"""
Resend API integration service for emailing payment receipts to customers
after any successful Order or Cat Room Reservation payment.
"""
from datetime import datetime, timedelta
import html
import logging

import httpx
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Payment

logger = logging.getLogger(__name__)

RESEND_EMAILS_URL = "https://api.resend.com/emails"


def _format_php(amount):
    try:
        val = float(amount or 0)
    except (ValueError, TypeError):
        val = 0.0
    return f"₱{val:,.2f}"


def _build_receipt_email_content(payment):
    """
    Build the subject, HTML body, and plain-text body for a paid Payment
    (supporting both Café Orders and Cat Room Reservations).
    """
    cafe_name = getattr(settings, "CAFE_NAME", "Catopia Café")
    cafe_address = getattr(settings, "CAFE_ADDRESS", "")
    cafe_phone = getattr(settings, "CAFE_PHONE", "")
    frontend_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")

    customer = payment.customer
    customer_name = (
        f"{customer.first_name} {customer.last_name}".strip()
        if customer
        else ""
    ) or (customer.username if customer else "Valued Guest")

    receipt_no = payment.receipt_number or payment.reference_number
    reference_no = payment.reference_number
    transaction_id = str(payment.transaction_id)
    paid_dt = timezone.localtime(payment.paid_at) if payment.paid_at else timezone.localtime()
    paid_date_str = paid_dt.strftime("%b %d, %Y, %I:%M %p")
    total_str = _format_php(payment.amount)
    method_label = (payment.method or "Xendit").capitalize()
    receipt_url = f"{frontend_base}/payment/{payment.pk}/receipt"

    is_order = bool(payment.order_id and payment.order)
    is_reservation = bool(payment.reservation_id and payment.reservation)

    if is_order:
        order = payment.order
        subject = f"{cafe_name} Payment Receipt — Order #{order.pk} ({receipt_no})"
        section_title = f"Café Order #{order.pk}"

        rows_html = []
        text_lines = [f"Order #{order.pk} Items:"]
        for item in order.items.all():
            variant = f" ({item.size} {item.temperature})".strip() if (getattr(item, "size", "") or getattr(item, "temperature", "")) else ""
            item_label = f"{item.name}{variant}"
            line_total_str = _format_php(item.line_total)
            rows_html.append(
                f"""
                <tr>
                  <td style="padding:8px 0;color:#2D221B;font-size:14px;border-bottom:1px solid #F2ECE4;">
                    <strong>{html.escape(item_label)}</strong>
                    <span style="color:#7A6A5E;font-size:12px;"> &times; {item.quantity}</span>
                  </td>
                  <td style="padding:8px 0;color:#2D221B;font-size:14px;text-align:right;font-weight:600;border-bottom:1px solid #F2ECE4;">
                    {html.escape(line_total_str)}
                  </td>
                </tr>
                """
            )
            text_lines.append(f"  - {item_label} x{item.quantity}: {line_total_str}")

        details_table_html = f"""
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;">
          {''.join(rows_html)}
        </table>
        """
        details_text = "\n".join(text_lines)

    elif is_reservation:
        res = payment.reservation
        subject = f"{cafe_name} Payment Receipt — Cat Room Reservation #{res.pk} ({receipt_no})"
        section_title = f"Cat Room Reservation #{res.pk}"

        slot_start_dt = datetime.combine(res.date, res.slot_start)
        slot_end_dt = slot_start_dt + timedelta(hours=1)
        slot_str = f"{res.slot_start.strftime('%H:%M')} – {slot_end_dt.time().strftime('%H:%M')}"
        plan_str = "50% Deposit" if res.payment_option == "deposit" else "Full Payment"
        fee_str = _format_php(res.fee)

        details_table_html = f"""
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;">
          <tr>
            <td style="padding:6px 0;color:#7A6A5E;font-size:14px;">Date</td>
            <td style="padding:6px 0;color:#2D221B;font-size:14px;text-align:right;font-weight:600;">{html.escape(str(res.date))}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#7A6A5E;font-size:14px;">Time Slot</td>
            <td style="padding:6px 0;color:#2D221B;font-size:14px;text-align:right;font-weight:600;">{html.escape(slot_str)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#7A6A5E;font-size:14px;">Visitors</td>
            <td style="padding:6px 0;color:#2D221B;font-size:14px;text-align:right;font-weight:600;">{res.visitors}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#7A6A5E;font-size:14px;">Session Fee</td>
            <td style="padding:6px 0;color:#2D221B;font-size:14px;text-align:right;font-weight:600;">{html.escape(fee_str)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#7A6A5E;font-size:14px;">Payment Plan</td>
            <td style="padding:6px 0;color:#2D221B;font-size:14px;text-align:right;font-weight:600;">{html.escape(plan_str)}</td>
          </tr>
        </table>
        """
        details_text = (
            f"Cat Room Reservation #{res.pk}:\n"
            f"  - Date: {res.date}\n"
            f"  - Time Slot: {slot_str}\n"
            f"  - Visitors: {res.visitors}\n"
            f"  - Session Fee: {fee_str}\n"
            f"  - Payment Plan: {plan_str}"
        )
    else:
        subject = f"{cafe_name} Payment Receipt ({receipt_no})"
        section_title = "Payment Summary"
        details_table_html = ""
        details_text = ""

    html_body = f"""
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background-color:#FAF6F0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#2D221B;">
        <div style="max-width:560px;margin:24px auto;background-color:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E8DFD5;box-shadow:0 6px 24px rgba(45,34,27,0.08);">
          <div style="background-color:#2D221B;padding:28px 24px;text-align:center;color:#FFFFFF;">
            <h1 style="margin:0;font-size:22px;letter-spacing:0.5px;">{html.escape(cafe_name)}</h1>
            <p style="margin:6px 0 0;color:#34D399;font-size:14px;font-weight:600;">&#10003; Official Payment Receipt</p>
          </div>

          <div style="padding:24px 28px;">
            <p style="margin:0 0 16px;font-size:14px;color:#2D221B;">
              Hi <strong>{html.escape(customer_name)}</strong>, thank you for your payment! Here is your official receipt from {html.escape(cafe_name)}.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF6F0;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#7A6A5E;">Receipt No.</td>
                <td style="padding:4px 0;font-size:13px;color:#C47D4E;font-weight:700;text-align:right;font-family:monospace;">{html.escape(receipt_no)}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#7A6A5E;">Date Paid</td>
                <td style="padding:4px 0;font-size:12px;color:#2D221B;font-weight:600;text-align:right;">{html.escape(paid_date_str)}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#7A6A5E;">Reference</td>
                <td style="padding:4px 0;font-size:12px;color:#2D221B;font-weight:600;text-align:right;font-family:monospace;">{html.escape(reference_no)}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#7A6A5E;">Transaction ID</td>
                <td style="padding:4px 0;font-size:12px;color:#2D221B;font-weight:600;text-align:right;font-family:monospace;">{html.escape(transaction_id[:18])}...</td>
              </tr>
            </table>

            <h3 style="margin:0 0 8px;font-size:15px;color:#2D221B;border-bottom:1px solid #E8DFD5;padding-bottom:6px;">
              {html.escape(section_title)}
            </h3>
            {details_table_html}

            <div style="margin-top:20px;padding-top:14px;border-top:2px solid #E8DFD5;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:#7A6A5E;">Payment Method</td>
                  <td style="padding:4px 0;font-size:13px;color:#2D221B;font-weight:600;text-align:right;">{html.escape(method_label)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0 0;font-size:16px;color:#2D221B;font-weight:700;">Total Paid</td>
                  <td style="padding:8px 0 0;font-size:22px;color:#C47D4E;font-weight:800;text-align:right;">PHP {float(payment.amount or 0):,.2f}</td>
                </tr>
              </table>
            </div>

            <div style="text-align:center;margin:24px 0 12px;">
              <a href="{html.escape(receipt_url)}"
                 style="display:inline-block;background-color:#C47D4E;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:999px;">
                View &amp; Print Online Receipt
              </a>
            </div>

            <p style="margin:18px 0 0;text-align:center;font-size:12px;color:#7A6A5E;line-height:1.5;">
              Thank you for visiting {html.escape(cafe_name)}!<br/>
              Coffee for the humans, chin scratches for the cats.<br/>
              {html.escape(cafe_address)} {f'• {html.escape(cafe_phone)}' if cafe_phone else ''}
            </p>
          </div>
        </div>
      </body>
    </html>
    """

    text_body = (
        f"{cafe_name} — Official Payment Receipt\n"
        f"========================================\n"
        f"Hi {customer_name},\n\n"
        f"Thank you for your payment!\n\n"
        f"Receipt No.    : {receipt_no}\n"
        f"Date Paid      : {paid_date_str}\n"
        f"Reference      : {reference_no}\n"
        f"Transaction ID : {transaction_id}\n"
        f"Payment Method : {method_label}\n\n"
        f"{details_text}\n\n"
        f"TOTAL PAID     : PHP {float(payment.amount or 0):,.2f}\n\n"
        f"View Online Receipt: {receipt_url}\n\n"
        f"Thank you for visiting {cafe_name}!\n"
    )

    return subject, html_body, text_body


