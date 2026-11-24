from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    payment_type = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id", "transaction_id", "xendit_invoice_id", "reference_number",
            "customer", "customer_name", "customer_email", "payment_type",
            "order", "reservation", "method", "amount",
            "currency", "status", "audit_note", "paid_at", "receipt_number", "created_at",
        ]
        read_only_fields = [
            "id", "transaction_id", "reference_number", "xendit_invoice_id",
            "status", "paid_at", "receipt_number", "created_at",
        ]

    def get_customer_name(self, obj):
        if not obj.customer:
            return "Guest"
        name = f"{obj.customer.first_name} {obj.customer.last_name}".strip()
        return name or obj.customer.username

    def get_payment_type(self, obj):
        if obj.order_id:
            return "order"
        if obj.reservation_id:
            return "reservation"
        return "other"


class CheckoutRequestSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["order", "reservation"])
    id = serializers.IntegerField()


class ReceiptSerializer(serializers.ModelSerializer):
    order_items = serializers.SerializerMethodField()
    reservation_details = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id", "transaction_id", "reference_number", "receipt_number",
            "customer", "order", "reservation", "method", "amount",
            "currency", "status", "paid_at", "created_at",
            "order_items", "reservation_details",
        ]

    def get_order_items(self, obj):
        if not obj.order:
            return None
        return [
            {
                "name": item.name,
                "price": str(item.price),
                "quantity": item.quantity,
                "line_total": str(item.line_total),
            }
            for item in obj.order.items.all()
        ]

    def get_reservation_details(self, obj):
        if not obj.reservation:
            return None
        r = obj.reservation
        # Calculate slot_end (1 hour after slot_start)
        from datetime import timedelta, datetime
        slot_start_dt = datetime.combine(r.date, r.slot_start)
        slot_end_dt = slot_start_dt + timedelta(hours=1)
        return {
            "date": str(r.date),
            "slot_start": r.slot_start.strftime("%H:%M"),
            "slot_end": slot_end_dt.time().strftime("%H:%M"),
            "visitors": r.visitors,
            "fee": str(r.fee),
            "payment_option": r.payment_option,
            "amount_due": str(r.amount_due),
        }
