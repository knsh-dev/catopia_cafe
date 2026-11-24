from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User, Group
from django.db import models
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsStaffOrAdmin, IsAdmin
from accounts.models import Profile
from cats.models import ResidentCat
from catroom.models import CatRoomReservation, CatRoomSlotBlock, CatRoomConfig
from loyalty.models import LoyaltyTransaction
from menu.models import MenuItem
from orders.models import Order, OrderItem
from orders.serializers import OrderSerializer
from payments.models import Payment


@api_view(["GET"])
@permission_classes([IsStaffOrAdmin])
def admin_overview_view(request):
    """
    GET /api/admin/overview/
    Returns high-level business analytics:
    - Today's revenue from paid payments only (PHP)
    - Hourly Cat Room occupancy rate (booked spots / total spots)
    - Active orders count & list
    - Awaiting approval bookings count
    - 7-day revenue chart data
    - Top-selling menu items
    - Registered members & cats ready counts
    """
    now = timezone.localtime()
    date_str = request.query_params.get("date")
    if date_str:
        try:
            target_date = timezone.datetime.fromisoformat(date_str).date()
        except Exception:
            target_date = now.date()
    else:
        target_date = now.date()

    # 1. Today's Revenue (paid payments only)
    paid_today_qs = Payment.objects.filter(
        status="paid",
        paid_at__date=target_date,
    )
    revenue_today = paid_today_qs.aggregate(total=models.Sum("amount"))["total"] or Decimal("0.00")
    paid_today_count = paid_today_qs.count()

    # 2. Cat Room Occupancy
    from catroom.views import get_room_config
    cfg = get_room_config()
    opening = cfg.opening_hour if cfg else 10
    closing = cfg.closing_hour if cfg else 21
    capacity = cfg.max_visitors if cfg else 8
    daily_rest = set(cfg.daily_rest_hours if cfg and cfg.daily_rest_hours is not None else ["14:00"])

    total_hours = max(1, closing - opening)
    total_spots = total_hours * capacity

    reservations_today = (
        CatRoomReservation.objects.filter(
            date=target_date,
            status__in=["pending_payment", "confirmed", "rescheduled", "completed"],
        )
        .exclude(status="pending_payment", hold_expires_at__lt=now)
    )
    booked_spots_total = reservations_today.aggregate(total=models.Sum("visitors"))["total"] or 0
    occupancy_pct = min(100.0, round((float(booked_spots_total) / float(total_spots)) * 100.0, 1))

    # Hourly slot occupancy breakdown (10 AM to 7 PM etc.)
    hourly_occupancy = []
    blocked_slots = set(
        CatRoomSlotBlock.objects.filter(
            date=target_date, reason="blocked"
        ).values_list("slot_start", flat=True)
    )
    unblocked_overrides = set(
        CatRoomSlotBlock.objects.filter(
            date=target_date, reason="unblocked"
        ).values_list("slot_start", flat=True)
    )

    for h in range(opening, closing):
        slot_time = timezone.datetime.strptime(f"{h:02d}:00", "%H:%M").time()
        time_label = slot_time.strftime("%I %p").lstrip("0")
        time_str = slot_time.strftime("%H:%M")

        slot_res = reservations_today.filter(slot_start=slot_time)
        slot_visitors = slot_res.aggregate(total=models.Sum("visitors"))["total"] or 0

        is_daily_rest = (time_str in daily_rest) and (slot_time not in unblocked_overrides)
        is_blocked = is_daily_rest or (slot_time in blocked_slots)
        status_label = "blocked" if is_blocked else "full" if slot_visitors >= capacity else "booked" if slot_visitors > 0 else "available"

        hourly_occupancy.append({
            "hour": h,
            "time": time_label,
            "booked": slot_visitors,
            "capacity": capacity,
            "status": status_label,
            "is_rest": is_daily_rest,
        })

    # 3. Revenue last 7 days
    revenue_7days = []
    for i in range(6, -1, -1):
        day = target_date - timedelta(days=i)
        day_rev = Payment.objects.filter(
            status="paid",
            paid_at__date=day,
        ).aggregate(total=models.Sum("amount"))["total"] or Decimal("0.00")
        revenue_7days.append({
            "date": day.isoformat(),
            "day": day.strftime("%a"),
            "revenue": float(day_rev),
        })

    # 4. Top-selling menu items (based on completed and paid orders, synchronized with public website)
    valid_sales_filter = (
        ~models.Q(order__status="cancelled")
        & ~models.Q(order__payment_status__in=["REFUNDED", "FAILED", "EXPIRED"])
        & (
            models.Q(order__payment_status__in=["PAID", "SETTLED"])
            | models.Q(order__status__in=["preparing", "ready", "completed"])
        )
    )
    top_items_qs = (
        OrderItem.objects.filter(valid_sales_filter)
        .values("menu_item_id", "menu_item__name", "name")
        .annotate(
            sold_count=models.Sum("quantity"),
            revenue=models.Sum(models.F("price") * models.F("quantity")),
        )
        .order_by("-sold_count", "-revenue", "name")[:5]
    )
    top_selling = [
        {
            "id": item["menu_item_id"],
            "name": item["name"] or item["menu_item__name"] or "Menu Item",
            "sold_count": item["sold_count"] or 0,
            "revenue": float(item["revenue"] or 0),
        }
        for item in top_items_qs
    ]

    # 5. Active orders
    active_orders_qs = (
        Order.objects.filter(status__in=["pending", "confirmed", "preparing", "ready"])
        .select_related("customer", "customer__profile")
        .prefetch_related("items", "payments")
        .order_by("-created_at")
    )
    active_orders_count = active_orders_qs.count()
    active_orders_data = OrderSerializer(active_orders_qs[:8], many=True).data

    # 6. Awaiting approval reservations
    awaiting_approval_count = CatRoomReservation.objects.filter(
        status="pending_payment"
    ).count()

    # 7. Summary counts
    registered_members_count = User.objects.filter(groups__name="customer").distinct().count()
    if registered_members_count == 0:
        registered_members_count = User.objects.count()

    cats_ready_count = ResidentCat.objects.filter(is_active=True, status="ready_to_play").count()
    cats_total_count = ResidentCat.objects.filter(is_active=True).count()

    resp = Response({
        "revenue_today": str(revenue_today),
        "paid_today_count": paid_today_count,
        "catroom_occupancy_rate": occupancy_pct,
        "booked_spots": booked_spots_total,
        "total_spots": total_spots,
        "hourly_occupancy": hourly_occupancy,
        "revenue_7days": revenue_7days,
        "top_selling": top_selling,
        "active_orders_count": active_orders_count,
        "active_orders": active_orders_data,
        "awaiting_approval_count": awaiting_approval_count,
        "registered_members_count": registered_members_count,
        "cats_ready_count": cats_ready_count,
        "cats_total_count": cats_total_count,
        "capacity_per_hour": capacity,
    })
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
    resp["Pragma"] = "no-cache"
    return resp