def send_payment_receipt_email(payment):
    """
    Send the payment receipt directly to the customer's email (e.g., Gmail) via Resend API.
    Idempotent: records `receipt_email_sent: True` in `payment.raw_payload` so multiple
    webhooks/polls never send duplicate emails for the same payment.
    Returns True if sent (or already sent), False otherwise.
    """
    if not payment or payment.status != "paid":
        return False

    customer = getattr(payment, "customer", None)
    recipient_email = (getattr(customer, "email", "") or "").strip()

    # Fallback to payer_email in raw_payload if customer.email is blank
    if not recipient_email and isinstance(payment.raw_payload, dict):
        recipient_email = (payment.raw_payload.get("payer_email") or "").strip()

    if not recipient_email or recipient_email.endswith("@placeholder.local"):
        logger.warning(
            "Skipping Resend receipt email for Payment %s: customer has no valid email address.",
            payment.reference_number,
        )
        return False

    api_key = getattr(settings, "RESEND_API_KEY", "").strip()
    if not api_key:
        logger.warning(
            "RESEND_API_KEY is not configured in settings/.env. Cannot send receipt email for Payment %s to %s.",
            payment.reference_number,
            recipient_email,
        )
        return False

    from_email = (
        getattr(settings, "RESEND_FROM_EMAIL", "").strip()
        or "Catopia Café <onboarding@resend.dev>"
    )

    # Quick non-locking check first
    if isinstance(payment.raw_payload, dict) and (
        payment.raw_payload.get("receipt_email_sent")
        or payment.raw_payload.get("receipt_email_attempted")
    ):
        return True

    # Short atomic claim so we NEVER hold a database lock while making external HTTP calls
    try:
        with transaction.atomic():
            locked_payment = (
                Payment.objects.select_for_update()
                .select_related("customer", "order", "reservation")
                .get(pk=payment.pk)
            )
            payload_data = (
                dict(locked_payment.raw_payload)
                if isinstance(locked_payment.raw_payload, dict)
                else {}
            )
            if payload_data.get("receipt_email_sent") or payload_data.get("receipt_email_attempted"):
                payment.raw_payload = payload_data
                return True

            payload_data["receipt_email_attempted"] = True
            locked_payment.raw_payload = payload_data
            locked_payment.save(update_fields=["raw_payload", "updated_at"])
            payment.raw_payload = payload_data
            subject, html_body, text_body = _build_receipt_email_content(locked_payment)
    except Exception as exc:
        logger.warning("Skipping receipt email claim for Payment %s: %s", payment.pk, exc)
        return False

    resend_payload = {
        "from": from_email,
        "to": [recipient_email],
        "subject": subject,
        "html": html_body,
        "text": text_body,
    }

    try:
        resp = httpx.post(
            RESEND_EMAILS_URL,
            json=resend_payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        resp_data = resp.json()
    except Exception as exc:
        logger.warning(
            "Failed to send receipt email via Resend for Payment %s to %s: %s",
            payment.reference_number,
            recipient_email,
            exc,
        )
        return False

    try:
        with transaction.atomic():
            locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
            updated_payload = (
                dict(locked_payment.raw_payload)
                if isinstance(locked_payment.raw_payload, dict)
                else {}
            )
            updated_payload["receipt_email_sent"] = True
            updated_payload["receipt_email_to"] = recipient_email
            if isinstance(resp_data, dict) and resp_data.get("id"):
                updated_payload["resend_email_id"] = resp_data["id"]

            locked_payment.raw_payload = updated_payload
            locked_payment.save(update_fields=["raw_payload", "updated_at"])
            payment.raw_payload = updated_payload
    except Exception as exc:
        logger.warning("Failed to persist receipt email metadata for Payment %s: %s", payment.pk, exc)

    logger.info(
        "Sent payment receipt email (%s) via Resend to %s for Payment %s",
        payment.receipt_number,
        recipient_email,
        payment.reference_number,
    )
    return True
