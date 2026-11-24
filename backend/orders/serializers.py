from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from menu.models import MenuItem
from payments.models import Payment
from .models import Order, OrderItem


def calculate_unit_price(menu_item, size="", temperature=""):
    """Calculate unit price with size and temperature surcharges."""
    base = menu_item.price
    surcharge = Decimal("0.00")
    if (size or "").strip().lower() == "grande" and menu_item.effective_enable_sizing:
        surcharge += Decimal("30.00")
    if (temperature or "").strip().lower() == "cold" and menu_item.effective_enable_temperature:
        surcharge += Decimal("30.00")
    return base + surcharge


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "menu_item",
            "name",
            "price",
            "unit_price",
            "size",
            "temperature",
            "quantity",
            "line_total",
        ]
        read_only_fields = ["id", "name", "price", "unit_price", "line_total"]


class OrderPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id",
            "reference_number",
            "xendit_invoice_id",
            "method",
            "amount",
            "status",
            "paid_at",
            "receipt_number",
        ]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_username = serializers.CharField(source="customer.username", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    customer_phone = serializers.SerializerMethodField()
    payment_status = serializers.CharField(default="UNPAID")
    paymentStatus = serializers.CharField(source="payment_status", read_only=True)
    loyaltyCredited = serializers.BooleanField(source="loyalty_credited", read_only=True)
    pointsCredited = serializers.BooleanField(source="points_credited", read_only=True)
    freeTreatRedeemed = serializers.BooleanField(source="free_treat_redeemed", read_only=True)
    voucherDiscount = serializers.DecimalField(source="voucher_discount", max_digits=10, decimal_places=2, read_only=True)
    perkDiscount = serializers.DecimalField(source="perk_discount", max_digits=10, decimal_places=2, read_only=True)
    tierPerkApplied = serializers.CharField(source="tier_perk_applied", read_only=True)
    pickupTime = serializers.CharField(source="pickup_time", read_only=True)
    orderNote = serializers.CharField(source="order_note", read_only=True)
    notes = serializers.CharField(source="order_note", read_only=True)
    payment = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "customer", "customer_name", "customer_username", "customer_email", "customer_phone", "items",
            "subtotal", "total", "discount_amount",
            "voucher_discount", "voucherDiscount",
            "perk_discount", "perkDiscount",
            "tier_perk_applied", "tierPerkApplied",
            "pickup_time", "pickupTime",
            "order_note", "orderNote", "notes",
            "contact_phone",
            "status", "payment_status", "paymentStatus",
            "loyalty_credited", "loyaltyCredited",
            "points_credited", "pointsCredited",
            "free_treat_redeemed", "freeTreatRedeemed",
            "payment", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "customer", "customer_name", "customer_username", "customer_email", "customer_phone", "subtotal", "total",
            "discount_amount", "voucher_discount", "voucherDiscount",
            "perk_discount", "perkDiscount",
            "tier_perk_applied", "tierPerkApplied",
            "pickup_time", "pickupTime",
            "order_note", "orderNote", "notes",
            "contact_phone",
            "status", "payment_status", "paymentStatus",
            "loyalty_credited", "loyaltyCredited",
            "points_credited", "pointsCredited",
            "free_treat_redeemed", "freeTreatRedeemed",
            "payment", "created_at", "updated_at",
        ]

    def get_customer_name(self, obj):
        if not obj.customer:
            return "Guest"
        name = f"{obj.customer.first_name} {obj.customer.last_name}".strip()
        return name or obj.customer.username

    def get_customer_phone(self, obj):
        if getattr(obj, "contact_phone", ""):
            return obj.contact_phone
        if not obj.customer:
            return ""
        profile = getattr(obj.customer, "profile", None)
        return getattr(profile, "phone", "") if profile else ""

    def get_payment(self, obj):
        payment = obj.payments.order_by("-created_at").first()
        if payment:
            return OrderPaymentSerializer(payment).data
        return None


class OrderItemInputSerializer(serializers.Serializer):
    """Validates each item in the cart when creating an order."""
    menu_item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=99)
    size = serializers.CharField(required=False, allow_blank=True, default="")
    temperature = serializers.CharField(required=False, allow_blank=True, default="")