@api_view(["GET"])
@permission_classes([IsStaffOrAdmin])
def admin_customers_view(request):
    """
    GET /api/admin/customers/
    Returns customer directory with stats:
    - total members, total paw points outstanding, lifetime member spend
    - searchable list of members with paw points, tier, visits, orders, and spend
    - expandable booking history, order history, contact, and points adjustment
    """
    search = request.query_params.get("search", "").strip()

    customers = User.objects.all().select_related("profile").prefetch_related("groups").order_by("-date_joined", "id")
    if search:
        customers = customers.filter(
            models.Q(username__icontains=search)
            | models.Q(email__icontains=search)
            | models.Q(first_name__icontains=search)
            | models.Q(last_name__icontains=search)
            | models.Q(profile__phone__icontains=search)
        ).distinct()

    # Top aggregated cards
    total_members = User.objects.count()
    total_points = Profile.objects.aggregate(total=models.Sum("paw_points"))["total"] or 0
    lifetime_spend = Payment.objects.filter(status="paid").aggregate(total=models.Sum("amount"))["total"] or Decimal("0.00")

    results = []
    for u in customers:
        prof = getattr(u, "profile", None)
        paw_pts = int((prof.paw_points or prof.loyalty_points) or 0) if prof else 0
        lifetime_pts = int((prof.lifetime_paw_points or paw_pts) or 0) if prof else paw_pts
        tier = prof.tier if prof else "Kitten"
        phone = (prof.phone or "") if prof else ""

        # Visits & Orders
        visits_count = u.reservations.filter(status__in=["confirmed", "completed", "rescheduled"]).count()
        orders_count = u.orders.count()
        user_spend = Payment.objects.filter(customer=u, status="paid").aggregate(total=models.Sum("amount"))["total"] or Decimal("0.00")

        # Roles
        groups = list(u.groups.values_list("name", flat=True))
        role = (
            "admin"
            if "admin" in groups or u.is_superuser
            else "staff"
            if "staff" in groups or u.is_staff
            else "customer"
        )

        # Recent Bookings (last 4)
        recent_bookings = []
        for r in u.reservations.order_by("-date", "-slot_start")[:4]:
            slot_start_str = r.slot_start.strftime("%H:%M") if r.slot_start else ""
            slot_end_str = (
                (timezone.datetime.combine(r.date, r.slot_start) + timedelta(hours=1)).strftime("%H:%M")
                if r.date and r.slot_start
                else ""
            )
            recent_bookings.append({
                "id": r.id,
                "date": str(r.date),
                "slot_start": slot_start_str,
                "slot_end": slot_end_str,
                "visitors": r.visitors,
                "fee": str(r.fee),
                "status": r.status,
                "status_display": r.get_status_display(),
            })

        # Recent Orders (last 4)
        recent_orders = []
        for o in u.orders.order_by("-created_at")[:4]:
            recent_orders.append({
                "id": o.id,
                "items_count": o.items.count(),
                "total": str(o.total),
                "status": o.status,
                "payment_status": o.payment_status,
                "created_at": o.created_at.strftime("%b %d, %Y") if o.created_at else "",
            })

        # Favorite Cats
        fav_cats = list(u.favorite_cats.values_list("cat__name", flat=True))

        full_name = f"{u.first_name} {u.last_name}".strip() or u.username

        results.append({
            "id": u.id,
            "username": u.username,
            "full_name": full_name,
            "email": u.email,
            "phone": phone,
            "role": role,
            "paw_points": paw_pts,
            "lifetime_paw_points": lifetime_pts,
            "tier": tier,
            "visits_count": visits_count,
            "orders_count": orders_count,
            "total_spend": str(user_spend),
            "member_since": u.date_joined.strftime("%b %Y") if u.date_joined else "",
            "recent_bookings": recent_bookings,
            "recent_orders": recent_orders,
            "favorite_cats": fav_cats,
        })

    resp = Response({
        "stats": {
            "total_members": total_members,
            "paw_points_outstanding": total_points,
            "lifetime_member_spend": str(lifetime_spend),
        },
        "customers": results,
    })
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
    resp["Pragma"] = "no-cache"
    return resp


