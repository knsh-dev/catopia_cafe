from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .serializers import (
    RegisterSerializer,
    UserSerializer,
    UserProfileDetailSerializer,
    UserUpdateSerializer,
    PasswordChangeSerializer,
)


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_token_view(request):
    """Return a CSRF token for the React frontend and ensure the csrftoken cookie is set."""
    token = get_token(request)
    resp = Response({"csrfToken": token})
    resp["X-CSRFToken"] = token
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
    resp["Pragma"] = "no-cache"
    return resp


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    login(request, user)
    token = get_token(request)
    data = dict(UserProfileDetailSerializer(user).data)
    data["csrfToken"] = token
    resp = Response(data, status=status.HTTP_201_CREATED)
    resp["X-CSRFToken"] = token
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
    resp["Pragma"] = "no-cache"
    return resp


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    identifier = (request.data.get("username") or request.data.get("email") or "").strip()
    password = request.data.get("password", "")

    # Check if identifier is an email
    username_to_auth = identifier
    if "@" in identifier:
        try:
            matched_user = User.objects.get(email__iexact=identifier)
            username_to_auth = matched_user.username
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            pass

    user = authenticate(request, username=username_to_auth, password=password)
    if user is None:
        return Response(
            {"detail": "Invalid credentials."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    login(request, user)
    token = get_token(request)
    data = dict(UserProfileDetailSerializer(user).data)
    data["csrfToken"] = token
    resp = Response(data)
    resp["X-CSRFToken"] = token
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
    resp["Pragma"] = "no-cache"
    return resp


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    if request.user.is_authenticated:
        request.session.flush()
        logout(request)
    resp = Response({"detail": "Logged out."})
    cookie_domain = getattr(settings, "SESSION_COOKIE_DOMAIN", None)
    resp.delete_cookie(settings.SESSION_COOKIE_NAME, path="/", domain=cookie_domain)
    resp.delete_cookie(settings.CSRF_COOKIE_NAME, path="/", domain=cookie_domain)
    resp.delete_cookie("sessionid", path="/")
    resp.delete_cookie("csrftoken", path="/")
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
    resp["Pragma"] = "no-cache"
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    token = get_token(request)
    data = dict(UserProfileDetailSerializer(request.user).data)
    data["csrfToken"] = token
    resp = Response(data)
    resp["X-CSRFToken"] = token
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
    resp["Pragma"] = "no-cache"
    return resp


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def user_me_view(request):
    """
    GET /api/users/me/ -> returns user details with profile stats.
    PATCH /api/users/me/ -> updates name, email, phone, avatar.
    """
    if request.method == "GET":
        serializer = UserProfileDetailSerializer(request.user)
        return Response(serializer.data)

    elif request.method == "PATCH":
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()
        return Response(UserProfileDetailSerializer(updated_user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """
    POST /api/users/me/password/
    Validates current password, validates new password against Django validators,
    updates password, and keeps the current session active.
    """
    serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    new_password = serializer.validated_data["new_password"]
    request.user.set_password(new_password)
    request.user.save()

    # Keep session active
    update_session_auth_hash(request, request.user)

    return Response({"detail": "Password updated successfully."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_reservations_view(request):
    """
    GET /api/users/me/reservations/
    Returns user's reservations split into upcoming and past.
    """
    from catroom.models import CatRoomReservation
    from catroom.serializers import CatRoomReservationSerializer

    today = timezone.localdate()
    qs = CatRoomReservation.objects.filter(customer_id=request.user.id).order_by("-date", "-slot_start")

    upcoming = []
    past = []
    for res in qs:
        data = CatRoomReservationSerializer(res).data
        # Reservation is upcoming if date >= today and not completed or cancelled
        if res.date >= today and res.status in ["pending_payment", "confirmed", "rescheduled"]:
            upcoming.append(data)
        else:
            past.append(data)

    resp = Response({
        "upcoming": upcoming,
        "past": past,
        "total": len(upcoming) + len(past),
    })
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
    resp["Pragma"] = "no-cache"
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_orders_view(request):
    """
    GET /api/users/me/orders/
    Returns user's orders enriched with receipt metadata.
    """
    from orders.models import Order
    from orders.serializers import OrderSerializer
    from payments.models import Payment

    orders = Order.objects.filter(customer=request.user).prefetch_related("items").order_by("-created_at")
    results = []

    payments_map = {
        p.order_id: p
        for p in Payment.objects.filter(customer=request.user, order__isnull=False, status="paid")
    }

    for order in orders:
        order_data = OrderSerializer(order).data
        payment = payments_map.get(order.id)
        if payment:
            order_data["receipt"] = {
                "payment_id": payment.id,
                "receipt_number": payment.receipt_number,
                "paid_at": payment.paid_at,
                "amount": str(payment.amount),
            }
        else:
            order_data["receipt"] = None
        results.append(order_data)

    return Response(results)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_loyalty_view(request):
    """
    GET /api/users/me/loyalty/
    Returns spendable paw points balance, lifetime paw points, membership tier,
    stamp card progress, transaction history, active reward vouchers, and redeemable items.
    """
    from loyalty.models import LoyaltyTransaction, RewardVoucher
    from loyalty.serializers import LoyaltyTransactionSerializer, RewardVoucherSerializer
    from orders.models import Order

    user = request.user
    profile = getattr(user, "profile", None)
    paw_points = (getattr(profile, "paw_points", 0) or getattr(profile, "loyalty_points", 0)) if profile else 0
    lifetime_paw_points = (getattr(profile, "lifetime_paw_points", 0) or paw_points) if profile else 0
    stamps_count = getattr(profile, "stamps_count", 0) if profile else 0
    free_treats = getattr(profile, "free_treats_available", 0) if profile else 0

    # Membership tiers based on lifetime points:
    # Kitten (0-799), Tabby Club (800-2499), Tubby Club (2500+)
    if lifetime_paw_points >= 2500:
        tier = "Tubby Club"
        next_tier = None
        points_to_next = 0
        tier_progress = 100.0
        earn_rate = 1.5
        earn_rate_label = "1.5 pts per ₱10 spent"
    elif lifetime_paw_points >= 800:
        tier = "Tabby Club"
        next_tier = "Tubby Club"
        points_to_next = max(0, 2500 - lifetime_paw_points)
        tier_progress = min(100.0, round(((lifetime_paw_points - 800) / 1700.0) * 100.0, 1))
        earn_rate = 1.25
        earn_rate_label = "1.25 pts per ₱10 spent"
    else:
        tier = "Kitten"
        next_tier = "Tabby Club"
        points_to_next = max(0, 800 - lifetime_paw_points)
        tier_progress = min(100.0, round((lifetime_paw_points / 800.0) * 100.0, 1))
        earn_rate = 1.0
        earn_rate_label = "1 pt per ₱10 spent"

    is_tabby = lifetime_paw_points >= 800

    tier_perks_info = {
        "Kitten": {
            "name": "Kitten",
            "threshold": "0–799 pts",
            "spend_equivalent": "₱0–₱7,999 spend",
            "earn_rate": "1 pt per ₱10 spent",
            "bonus": None,
            "perks": [
                "Earn 1 Paw Point per ₱10 net spent",
                "1 stamp per qualifying drink/pastry/food",
                "Stamp Card: Free treat every 10 stamps",
            ],
        },
        "Tabby Club": {
            "name": "Tabby Club",
            "threshold": "800–2,499 pts",
            "spend_equivalent": "₱8,000–₱24,999 spend",
            "earn_rate": "1.25 pts per ₱10 spent (+25% boost)",
            "bonus": "+30 Bonus Points upon unlocking",
            "perks": [
                "Earn 1.25 Paw Points per ₱10 net spent (+25% boost)",
                "+30 one-time Paw Points bonus on unlock",
                "Free Drink Customization (oat/soy milk, extra espresso shot, or flavored syrup) on 1 drink per order (-₱30.00)",
            ],
        },
        "Tubby Club": {
            "name": "Tubby Club",
            "threshold": "2,500+ pts",
            "spend_equivalent": "₱25,000+ spend",
            "earn_rate": "1.5 pts per ₱10 spent (+50% boost)",
            "bonus": "+75 Bonus Points upon unlocking",
            "perks": [
                "Earn 1.5 Paw Points per ₱10 net spent (+50% boost)",
                "+75 one-time Paw Points bonus on unlock",
                "Free Drink Size Upgrade + Free Customization on 1 drink per order (-₱50.00)",
                "Priority Cat Room Booking & complimentary 15-min weekday extension",
            ],
        },
    }

    # Stamp card:
    # If a free treat is unlocked (free_treats > 0 or stamps_count >= 10), progress shows 10/10
    has_free_treat = free_treats > 0 or stamps_count >= 10
    active_stamps = 10 if has_free_treat else (stamps_count % 10)
    remaining_stamps = 0 if has_free_treat else (10 - active_stamps)

    history = LoyaltyTransaction.objects.filter(user=user).order_by("-created_at")[:20]
    history_data = LoyaltyTransactionSerializer(history, many=True).data

    active_vouchers = RewardVoucher.objects.filter(user=user, status="active").order_by("-created_at")
    vouchers_data = RewardVoucherSerializer(active_vouchers, many=True).data

    rewards = [
        {"id": 1, "reward_type": "free_drink", "title": "Any Drink On Us", "points": 400, "description": "Coffee or tea, any size"},
        {"id": 2, "reward_type": "free_pastry", "title": "Free Pastry", "points": 300, "description": "From the morning case"},
        {"id": 3, "reward_type": "catroom_50", "title": "50% Off A Cat Room Hour", "points": 600, "description": "One guest, weekday Mon–Thu"},
        {"id": 4, "reward_type": "free_mug", "title": "Catopia Café Ceramic Mug", "points": 900, "description": "Limited glaze edition"},
    ]

    return Response({
        "points": paw_points,
        "paw_points": paw_points,
        "pawPoints": paw_points,
        "lifetime_paw_points": lifetime_paw_points,
        "lifetimePawPoints": lifetime_paw_points,
        "tier": tier,
        "next_tier": next_tier,
        "points_to_next_tier": points_to_next,
        "tier_progress": tier_progress,
        "earn_rate": earn_rate,
        "earn_rate_label": earn_rate_label,
        "tier_perks": tier_perks_info,
        "is_tabby": is_tabby,
        "is_tubby": tier == "Tubby Club",
        "stamp_card": {
            "stamps": active_stamps,
            "stamps_count": stamps_count,
            "stampsCount": stamps_count,
            "max_stamps": 10,
            "free_treats_available": free_treats,
            "freeTreatsAvailable": free_treats,
            "has_free_treat": has_free_treat,
            "items_until_free": remaining_stamps,
        },
        "vouchers": vouchers_data,
        "history": history_data,
        "rewards": rewards,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_favorites_view(request):
    """
    GET /api/users/me/favorites/
    Returns list of favorite resident cats for the current user.
    """
    from cats.models import FavoriteCat
    from cats.serializers import ResidentCatSerializer

    favorites = FavoriteCat.objects.filter(user=request.user).select_related("cat")
    cats = [fav.cat for fav in favorites if fav.cat.is_active]
    serializer = ResidentCatSerializer(cats, many=True, context={"request": request})
    return Response(serializer.data)
