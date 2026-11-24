from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models


class MenuCategory(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    enable_sizing = models.BooleanField(
        default=False,
        help_text="Items in this category offer Regular (default, +₱0) and Grande (+₱30.00)"
    )
    enable_temperature = models.BooleanField(
        default=False,
        help_text="Items in this category offer Hot (default, +₱0) and Cold (+₱30.00)"
    )
    qualifies_for_stamps = models.BooleanField(
        default=True,
        help_text="Controls whether items in this category count toward the Café Stamp Card"
    )
    badge_tag = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Optional tag/badge, e.g. 'Barista Favorite' or prep note"
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "menu_menucategory"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class MenuItem(models.Model):
    CATEGORY_CHOICES = [
        ("coffee", "Coffee"),
        ("non_coffee_tea", "Non-Coffee & Tea"),
        ("pastries", "Pastries"),
        ("light_bites", "Light Bites"),
        ("merch", "Merchandise"),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, blank=True)
    category_obj = models.ForeignKey(
        MenuCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="items"
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to="menu/", blank=True)
    is_available = models.BooleanField(default=True)
    stock_quantity = models.PositiveIntegerField(default=0)

    # Per-item overrides (null = inherit from category)
    override_sizing = models.BooleanField(
        null=True,
        blank=True,
        default=None,
        help_text="Override category enable_sizing if set"
    )
    override_temperature = models.BooleanField(
        null=True,
        blank=True,
        default=None,
        help_text="Override category enable_temperature if set"
    )
    override_stamps = models.BooleanField(
        null=True,
        blank=True,
        default=None,
        help_text="Override category qualifies_for_stamps if set"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "menu_menuitem"
        ordering = ["category", "name"]

    @property
    def effective_enable_sizing(self):
        if self.override_sizing is not None:
            return self.override_sizing
        if self.category_obj:
            return self.category_obj.enable_sizing
        return self.category in ("coffee", "non_coffee_tea")

    @property
    def effective_enable_temperature(self):
        if self.override_temperature is not None:
            return self.override_temperature
        if self.category_obj:
            return self.category_obj.enable_temperature
        return self.category in ("coffee", "non_coffee_tea")

    @property
    def effective_qualifies_for_stamps(self):
        if self.override_stamps is not None:
            return self.override_stamps
        if self.category_obj:
            return self.category_obj.qualifies_for_stamps
        return self.category in ("coffee", "non_coffee_tea", "pastries", "light_bites")

    def __str__(self):
        return f"{self.name} (₱{self.price})"


class Review(models.Model):
    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name="reviews"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="menu_reviews"
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Rating from 1 to 5 stars"
    )
    headline = models.CharField(max_length=200, blank=True)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "menu_review"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["menu_item", "user"], name="unique_user_menu_item_review")
        ]

    def __str__(self):
        return f"{self.user} - {self.menu_item.name} ({self.rating}★)"
