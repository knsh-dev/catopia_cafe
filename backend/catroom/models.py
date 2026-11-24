from decimal import Decimal
from django.conf import settings
from django.db import models


class CatRoomReservation(models.Model):
    STATUS_CHOICES = [
        ("pending_payment", "Pending Payment"),
        ("confirmed", "Confirmed"),
        ("rescheduled", "Rescheduled"),
        ("cancelled", "Cancelled"),
        ("completed", "Completed"),
    ]

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reservations",
    )
    date = models.DateField()
    slot_start = models.TimeField()
    visitors = models.PositiveSmallIntegerField(default=1)
    fee = models.DecimalField(max_digits=10, decimal_places=2)
    payment_option = models.CharField(max_length=10, choices=[("deposit", "Deposit"), ("full", "Full Payment")], default="full")
    amount_due = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    policy_acknowledged = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending_payment")
    hold_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "catroom_reservation"
        ordering = ["date", "slot_start"]

    def save(self, *args, **kwargs):
        if self.status in ["pending_payment", "confirmed", "rescheduled"]:
            from django.utils import timezone
            cfg = CatRoomConfig.objects.order_by("id").first()
            max_cap = cfg.max_visitors if cfg else getattr(settings, "CATROOM_MAX_VISITORS", 8)
            active_qs = (
                CatRoomReservation.objects.filter(
                    date=self.date,
                    slot_start=self.slot_start,
                    status__in=["pending_payment", "confirmed", "rescheduled"],
                )
                .exclude(status="pending_payment", hold_expires_at__lt=timezone.now())
            )
            if self.pk:
                active_qs = active_qs.exclude(pk=self.pk)
            from django.db.models import Sum
            booked = active_qs.aggregate(total=Sum("visitors"))["total"] or 0
            # Enforce capacity on new bookings or visitor/slot changes; allow confirming an existing held reservation
            is_confirming_existing = False
            if self.pk:
                prev = CatRoomReservation.objects.filter(pk=self.pk).values("date", "slot_start", "visitors", "status").first()
                if (
                    prev
                    and prev["date"] == self.date
                    and prev["slot_start"] == self.slot_start
                    and prev["visitors"] == self.visitors
                    and prev["status"] in ("pending_payment", "confirmed", "rescheduled")
                ):
                    is_confirming_existing = True
            if not is_confirming_existing and booked + self.visitors > max_cap:
                from django.db import IntegrityError
                raise IntegrityError(f"Slot capacity ({max_cap}) exceeded.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Reservation {self.date} {self.slot_start} ({self.get_status_display()})"


class CatRoomSlotBlock(models.Model):
    REASON_CHOICES = [
        ("blocked", "Blocked"),
        ("rest_hours", "Rest Hours"),
        ("unblocked", "Unblocked"),
    ]

    date = models.DateField()
    slot_start = models.TimeField()
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, default="blocked")
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "catroom_slotblock"
        unique_together = [("date", "slot_start")]
        ordering = ["date", "slot_start"]

    def __str__(self):
        return f"Block {self.date} {self.slot_start} ({self.reason})"


class CatRoomConfig(models.Model):
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("300.00"))
    max_visitors = models.PositiveSmallIntegerField(default=8)
    min_deposit = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("150.00"))
    opening_hour = models.PositiveSmallIntegerField(default=10)
    closing_hour = models.PositiveSmallIntegerField(default=21)
    hold_minutes = models.PositiveSmallIntegerField(default=15)
    cancel_cutoff_hours = models.PositiveSmallIntegerField(default=24)
    daily_rest_hours = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "catroom_config"
        ordering = ["id"]

    def __str__(self):
        return f"Cat Room Config (Rate: {self.hourly_rate}, Max: {self.max_visitors})"
