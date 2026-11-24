from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoyaltyTransactionViewSet,
    RewardVoucherViewSet,
    redeem_reward_view,
)

router = DefaultRouter()
router.register("transactions", LoyaltyTransactionViewSet, basename="loyaltytransaction")
router.register("vouchers", RewardVoucherViewSet, basename="rewardvoucher")

urlpatterns = [
    path("redeem/", redeem_reward_view, name="loyalty-redeem"),
    path("", include(router.urls)),
]
