import uuid
from django.conf import settings
from django.db import models


class Payment(models.Model):
    METHOD_CHOICES = [
        ("xendit", "Xendit"),
        ("cash", "Cash"),
    ]
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("failed", "Failed"),
        ("refunded", "Refunded"),
        ("expired", "Expired"),
    ]

    transaction_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    xendit_invoice_id = models.CharField(max_length=255, blank=True, db_index=True)
    reference_number = models.CharField(
        max_length=255, unique=True, editable=False,
        help_text="Unique external_id sent to Xendit",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="payments",
    )
    reservation = models.ForeignKey(
        "catroom.CatRoomReservation",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="payments",
    )
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default="xendit")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="PHP")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    paid_at = models.DateTimeField(null=True, blank=True)
    receipt_number = models.CharField(max_length=100, blank=True)
    audit_note = models.TextField(blank=True, default="")
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payments_payment"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(order__isnull=False, reservation__isnull=True)
                    | models.Q(order__isnull=True, reservation__isnull=False)
                ),
                name="payment_linked_to_order_or_reservation",
            )
        ]

    def save(self, *args, **kwargs):
        if not self.reference_number:
            self.reference_number = f"CATOPIA-{uuid.uuid4().hex[:12].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Payment {self.reference_number} — {self.get_status_display()}"
