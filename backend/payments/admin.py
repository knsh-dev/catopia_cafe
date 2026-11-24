from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["reference_number", "customer", "amount", "currency", "status", "paid_at", "receipt_number"]
    list_filter = ["status", "method"]
    search_fields = ["reference_number", "xendit_invoice_id", "customer__username"]
    readonly_fields = ["transaction_id", "reference_number", "raw_payload", "receipt_number"]
    raw_id_fields = ["customer", "order", "reservation"]
