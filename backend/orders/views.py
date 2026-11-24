import uuid
import logging
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsStaffOrAdmin, IsOwnerOrStaff
from loyalty.models import LoyaltyTransaction
from payments import xendit_service
from payments.resend_service import send_payment_receipt_email
from .models import Order
from .services import award_order_stamps_and_loyalty
from .serializers import (
    OrderSerializer,
    CreateOrderSerializer,
    UpdateOrderStatusSerializer,
)

logger = logging.getLogger(__name__)


class OrderPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    pagination_class = OrderPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Order.objects.none()

        is_staff_or_admin = (
            user.groups.filter(name__in=["staff", "admin"]).exists()
            or getattr(user, "is_staff", False)
            or getattr(user, "is_superuser", False)
        )

        mine_param = self.request.query_params.get("mine")
        customer_param = self.request.query_params.get("customer")

        # Strictly scope to current authenticated user's ID unless staff/admin explicitly requesting all
        if not is_staff_or_admin or mine_param in ("true", "1") or customer_param == "me":
            qs = Order.objects.filter(customer_id=user.id).select_related("customer", "customer__profile").prefetch_related("items", "payments")
        else:
            qs = Order.objects.all().select_related("customer", "customer__profile").prefetch_related("items", "payments")

        status_param = self.request.query_params.get("status")
        if status_param and status_param != "all":
            qs = qs.filter(status=status_param)

        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            from django.db.models import Q
            if search.isdigit():
                qs = qs.filter(Q(id=int(search)) | Q(customer__username__icontains=search) | Q(customer__email__icontains=search))
            else:
                qs = qs.filter(
                    Q(customer__username__icontains=search)
                    | Q(customer__email__icontains=search)
                    | Q(customer__first_name__icontains=search)
                    | Q(customer__last_name__icontains=search)
                )

        return qs.order_by("-created_at")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
        response["Pragma"] = "no-cache"
        return response

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        response["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
        response["Pragma"] = "no-cache"
        return response

    def get_permissions(self):
        if self.action in ("list", "retrieve", "create", "verify_payment", "cancel"):
            return [IsAuthenticated()]
        if self.action == "update_status":
            return [IsStaffOrAdmin()]
        return [IsOwnerOrStaff()]

    def create(self, request, *args, **kwargs):
        serializer = CreateOrderSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post", "patch"], url_path="status")
    def update_status(self, request, pk=None):
        order = self.get_object()
        serializer = UpdateOrderStatusSerializer(
            data=request.data,
            context={"order": order, "request": request},
        )
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]

        # If cancelling, restore stock
        if new_status == "cancelled":
            with transaction.atomic():
                for item in order.items.select_related("menu_item"):
                    if item.menu_item:
                        item.menu_item.stock_quantity += item.quantity
                        item.menu_item.save(update_fields=["stock_quantity"])
                order.status = new_status
                order.save(update_fields=["status", "updated_at"])
        else:
            order.status = new_status
            order.save(update_fields=["status", "updated_at"])
            if order.payment_status in ("PAID", "SETTLED"):
                award_order_stamps_and_loyalty(order)

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post", "patch"], url_path="cancel")
    def cancel(self, request, pk=None):
        order = self.get_object()

        # Check if already paid or settled
        is_paid = (
            order.payment_status in ("PAID", "SETTLED")
            or order.payments.filter(status="paid").exists()
        )
        if is_paid or order.status != "pending":
            return Response(
                {"detail": "Only unpaid pending orders can be canceled online."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Restore stock for each item
            for item in order.items.select_related("menu_item"):
                if item.menu_item:
                    item.menu_item.stock_quantity += item.quantity
                    item.menu_item.save(update_fields=["stock_quantity"])

            # If free treat was redeemed on unpaid order, restore the 10 stamps
            if order.free_treat_redeemed:
                profile = getattr(order.customer, "profile", None)
                if profile:
                    profile.stamps_count += 10
                    profile.free_treats_available = profile.stamps_count // 10
                    profile.save(update_fields=["stamps_count", "free_treats_available"])
                order.free_treat_redeemed = False

            order.status = "cancelled"
            order.save(update_fields=["status", "free_treat_redeemed", "updated_at"])

            # Expire any pending payments for this order
            for payment in order.payments.filter(status="pending"):
                payment.status = "expired"
                payment.save(update_fields=["status", "updated_at"])

        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="verify-payment")
    def verify_payment(self, request, pk=None):
        order = self.get_object()

        # If already paid and active, return current serialized order
        if order.payment_status in ("PAID", "SETTLED") and order.status != "pending":
            award_order_stamps_and_loyalty(order)
            paid_payment = order.payments.filter(status="paid").order_by("-paid_at", "-created_at").first()
            if paid_payment:
                send_payment_receipt_email(paid_payment)
            return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)

        payment = order.payments.order_by("-created_at").first()
        if not payment:
            return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)

        # If payment is already marked paid locally, sync order status
        if payment.status == "paid":
            order.payment_status = "PAID"
            if order.status == "pending":
                order.status = "preparing"
            order.save(update_fields=["payment_status", "status", "updated_at"])
            award_order_stamps_and_loyalty(order)
            send_payment_receipt_email(payment)
            return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)

        invoice_status = None
        invoice_data = {}

        # 1. Check by xendit_invoice_id if available
        if payment.xendit_invoice_id:
            try:
                invoice_data = xendit_service.get_invoice(payment.xendit_invoice_id)
                invoice_status = invoice_data.get("status", "").upper()
            except Exception as e:
                logger.warning("Failed to query Xendit invoice %s: %s", payment.xendit_invoice_id, e)

        # 2. Fallback check by external_id
        if not invoice_status and payment.reference_number:
            try:
                invoice_data = xendit_service.get_invoice_by_external_id(payment.reference_number)
                invoice_status = invoice_data.get("status", "").upper()
            except Exception as e:
                logger.warning("Failed to query Xendit by external_id %s: %s", payment.reference_number, e)

        if invoice_status in ("PAID", "SETTLED"):
            with transaction.atomic():
                payment.status = "paid"
                payment.paid_at = timezone.now()
                payment.raw_payload = invoice_data
                if not payment.receipt_number:
                    payment.receipt_number = f"RCP-{uuid.uuid4().hex[:10].upper()}"
                payment.save(update_fields=["status", "paid_at", "raw_payload", "receipt_number", "updated_at"])

                order.payment_status = "PAID"
                if order.status == "pending":
                    order.status = "preparing"
                order.save(update_fields=["payment_status", "status", "updated_at"])

                award_order_stamps_and_loyalty(order)

                # Deduplicate: clean up any other pending payment rows for this order
                from payments.models import Payment
                Payment.objects.filter(order=order, status="pending").exclude(pk=payment.pk).delete()
            send_payment_receipt_email(payment)
        elif invoice_status in ("EXPIRED", "FAILED"):
            payment.status = invoice_status.lower()
            payment.save(update_fields=["status", "updated_at"])
            order.payment_status = invoice_status
            order.save(update_fields=["payment_status", "updated_at"])

        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)
