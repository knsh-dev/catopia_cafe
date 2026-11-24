from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MenuItemViewSet, MenuCategoryViewSet, ReviewViewSet

router = DefaultRouter()
router.register("categories", MenuCategoryViewSet, basename="menucategory")
router.register("items", MenuItemViewSet, basename="menuitem")
router.register("reviews", ReviewViewSet, basename="menureview")

urlpatterns = [
    path("", MenuItemViewSet.as_view({"get": "list"}), name="menu-root"),
    path("", include(router.urls)),
]
