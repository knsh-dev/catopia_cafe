from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CatRoomReservationViewSet,
    CatRoomSlotBlockViewSet,
    CatRoomSettingsView,
    CatRoomSlotsView,
)

router = DefaultRouter()
router.register("reservations", CatRoomReservationViewSet, basename="reservation")
router.register("blocked-slots", CatRoomSlotBlockViewSet, basename="slotblock")

urlpatterns = [
    path("settings/", CatRoomSettingsView.as_view(), name="catroom-settings"),
    path("slots/", CatRoomSlotsView.as_view(), name="catroom-slots"),
    path("", include(router.urls)),
]