class CreateOrderSerializer(serializers.Serializer):
    """
    Accepts a list of {menu_item_id, quantity, size, temperature}, optional free treat redemption,
    and optional reward voucher.
    Prices and variant surcharges are looked up server-side — never trusted from the client.
    """
    items = OrderItemInputSerializer(many=True, min_length=1)
    redeem_free_treat = serializers.BooleanField(default=False, required=False)
    voucher_code = serializers.CharField(required=False, allow_blank=True)
    voucher_id = serializers.IntegerField(required=False, allow_null=True)
    pickup_time = serializers.CharField(required=False, allow_blank=True, default="")
    order_note = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    contact_phone = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_items(self, items):
        # Check for duplicates of exact same variant configuration
        variant_keys = [
            f"{i['menu_item_id']}_{i.get('size', '').strip().lower()}_{i.get('temperature', '').strip().lower()}"
            for i in items
        ]
        if len(variant_keys) != len(set(variant_keys)):
            raise serializers.ValidationError("Duplicate items with identical customizations are not allowed in one order.")

        # Aggregate requested quantities per menu item ID to enforce stock limits
        total_requested = {}
        for item in items:
            mid = item["menu_item_id"]
            total_requested[mid] = total_requested.get(mid, 0) + item["quantity"]

        ids = list(total_requested.keys())
        menu_items = MenuItem.objects.filter(id__in=ids)
        menu_map = {mi.id: mi for mi in menu_items}

        # Validate each item
        errors = []
        for mid, requested_qty in total_requested.items():
            mi = menu_map.get(mid)
            if not mi:
                errors.append(f"Menu item {mid} does not exist.")
            elif not mi.is_available:
                errors.append(f"'{mi.name}' is currently unavailable.")
            elif mi.stock_quantity < requested_qty:
                errors.append(
                    f"'{mi.name}' only has {mi.stock_quantity} in stock "
                    f"(requested {requested_qty})."
                )
        if errors:
            raise serializers.ValidationError(errors)

        return items

    def validate(self, attrs):
        user = self.context["request"].user
        redeem = attrs.get("redeem_free_treat", False)
        voucher_code = attrs.get("voucher_code")
        voucher_id = attrs.get("voucher_id")

        items = attrs.get("items", [])
        ids = list({i["menu_item_id"] for i in items})
        menu_items = MenuItem.objects.filter(id__in=ids)
        menu_map = {mi.id: mi for mi in menu_items}

        # Guardrail 2: No Stacking — allow only 1 loyalty redemption per order
        if redeem and (voucher_code or voucher_id):
            raise serializers.ValidationError(
                {"detail": "Only one loyalty redemption (Stamp Card free treat OR Reward Voucher) is allowed per order."}
            )

        if redeem:
            profile = getattr(user, "profile", None)
            stamps = getattr(profile, "stamps_count", 0) if profile else 0
            free_treats = getattr(profile, "free_treats_available", 0) if profile else 0
            if stamps < 10 and free_treats < 1:
                raise serializers.ValidationError(
                    {"redeem_free_treat": "You need at least 10 stamps to redeem a free treat."}
                )

            qualifying = [
                mi for mi in menu_items
                if mi.effective_qualifies_for_stamps
            ]
            if not qualifying:
                raise serializers.ValidationError(
                    {"redeem_free_treat": "Your order must contain at least one qualifying drink or pastry to redeem a free treat."}
                )

        # Voucher validation
        voucher = None
        if voucher_code or voucher_id:
            from loyalty.models import RewardVoucher
            voucher_qs = RewardVoucher.objects.filter(user=user, status="active")
            if voucher_id:
                voucher = voucher_qs.filter(id=voucher_id).first()
            else:
                voucher = voucher_qs.filter(code=voucher_code).first()

            if not voucher:
                raise serializers.ValidationError(
                    {"voucher": "Invalid, expired, or previously used reward voucher."}
                )

            # Check eligibility against items in cart
            if voucher.reward_type == "free_pastry":
                pastries = [
                    mi for mi in menu_items
                    if mi.category == "pastries" or (mi.category_obj and mi.category_obj.slug == "pastries")
                ]
                if not pastries:
                    raise serializers.ValidationError(
                        {"voucher": "Order must contain at least one pastry item for this voucher."}
                    )
            elif voucher.reward_type == "free_drink":
                drinks = [
                    mi for mi in menu_items
                    if mi.category in ("coffee", "non_coffee_tea") or (mi.category_obj and mi.category_obj.slug in ("coffee", "non_coffee_tea"))
                ]
                if not drinks:
                    raise serializers.ValidationError(
                        {"voucher": "Order must contain at least one coffee or tea item for this voucher."}
                    )
            elif voucher.reward_type == "free_mug":
                mugs = [
                    mi for mi in menu_items
                    if mi.category == "merch" or "mug" in mi.name.lower()
                ]
                if not mugs:
                    raise serializers.ValidationError(
                        {"voucher": "Order must contain a Catopia Café Ceramic Mug to use this voucher."}
                    )
            elif voucher.reward_type == "catroom_50":
                raise serializers.ValidationError(
                    {"voucher": "This voucher can only be used for Cat Room reservations."}
                )

            attrs["_voucher"] = voucher

        # Pre-calculate subtotal with unit price including variants
        subtotal = Decimal("0.00")
        for item in items:
            mi = menu_map.get(item["menu_item_id"])
            if mi:
                unit_p = calculate_unit_price(mi, item.get("size", ""), item.get("temperature", ""))
                subtotal += unit_p * item["quantity"]

        treat_discount = Decimal("0.00")
        if redeem:
            qualifying = [
                mi for mi in menu_items
                if mi.effective_qualifies_for_stamps
            ]
            if qualifying:
                treat_discount = min(Decimal("175.00"), min(qualifying, key=lambda x: x.price).price)

        voucher_discount = Decimal("0.00")
        if voucher:
            if voucher.reward_type == "free_pastry":
                pastries = [
                    mi for mi in menu_items
                    if mi.category == "pastries" or (mi.category_obj and mi.category_obj.slug == "pastries")
                ]
                if pastries:
                    voucher_discount = min(pastries, key=lambda x: x.price).price
            elif voucher.reward_type == "free_drink":
                drinks = [
                    mi for mi in menu_items
                    if mi.category in ("coffee", "non_coffee_tea") or (mi.category_obj and mi.category_obj.slug in ("coffee", "non_coffee_tea"))
                ]
                if drinks:
                    voucher_discount = min(drinks, key=lambda x: x.price).price
            elif voucher.reward_type == "free_mug":
                mugs = [
                    mi for mi in menu_items
                    if mi.category == "merch" or "mug" in mi.name.lower()
                ]
                if mugs:
                    voucher_discount = min(mugs, key=lambda x: x.price).price

        # Tier perk: Tabby Club (-₱30 on 1 drink), Tubby Club (-₱50 on 1 drink)
        profile = getattr(user, "profile", None)
        user_tier = profile.tier if profile else "Kitten"
        drinks = [
            mi for mi in menu_items
            if mi.category in ("coffee", "non_coffee_tea") or (mi.category_obj and mi.category_obj.slug in ("coffee", "non_coffee_tea"))
        ]
        perk_discount = Decimal("0.00")
        tier_perk_applied = ""
        if drinks:
            if user_tier == "Tubby Club":
                perk_discount = min(Decimal("50.00"), drinks[0].price)
                tier_perk_applied = "Tubby Club Perk: Free Drink Upgrade & Add-on (-₱50.00)"
            elif user_tier == "Tabby Club":
                perk_discount = min(Decimal("30.00"), drinks[0].price)
                tier_perk_applied = "Tabby Club Perk: Free Drink Customization (-₱30.00)"

        attrs["_treat_discount"] = treat_discount
        attrs["_voucher_discount"] = voucher_discount
        attrs["_perk_discount"] = perk_discount
        attrs["_tier_perk_applied"] = tier_perk_applied

        if (redeem or voucher):
            tentative_paid_total = subtotal - (treat_discount + voucher_discount + perk_discount)
            if tentative_paid_total < Decimal("100.00"):
                raise serializers.ValidationError(
                    {"detail": "Loyalty redemptions require a minimum paid purchase of ₱100.00 after discounts."}
                )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        items_data = validated_data["items"]
        redeem = validated_data.get("redeem_free_treat", False)
        voucher = validated_data.get("_voucher")
        treat_discount = validated_data.get("_treat_discount", Decimal("0.00"))
        voucher_discount = validated_data.get("_voucher_discount", Decimal("0.00"))
        perk_discount = validated_data.get("_perk_discount", Decimal("0.00"))
        tier_perk_applied = validated_data.get("_tier_perk_applied", "")

        # Re-fetch with select_for_update to prevent race conditions
        ids = list({i["menu_item_id"] for i in items_data})
        menu_items = MenuItem.objects.select_for_update().filter(id__in=ids)
        menu_map = {mi.id: mi for mi in menu_items}

        # Check total requested stock across line items
        total_requested = {}
        for item in items_data:
            mid = item["menu_item_id"]
            total_requested[mid] = total_requested.get(mid, 0) + item["quantity"]

        for mid, req_qty in total_requested.items():
            mi = menu_map[mid]
            if mi.stock_quantity < req_qty:
                raise serializers.ValidationError(
                    f"'{mi.name}' only has {mi.stock_quantity} in stock."
                )

        # Create the order
        pickup_time = (validated_data.get("pickup_time") or "").strip()
        order_note = (validated_data.get("order_note") or validated_data.get("notes") or "").strip()
        contact_phone = (validated_data.get("contact_phone") or "").strip()

        order = Order.objects.create(
            customer=user,
            status="pending",
            pickup_time=pickup_time,
            order_note=order_note,
            contact_phone=contact_phone,
        )

        if contact_phone:
            profile = getattr(user, "profile", None)
            if profile and not profile.phone:
                profile.phone = contact_phone
                profile.save(update_fields=["phone"])

        subtotal = Decimal("0.00")
        order_items = []

        for item_data in items_data:
            mi = menu_map[item_data["menu_item_id"]]
            qty = item_data["quantity"]
            size = item_data.get("size", "")
            temp = item_data.get("temperature", "")
            unit_price = calculate_unit_price(mi, size, temp)

            # Decrement stock
            mi.stock_quantity -= qty

            line_total = unit_price * qty
            subtotal += line_total

            order_items.append(OrderItem(
                order=order,
                menu_item=mi,
                name=mi.name,
                price=unit_price,
                unit_price=unit_price,
                size=size,
                temperature=temp,
                quantity=qty,
            ))

        # Save updated stock levels for all menu items
        for mi in menu_map.values():
            mi.save(update_fields=["stock_quantity"])

        OrderItem.objects.bulk_create(order_items)

        if redeem:
            order.free_treat_redeemed = True
            profile = getattr(user, "profile", None)
            if profile:
                profile.stamps_count = max(0, profile.stamps_count - 10)
                profile.free_treats_available = profile.stamps_count // 10
                profile.save(update_fields=["stamps_count", "free_treats_available"])

        if voucher:
            order.voucher_discount = voucher_discount
            voucher.status = "used"
            voucher.used_at = timezone.now()
            voucher.order = order
            voucher.save(update_fields=["status", "used_at", "order"])

        order.perk_discount = perk_discount
        order.tier_perk_applied = tier_perk_applied

        total_discount = treat_discount + voucher_discount + perk_discount
        order.discount_amount = total_discount
        total = max(Decimal("0.00"), subtotal - total_discount)
        order.subtotal = subtotal
        order.total = total

        order.save(update_fields=[
            "subtotal", "total", "discount_amount", "voucher_discount",
            "perk_discount", "tier_perk_applied", "free_treat_redeemed",
        ])

        return order


# Valid status transitions
VALID_TRANSITIONS = {
    "pending": ["preparing", "cancelled"],
    "confirmed": ["preparing", "cancelled"],
    "preparing": ["ready", "cancelled"],
    "ready": ["completed", "cancelled"],
    "completed": [],
    "cancelled": [],
}


class UpdateOrderStatusSerializer(serializers.Serializer):
    """Staff-only: update order status with valid transitions."""
    status = serializers.ChoiceField(choices=Order.STATUS_CHOICES)

    def validate_status(self, new_status):
        order = self.context["order"]
        current = order.status
        allowed = VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise serializers.ValidationError(
                f"Cannot transition from '{current}' to '{new_status}'. "
                f"Allowed: {allowed or 'none (terminal state)'}."
            )
        return new_status
