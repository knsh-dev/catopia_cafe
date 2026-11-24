from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ResidentCatViewSet, FavoriteCatViewSet

router = DefaultRouter()
router.register("residents", ResidentCatViewSet, basename="residentcat")
router.register("favorites", FavoriteCatViewSet, basename="favoritecat")

urlpatterns = [
    path("", ResidentCatViewSet.as_view({"get": "list"}), name="cats-root"),
    path("", include(router.urls)),
]
