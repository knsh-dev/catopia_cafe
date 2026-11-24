from datetime import date, time, timedelta
from decimal import Decimal
import io
from PIL import Image

from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework.test import APIClient

from catroom.models import CatRoomReservation
from orders.models import Order
from payments.models import Payment
from cats.models import ResidentCat, FavoriteCat
from loyalty.models import LoyaltyTransaction


class AuthFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="customer")
        Group.objects.get_or_create(name="staff")
        Group.objects.get_or_create(name="admin")

    def test_register_and_login_with_email(self):
        # Register with name, email, phone
        resp = self.client.post("/api/auth/register/", {
            "name": "Hana Sato",
            "email": "hana@example.com",
            "phone": "+63 912 345 6789",
            "password": "testpassword123",
            "confirm_password": "testpassword123",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["email"], "hana@example.com")
        self.assertEqual(resp.data["first_name"], "Hana")
        self.assertEqual(resp.data["last_name"], "Sato")
        self.assertEqual(resp.data["phone"], "+63 912 345 6789")
        self.assertEqual(resp.data["role"], "customer")

        # Logout
        resp = self.client.post("/api/auth/logout/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("sessionid", resp.cookies)
        self.assertIn("csrftoken", resp.cookies)
        self.assertEqual(resp.headers.get("Cache-Control"), "no-cache, no-store, must-revalidate, private")

        # Login using EMAIL instead of username
        resp = self.client.post("/api/auth/login/", {
            "email": "hana@example.com",
            "password": "testpassword123",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "hana@example.com")

        # Me endpoint
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "hana@example.com")
        self.assertIn("stats", resp.data)

    def test_login_bad_credentials(self):
        resp = self.client.post("/api/auth/login/", {
            "username": "nobody",
            "password": "wrong",
        }, format="json")
        self.assertEqual(resp.status_code, 401)

    def test_me_unauthenticated(self):
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 403)

    def test_csrf_endpoint(self):
        resp = self.client.get("/api/auth/csrf/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("csrfToken", resp.data)


class UserProfileAndAccountSettingsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        Group.objects.get_or_create(name="customer")
        self.user = User.objects.create_user(
            username="hana",
            email="hana@test.com",
            password="InitialPassword123!",
            first_name="Hana",
            last_name="Sato",
        )
        self.user.groups.add(Group.objects.get(name="customer"))
        self.user.profile.phone = "+63 912 000 0000"
        self.user.profile.loyalty_points = 150
        self.user.profile.save()

        self.other_user = User.objects.create_user(
            username="olivia",
            email="olivia@test.com",
            password="InitialPassword123!",
        )

    def test_get_user_me(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/users/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "hana@test.com")
        self.assertEqual(resp.data["full_name"], "Hana Sato")
        self.assertEqual(resp.data["phone"], "+63 912 000 0000")
        self.assertEqual(resp.data["loyalty_points"], 150)
        self.assertIn("stats", resp.data)
        self.assertEqual(resp.data["stats"]["paw_points"], 150)

    def test_patch_user_me_success(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.patch("/api/users/me/", {
            "name": "Hana Tanaka",
            "email": "hana.tanaka@test.com",
            "phone": "+63 999 888 7777",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Hana")
        self.assertEqual(self.user.last_name, "Tanaka")
        self.assertEqual(self.user.email, "hana.tanaka@test.com")
        self.assertEqual(self.user.profile.phone, "+63 999 888 7777")

    def test_patch_user_me_duplicate_email_rejected(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.patch("/api/users/me/", {
            "email": "olivia@test.com",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", resp.data)

    def test_patch_user_me_avatar_upload(self):
        self.client.force_authenticate(user=self.user)

        # Generate small valid test image in memory
        file_obj = io.BytesIO()
        image = Image.new("RGB", (100, 100), color=(200, 100, 50))
        image.save(file_obj, format="JPEG")
        file_obj.seek(0)

        avatar_file = SimpleUploadedFile(
            "test_avatar.jpg", file_obj.read(), content_type="image/jpeg"
        )

        resp = self.client.patch("/api/users/me/", {"avatar": avatar_file}, format="multipart")
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(bool(self.user.profile.avatar))

    def test_password_change_success_keeps_session_active(self):
        # Normal session login
        self.client.login(username="hana", password="InitialPassword123!")

        resp = self.client.post("/api/users/me/password/", {
            "current_password": "InitialPassword123!",
            "new_password": "NewSecretPassword123!",
            "confirm_password": "NewSecretPassword123!",
        }, format="json")
        self.assertEqual(resp.status_code, 200)

        # Confirm new password works in database
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewSecretPassword123!"))

        # Verify current session is still authenticated (update_session_auth_hash works)
        resp_me = self.client.get("/api/users/me/")
        self.assertEqual(resp_me.status_code, 200)

    def test_password_change_wrong_current_password(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/users/me/password/", {
            "current_password": "WrongPassword999!",
            "new_password": "NewSecretPassword123!",
            "confirm_password": "NewSecretPassword123!",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("current_password", resp.data)

    def test_password_change_mismatch_rejected(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/users/me/password/", {
            "current_password": "InitialPassword123!",
            "new_password": "NewSecretPassword123!",
            "confirm_password": "DifferentPassword123!",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("confirm_password", resp.data)

    def test_profile_reservations_upcoming_and_past(self):
        today = timezone.localdate()
        # Upcoming reservation
        CatRoomReservation.objects.create(
            customer=self.user,
            date=today + timedelta(days=2),
            slot_start=time(11, 0),
            visitors=2,
            fee=Decimal("600.00"),
            payment_option="full",
            amount_due=Decimal("600.00"),
            status="confirmed",
            policy_acknowledged=True,
        )
        # Past reservation
        CatRoomReservation.objects.create(
            customer=self.user,
            date=today - timedelta(days=5),
            slot_start=time(14, 0),
            visitors=1,
            fee=Decimal("300.00"),
            payment_option="full",
            amount_due=Decimal("300.00"),
            status="completed",
            policy_acknowledged=True,
        )

        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/users/me/reservations/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["upcoming"]), 1)
        self.assertEqual(len(resp.data["past"]), 1)

    def test_profile_orders_with_receipts(self):
        order = Order.objects.create(
            customer=self.user,
            subtotal=Decimal("350.00"),
            total=Decimal("350.00"),
            status="completed",
        )
        Payment.objects.create(
            customer=self.user,
            order=order,
            amount=Decimal("350.00"),
            status="paid",
            receipt_number="RCP-ORDER123",
            paid_at=timezone.now(),
        )

        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/users/me/orders/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertIsNotNone(resp.data[0]["receipt"])
        self.assertEqual(resp.data[0]["receipt"]["receipt_number"], "RCP-ORDER123")

    def test_profile_loyalty_data(self):
        LoyaltyTransaction.objects.create(
            user=self.user,
            points=150,
            reason="Welcome bonus",
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/users/me/loyalty/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["points"], 150)
        self.assertEqual(resp.data["tier"], "Kitten")
        self.assertEqual(resp.data["points_to_next_tier"], 650)
        self.assertEqual(len(resp.data["history"]), 1)
        self.assertEqual(len(resp.data["rewards"]), 4)

    def test_favorite_cats_flow(self):
        cat1 = ResidentCat.objects.create(name="Mochi", age=2)
        cat2 = ResidentCat.objects.create(name="Pepper", age=3)

        self.client.force_authenticate(user=self.user)

        # Toggle favorite cat1 -> add
        resp_add = self.client.post(f"/api/cats/residents/{cat1.id}/favorite/")
        self.assertEqual(resp_add.status_code, 201)

        # Check me favorites list
        resp_favs = self.client.get("/api/users/me/favorites/")
        self.assertEqual(resp_favs.status_code, 200)
        self.assertEqual(len(resp_favs.data), 1)
        self.assertEqual(resp_favs.data[0]["name"], "Mochi")
        self.assertTrue(resp_favs.data[0]["is_favorite"])

        # Toggle favorite cat1 -> remove
        resp_del = self.client.post(f"/api/cats/residents/{cat1.id}/favorite/")
        self.assertEqual(resp_del.status_code, 200)
        self.assertEqual(FavoriteCat.objects.filter(user=self.user).count(), 0)


class PermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        for name in ("customer", "staff", "admin"):
            Group.objects.get_or_create(name=name)

        self.customer = User.objects.create_user("cust", "cust@test.com", "pass1234")
        self.customer.groups.add(Group.objects.get(name="customer"))

        self.staff_user = User.objects.create_user("staffuser", "staff@test.com", "pass1234")
        self.staff_user.groups.add(Group.objects.get(name="staff"))

    def test_customer_cannot_create_menu_item(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/menu/items/", {
            "name": "Hack Coffee",
            "category": "coffee",
            "price": "100.00",
            "stock_quantity": 10,
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_staff_can_create_menu_item(self):
        self.client.force_authenticate(user=self.staff_user)
        resp = self.client.post("/api/menu/items/", {
            "name": "Staff Coffee",
            "category": "coffee",
            "price": "100.00",
            "stock_quantity": 10,
        }, format="json")
        self.assertEqual(resp.status_code, 201)

    def test_customer_cannot_create_slot_block(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/catroom/blocked-slots/", {
            "date": "2026-12-01",
            "slot_start": "10:00:00",
            "reason": "blocked",
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_public_can_read_menu(self):
        resp = self.client.get("/api/menu/items/")
        self.assertEqual(resp.status_code, 200)

    def test_public_can_read_cats(self):
        resp = self.client.get("/api/cats/residents/")
        self.assertEqual(resp.status_code, 200)

    def test_public_can_read_cafe_info(self):
        resp = self.client.get("/api/cafe/info/")
        self.assertEqual(resp.status_code, 200)

    def test_customer_forbidden_from_admin_endpoints(self):
        """Customers must receive 403 on staff/admin dashboard endpoints."""
        self.client.force_authenticate(user=self.customer)
        res_ov = self.client.get("/api/admin/overview/")
        self.assertEqual(res_ov.status_code, 403)

        res_cust = self.client.get("/api/admin/customers/")
        self.assertEqual(res_cust.status_code, 403)

    def test_staff_can_view_admin_overview_and_customers(self):
        """Staff members can view overview analytics and the customer directory."""
        self.client.force_authenticate(user=self.staff_user)
        res_ov = self.client.get("/api/admin/overview/")
        self.assertEqual(res_ov.status_code, 200)
        self.assertIn("revenue_today", res_ov.data)
        self.assertIn("hourly_occupancy", res_ov.data)

        res_cust = self.client.get("/api/admin/customers/")
        self.assertEqual(res_cust.status_code, 200)
        self.assertIn("stats", res_cust.data)
        self.assertIn("customers", res_cust.data)

    def test_role_rules_refund_points_role_and_menu_delete(self):
        """Role rules: only admin can manage refunds, user roles, points adjustment, and delete menu items."""
        admin_user = User.objects.create_user("adminboss", "boss@test.com", "pass1234")
        admin_user.groups.add(Group.objects.get(name="admin"))

        # 1. Menu item deletion: Staff forbidden (403), Admin allowed (204)
        from menu.models import MenuItem
        item = MenuItem.objects.create(name="Delete Item", price=Decimal("100.00"), stock_quantity=5)

        self.client.force_authenticate(user=self.staff_user)
        res_staff_del = self.client.delete(f"/api/menu/items/{item.id}/")
        self.assertEqual(res_staff_del.status_code, 403)

        self.client.force_authenticate(user=admin_user)
        res_admin_del = self.client.delete(f"/api/menu/items/{item.id}/")
        self.assertEqual(res_admin_del.status_code, 204)

        # 2. Points adjustment: Staff forbidden (403), Admin allowed (200)
        self.client.force_authenticate(user=self.staff_user)
        res_staff_pts = self.client.post(
            f"/api/admin/customers/{self.customer.id}/adjust-points/",
            {"points_delta": 50, "reason": "VIP bonus"},
            format="json",
        )
        self.assertEqual(res_staff_pts.status_code, 403)

        self.client.force_authenticate(user=admin_user)
        res_admin_pts = self.client.post(
            f"/api/admin/customers/{self.customer.id}/adjust-points/",
            {"points_delta": 50, "reason": "VIP bonus"},
            format="json",
        )
        self.assertEqual(res_admin_pts.status_code, 200)
        self.assertEqual(res_admin_pts.data["paw_points"], 50)

        # 3. Change user role: Staff forbidden (403), Admin allowed (200)
        self.client.force_authenticate(user=self.staff_user)
        res_staff_role = self.client.post(
            f"/api/admin/customers/{self.customer.id}/role/",
            {"role": "staff"},
            format="json",
        )
        self.assertEqual(res_staff_role.status_code, 403)

        self.client.force_authenticate(user=admin_user)
        res_admin_role = self.client.post(
            f"/api/admin/customers/{self.customer.id}/role/",
            {"role": "staff"},
            format="json",
        )
        self.assertEqual(res_admin_role.status_code, 200)
        self.assertEqual(res_admin_role.data["role"], "staff")

        # 4. Refund: Staff forbidden (403), Admin allowed (200)
        from unittest.mock import patch
        test_order = Order.objects.create(
            customer=self.customer,
            subtotal=Decimal("150.00"),
            total=Decimal("150.00"),
            status="preparing",
            payment_status="PAID",
        )
        payment = Payment.objects.create(
            customer=self.customer,
            order=test_order,
            amount=Decimal("150.00"),
            status="paid",
            method="xendit",
        )
        self.client.force_authenticate(user=self.staff_user)
        res_staff_ref = self.client.post(f"/api/payments/{payment.pk}/refund/", {"audit_note": "test"})
        self.assertEqual(res_staff_ref.status_code, 403)

        self.client.force_authenticate(user=admin_user)
        with patch("payments.xendit_service.create_refund"):
            res_admin_ref = self.client.post(f"/api/payments/{payment.pk}/refund/", {"audit_note": "Approved by manager"})
            self.assertEqual(res_admin_ref.status_code, 200)
            self.assertEqual(res_admin_ref.data["status"], "refunded")
            self.assertEqual(res_admin_ref.data["audit_note"], "Approved by manager")
