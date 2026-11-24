from datetime import date, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.db import IntegrityError
from django.utils import timezone
from django.core.management import call_command

from rest_framework.test import APIClient

from catroom.models import CatRoomReservation, CatRoomSlotBlock, CatRoomConfig


class DoubleBookingConstraintTest(TestCase):
    def setUp(self):
        Group.objects.get_or_create(name="customer")
        self.user1 = User.objects.create_user("user1", "u1@test.com", "pass1234")
        self.user1.groups.add(Group.objects.get(name="customer"))
        self.user2 = User.objects.create_user("user2", "u2@test.com", "pass1234")
        self.user2.groups.add(Group.objects.get(name="customer"))

    def test_cannot_double_book_active_slot(self):
        cfg = CatRoomConfig.objects.first()
        max_cap = cfg.max_visitors if cfg else getattr(settings, "CATROOM_MAX_VISITORS", 8)
        CatRoomReservation.objects.create(
            customer=self.user1, date=date(2026, 12, 15),
            slot_start=time(10, 0), visitors=max_cap, fee=250, status="confirmed",
        )
        with self.assertRaises(IntegrityError):
            CatRoomReservation.objects.create(
                customer=self.user2, date=date(2026, 12, 15),
                slot_start=time(10, 0), visitors=1, fee=250, status="confirmed",
            )

    def test_multiple_bookings_allowed_within_capacity(self):
        res1 = CatRoomReservation.objects.create(
            customer=self.user1, date=date(2026, 12, 16),
            slot_start=time(10, 0), visitors=2, fee=500, status="confirmed",
        )
        res2 = CatRoomReservation.objects.create(
            customer=self.user2, date=date(2026, 12, 16),
            slot_start=time(10, 0), visitors=2, fee=500, status="confirmed",
        )
        self.assertEqual(res1.status, "confirmed")
        self.assertEqual(res2.status, "confirmed")

    def test_cancelled_slot_can_be_rebooked(self):
        CatRoomReservation.objects.create(
            customer=self.user1, date=date(2026, 12, 15),
            slot_start=time(14, 0), visitors=2, fee=250, status="cancelled",
        )
        reservation = CatRoomReservation.objects.create(
            customer=self.user2, date=date(2026, 12, 15),
            slot_start=time(14, 0), visitors=1, fee=250, status="confirmed",
        )
        self.assertEqual(reservation.status, "confirmed")


class CatRoomSlotsAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="customer")
        self.user = User.objects.create_user("slotuser", "s@test.com", "pass1234")
        self.user.groups.add(Group.objects.get(name="customer"))
        self.future_date = (timezone.localdate() + timedelta(days=7)).isoformat()

    def test_slots_require_date_param(self):
        resp = self.client.get("/api/catroom/slots/")
        self.assertEqual(resp.status_code, 400)

    def test_slots_returns_all_hours(self):
        resp = self.client.get(f"/api/catroom/slots/?date={self.future_date}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 11)

    def test_booked_slot_shown(self):
        future = timezone.localdate() + timedelta(days=7)
        cfg = CatRoomConfig.objects.first()
        max_cap = cfg.max_visitors if cfg else getattr(settings, "CATROOM_MAX_VISITORS", 8)
        CatRoomReservation.objects.create(
            customer=self.user, date=future, slot_start=time(10, 0),
            visitors=max_cap, fee=250, status="confirmed",
        )
        resp = self.client.get(f"/api/catroom/slots/?date={future.isoformat()}")
        self.assertEqual(resp.status_code, 200)
        first_slot = resp.data[0]
        self.assertEqual(first_slot["state"], "booked")
        self.assertEqual(first_slot["spots_left"], 0)
        self.assertEqual(first_slot["booked_visitors"], max_cap)

    def test_blocked_slot_shown(self):
        future = timezone.localdate() + timedelta(days=7)
        CatRoomSlotBlock.objects.create(date=future, slot_start=time(12, 0), reason="blocked")
        resp = self.client.get(f"/api/catroom/slots/?date={future.isoformat()}")
        self.assertEqual(resp.status_code, 200)
        slot_12 = [s for s in resp.data if s["slot_start"] == "12:00:00"][0]
        self.assertEqual(slot_12["state"], "blocked")


class CatRoomBookingAPITest(TestCase):
    def setUp(self):
        Group.objects.get_or_create(name="customer")
        self.user = User.objects.create_user("booker", "b@test.com", "pass1234")
        self.user.groups.add(Group.objects.get(name="customer"))
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.future_date = (timezone.localdate() + timedelta(days=7)).isoformat()

    def test_successful_booking_full_payment(self):
        resp = self.client.post("/api/catroom/reservations/", {
            "date": self.future_date, "slot_start": "10:00",
            "visitors": 2, "payment_option": "full", "policy_acknowledged": True,
        })
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], "pending_payment")
        self.assertEqual(resp.data["payment_option"], "full")
        rate = Decimal(str(getattr(settings, "CATROOM_HOURLY_RATE", 300)))
        expected_fee = (rate * 2).quantize(Decimal("0.01"))
        self.assertEqual(Decimal(resp.data["fee"]), expected_fee)
        self.assertEqual(Decimal(resp.data["amount_due"]), expected_fee)
        self.assertIsNotNone(resp.data["hold_expires_at"])

    def test_successful_booking_deposit(self):
        resp = self.client.post("/api/catroom/reservations/", {
            "date": self.future_date, "slot_start": "11:00",
            "visitors": 1, "payment_option": "deposit", "policy_acknowledged": True,
        })
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["payment_option"], "deposit")
        rate = Decimal(str(getattr(settings, "CATROOM_HOURLY_RATE", 300)))
        expected_fee = (rate * 1).quantize(Decimal("0.01"))
        expected_due = (expected_fee * Decimal("0.50")).quantize(Decimal("0.01"))
        self.assertEqual(Decimal(resp.data["fee"]), expected_fee)
        self.assertEqual(Decimal(resp.data["amount_due"]), expected_due)

    def test_past_date_rejected(self):
        resp = self.client.post("/api/catroom/reservations/", {
            "date": "2020-01-01", "slot_start": "10:00",
            "visitors": 1, "payment_option": "full", "policy_acknowledged": True,
        })
        self.assertEqual(resp.status_code, 400)

    def test_over_capacity_rejected(self):
        resp = self.client.post("/api/catroom/reservations/", {
            "date": self.future_date, "slot_start": "10:00",
            "visitors": 999, "payment_option": "full", "policy_acknowledged": True,
        })
        self.assertEqual(resp.status_code, 400)

    def test_blocked_slot_rejected(self):
        future = timezone.localdate() + timedelta(days=7)
        CatRoomSlotBlock.objects.create(date=future, slot_start=time(14, 0), reason="blocked")
        resp = self.client.post("/api/catroom/reservations/", {
            "date": future.isoformat(), "slot_start": "14:00",
            "visitors": 1, "payment_option": "full", "policy_acknowledged": True,
        })
        self.assertEqual(resp.status_code, 400)

    def test_policy_not_acknowledged_rejected(self):
        resp = self.client.post("/api/catroom/reservations/", {
            "date": self.future_date, "slot_start": "10:00",
            "visitors": 1, "payment_option": "full", "policy_acknowledged": False,
        })
        self.assertEqual(resp.status_code, 400)

    def test_double_booking_via_api_rejected(self):
        cfg = CatRoomConfig.objects.first()
        max_cap = cfg.max_visitors if cfg else getattr(settings, "CATROOM_MAX_VISITORS", 8)
        payload = {
            "date": self.future_date, "slot_start": "15:00",
            "visitors": max_cap, "payment_option": "full", "policy_acknowledged": True,
        }
        resp1 = self.client.post("/api/catroom/reservations/", payload)
        self.assertEqual(resp1.status_code, 201)
        user2 = User.objects.create_user("booker2", "b2@test.com", "pass1234")
        user2.groups.add(Group.objects.get(name="customer"))
        client2 = APIClient()
        client2.force_authenticate(user=user2)
        resp2 = client2.post("/api/catroom/reservations/", {
            "date": self.future_date, "slot_start": "15:00",
            "visitors": 1, "payment_option": "full", "policy_acknowledged": True,
        })
        self.assertEqual(resp2.status_code, 400)
        self.assertIn("visitors", resp2.data)

    def test_sharing_slot_via_api_within_capacity(self):
        resp1 = self.client.post("/api/catroom/reservations/", {
            "date": self.future_date, "slot_start": "16:00",
            "visitors": 2, "payment_option": "full", "policy_acknowledged": True,
        })
        self.assertEqual(resp1.status_code, 201)
        user3 = User.objects.create_user("booker3", "b3@test.com", "pass1234")
        user3.groups.add(Group.objects.get(name="customer"))
        client3 = APIClient()
        client3.force_authenticate(user=user3)
        resp2 = client3.post("/api/catroom/reservations/", {
            "date": self.future_date, "slot_start": "16:00",
            "visitors": 2, "payment_option": "full", "policy_acknowledged": True,
        })
        self.assertEqual(resp2.status_code, 201)

    def test_unauthenticated_booking_rejected(self):
        client = APIClient()
        resp = client.post("/api/catroom/reservations/", {
            "date": self.future_date, "slot_start": "10:00",
            "visitors": 1, "payment_option": "full", "policy_acknowledged": True,
        })
        self.assertIn(resp.status_code, [401, 403])

    def test_invalid_slot_time_rejected(self):
        resp = self.client.post("/api/catroom/reservations/", {
            "date": self.future_date, "slot_start": "23:00",
            "visitors": 1, "payment_option": "full", "policy_acknowledged": True,
        })
        self.assertEqual(resp.status_code, 400)


