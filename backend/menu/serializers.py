from rest_framework import serializers
from django.db import models
from django.db.models import Avg, Count
from .models import MenuCategory, MenuItem, Review


class MenuCategorySerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = MenuCategory
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "enable_sizing",
            "enable_temperature",
            "qualifies_for_stamps",
            "badge_tag",
            "sort_order",
            "is_visible",
            "items_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "items_count", "created_at", "updated_at"]

    def get_items_count(self, obj):
        return obj.items.filter(is_available=True).count()


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_initials = serializers.SerializerMethodField()
    is_verified_order = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id",
            "menu_item",
            "user",
            "user_name",
            "user_initials",
            "rating",
            "headline",
            "comment",
            "is_verified_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "user_name",
            "user_initials",
            "is_verified_order",
            "created_at",
            "updated_at",
        ]

    def get_user_name(self, obj):
        if not obj.user:
            return "Catopia Guest"
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or obj.user.username

    def get_user_initials(self, obj):
        if not obj.user:
            return "CG"
        first = obj.user.first_name[:1] if obj.user.first_name else ""
        last = obj.user.last_name[:1] if obj.user.last_name else ""
        initials = (first + last).upper()
        return initials or obj.user.username[:2].upper()

    def get_is_verified_order(self, obj):
        from orders.models import OrderItem
        if not obj.user_id:
            return False
        return OrderItem.objects.filter(
            order__customer_id=obj.user_id,
            menu_item_id=obj.menu_item_id,
        ).filter(
            models.Q(order__payment_status__in=["PAID", "SETTLED"])
            | models.Q(order__status__in=["preparing", "ready", "completed"])
        ).exists()


class NullableBooleanField(serializers.Field):
    """
    Custom field that accepts boolean, string ('true'/'false'), or 'inherit'/null/empty string
    in both JSON and multipart/form-data requests without HTML checkbox coercion bugs.
    """
    def to_internal_value(self, data):
        if data in ("", "null", "None", None, "inherit"):
            return None
        if isinstance(data, bool):
            return data
        if isinstance(data, str):
            low = data.strip().lower()
            if low in ("true", "1", "yes", "on"):
                return True
            if low in ("false", "0", "no", "off"):
                return False
            if low in ("inherit", "null", "none", ""):
                return None
        raise serializers.ValidationError("Must be a valid boolean or 'inherit'.")

    def to_representation(self, value):
        return value


class MenuItemSerializer(serializers.ModelSerializer):
    category = serializers.CharField(required=False, allow_blank=True, default="coffee")
    category_obj = serializers.PrimaryKeyRelatedField(
        queryset=MenuCategory.objects.all(),
        required=False,
        allow_null=True
    )
    image = serializers.ImageField(required=False, allow_null=True)
    category_detail = MenuCategorySerializer(source="category_obj", read_only=True)
    enable_sizing = serializers.BooleanField(source="effective_enable_sizing", read_only=True)
    enable_temperature = serializers.BooleanField(source="effective_enable_temperature", read_only=True)
    qualifies_for_stamps = serializers.BooleanField(source="effective_qualifies_for_stamps", read_only=True)
    override_sizing = NullableBooleanField(required=False, allow_null=True)
    override_temperature = NullableBooleanField(required=False, allow_null=True)
    override_stamps = NullableBooleanField(required=False, allow_null=True)
    badge_tag = serializers.SerializerMethodField()
    avg_rating = serializers.SerializerMethodField()
    averageRating = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    reviewCount = serializers.SerializerMethodField()
    rating_breakdown = serializers.SerializerMethodField()
    sold_count = serializers.SerializerMethodField()
    sales_revenue = serializers.SerializerMethodField()

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "name",
            "description",
            "category",
            "category_obj",
            "category_detail",
            "price",
            "image",
            "is_available",
            "stock_quantity",
            "enable_sizing",
            "enable_temperature",
            "qualifies_for_stamps",
            "override_sizing",
            "override_temperature",
            "override_stamps",
            "badge_tag",
            "avg_rating",
            "averageRating",
            "average_rating",
            "review_count",
            "reviewCount",
            "rating_breakdown",
            "sold_count",
            "sales_revenue",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "category_detail",
            "enable_sizing",
            "enable_temperature",
            "qualifies_for_stamps",
            "badge_tag",
            "avg_rating",
            "averageRating",
            "average_rating",
            "review_count",
            "reviewCount",
            "rating_breakdown",
            "sold_count",
            "sales_revenue",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        category_obj = attrs.get("category_obj")
        category = (attrs.get("category") or "").strip()
        valid_choice_keys = {c[0] for c in MenuItem.CATEGORY_CHOICES}

        if not category_obj and category:
            matched_cat = MenuCategory.objects.filter(slug=category).first()
            if matched_cat:
                attrs["category_obj"] = matched_cat
                category_obj = matched_cat

        if category_obj:
            if not category or category not in valid_choice_keys:
                attrs["category"] = (
                    category_obj.slug
                    if category_obj.slug in valid_choice_keys
                    else "coffee"
                )
        elif not category or category not in valid_choice_keys:
            if not self.instance:
                attrs["category"] = "coffee"

        return attrs

    def get_badge_tag(self, obj):
        if obj.category_obj and obj.category_obj.badge_tag:
            return obj.category_obj.badge_tag
        return ""

    def get_avg_rating(self, obj):
        avg = obj.reviews.aggregate(avg=Avg("rating"))["avg"]
        return round(float(avg), 1) if avg is not None else 0.0

    def get_averageRating(self, obj):
        return self.get_avg_rating(obj)

    def get_average_rating(self, obj):
        return self.get_avg_rating(obj)

    def get_review_count(self, obj):
        return obj.reviews.count()

    def get_reviewCount(self, obj):
        return self.get_review_count(obj)

    def get_rating_breakdown(self, obj):
        counts = {i: 0 for i in range(1, 6)}
        qs = obj.reviews.values("rating").annotate(count=Count("id"))
        for row in qs:
            counts[row["rating"]] = row["count"]
        return counts

    def get_sold_count(self, obj):
        return int(getattr(obj, "sold_count", 0) or 0)

    def get_sales_revenue(self, obj):
        return float(getattr(obj, "sales_revenue", 0) or 0)
