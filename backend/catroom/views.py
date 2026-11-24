from datetime import date as date_type, time, datetime, timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsStaffOrAdmin, IsOwnerOrStaff
from .models import CatRoomReservation, CatRoomSlotBlock, CatRoomConfig
from .serializers import (
    CatRoomReservationSerializer,
    CatRoomSlotBlockSerializer,
    CreateReservationSerializer,
    CatRoomSettingsSerializer,
    SlotSerializer,
)


def get_room_config():
    cfg = CatRoomConfig.objects.order_by("id").first()
    if not cfg:
        try:
            rate = Decimal(str(getattr(settings, "CATROOM_HOURLY_RATE", "300.00")))
        except Exception:
            rate = Decimal("300.00")
        try:
            deposit = Decimal(str(getattr(settings, "CATROOM_MIN_DEPOSIT", "150.00")))
        except Exception:
            deposit = Decimal("150.00")
        cfg = CatRoomConfig.objects.create(
            hourly_rate=rate,
            max_visitors=getattr(settings, "CATROOM_MAX_VISITORS", 8),
            min_deposit=deposit,
            opening_hour=getattr(settings, "CAFE_OPENING_HOUR", 10),
            closing_hour=getattr(settings, "CAFE_CLOSING_HOUR", 21),
            hold_minutes=getattr(settings, "CATROOM_HOLD_MINUTES", 15),
            cancel_cutoff_hours=getattr(settings, "CATROOM_CANCEL_CUTOFF_HOURS", 24),
            daily_rest_hours=["14:00"],
        )
    else:
        # Clean up any accidental duplicate config rows so singleton stays consistent
        CatRoomConfig.objects.exclude(pk=cfg.pk).delete()
    return cfg