class CatRoomCancelAPITest(TestCase):
    def setUp(self):
        Group.objects.get_or_create(name="customer")
        self.user = User.objects.create_user("canceller", "c@test.com", "pass1234")
        self.user.groups.add(Group.objects.get(name="customer"))
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.future = timezone.localdate() + timedelta(days=7)

    def test_cancel_pending_reservation(self):
        res = CatRoomReservation.objects.create(
            customer=self.user, date=self.future, slot_start=time(10, 0),
            visitors=1, fee=250, status="pending_payment",
        )
        resp = self.client.post(f"/api/catroom/reservations/{res.id}/cancel/")
        self.assertEqual(resp.status_code, 200)
        res.refresh_from_db()
        self.assertEqual(res.status, "cancelled")

    def test_cannot_cancel_completed(self):
        res = CatRoomReservation.objects.create(
            customer=self.user, date=self.future, slot_start=time(11, 0),
            visitors=1, fee=250, status="completed",
        )
        resp = self.client.post(f"/api/catroom/reservations/{res.id}/cancel/")
        self.assertEqual(resp.status_code, 400)

    def test_other_user_cannot_cancel(self):
        user2 = User.objects.create_user("other", "o@test.com", "pass1234")
        user2.groups.add(Group.objects.get(name="customer"))
        res = CatRoomReservation.objects.create(
            customer=self.user, date=self.future, slot_start=time(12, 0),
            visitors=1, fee=250, status="pending_payment",
        )
        client2 = APIClient()
        client2.force_authenticate(user=user2)
        resp = client2.post(f"/api/catroom/reservations/{res.id}/cancel/")
        self.assertIn(resp.status_code, [403, 404])


class ExpiredHoldsManagementTest(TestCase):
    def setUp(self):
        Group.objects.get_or_create(name="customer")
        self.user = User.objects.create_user("holduser", "h@test.com", "pass1234")
        self.user.groups.add(Group.objects.get(name="customer"))

    def test_expired_hold_released(self):
        res = CatRoomReservation.objects.create(
            customer=self.user, date=timezone.localdate() + timedelta(days=7),
            slot_start=time(10, 0), visitors=1, fee=250,
            status="pending_payment", hold_expires_at=timezone.now() - timedelta(minutes=1),
        )
        call_command("release_expired_holds")
        res.refresh_from_db()
        self.assertEqual(res.status, "cancelled")

    def test_active_hold_not_released(self):
        res = CatRoomReservation.objects.create(
            customer=self.user, date=timezone.localdate() + timedelta(days=7),
            slot_start=time(11, 0), visitors=1, fee=250,
            status="pending_payment", hold_expires_at=timezone.now() + timedelta(minutes=10),
        )
        call_command("release_expired_holds")
        res.refresh_from_db()
        self.assertEqual(res.status, "pending_payment")

    def test_confirmed_not_released(self):
        res = CatRoomReservation.objects.create(
            customer=self.user, date=timezone.localdate() + timedelta(days=7),
            slot_start=time(12, 0), visitors=1, fee=250,
            status="confirmed", hold_expires_at=timezone.now() - timedelta(minutes=1),
        )
        call_command("release_expired_holds")
        res.refresh_from_db()
        self.assertEqual(res.status, "confirmed")


