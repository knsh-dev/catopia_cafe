from decimal import Decimal
from datetime import date as date_type, time, datetime, timedelta

from django.conf import settings
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import serializers

from .models import CatRoomReservation, CatRoomSlotBlock


class CatRoomSettingsSerializer(serializers.Serializer):
    hourly_rate = serializers.CharField()
    max_visitors = serializers.IntegerField()
    min_deposit = serializers.CharField()
    opening_hour = serializers.IntegerField()
    closing_hour = serializers.IntegerField()
    hold_minutes = serializers.IntegerField()
    cancel_cutoff_hours = serializers.IntegerField()
    daily_rest_hours = serializers.ListField(child=serializers.CharField(), required=False)


class SlotSerializer(serializers.Serializer):
    slot_start = serializers.TimeField()
    slot_end = serializers.TimeField()
    state = serializers.CharField()
    capacity = serializers.IntegerField(default=8)
    max_capacity = serializers.IntegerField(default=8)
    remaining_spots = serializers.IntegerField(default=8)
    spots_left = serializers.IntegerField(default=8)
    booked_visitors = serializers.IntegerField(default=0)


class CatRoomReservationSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    customer_phone = serializers.SerializerMethodField()
    slot_end = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    receipt = serializers.SerializerMethodField()

    class Meta:
        model = CatRoomReservation
        fields = [
            "id", "customer", "customer_name", "customer_email", "customer_phone",
            "date", "slot_start", "slot_end",
            "visitors", "fee", "payment_option", "amount_due",
            "policy_acknowledged", "status", "payment_status", "receipt",
            "hold_expires_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "customer", "fee", "amount_due", "status",
            "payment_status", "receipt",
            "hold_expires_at", "created_at", "updated_at",
        ]

    def get_customer_name(self, obj):
        if not obj.customer:
            return "Guest"
        name = f"{obj.customer.first_name} {obj.customer.last_name}".strip()
        return name or obj.customer.username

    def get_customer_phone(self, obj):
        prof = getattr(obj.customer, "profile", None)
        return prof.phone if prof else ""

    def get_slot_end(self, obj):
        from datetime import datetime as dt, timedelta
        combined = dt.combine(obj.date, obj.slot_start)
        return (combined + timedelta(hours=1)).time()

    def get_payment_status(self, obj):
        payments = list(obj.payments.all()) if hasattr(obj, "payments") else []
        if any(p.status == "paid" for p in payments):
            return "PAID"
        if any(p.status == "refunded" for p in payments):
            return "REFUNDED"
        if any(p.status == "pending" for p in payments):
            return "PENDING"
        return "UNPAID"

    def get_receipt(self, obj):
        payments = list(obj.payments.all()) if hasattr(obj, "payments") else []
        paid = next((p for p in payments if p.status == "paid"), None)
        if not paid:
            return None
        return {
            "payment_id": paid.id,
            "receipt_number": paid.receipt_number,
            "reference_number": paid.reference_number,
            "paid_at": paid.paid_at,
            "amount": str(paid.amount),
        }


