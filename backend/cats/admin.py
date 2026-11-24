from django.contrib import admin
from .models import ResidentCat, FavoriteCat


@admin.register(ResidentCat)
class ResidentCatAdmin(admin.ModelAdmin):
    list_display = ["name", "age", "is_active"]
    list_filter = ["is_active"]


@admin.register(FavoriteCat)
class FavoriteCatAdmin(admin.ModelAdmin):
    list_display = ["user", "cat", "created_at"]
