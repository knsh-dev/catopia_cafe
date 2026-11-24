import uuid
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import LoyaltyTransaction, RewardVoucher
from .serializers import LoyaltyTransactionSerializer, RewardVoucherSerializer

REWARD_CATALOG = {
    1: {
        "id": 1,
        "reward_type": "free_drink",
        "title": "Any Drink On Us",
        "points": 400,
        "description": "Coffee or tea, any size",
    },
    2: {
        "id": 2,
        "reward_type": "free_pastry",
        "title": "Free Pastry",
        "points": 300,
        "description": "From the morning case",
    },
    3: {
        "id": 3,
        "reward_type": "catroom_50",
        "title": "50% Off A Cat Room Hour",
        "points": 600,
        "description": "One guest, any open slot",
    },
    4: {
        "id": 4,
        "reward_type": "free_mug",
        "title": "Catopia Café Ceramic Mug",
        "points": 900,
        "description": "Limited glaze edition",
    },
}


class LoyaltyTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LoyaltyTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.groups.filter(name__in=["staff", "admin"]).exists():
            return LoyaltyTransaction.objects.all()
        return LoyaltyTransaction.objects.filter(user=user)


class RewardVoucherViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RewardVoucherSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = RewardVoucher.objects.filter(user=user)
        v_status = self.request.query_params.get("status")
        if v_status:
            qs = qs.filter(status=v_status)
        return qs


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def redeem_reward_view(request):
    """
    POST /api/loyalty/redeem/
    Body: {"reward_id": 1}
    Deducts points from paw_points (lifetime_paw_points unchanged) and issues an active RewardVoucher.
    """
    user = request.user
    reward_id = request.data.get("reward_id")
    try:
        reward_id = int(reward_id)
    except (TypeError, ValueError):
        return Response({"detail": "Invalid reward_id."}, status=status.HTTP_400_BAD_REQUEST)

    reward = REWARD_CATALOG.get(reward_id)
    if not reward:
        return Response({"detail": "Reward not found in catalog."}, status=status.HTTP_404_NOT_FOUND)

    cost = reward["points"]
    profile = getattr(user, "profile", None)
    current_points = getattr(profile, "paw_points", 0) if profile else 0

    if current_points < cost:
        return Response(
            {
                "detail": f"Insufficient paw points. You need {cost} points but have {current_points}.",
                "required": cost,
                "current": current_points,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        from accounts.models import Profile

        locked_profile = Profile.objects.select_for_update().get(pk=profile.pk)
        if locked_profile.paw_points < cost:
            return Response(
                {"detail": "Insufficient paw points."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        locked_profile.paw_points -= cost
        locked_profile.loyalty_points = locked_profile.paw_points
        # NOTE: lifetime_paw_points is intentionally untouched to preserve tier progress!
        locked_profile.save(update_fields=["paw_points", "loyalty_points"])

        LoyaltyTransaction.objects.create(
            user=user,
            points=-cost,
            reason=f"Redeemed {reward['title']}",
        )

        code = f"VCHR-{uuid.uuid4().hex[:8].upper()}"
        voucher = RewardVoucher.objects.create(
            user=user,
            reward_type=reward["reward_type"],
            title=reward["title"],
            points_cost=cost,
            code=code,
            status="active",
        )

    return Response(
        {
            "detail": f"Voucher for '{reward['title']}' redeemed successfully!",
            "voucher": RewardVoucherSerializer(voucher).data,
            "paw_points": locked_profile.paw_points,
            "pawPoints": locked_profile.paw_points,
        },
        status=status.HTTP_201_CREATED,
    )
