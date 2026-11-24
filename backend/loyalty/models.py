from django.conf import settings
from django.db import models


class LoyaltyTransaction(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="loyalty_transactions",
    )
    points = models.IntegerField(help_text="Positive = earned, negative = redeemed")
    reason = models.CharField(max_length=255)
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="loyalty_transactions",
    )
    reservation = models.ForeignKey(
        "catroom.CatRoomReservation",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="loyalty_transactions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "loyalty_transaction"
        ordering = ["-created_at"]

    def __str__(self):
        sign = "+" if self.points >= 0 else ""
        return f"{self.user.username}: {sign}{self.points} pts — {self.reason}"


class RewardVoucher(models.Model):
    REWARD_CHOICES = [
        ("free_drink", "Any Drink On Us"),
        ("free_pastry", "Free Pastry"),
        ("catroom_50", "50% Off A Cat Room Hour"),
        ("free_mug", "Catopia Café Ceramic Mug"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("used", "Used"),
        ("expired", "Expired"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vouchers",
    )
    reward_type = models.CharField(max_length=50, choices=REWARD_CHOICES)
    title = models.CharField(max_length=100)
    points_cost = models.PositiveIntegerField(default=0)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active", db_index=True)
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vouchers_used",
    )
    reservation = models.ForeignKey(
        "catroom.CatRoomReservation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vouchers_used",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "loyalty_voucher"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.title} ({self.code}) [{self.status}]"