class CatRoomSettingsView(APIView):
    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT", "POST"):
            return [IsStaffOrAdmin()]
        return [AllowAny()]

    def _build_response(self, cfg):
        data = {
            "hourly_rate": f"{Decimal(str(cfg.hourly_rate)):.2f}",
            "max_visitors": int(cfg.max_visitors),
            "min_deposit": f"{Decimal(str(cfg.min_deposit)):.2f}",
            "opening_hour": int(cfg.opening_hour),
            "closing_hour": int(cfg.closing_hour),
            "hold_minutes": int(cfg.hold_minutes),
            "cancel_cutoff_hours": int(cfg.cancel_cutoff_hours),
            "daily_rest_hours": cfg.daily_rest_hours if cfg.daily_rest_hours is not None else [],
        }
        serializer = CatRoomSettingsSerializer(data)
        resp = Response(serializer.data)
        resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
        resp["Pragma"] = "no-cache"
        return resp

    def get(self, request):
        cfg = get_room_config()
        return self._build_response(cfg)

    def patch(self, request):
        cfg = get_room_config()
        decimal_fields = ("hourly_rate", "min_deposit")
        int_fields = (
            "max_visitors", "opening_hour", "closing_hour",
            "hold_minutes", "cancel_cutoff_hours",
        )

        for f in decimal_fields:
            if f in request.data and request.data[f] not in (None, ""):
                try:
                    val = Decimal(str(request.data[f])).quantize(Decimal("0.01"))
                    if val >= Decimal("0.00"):
                        setattr(cfg, f, val)
                except Exception:
                    return Response(
                        {f: "Invalid decimal value."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        for f in int_fields:
            if f in request.data and request.data[f] not in (None, ""):
                try:
                    val = int(float(str(request.data[f])))
                    if f == "max_visitors" and val < 1:
                        val = 1
                    setattr(cfg, f, val)
                except Exception:
                    return Response(
                        {f: "Invalid integer value."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        if "daily_rest_hours" in request.data:
            raw_hours = request.data.get("daily_rest_hours") or []
            if isinstance(raw_hours, list):
                normalized_hours = []
                for h in raw_hours:
                    if not h:
                        continue
                    h_str = str(h).strip()
                    if ":" in h_str:
                        parts = h_str.split(":")
                        try:
                            normalized_hours.append(f"{int(parts[0]):02d}:{int(parts[1]):02d}")
                        except ValueError:
                            continue
                    else:
                        try:
                            normalized_hours.append(f"{int(h_str):02d}:00")
                        except ValueError:
                            continue
                cfg.daily_rest_hours = sorted(list(set(normalized_hours)))

                # Clear date-specific 'unblocked' overrides for newly configured daily rest hours
                # so the updated daily rest schedule takes effect immediately across all dates.
                rest_time_objs = []
                for h_str in cfg.daily_rest_hours:
                    try:
                        rest_time_objs.append(time.fromisoformat(h_str[:5]))
                    except ValueError:
                        pass
                if rest_time_objs:
                    CatRoomSlotBlock.objects.filter(
                        slot_start__in=rest_time_objs,
                        reason="unblocked",
                    ).delete()
                # Also clean up stale 'unblocked' or 'rest_hours' blocks for hours no longer in daily_rest_hours
                CatRoomSlotBlock.objects.filter(
                    reason__in=["unblocked", "rest_hours"]
                ).exclude(slot_start__in=rest_time_objs).delete()

        cfg.save()
        CatRoomConfig.objects.exclude(pk=cfg.pk).delete()
        return self._build_response(cfg)

    def put(self, request):
        return self.patch(request)


class CatRoomSlotsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        date_str = request.query_params.get("date")
        if not date_str:
            return Response(
                {"date": "This query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            query_date = date_type.fromisoformat(date_str)
        except ValueError:
            return Response(
                {"date": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cfg = get_room_config()
        opening = cfg.opening_hour
        closing = cfg.closing_hour
        capacity = cfg.max_visitors
        daily_rest = set(cfg.daily_rest_hours or [])
        now = timezone.localtime()

        from django.db.models import Sum

        active_statuses = ["pending_payment", "confirmed", "rescheduled"]
        active_res = (
            CatRoomReservation.objects.filter(date=query_date, status__in=active_statuses)
            .exclude(status="pending_payment", hold_expires_at__lt=now)
            .values("slot_start")
            .annotate(total_visitors=Sum("visitors"))
        )

        booked_by_slot = {}
        for item in active_res:
            s = item["slot_start"]
            key = s.strftime("%H:%M") if hasattr(s, "strftime") else str(s)[:5]
            booked_by_slot[key] = item["total_visitors"] or 0

        blocked_slots = set(
            CatRoomSlotBlock.objects.filter(
                date=query_date, reason="blocked"
            ).values_list("slot_start", flat=True)
        )
        unblocked_overrides = set(
            CatRoomSlotBlock.objects.filter(
                date=query_date, reason="unblocked"
            ).values_list("slot_start", flat=True)
        )

        slots = []
        for hour in range(opening, closing):
            slot_start = time(hour, 0)
            slot_end = time(hour + 1, 0) if hour + 1 < 24 else time(0, 0)
            time_str = slot_start.strftime("%H:%M")

            booked_visitors = booked_by_slot.get(time_str, 0)
            spots_left = max(0, capacity - booked_visitors)

            is_daily_rest = (time_str in daily_rest) and (slot_start not in unblocked_overrides)
            is_blocked = is_daily_rest or (slot_start in blocked_slots)

            if query_date < now.date():
                state = "past"
            elif query_date == now.date() and slot_start <= now.time():
                state = "past"
            elif is_blocked:
                state = "blocked"
                spots_left = 0
            elif spots_left <= 0:
                state = "booked"
                spots_left = 0
            else:
                state = "available"

            slots.append({
                "slot_start": slot_start,
                "slot_end": slot_end,
                "state": state,
                "capacity": capacity,
                "max_capacity": capacity,
                "remaining_spots": spots_left,
                "spots_left": spots_left,
                "booked_visitors": booked_visitors,
            })

        serializer = SlotSerializer(slots, many=True)
        resp = Response(serializer.data)
        resp["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
        resp["Pragma"] = "no-cache"
        return resp


class CatRoomReservationViewSet(viewsets.ModelViewSet):
    serializer_class = CatRoomReservationSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return CatRoomReservation.objects.none()

        is_staff_or_admin = (
            user.groups.filter(name__in=["staff", "admin"]).exists()
            or getattr(user, "is_staff", False)
            or getattr(user, "is_superuser", False)
        )

        mine_param = self.request.query_params.get("mine")
        customer_param = self.request.query_params.get("customer")

        # Strictly scope to current authenticated user's ID unless staff/admin explicitly requesting all
        if not is_staff_or_admin or mine_param in ("true", "1") or customer_param == "me":
            qs = CatRoomReservation.objects.filter(customer_id=user.id).select_related("customer").prefetch_related("payments")
        else:
            qs = CatRoomReservation.objects.all().select_related("customer").prefetch_related("payments")

        date_param = self.request.query_params.get("date")
        if date_param:
            qs = qs.filter(date=date_param)
        status_param = self.request.query_params.get("status")
        if status_param and status_param != "all":
            qs = qs.filter(status=status_param)
        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(customer__username__icontains=search)
                | Q(customer__email__icontains=search)
                | Q(customer__first_name__icontains=search)
                | Q(customer__last_name__icontains=search)
            )
        return qs.order_by("-date", "-slot_start")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
        response["Pragma"] = "no-cache"
        return response

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        response["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
        response["Pragma"] = "no-cache"
        return response

    def get_serializer_class(self):
        if self.action == "create":
            return CreateReservationSerializer
        return CatRoomReservationSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "create", "cancel", "verify_payment"):
            return [IsAuthenticated()]
        if self.action in ("approve", "reschedule", "walkin"):
            return [IsStaffOrAdmin()]
        return [IsOwnerOrStaff()]

    @action(detail=True, methods=["post"], url_path="verify-payment")
    def verify_payment(self, request, pk=None):
        from payments import xendit_service
        from payments.views import confirm_paid_payment

        reservation = self.get_object()
        payment = reservation.payments.order_by("-created_at").first()
        if not payment:
            return Response(CatRoomReservationSerializer(reservation).data, status=status.HTTP_200_OK)

        if payment.status == "paid":
            confirm_paid_payment(payment)
            reservation.refresh_from_db()
            return Response(CatRoomReservationSerializer(reservation).data, status=status.HTTP_200_OK)

        invoice_data = None
        if payment.xendit_invoice_id:
            try:
                invoice_data = xendit_service.get_invoice(payment.xendit_invoice_id)
            except Exception:
                pass
        if not invoice_data and payment.reference_number:
            try:
                invoice_data = xendit_service.get_invoice_by_external_id(payment.reference_number)
            except Exception:
                pass

        if isinstance(invoice_data, dict):
            x_status = invoice_data.get("status", "").upper()
            if x_status in ("PAID", "SETTLED"):
                confirm_paid_payment(payment, invoice_data)
                reservation.refresh_from_db()
            elif payment.status == "pending" and x_status in ("EXPIRED", "FAILED"):
                payment.status = x_status.lower()
                payment.raw_payload = invoice_data
                payment.save(update_fields=["status", "raw_payload", "updated_at"])

        return Response(CatRoomReservationSerializer(reservation).data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = CreateReservationSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        reservation = serializer.save()
        output = CatRoomReservationSerializer(reservation)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post", "patch"], permission_classes=[IsStaffOrAdmin])
    def approve(self, request, pk=None):
        from django.db import IntegrityError
        reservation = self.get_object()
        if reservation.status in ("cancelled", "completed"):
            return Response(
                {"detail": f"Cannot approve a reservation that is already {reservation.get_status_display().lower()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reservation.status = "confirmed"
        reservation.hold_expires_at = None
        try:
            reservation.save(update_fields=["status", "hold_expires_at", "updated_at"])
        except IntegrityError as exc:
            return Response(
                {"detail": str(exc) or "Slot capacity exceeded for this reservation."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(CatRoomReservationSerializer(reservation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[IsStaffOrAdmin])
    def reschedule(self, request, pk=None):
        reservation = self.get_object()
        new_date_str = request.data.get("date")
        new_slot_str = request.data.get("slot_start")
        if not new_date_str or not new_slot_str:
            return Response({"detail": "Both 'date' and 'slot_start' are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            new_date = date_type.fromisoformat(new_date_str)
            new_slot = time.fromisoformat(new_slot_str[:5])
        except ValueError:
            return Response({"detail": "Invalid date or time format."}, status=status.HTTP_400_BAD_REQUEST)

        # Check capacity
        cfg = get_room_config()
        now = timezone.localtime()
        from django.db.models import Sum
        active_res = (
            CatRoomReservation.objects.filter(
                date=new_date, slot_start=new_slot, status__in=["pending_payment", "confirmed", "rescheduled"]
            )
            .exclude(status="pending_payment", hold_expires_at__lt=now)
            .exclude(pk=reservation.pk)
        )
        booked = active_res.aggregate(total=Sum("visitors"))["total"] or 0
        if booked + reservation.visitors > cfg.max_visitors:
            return Response(
                {"detail": f"Selected slot does not have enough capacity. Only {max(0, cfg.max_visitors - booked)} spots left."},
                status=status.HTTP_400_BAD_REQUEST
            )

        blocked = CatRoomSlotBlock.objects.filter(date=new_date, slot_start=new_slot, reason="blocked").exists()
        unblocked_override = CatRoomSlotBlock.objects.filter(date=new_date, slot_start=new_slot, reason="unblocked").exists()
        time_str = new_slot.strftime("%H:%M")
        if blocked or (time_str in (cfg.daily_rest_hours or []) and not unblocked_override):
            return Response({"detail": "Selected slot is blocked."}, status=status.HTTP_400_BAD_REQUEST)

        reservation.date = new_date
        reservation.slot_start = new_slot
        reservation.status = "rescheduled"
        reservation.save(update_fields=["date", "slot_start", "status", "updated_at"])
        return Response(CatRoomReservationSerializer(reservation).data)

    @action(detail=False, methods=["post"], permission_classes=[IsStaffOrAdmin])
    def walkin(self, request):
        date_str = request.data.get("date") or timezone.localdate().isoformat()
        slot_start_str = request.data.get("slot_start")
        visitors = int(request.data.get("visitors", 1))
        if not slot_start_str:
            return Response({"detail": "slot_start is required."}, status=status.HTTP_400_BAD_REQUEST)
        slot_start = time.fromisoformat(slot_start_str[:5])
        cfg = get_room_config()
        now = timezone.localtime()

        # Validate capacity for walk-in
        from django.db.models import Sum
        active_res = (
            CatRoomReservation.objects.filter(
                date=date_type.fromisoformat(date_str), slot_start=slot_start,
                status__in=["pending_payment", "confirmed", "rescheduled"]
            )
            .exclude(status="pending_payment", hold_expires_at__lt=now)
        )
        booked = active_res.aggregate(total=Sum("visitors"))["total"] or 0
        if booked + visitors > cfg.max_visitors:
            return Response(
                {"detail": f"Not enough capacity. Only {max(0, cfg.max_visitors - booked)} spots remaining."},
                status=status.HTTP_400_BAD_REQUEST
            )

        fee = (cfg.hourly_rate * Decimal(visitors)).quantize(Decimal("0.01"))
        reservation = CatRoomReservation.objects.create(
            customer=request.user,
            date=date_type.fromisoformat(date_str),
            slot_start=slot_start,
            visitors=visitors,
            fee=fee,
            payment_option="full",
            amount_due=Decimal("0.00"),
            policy_acknowledged=True,
            status="confirmed",
        )
        return Response(CatRoomReservationSerializer(reservation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        is_staff = request.user.groups.filter(name__in=["staff", "admin"]).exists() or request.user.is_superuser
        if not is_staff and reservation.customer != request.user:
            return Response(
                {"detail": "You can only cancel your own reservations."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if reservation.status not in ("pending_payment", "confirmed", "rescheduled"):
            return Response(
                {"detail": "This reservation cannot be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not is_staff and reservation.status == "confirmed":
            cfg = get_room_config()
            cutoff_hours = cfg.cancel_cutoff_hours if cfg and cfg.cancel_cutoff_hours is not None else settings.CATROOM_CANCEL_CUTOFF_HOURS
            slot_dt = timezone.make_aware(
                datetime.combine(reservation.date, reservation.slot_start)
            )
            if timezone.now() > slot_dt - timedelta(hours=cutoff_hours):
                return Response(
                    {"detail": f"Cancellations must be made at least {cutoff_hours} hours before the slot."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        reservation.status = "cancelled"
        reservation.save(update_fields=["status", "updated_at"])
        return Response(CatRoomReservationSerializer(reservation).data)


class CatRoomSlotBlockViewSet(viewsets.ModelViewSet):
    queryset = CatRoomSlotBlock.objects.all()
    serializer_class = CatRoomSlotBlockSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsStaffOrAdmin()]

    @action(detail=False, methods=["post"], permission_classes=[IsStaffOrAdmin])
    def unblock(self, request):
        date_str = request.data.get("date")
        slot_str = request.data.get("slot_start") or request.data.get("hour")
        if not date_str or not slot_str:
            return Response({"detail": "Both 'date' and 'slot_start' are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            q_date = date_type.fromisoformat(date_str)
            if "AM" in slot_str.upper() or "PM" in slot_str.upper():
                q_slot = datetime.strptime(slot_str.strip(), "%I:%M %p").time()
            else:
                q_slot = time.fromisoformat(slot_str[:5])
        except ValueError:
            return Response({"detail": "Invalid date or time format."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Delete any manual block for this date & slot
        CatRoomSlotBlock.objects.filter(date=q_date, slot_start=q_slot).delete()

        # 2. Check if this hour is in daily_rest_hours
        cfg = get_room_config()
        time_str = q_slot.strftime("%H:%M")
        if time_str in (cfg.daily_rest_hours or []):
            CatRoomSlotBlock.objects.update_or_create(
                date=q_date,
                slot_start=q_slot,
                defaults={"reason": "unblocked", "note": f"Date override unblock for {date_str}"}
            )

        return Response({"detail": f"Slot {q_slot.strftime('%H:%M')} on {date_str} unblocked successfully."})

    @action(detail=False, methods=["post"], permission_classes=[IsStaffOrAdmin])
    def block(self, request):
        date_str = request.data.get("date")
        slot_str = request.data.get("slot_start") or request.data.get("hour")
        if not date_str or not slot_str:
            return Response({"detail": "Both 'date' and 'slot_start' are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            q_date = date_type.fromisoformat(date_str)
            if "AM" in slot_str.upper() or "PM" in slot_str.upper():
                q_slot = datetime.strptime(slot_str.strip(), "%I:%M %p").time()
            else:
                q_slot = time.fromisoformat(slot_str[:5])
        except ValueError:
            return Response({"detail": "Invalid date or time format."}, status=status.HTTP_400_BAD_REQUEST)

        CatRoomSlotBlock.objects.update_or_create(
            date=q_date,
            slot_start=q_slot,
            defaults={"reason": "blocked", "note": "Manually blocked"}
        )
        return Response({"detail": f"Slot {q_slot.strftime('%H:%M')} on {date_str} blocked successfully."})
