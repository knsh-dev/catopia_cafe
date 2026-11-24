from django.urls import path
from .cafe_views import cafe_info

urlpatterns = [
    path("info/", cafe_info, name="cafe-info"),
]