class CreateReservationSerializer(serializers.Serializer):
    date = serializers.DateField()
    slot_start = serializers.TimeField()
    visitors = serializers.IntegerField(min_value=1)
    payment_option = serializers.ChoiceField(choices=["deposit", "full"])
    policy_acknowledged = serializers.BooleanField()
    voucher_code = serializers.CharField(required=False, allow_blank=True)

    def validate_policy_acknowledged(self, value):
        if not value:
            raise serializers.ValidationError("You must acknowledge the cat room policy.")
        return value

    def validate_date(self, value):
        today = timezone.localdate()
        if value < today:
            raise serializers.ValidationError("Cannot book a date in the past.")
        return value

    def validate_visitors(self, value):
        from catroom.views import get_room_config
        cfg = get_room_config()
        max_v = cfg.max_visitors if cfg else getattr(settings, "CATROOM_MAX_VISITORS", 10)
        if value > max_v:
            raise serializers.ValidationError(f"Maximum {max_v} visitors allowed.")
        return value

    def validate_slot_start(self, value):
        from catroom.views import get_room_config
        cfg = get_room_config()
        open_hr = cfg.opening_hour if cfg else settings.CAFE_OPENING_HOUR
        close_hr = cfg.closing_hour if cfg else settings.CAFE_CLOSING_HOUR
        opening = time(open_hr, 0)
        last_slot = time(max(open_hr, close_hr - 1), 0)
        if value < opening or value > last_slot:
            raise serializers.ValidationError(
                f"Slot must be between {opening.strftime('%I:%M %p')} and {last_slot.strftime('%I:%M %p')}."
            )
        if value.minute != 0 or value.second != 0:
            raise serializers.ValidationError("Slots must start on the hour.")
        return value

    def validate(self, data):
        now = timezone.localtime()
        if data["date"] == now.date() and data["slot_start"] <= now.time():
            raise serializers.ValidationError({"slot_start": "This slot has already passed."})

        from catroom.views import get_room_config
        cfg = get_room_config()
        max_cap = cfg.max_visitors if cfg else settings.CATROOM_MAX_VISITORS
        daily_rest = (cfg.daily_rest_hours if cfg.daily_rest_hours is not None else []) if cfg else ["14:00"]
        time_str = data["slot_start"].strftime("%H:%M")

        is_explicit_blocked = CatRoomSlotBlock.objects.filter(
            date=data["date"], slot_start=data["slot_start"], reason="blocked"
        ).exists()
        is_unblocked_override = CatRoomSlotBlock.objects.filter(
            date=data["date"], slot_start=data["slot_start"], reason="unblocked"
        ).exists()

        if is_explicit_blocked or (time_str in daily_rest and not is_unblocked_override):
            raise serializers.ValidationError({"slot_start": "This slot is blocked."})

        # Validate capacity / remaining spots
        from django.db.models import Sum
        active_statuses = ["pending_payment", "confirmed", "rescheduled"]
        active_qs = CatRoomReservation.objects.filter(
            date=data["date"], slot_start=data["slot_start"], status__in=active_statuses
        ).exclude(status="pending_payment", hold_expires_at__lt=timezone.now())
        booked_visitors = active_qs.aggregate(total=Sum("visitors"))["total"] or 0
        spots_left = max(0, max_cap - booked_visitors)

        if data["visitors"] > spots_left:
            raise serializers.ValidationError({
                "visitors": f"Only {spots_left} spot{'s' if spots_left != 1 else ''} left for this time slot (requested {data['visitors']})."
            })

        voucher_code = data.get("voucher_code")
        if voucher_code:
            from loyalty.models import RewardVoucher
            user = self.context["request"].user
            voucher = RewardVoucher.objects.filter(
                user=user,
                code=voucher_code,
                status="active",
                reward_type="catroom_50",
            ).first()
            if not voucher:
                raise serializers.ValidationError(
                    {"voucher_code": "Invalid, expired, or non-matching Cat Room voucher."}
                )

            # Off-Peak Cat Room Rule: Restrict to 1 guest on weekday (Mon–Thu) slots
            res_date = data["date"]
            if res_date.weekday() > 3:  # Friday (4), Saturday (5), Sunday (6)
                raise serializers.ValidationError(
                    {"voucher_code": "The 50% Off Cat Room voucher is only valid on weekdays (Monday to Thursday)."}
                )
            if data["visitors"] > 1:
                raise serializers.ValidationError(
                    {"voucher_code": "The 50% Off Cat Room voucher is valid for 1 guest only."}
                )

            data["_voucher"] = voucher

        return data

    def create(self, validated_data):
        from catroom.views import get_room_config
        user = self.context["request"].user
        cfg = get_room_config()
        if cfg and cfg.hourly_rate:
            rate = Decimal(str(cfg.hourly_rate))
        else:
            rate_str = getattr(settings, "CATROOM_HOURLY_RATE", "300.00")
            try:
                rate = Decimal(str(rate_str))
            except Exception:
                rate = Decimal("300.00")

        visitors = validated_data["visitors"]
        fee = (rate * Decimal(visitors)).quantize(Decimal("0.01"))
        payment_option = validated_data["payment_option"]

        voucher = validated_data.get("_voucher")
        if voucher:
            fee = (fee * Decimal("0.50")).quantize(Decimal("0.01"))

        if payment_option == "deposit":
            fifty_pct = (fee * Decimal("0.50")).quantize(Decimal("0.01"))
            if voucher:
                amount_due = fifty_pct
            else:
                try:
                    min_dep = Decimal(str(cfg.min_deposit)).quantize(Decimal("0.01")) if (cfg and cfg.min_deposit is not None) else Decimal("0.00")
                except Exception:
                    min_dep = Decimal("0.00")
                amount_due = min(fee, max(fifty_pct, min_dep))
        else:
            amount_due = fee

        hold_minutes = cfg.hold_minutes if cfg and cfg.hold_minutes else getattr(settings, "CATROOM_HOLD_MINUTES", 15)
        hold_expires = timezone.now() + timedelta(minutes=hold_minutes)

        try:
            reservation = CatRoomReservation.objects.create(
                customer=user,
                date=validated_data["date"],
                slot_start=validated_data["slot_start"],
                visitors=validated_data["visitors"],
                fee=fee,
                payment_option=payment_option,
                amount_due=amount_due,
                policy_acknowledged=True,
                status="pending_payment",
                hold_expires_at=hold_expires,
            )
            if voucher:
                voucher.status = "used"
                voucher.used_at = timezone.now()
                voucher.reservation = reservation
                voucher.save(update_fields=["status", "used_at", "reservation"])
        except IntegrityError:
            raise serializers.ValidationError(
                {"slot_start": "This slot was just booked by someone else. Please choose another."}
            )
        return reservation


class CatRoomSlotBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatRoomSlotBlock
        fields = ["id", "date", "slot_start", "reason", "note"]
