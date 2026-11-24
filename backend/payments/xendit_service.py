"""
Xendit API integration service.
Uses httpx for HTTP calls to the Xendit REST API.
"""
import base64
import httpx
from django.conf import settings


def _auth_header():
    """Build Basic auth header from XENDIT_SECRET_KEY."""
    key = settings.XENDIT_SECRET_KEY
    token = base64.b64encode(f"{key}:".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def create_invoice(
    amount,
    external_id,
    description,
    payer_email,
    success_redirect_url,
    failure_redirect_url,
    invoice_duration=None,
    currency="PHP",
):
    """Create a Xendit invoice and return the JSON response."""
    payload = {
        "external_id": external_id,
        "amount": float(amount),
        "currency": currency,
        "description": description,
        "payer_email": payer_email,
        "success_redirect_url": success_redirect_url,
        "failure_redirect_url": failure_redirect_url,
    }
    if invoice_duration is not None:
        payload["invoice_duration"] = int(invoice_duration)

    resp = httpx.post(
        "https://api.xendit.co/v2/invoices",
        json=payload,
        headers=_auth_header(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def create_refund(invoice_id, amount, reason="REQUESTED_BY_CUSTOMER"):
    """Create a refund via Xendit and return the JSON response."""
    payload = {
        "invoice_id": invoice_id,
        "amount": float(amount),
        "reason": reason,
    }

    resp = httpx.post(
        "https://api.xendit.co/refunds",
        json=payload,
        headers=_auth_header(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_invoice(invoice_id):
    """Retrieve an invoice from Xendit by ID."""
    resp = httpx.get(
        f"https://api.xendit.co/v2/invoices/{invoice_id}",
        headers=_auth_header(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_invoice_by_external_id(external_id):
    """Retrieve invoices matching external_id."""
    resp = httpx.get(
        "https://api.xendit.co/v2/invoices",
        params={"external_id": external_id},
        headers=_auth_header(),
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, list) and len(data) > 0:
        return data[0]
    return data

