from django.contrib import admin
from .models import MenuCategory, MenuItem, Review


@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display = [
        "name", "slug", "enable_sizing", "enable_temperature",
        "qualifies_for_stamps", "badge_tag", "sort_order", "is_visible",
    ]
    list_filter = ["is_visible", "enable_sizing", "enable_temperature", "qualifies_for_stamps"]
    search_fields = ["name", "slug", "badge_tag"]
    ordering = ["sort_order", "name"]


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = [
        "name", "category", "category_obj", "price",
        "is_available", "stock_quantity",
    ]
    list_filter = ["category", "category_obj", "is_available"]
    search_fields = ["name"]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["menu_item", "user", "rating", "headline", "created_at"]
    list_filter = ["rating", "created_at"]
    search_fields = ["headline", "comment", "menu_item__name", "user__username"]
