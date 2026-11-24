import uuid
import logging

from django.conf import settings
from django.db import transaction, models
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsStaffOrAdmin, IsAdmin
from loyalty.models import LoyaltyTransaction
from orders.models import Order
from catroom.models import CatRoomReservation

from .models import Payment
from .serializers import PaymentSerializer, CheckoutRequestSerializer, ReceiptSerializer
from . import xendit_service
from .resend_service import send_payment_receipt_email

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
#  Pagination & Deduplication Helpers
# ------------------------------------------------------------------ #
class PaymentPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


def deduplicate_payments():
    """
    Deduplicates Payment records per order and per reservation:
    - If a Paid (or Refunded) payment exists: keep it and delete all other Pending payment rows for that order/reservation.
    - If none are Paid/Refunded yet: keep only the single most recent Pending payment row and delete older Pending rows.
    Returns the count of deleted duplicate rows.
    """
    deleted_count = 0

    # 1. Orders with multiple payments
    order_ids = (
        Payment.objects.exclude(order__isnull=True)
        .values("order_id")
        .annotate(cnt=models.Count("id"))
        .filter(cnt__gt=1)
        .values_list("order_id", flat=True)
    )
    for oid in order_ids:
        qs = Payment.objects.filter(order_id=oid).order_by("-paid_at", "-created_at")
        paid_or_refunded = qs.filter(status__in=["paid", "refunded"]).first()
        if paid_or_refunded:
            count, _ = qs.filter(status="pending").exclude(pk=paid_or_refunded.pk).delete()
            deleted_count += count
        else:
            latest_pending = qs.filter(status="pending").first()
            if latest_pending:
                count, _ = qs.filter(status="pending").exclude(pk=latest_pending.pk).delete()
                deleted_count += count

    # 2. Reservations with multiple payments
    res_ids = (
        Payment.objects.exclude(reservation__isnull=True)
        .values("reservation_id")
        .annotate(cnt=models.Count("id"))
        .filter(cnt__gt=1)
        .values_list("reservation_id", flat=True)
    )
    for rid in res_ids:
        qs = Payment.objects.filter(reservation_id=rid).order_by("-paid_at", "-created_at")
        paid_or_refunded = qs.filter(status__in=["paid", "refunded"]).first()
        if paid_or_refunded:
            count, _ = qs.filter(status="pending").exclude(pk=paid_or_refunded.pk).delete()
            deleted_count += count
        else:
            latest_pending = qs.filter(status="pending").first()
            if latest_pending:
                count, _ = qs.filter(status="pending").exclude(pk=latest_pending.pk).delete()
                deleted_count += count

    return deleted_count