@api_view(["POST"])
@permission_classes([IsAdmin])
def admin_adjust_points_view(request, pk):
    """
    POST /api/admin/customers/<id>/adjust-points/
    Admin only: Adjust customer's Paw Points balance with an audit note.
    Records a LoyaltyTransaction.
    """
    try:
        target_user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    try:
        points_delta = int(request.data.get("points_delta", 0))
    except (ValueError, TypeError):
        return Response({"detail": "Invalid points_delta value."}, status=status.HTTP_400_BAD_REQUEST)

    if points_delta == 0:
        return Response({"detail": "points_delta cannot be zero."}, status=status.HTTP_400_BAD_REQUEST)

    reason = request.data.get("reason", "Admin point adjustment").strip() or "Admin point adjustment"

    prof, _ = Profile.objects.get_or_create(user=target_user)
    new_points = max(0, prof.paw_points + points_delta)
    prof.paw_points = new_points
    if points_delta > 0:
        prof.lifetime_paw_points = prof.lifetime_paw_points + points_delta
    prof.loyalty_points = prof.paw_points
    prof.save(update_fields=["paw_points", "lifetime_paw_points", "loyalty_points"])

    LoyaltyTransaction.objects.create(
        user=target_user,
        points=points_delta,
        reason=f"{reason} (by {request.user.username})",
    )

    return Response({
        "detail": f"Adjusted points by {points_delta:+d} points.",
        "paw_points": prof.paw_points,
        "lifetime_paw_points": prof.lifetime_paw_points,
        "tier": prof.tier,
    })


@api_view(["POST"])
@permission_classes([IsAdmin])
def admin_change_role_view(request, pk):
    """
    POST /api/admin/customers/<id>/role/
    Admin only: Update a user's role (customer, staff, admin).
    """
    try:
        target_user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    new_role = request.data.get("role", "").strip().lower()
    if new_role not in ("customer", "staff", "admin"):
        return Response({"detail": "Role must be 'customer', 'staff', or 'admin'."}, status=status.HTTP_400_BAD_REQUEST)

    # Protect self-demotion from superuser if admin
    if target_user == request.user and new_role != "admin":
        return Response({"detail": "You cannot remove your own admin privileges."}, status=status.HTTP_400_BAD_REQUEST)

    target_user.groups.clear()
    group, _ = Group.objects.get_or_create(name=new_role)
    target_user.groups.add(group)
    if new_role in ("staff", "admin"):
        target_user.is_staff = True
    else:
        target_user.is_staff = False
    target_user.save(update_fields=["is_staff"])

    return Response({
        "detail": f"Updated role to {new_role}.",
        "role": new_role,
    })
