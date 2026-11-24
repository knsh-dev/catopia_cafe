from django.conf import settings
from django.db import models


class Order(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("preparing", "Preparing"),
        ("ready", "Ready"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]
    PAYMENT_STATUS_CHOICES = [
        ("UNPAID", "Unpaid"),
        ("PAID", "Paid"),
        ("SETTLED", "Settled"),
        ("REFUNDED", "Refunded"),
        ("FAILED", "Failed"),
        ("EXPIRED", "Expired"),
    ]

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="UNPAID",
        db_index=True,
    )
    loyalty_credited = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Ensures stamps and loyalty points are awarded only once per order",
    )
    points_credited = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Ensures paw points are credited only once per order",
    )
    free_treat_redeemed = models.BooleanField(
        default=False,
        help_text="Indicates whether 10 stamps were redeemed for a free treat on this order",
    )
    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Discount applied to this order (e.g. stamp card free treat or reward voucher)",
    )
    voucher_discount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Discount applied from loyalty reward voucher",
    )
    perk_discount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Discount applied from tier perks (e.g. Tabby/Tubby free drink customization)",
    )
    tier_perk_applied = models.CharField(
        max_length=100,
        blank=True,
        help_text="Description of tier perk applied (e.g. Tabby Club Perk: Free Drink Customization)",
    )
    pickup_time = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Customer requested pickup timing (e.g. ASAP or In ~30 mins)",
    )
    order_note = models.TextField(
        blank=True,
        default="",
        help_text="Customer instructions, pickup notes, or customization details",
    )
    contact_phone = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text="Customer contact phone number for order pickup",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orders_order"
        ordering = ["-created_at"]

    @property
    def paymentStatus(self):
        return self.payment_status

    @property
    def loyaltyCredited(self):
        return self.loyalty_credited

    @property
    def pointsCredited(self):
        return self.points_credited

    @property
    def freeTreatRedeemed(self):
        return self.free_treat_redeemed

    @property
    def perkDiscount(self):
        return self.perk_discount

    @property
    def tierPerkApplied(self):
        return self.tier_perk_applied

    def __str__(self):
        return f"Order #{self.pk} — {self.get_status_display()}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    menu_item = models.ForeignKey(
        "menu.MenuItem",
        on_delete=models.SET_NULL,
        null=True,
        related_name="order_items",
    )
    name = models.CharField(max_length=200, help_text="Snapshot of item name at order time")
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Snapshot of price at order time")
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Snapshot of unit price with variant surcharges"
    )
    size = models.CharField(max_length=20, blank=True, default="", help_text="e.g. Regular, Grande")
    temperature = models.CharField(max_length=20, blank=True, default="", help_text="e.g. Hot, Cold")
    quantity = models.PositiveSmallIntegerField(default=1)

    class Meta:
        db_table = "orders_orderitem"

    @property
    def effective_unit_price(self):
        return self.unit_price if self.unit_price > 0 else self.price

    @property
    def line_total(self):
        return self.effective_unit_price * self.quantity

    def __str__(self):
        variant = f" ({self.size} {self.temperature})".strip() if self.size or self.temperature else ""
        return f"{self.name}{variant} x{self.quantity}"
