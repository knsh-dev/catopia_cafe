from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def cafe_info(request):
    """Public endpoint: returns cafe metadata synced with live Cat Room settings."""
    from catroom.views import get_room_config
    cfg = get_room_config()
    resp = Response({
        "name": settings.CAFE_NAME,
        "address": settings.CAFE_ADDRESS,
        "phone": settings.CAFE_PHONE,
        "email": settings.CAFE_EMAIL,
        "latitude": settings.CAFE_LATITUDE,
        "longitude": settings.CAFE_LONGITUDE,
        "opening_hour": cfg.opening_hour if cfg else settings.CAFE_OPENING_HOUR,
        "closing_hour": cfg.closing_hour if cfg else settings.CAFE_CLOSING_HOUR,
        "catroom_hourly_rate": f"{cfg.hourly_rate:.2f}" if cfg else str(settings.CATROOM_HOURLY_RATE),
        "catroom_max_visitors": cfg.max_visitors if cfg else settings.CATROOM_MAX_VISITORS,
        "catroom_min_deposit": f"{cfg.min_deposit:.2f}" if cfg else str(getattr(settings, "CATROOM_MIN_DEPOSIT", "150.00")),
        "catroom_daily_rest_hours": (cfg.daily_rest_hours if cfg and cfg.daily_rest_hours is not None else ["14:00"]),
    })
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
    resp["Pragma"] = "no-cache"
    return resp
