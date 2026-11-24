from rest_framework import serializers
from .models import LoyaltyTransaction, RewardVoucher


class LoyaltyTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyTransaction
        fields = ["id", "user", "points", "reason", "order", "reservation", "created_at"]
        read_only_fields = fields


class RewardVoucherSerializer(serializers.ModelSerializer):
    class Meta:
        model = RewardVoucher
        fields = [
            "id",
            "reward_type",
            "title",
            "points_cost",
            "code",
            "status",
            "order",
            "reservation",
            "created_at",
            "used_at",
        ]
        read_only_fields = fields
