from decimal import Decimal
import logging
from django.conf import settings
from django.db import transaction
from accounts.models import Profile
from loyalty.models import LoyaltyTransaction
from .models import Order

logger = logging.getLogger(__name__)

QUALIFYING_CATEGORIES = {"coffee", "non_coffee_tea", "pastries", "light_bites"}


def get_tier_multiplier(lifetime_points):
    """
    Tier earn rate multiplier based on cumulative lifetime points:
    - Kitten (0-799): 1.0 pt per ₱10 spent
    - Tabby Club (800-2499): 1.25 pts per ₱10 spent
    - Tubby Club (2500+): 1.5 pts per ₱10 spent
    """
    if lifetime_points >= 2500:
        return Decimal("1.5")
    if lifetime_points >= 800:
        return Decimal("1.25")
    return Decimal("1.0")


def award_order_stamps_and_loyalty(order):
    """
    Award stamps and loyalty points for a paid order idempotently.
    Stamps: 1 stamp per qualifying café item (drinks, pastries, food — excluding retail merch).
    Paw Points: Net-spend calculation Math.floor((netAmountPaid / 10) * tierMultiplier).
    Tier bonuses: +30 upon unlocking Tabby Club (800 pts), +75 upon unlocking Tubby Club (2500 pts).
    """
    if not order:
        return

    # Do not award stamps or points for cancelled or failed/expired/refunded orders
    if order.status == "cancelled" or order.payment_status in ("FAILED", "EXPIRED", "REFUNDED"):
        return

    user = order.customer
    if not user:
        return

    profile = getattr(user, "profile", None)
    if not profile:
        profile, _ = Profile.objects.get_or_create(user=user)

    with transaction.atomic():
        # Lock order to avoid double-crediting under concurrency
        locked_order = Order.objects.select_for_update().get(pk=order.pk)

        if locked_order.status == "cancelled" or locked_order.payment_status in ("FAILED", "EXPIRED", "REFUNDED"):
            return

        locked_profile = Profile.objects.select_for_update().get(pk=profile.pk)
        profile_save_fields = []
        order_save_fields = ["updated_at"]

        # 1. Stamps: 1 per qualifying café item
        if not locked_order.loyalty_credited:
            stamps_to_add = 0
            for item in locked_order.items.select_related("menu_item", "menu_item__category_obj"):
                if item.menu_item:
                    qualifies = item.menu_item.effective_qualifies_for_stamps
                else:
                    cat = "coffee"
                    qualifies = cat in QUALIFYING_CATEGORIES
                if qualifies:
                    stamps_to_add += item.quantity

            locked_profile.stamps_count += stamps_to_add
            locked_profile.free_treats_available = locked_profile.stamps_count // 10
            profile_save_fields.extend(["stamps_count", "free_treats_available"])

            locked_order.loyalty_credited = True
            order_save_fields.append("loyalty_credited")

        # 2. Paw points: Net-spend calculation with tier multiplier
        if not locked_order.points_credited:
            current_lifetime = (
                locked_profile.lifetime_paw_points
                or locked_profile.paw_points
                or locked_profile.loyalty_points
            )
            multiplier = get_tier_multiplier(current_lifetime)
            paw_points_to_add = int((locked_order.total / Decimal("10.0")) * multiplier)

            if paw_points_to_add > 0:
                locked_profile.paw_points += paw_points_to_add
                locked_profile.lifetime_paw_points += paw_points_to_add
                locked_profile.loyalty_points = locked_profile.paw_points
                profile_save_fields.extend(["paw_points", "lifetime_paw_points", "loyalty_points"])

                LoyaltyTransaction.objects.create(
                    user=user,
                    points=paw_points_to_add,
                    reason=f"Order #{locked_order.pk} ({paw_points_to_add} paw pts earned at {multiplier}x)",
                    order=locked_order,
                )

            # Check tier unlock one-time bonuses
            new_lifetime = locked_profile.lifetime_paw_points
            if new_lifetime >= 800 and not locked_profile.tabby_bonus_credited:
                locked_profile.tabby_bonus_credited = True
                locked_profile.paw_points += 30
                locked_profile.lifetime_paw_points += 30
                locked_profile.loyalty_points = locked_profile.paw_points
                profile_save_fields.extend([
                    "tabby_bonus_credited", "paw_points", "lifetime_paw_points", "loyalty_points"
                ])
                LoyaltyTransaction.objects.create(
                    user=user,
                    points=30,
                    reason="Welcome to Tabby Club! Tier Bonus (+30 pts)",
                )

            if new_lifetime >= 2500 and not locked_profile.tubby_bonus_credited:
                locked_profile.tubby_bonus_credited = True
                locked_profile.paw_points += 75
                locked_profile.lifetime_paw_points += 75
                locked_profile.loyalty_points = locked_profile.paw_points
                profile_save_fields.extend([
                    "tubby_bonus_credited", "paw_points", "lifetime_paw_points", "loyalty_points"
                ])
                LoyaltyTransaction.objects.create(
                    user=user,
                    points=75,
                    reason="Welcome to Tubby Club! Tier Bonus (+75 pts)",
                )

            locked_order.points_credited = True
            order_save_fields.append("points_credited")

        if profile_save_fields:
            locked_profile.save(update_fields=list(set(profile_save_fields)))

        locked_order.save(update_fields=order_save_fields)

        logger.info(
            "Processed loyalty for Order #%d for user %s (stamps: %d, net total: %.2f, balance: %d)",
            locked_order.pk,
            user.username,
            locked_profile.stamps_count,
            float(locked_order.total),
            locked_profile.paw_points,
        )
