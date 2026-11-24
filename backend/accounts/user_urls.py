from django.urls import path
from . import views

urlpatterns = [
    path("me/", views.user_me_view, name="user-me"),
    path("me/password/", views.change_password_view, name="user-password"),
    path("me/reservations/", views.user_reservations_view, name="user-reservations"),
    path("me/orders/", views.user_orders_view, name="user-orders"),
    path("me/loyalty/", views.user_loyalty_view, name="user-loyalty"),
    path("me/favorites/", views.user_favorites_view, name="user-favorites"),
]
