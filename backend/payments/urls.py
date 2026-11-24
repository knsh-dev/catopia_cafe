from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PaymentViewSet,
    CheckoutView,
    XenditWebhookView,
    ReceiptView,
    RefundView,
    PaymentStatusView,
    SyncPaymentsView,
)

router = DefaultRouter()
router.register("", PaymentViewSet, basename="payment")

urlpatterns = [
    path("checkout/", CheckoutView.as_view(), name="checkout"),
    path("sync/", SyncPaymentsView.as_view(), name="payment-sync"),
    path("xendit/webhook/", XenditWebhookView.as_view(), name="xendit-webhook"),
    path("<int:pk>/receipt/", ReceiptView.as_view(), name="payment-receipt"),
    path("<int:pk>/refund/", RefundView.as_view(), name="payment-refund"),
    path("<int:pk>/status/", PaymentStatusView.as_view(), name="payment-status"),
    path("", include(router.urls)),
]
