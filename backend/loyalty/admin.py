from django.contrib import admin
from .models import LoyaltyTransaction


@admin.register(LoyaltyTransaction)
class LoyaltyTransactionAdmin(admin.ModelAdmin):
    list_display = ["user", "points", "reason", "created_at"]
    list_filter = ["reason"]
    search_fields = ["user__username"]