class CatRoomSettingsAPITest(TestCase):
    def test_settings_public(self):
        resp = self.client.get("/api/catroom/settings/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("hourly_rate", resp.data)
        self.assertIn("max_visitors", resp.data)
        self.assertIn("min_deposit", resp.data)
        self.assertIn("opening_hour", resp.data)
        self.assertIn("closing_hour", resp.data)


class CatRoomListScopingAPITest(TestCase):
    def setUp(self):
        for name in ("customer", "staff", "admin"):
            Group.objects.get_or_create(name=name)

        self.user1 = User.objects.create_user("cust1", "c1@test.com", "pass1234")
        self.user1.groups.add(Group.objects.get(name="customer"))

        self.user2 = User.objects.create_user("cust2", "c2@test.com", "pass1234")
        self.user2.groups.add(Group.objects.get(name="customer"))

        self.staff_user = User.objects.create_user("staffcat", "sc@test.com", "pass1234")
        self.staff_user.groups.add(Group.objects.get(name="staff"))

        self.future = timezone.localdate() + timedelta(days=5)
        self.res1 = CatRoomReservation.objects.create(
            customer=self.user1,
            date=self.future,
            slot_start=time(10, 0),
            visitors=1,
            fee=Decimal("250.00"),
            status="confirmed",
        )

    def test_customer_only_sees_own_reservations(self):
        client = APIClient()
        client.force_authenticate(user=self.user2)
        resp = client.get("/api/catroom/reservations/")
        self.assertEqual(resp.status_code, 200)
        items = resp.data.get("results", resp.data)
        self.assertEqual(len(items), 0)

        client.force_authenticate(user=self.user1)
        resp1 = client.get("/api/catroom/reservations/")
        self.assertEqual(resp1.status_code, 200)
        items1 = resp1.data.get("results", resp1.data)
        self.assertEqual(len(items1), 1)
        self.assertEqual(items1[0]["id"], self.res1.id)

    def test_staff_mine_param_scopes_to_own(self):
        client = APIClient()
        client.force_authenticate(user=self.staff_user)
        resp_all = client.get("/api/catroom/reservations/")
        self.assertEqual(len(resp_all.data.get("results", resp_all.data)), 1)

        resp_mine = client.get("/api/catroom/reservations/?mine=true")
        self.assertEqual(len(resp_mine.data.get("results", resp_mine.data)), 0)


class CatRoomSlotBlockAPITest(TestCase):
    def setUp(self):
        Group.objects.get_or_create(name="admin")
        self.admin = User.objects.create_user("adminuser", "admin@test.com", "pass1234", is_staff=True)
        self.admin.groups.add(Group.objects.get(name="admin"))
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.future = (timezone.localdate() + timedelta(days=7)).isoformat()

    def test_block_and_unblock_slot(self):
        resp_block = self.client.post("/api/catroom/blocked-slots/block/", {
            "date": self.future, "slot_start": "12:00", "reason": "blocked"
        })
        self.assertEqual(resp_block.status_code, 200)

        # Check slots view reports blocked
        resp_slots = self.client.get(f"/api/catroom/slots/?date={self.future}")
        slot_12 = [s for s in resp_slots.data if s["slot_start"].startswith("12:00")][0]
        self.assertEqual(slot_12["state"], "blocked")

        # Unblock slot
        resp_unblock = self.client.post("/api/catroom/blocked-slots/unblock/", {
            "date": self.future, "slot_start": "12:00"
        })
        self.assertEqual(resp_unblock.status_code, 200)

        # Check slots view reports available
        resp_slots2 = self.client.get(f"/api/catroom/slots/?date={self.future}")
        slot_12_after = [s for s in resp_slots2.data if s["slot_start"].startswith("12:00")][0]
        self.assertEqual(slot_12_after["state"], "available")
