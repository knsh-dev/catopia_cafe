from django.contrib import admin
from .models import CatRoomReservation, CatRoomSlotBlock


@admin.register(CatRoomReservation)
class CatRoomReservationAdmin(admin.ModelAdmin):
    list_display = ["customer", "date", "slot_start", "visitors", "fee", "payment_option", "amount_due", "status", "hold_expires_at"]
    list_filter = ["status", "date", "payment_option"]
    search_fields = ["customer__username"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(CatRoomSlotBlock)
class CatRoomSlotBlockAdmin(admin.ModelAdmin):
    list_display = ["date", "slot_start", "reason", "note"]
    list_filter = ["reason"]