def sync_pending_xendit_payments():
    """
    Checks any Pending Xendit transactions against Xendit's Invoices API
    and updates them to Paid (or Expired/Failed) if settled.
    Then deduplicates existing records.
    Returns (updated_count, deduplicated_count).
    """
    updated_count = 0
    pending_payments = Payment.objects.filter(status="pending", method="xendit")

    for payment in pending_payments:
        invoice_data = None
        if payment.xendit_invoice_id:
            try:
                invoice_data = xendit_service.get_invoice(payment.xendit_invoice_id)
            except Exception as e:
                logger.warning("Sync failed to fetch Xendit invoice %s: %s", payment.xendit_invoice_id, e)
        if not invoice_data and payment.reference_number:
            try:
                invoice_data = xendit_service.get_invoice_by_external_id(payment.reference_number)
            except Exception as e:
                logger.warning("Sync failed to fetch Xendit invoice by ref %s: %s", payment.reference_number, e)

        if not invoice_data or not isinstance(invoice_data, dict):
            continue

        x_status = invoice_data.get("status", "").upper()
        if x_status in ("PAID", "SETTLED"):
            with transaction.atomic():
                payment.status = "paid"
                payment.paid_at = timezone.now()
                payment.raw_payload = invoice_data
                if not payment.receipt_number:
                    payment.receipt_number = f"RCP-{uuid.uuid4().hex[:10].upper()}"
                payment.save(update_fields=["status", "paid_at", "raw_payload", "receipt_number", "updated_at"])

                # Sync order
                if payment.order:
                    payment.order.payment_status = "PAID"
                    if payment.order.status == "pending":
                        payment.order.status = "preparing"
                    payment.order.save(update_fields=["payment_status", "status", "updated_at"])
                    from orders.services import award_order_stamps_and_loyalty
                    award_order_stamps_and_loyalty(payment.order)
                    Payment.objects.filter(order=payment.order, status="pending").exclude(pk=payment.pk).delete()

                # Sync reservation
                if payment.reservation:
                    if payment.reservation.status == "pending_payment":
                        payment.reservation.status = "confirmed"
                        payment.reservation.save(update_fields=["status", "updated_at"])
                    if not LoyaltyTransaction.objects.filter(reservation=payment.reservation).exists():
                        points = int(payment.amount // 10)
                        if points > 0:
                            from accounts.models import Profile
                            prof, _ = Profile.objects.get_or_create(user=payment.customer)
                            prof.paw_points += points
                            prof.lifetime_paw_points += points
                            prof.loyalty_points = prof.paw_points
                            prof.save(update_fields=["paw_points", "lifetime_paw_points", "loyalty_points"])
                            LoyaltyTransaction.objects.create(
                                user=payment.customer,
                                points=points,
                                reason=f"Reservation payment {payment.reference_number}",
                                reservation=payment.reservation,
                            )
                    Payment.objects.filter(reservation=payment.reservation, status="pending").exclude(pk=payment.pk).delete()
                updated_count += 1
            send_payment_receipt_email(payment)

        elif x_status == "EXPIRED":
            payment.status = "expired"
            payment.raw_payload = invoice_data
            payment.save(update_fields=["status", "raw_payload", "updated_at"])
            if payment.order and payment.order.payment_status == "UNPAID":
                payment.order.payment_status = "EXPIRED"
                payment.order.save(update_fields=["payment_status", "updated_at"])
            if payment.reservation and payment.reservation.status == "pending_payment":
                payment.reservation.status = "cancelled"
                payment.reservation.save(update_fields=["status", "updated_at"])
            updated_count += 1

        elif x_status == "FAILED":
            payment.status = "failed"
            payment.raw_payload = invoice_data
            payment.save(update_fields=["status", "raw_payload", "updated_at"])
            if payment.order and payment.order.payment_status == "UNPAID":
                payment.order.payment_status = "FAILED"
                payment.order.save(update_fields=["payment_status", "updated_at"])
            if payment.reservation and payment.reservation.status == "pending_payment":
                payment.reservation.status = "cancelled"
                payment.reservation.save(update_fields=["status", "updated_at"])
            updated_count += 1

    dedup_count = deduplicate_payments()
    return updated_count, dedup_count


# ------------------------------------------------------------------ #
#  Sync Payments View (Admin & Staff)
# ------------------------------------------------------------------ #
class SyncPaymentsView(APIView):
    permission_classes = [IsStaffOrAdmin]

    def post(self, request):
        updated_count, dedup_count = sync_pending_xendit_payments()
        return Response(
            {
                "detail": "Payments synced and deduplicated successfully.",
                "updated_count": updated_count,
                "deduplicated_count": dedup_count,
            },
            status=status.HTTP_200_OK,
        )


# ------------------------------------------------------------------ #
#  Read-only viewset
# ------------------------------------------------------------------ #
class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for payments with search, filtering, sorting, and pagination for staff/admin."""
    serializer_class = PaymentSerializer
    pagination_class = PaymentPagination

    def get_queryset(self):
        user = self.request.user
        if (
            user.groups.filter(name__in=["staff", "admin"]).exists()
            or user.is_staff
            or user.is_superuser
        ):
            deduplicate_payments()
            qs = Payment.objects.all().select_related("customer", "order", "reservation")
        else:
            qs = Payment.objects.filter(customer=user).select_related("customer", "order", "reservation")

        # Filters
        status_param = self.request.query_params.get("status")
        if status_param and status_param != "all":
            qs = qs.filter(status=status_param)

        method_param = self.request.query_params.get("method")
        if method_param and method_param != "all":
            qs = qs.filter(method=method_param)

        type_param = self.request.query_params.get("type")
        if type_param == "order":
            qs = qs.filter(order__isnull=False)
        elif type_param == "reservation":
            qs = qs.filter(reservation__isnull=False)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            qs = qs.filter(
                models.Q(reference_number__icontains=search)
                | models.Q(customer__username__icontains=search)
                | models.Q(customer__email__icontains=search)
                | models.Q(customer__first_name__icontains=search)
                | models.Q(customer__last_name__icontains=search)
            )

        # Sorting
        sort = (
            self.request.query_params.get("sort")
            or self.request.query_params.get("ordering")
            or "date_desc"
        )

        status_order = models.Case(
            models.When(status="pending", then=models.Value(1)),
            models.When(status="paid", then=models.Value(2)),
            models.When(status="refunded", then=models.Value(3)),
            models.When(status="failed", then=models.Value(4)),
            models.When(status="expired", then=models.Value(5)),
            default=models.Value(6),
            output_field=models.IntegerField(),
        )

        if sort in ("date_asc", "created_at"):
            qs = qs.order_by("created_at")
        elif sort in ("amount_desc", "-amount"):
            qs = qs.order_by("-amount", "-created_at")
        elif sort in ("amount_asc", "amount"):
            qs = qs.order_by("amount", "-created_at")
        elif sort in ("status", "status_asc"):
            qs = qs.annotate(_status_rank=status_order).order_by("_status_rank", "-created_at")
        elif sort in ("status_desc", "-status"):
            qs = qs.annotate(_status_rank=status_order).order_by("-_status_rank", "-created_at")
        else:  # date_desc, -created_at, or default
            qs = qs.order_by("-created_at")

        return qs

    def get_permissions(self):
        return [IsAuthenticated()]


# ------------------------------------------------------------------ #
#  Checkout
# ------------------------------------------------------------------ #
class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = CheckoutRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        checkout_type = ser.validated_data["type"]
        obj_id = ser.validated_data["id"]
        user = request.user

        order = None
        reservation = None
        invoice_duration = None

        if checkout_type == "order":
            try:
                order = Order.objects.get(pk=obj_id, customer=user)
            except Order.DoesNotExist:
                return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
            if order.status != "pending":
                return Response({"detail": "Order is not pending."}, status=status.HTTP_400_BAD_REQUEST)
            amount = order.total
            target_filter = {"order": order}

        else:  # reservation
            try:
                reservation = CatRoomReservation.objects.get(pk=obj_id, customer=user)
            except CatRoomReservation.DoesNotExist:
                return Response({"detail": "Reservation not found."}, status=status.HTTP_404_NOT_FOUND)
            if reservation.status != "pending_payment":
                return Response({"detail": "Reservation is not pending payment."}, status=status.HTTP_400_BAD_REQUEST)
            if reservation.hold_expires_at and reservation.hold_expires_at <= timezone.now():
                return Response({"detail": "Reservation hold has expired."}, status=status.HTTP_400_BAD_REQUEST)
            amount = reservation.amount_due
            # Calculate remaining hold seconds (minimum 60)
            if reservation.hold_expires_at:
                remaining = (reservation.hold_expires_at - timezone.now()).total_seconds()
                invoice_duration = max(int(remaining), 60)
            target_filter = {"reservation": reservation}

        # Check existing payments for this order/reservation
        existing_payments = Payment.objects.filter(**target_filter).order_by("-created_at")
        existing_payment = existing_payments.first()

        if existing_payment:
            # If already paid locally
            if existing_payment.status == "paid":
                existing_payments.filter(status="pending").exclude(pk=existing_payment.pk).delete()
                return Response(
                    {
                        "payment_id": existing_payment.pk,
                        "status": "paid",
                        "reference_number": existing_payment.reference_number,
                        "detail": "Payment already completed.",
                    },
                    status=status.HTTP_200_OK,
                )

            # Check if active unexpired pending Xendit invoice exists
            if existing_payment.status == "pending" and existing_payment.xendit_invoice_id:
                try:
                    invoice_data = xendit_service.get_invoice(existing_payment.xendit_invoice_id)
                    inv_status = invoice_data.get("status", "").upper()
                    if inv_status == "PENDING" and invoice_data.get("invoice_url"):
                        # Clean up other duplicate pending rows
                        existing_payments.filter(status="pending").exclude(pk=existing_payment.pk).delete()
                        return Response(
                            {
                                "payment_id": existing_payment.pk,
                                "invoice_url": invoice_data.get("invoice_url"),
                                "reference_number": existing_payment.reference_number,
                            },
                            status=status.HTTP_200_OK,
                        )
                    elif inv_status in ("PAID", "SETTLED"):
                        with transaction.atomic():
                            existing_payment.status = "paid"
                            existing_payment.paid_at = timezone.now()
                            existing_payment.raw_payload = invoice_data
                            if not existing_payment.receipt_number:
                                existing_payment.receipt_number = f"RCP-{uuid.uuid4().hex[:10].upper()}"
                            existing_payment.save(update_fields=["status", "paid_at", "raw_payload", "receipt_number", "updated_at"])
                            if order:
                                order.payment_status = "PAID"
                                if order.status == "pending":
                                    order.status = "preparing"
                                order.save(update_fields=["payment_status", "status", "updated_at"])
                                from orders.services import award_order_stamps_and_loyalty
                                award_order_stamps_and_loyalty(order)
                            elif reservation:
                                reservation.status = "confirmed"
                                reservation.save(update_fields=["status", "updated_at"])
                            existing_payments.filter(status="pending").exclude(pk=existing_payment.pk).delete()
                        send_payment_receipt_email(existing_payment)
                        return Response(
                            {
                                "payment_id": existing_payment.pk,
                                "status": "paid",
                                "reference_number": existing_payment.reference_number,
                                "detail": "Payment already completed.",
                            },
                            status=status.HTTP_200_OK,
                        )
                except Exception as e:
                    logger.warning("Failed to check active invoice for existing payment %s: %s", existing_payment.pk, e)

        # Upsert or create payment record
        payer_email = user.email or f"{user.username}@placeholder.local"
        description = (
            f"Order #{order.pk}" if order else f"Cat Room Reservation #{reservation.pk}"
        )

        is_new_record = False
        if existing_payment and existing_payment.status != "paid":
            # Update (upsert) existing record in place with new transId and reference_number
            payment = existing_payment
            payment.amount = amount
            payment.status = "pending"
            payment.method = "xendit"
            payment.transaction_id = uuid.uuid4()
            payment.reference_number = f"CATOPIA-{uuid.uuid4().hex[:12].upper()}"
            payment.save(update_fields=["amount", "status", "method", "transaction_id", "reference_number", "updated_at"])
            existing_payments.filter(status="pending").exclude(pk=payment.pk).delete()
        else:
            payment = Payment.objects.create(
                customer=user,
                order=order,
                reservation=reservation,
                amount=amount,
                method="xendit",
            )
            is_new_record = True

        # Build redirect URLs
        base = settings.FRONTEND_BASE_URL.rstrip("/")
        if order:
            success_url = f"{base}/orders/{order.pk}?payment=success"
            failure_url = f"{base}/orders/{order.pk}?payment=failed"
        else:
            success_url = f"{base}/payment/success?payment_id={payment.pk}"
            failure_url = f"{base}/payment/failed?payment_id={payment.pk}"

        try:
            invoice = xendit_service.create_invoice(
                amount=amount,
                external_id=payment.reference_number,
                description=description,
                payer_email=payer_email,
                success_redirect_url=success_url,
                failure_redirect_url=failure_url,
                invoice_duration=invoice_duration,
            )
        except Exception:
            logger.exception("Xendit create_invoice failed")
            payment.status = "failed"
            payment.save(update_fields=["status", "updated_at"])
            return Response(
                {"detail": "Payment gateway error."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.xendit_invoice_id = invoice.get("id", "")
        payment.save(update_fields=["xendit_invoice_id", "updated_at"])

        return Response(
            {
                "payment_id": payment.pk,
                "invoice_url": invoice.get("invoice_url", ""),
                "reference_number": payment.reference_number,
            },
            status=status.HTTP_201_CREATED if is_new_record else status.HTTP_200_OK,
        )


# ------------------------------------------------------------------ #
#  Xendit Webhook
# ------------------------------------------------------------------ #
class XenditWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        # Verify callback token
        token = request.headers.get("X-Callback-Token", "")
        if token != settings.XENDIT_WEBHOOK_TOKEN:
            return Response({"detail": "Invalid token."}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        external_id = data.get("external_id", "")
        xendit_status = data.get("status", "").upper()

        try:
            payment = Payment.objects.get(reference_number=external_id)
        except Payment.DoesNotExist:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)

        # Idempotency: if already in terminal state, return 200
        if payment.status in ("paid", "refunded"):
            return Response({"detail": "Already processed."}, status=status.HTTP_200_OK)

        if xendit_status in ("PAID", "SETTLED"):
            with transaction.atomic():
                payment.status = "paid"
                payment.paid_at = timezone.now()
                payment.raw_payload = data
                payment.receipt_number = f"RCP-{uuid.uuid4().hex[:10].upper()}"
                payment.save(update_fields=[
                    "status", "paid_at", "raw_payload", "receipt_number", "updated_at",
                ])

                # Confirm reservation if applicable
                if payment.reservation and payment.reservation.status == "pending_payment":
                    payment.reservation.status = "confirmed"
                    payment.reservation.save(update_fields=["status", "updated_at"])

                # Update order if applicable and award stamps & points idempotently
                if payment.order:
                    payment.order.payment_status = "PAID"
                    if payment.order.status == "pending":
                        payment.order.status = "preparing"
                    payment.order.save(update_fields=["payment_status", "status", "updated_at"])
                    from orders.services import award_order_stamps_and_loyalty
                    award_order_stamps_and_loyalty(payment.order)

                # Award loyalty points for reservations (1 paw point per ₱10)
                if payment.reservation and not LoyaltyTransaction.objects.filter(reservation=payment.reservation).exists():
                    points = int(payment.amount // 10)
                    if points > 0:
                        from accounts.models import Profile
                        prof, _ = Profile.objects.get_or_create(user=payment.customer)
                        prof.paw_points += points
                        prof.lifetime_paw_points += points
                        prof.loyalty_points = prof.paw_points
                        prof.save(update_fields=["paw_points", "lifetime_paw_points", "loyalty_points"])
                        LoyaltyTransaction.objects.create(
                            user=payment.customer,
                            points=points,
                            reason=f"Reservation payment {payment.reference_number}",
                            reservation=payment.reservation,
                        )

                # Deduplicate: remove any other pending payments for this order or reservation
                if payment.order:
                    Payment.objects.filter(order=payment.order, status="pending").exclude(pk=payment.pk).delete()
                elif payment.reservation:
                    Payment.objects.filter(reservation=payment.reservation, status="pending").exclude(pk=payment.pk).delete()

            send_payment_receipt_email(payment)

        elif xendit_status == "EXPIRED":
            payment.status = "expired"
            payment.raw_payload = data
            payment.save(update_fields=["status", "raw_payload", "updated_at"])

            if payment.reservation and payment.reservation.status == "pending_payment":
                payment.reservation.status = "cancelled"
                payment.reservation.save(update_fields=["status", "updated_at"])

            if payment.order and payment.order.payment_status == "UNPAID":
                payment.order.payment_status = "EXPIRED"
                payment.order.save(update_fields=["payment_status", "updated_at"])

        elif xendit_status == "FAILED":
            payment.status = "failed"
            payment.raw_payload = data
            payment.save(update_fields=["status", "raw_payload", "updated_at"])

            if payment.reservation and payment.reservation.status == "pending_payment":
                payment.reservation.status = "cancelled"
                payment.reservation.save(update_fields=["status", "updated_at"])

            if payment.order and payment.order.payment_status == "UNPAID":
                payment.order.payment_status = "FAILED"
                payment.order.save(update_fields=["payment_status", "updated_at"])

        return Response({"detail": "OK"}, status=status.HTTP_200_OK)


# ------------------------------------------------------------------ #
#  Receipt
# ------------------------------------------------------------------ #
class ReceiptView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            payment = Payment.objects.get(pk=pk)
        except Payment.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check ownership or staff
        is_owner = payment.customer == request.user
        is_staff = (
            request.user.groups.filter(name__in=["staff", "admin"]).exists()
            or request.user.is_superuser
        )
        if not (is_owner or is_staff):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        if payment.status != "paid":
            return Response({"detail": "Receipt only available for paid payments."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ReceiptSerializer(payment)
        return Response(serializer.data)


# ------------------------------------------------------------------ #
#  Refund (Admin Only)
# ------------------------------------------------------------------ #
class RefundView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            payment = Payment.objects.get(pk=pk)
        except Payment.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if payment.status != "paid":
            return Response({"detail": "Only paid payments can be refunded."}, status=status.HTTP_400_BAD_REQUEST)

        audit_note = request.data.get("audit_note", "").strip()
        payment.status = "refunded"
        payment.audit_note = audit_note
        payment.save(update_fields=["status", "audit_note", "updated_at"])

        if payment.reservation:
            payment.reservation.status = "cancelled"
            payment.reservation.save(update_fields=["status", "updated_at"])

        if payment.order:
            payment.order.payment_status = "REFUNDED"
            payment.order.save(update_fields=["payment_status", "updated_at"])
            if getattr(payment.order, "points_credited", False):
                points_to_deduct = int(payment.order.total // 10)
                profile = getattr(payment.customer, "profile", None)
                if profile and points_to_deduct > 0:
                    profile.paw_points = max(0, profile.paw_points - points_to_deduct)
                    profile.lifetime_paw_points = max(0, profile.lifetime_paw_points - points_to_deduct)
                    profile.loyalty_points = profile.paw_points
                    profile.save(update_fields=["paw_points", "lifetime_paw_points", "loyalty_points"])
                    LoyaltyTransaction.objects.create(
                        user=payment.customer,
                        points=-points_to_deduct,
                        reason=f"Order #{payment.order.pk} refund point deduction: {audit_note or 'Admin refund'}",
                        order=payment.order,
                    )

        # Best-effort refund via Xendit
        try:
            xendit_service.create_refund(
                invoice_id=payment.xendit_invoice_id,
                amount=payment.amount,
            )
        except Exception:
            logger.exception("Xendit refund failed (best-effort)")

        serializer = PaymentSerializer(payment)
        return Response(serializer.data)


# ------------------------------------------------------------------ #
#  Payment Status Polling
# ------------------------------------------------------------------ #
class PaymentStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            payment = Payment.objects.get(pk=pk, customer=request.user)
        except Payment.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if payment.status == "paid":
            send_payment_receipt_email(payment)
        elif payment.status == "pending" and payment.method == "xendit":
            invoice_data = None
            if payment.xendit_invoice_id:
                try:
                    invoice_data = xendit_service.get_invoice(payment.xendit_invoice_id)
                except Exception:
                    pass
            if not invoice_data and payment.reference_number:
                try:
                    invoice_data = xendit_service.get_invoice_by_external_id(payment.reference_number)
                except Exception:
                    pass

            if invoice_data and isinstance(invoice_data, dict):
                x_status = invoice_data.get("status", "").upper()
                if x_status in ("PAID", "SETTLED"):
                    with transaction.atomic():
                        payment.status = "paid"
                        payment.paid_at = timezone.now()
                        payment.raw_payload = invoice_data
                        if not payment.receipt_number:
                            payment.receipt_number = f"RCP-{uuid.uuid4().hex[:10].upper()}"
                        payment.save(update_fields=["status", "paid_at", "raw_payload", "receipt_number", "updated_at"])

                        if payment.order:
                            payment.order.payment_status = "PAID"
                            if payment.order.status == "pending":
                                payment.order.status = "preparing"
                            payment.order.save(update_fields=["payment_status", "status", "updated_at"])
                            from orders.services import award_order_stamps_and_loyalty
                            award_order_stamps_and_loyalty(payment.order)
                            Payment.objects.filter(order=payment.order, status="pending").exclude(pk=payment.pk).delete()
                        elif payment.reservation:
                            if payment.reservation.status == "pending_payment":
                                payment.reservation.status = "confirmed"
                                payment.reservation.save(update_fields=["status", "updated_at"])
                            if not LoyaltyTransaction.objects.filter(reservation=payment.reservation).exists():
                                points = int(payment.amount // 10)
                                if points > 0:
                                    from accounts.models import Profile
                                    prof, _ = Profile.objects.get_or_create(user=payment.customer)
                                    prof.paw_points += points
                                    prof.lifetime_paw_points += points
                                    prof.loyalty_points = prof.paw_points
                                    prof.save(update_fields=["paw_points", "lifetime_paw_points", "loyalty_points"])
                                    LoyaltyTransaction.objects.create(
                                        user=payment.customer,
                                        points=points,
                                        reason=f"Reservation payment {payment.reference_number}",
                                        reservation=payment.reservation,
                                    )
                            Payment.objects.filter(reservation=payment.reservation, status="pending").exclude(pk=payment.pk).delete()
                    send_payment_receipt_email(payment)

        serializer = PaymentSerializer(payment)
        return Response(serializer.data)
