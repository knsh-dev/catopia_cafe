from datetime import time, timedelta
from decimal import Decimal

from django.contrib.auth.models import Group, User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from catroom.models import CatRoomReservation
from cats.models import ResidentCat
from menu.models import MenuItem
from orders.models import Order, OrderItem


class FullSystemIntegrationAndSyncTest(TestCase):
    """End-to-end verification of authentication, CSRF, admin dashboard, orders,
    cat room approval, best-selling products, and cat availability synchronization."""

    def setUp(self):
        for name in ("customer", "staff", "admin"):
            Group.objects.get_or_create(name=name)

        self.admin = User.objects.create_user(
            "admin_user", "admin@catopia.test", "admin1234", is_staff=True
        )
        self.admin.groups.add(Group.objects.get(name="admin"))

        self.customer = User.objects.create_user(
            "cust_user", "customer@catopia.test", "cust1234"
        )
        self.customer.groups.add(Group.objects.get(name="customer"))

        self.item_latte = MenuItem.objects.create(
            name="Purr-fect Latte",
            category="coffee",
            price=Decimal("180.00"),
            is_available=True,
            stock_quantity=25,
        )
        self.item_matcha = MenuItem.objects.create(
            name="Whisker Matcha",
            category="non_coffee",
            price=Decimal("200.00"),
            is_available=True,
            stock_quantity=25,
        )
        self.item_pastry = MenuItem.objects.create(
            name="Cat Paw Croissant",
            category="pastries",
            price=Decimal("140.00"),
            is_available=True,
            stock_quantity=25,
        )

        self.cat_mochi = ResidentCat.objects.create(
            name="Mochi",
            breed="Scottish Fold",
            age=2,
            personality="Cuddly and playful",
            status="ready_to_play",
            is_active=True,
        )
        self.cat_boba = ResidentCat.objects.create(
            name="Boba",
            breed="British Shorthair",
            age=3,
            personality="Calm nap lover",
            status="resting",
            is_active=True,
        )
        self.cat_retired = ResidentCat.objects.create(
            name="Shadow",
            breed="Bombay",
            age=5,
            personality="Wise elder cat",
            status="vet_day",
            is_active=False,
        )

    def test_auth_login_csrf_rotation_and_me_endpoint(self):
        client = APIClient(enforce_csrf_checks=True)

        # 1. Fetch initial CSRF cookie
        csrf_resp = client.get("/api/auth/csrf/")
        self.assertEqual(csrf_resp.status_code, 200)
        initial_csrf = csrf_resp.data.get("csrfToken") or client.cookies["csrftoken"].value
        self.assertTrue(initial_csrf)

        # 2. Customer login rotates CSRF token and returns csrfToken in payload + header
        login_resp = client.post(
            "/api/auth/login/",
            {"username": "customer@catopia.test", "password": "cust1234"},
            format="json",
            HTTP_X_CSRFTOKEN=initial_csrf,
        )
        self.assertEqual(login_resp.status_code, 200)
        self.assertEqual(login_resp.data["username"], "cust_user")
        self.assertEqual(login_resp.data["role"], "customer")
        rotated_csrf = login_resp.data.get("csrfToken")
        self.assertTrue(rotated_csrf)
        self.assertEqual(login_resp["X-CSRFToken"], rotated_csrf)

        # 3. /api/auth/me/ identifies the authenticated customer
        me_resp = client.get("/api/auth/me/")
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.data["username"], "cust_user")
        self.assertIn("csrfToken", me_resp.data)

    def test_admin_overview_and_customers_endpoints(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        # Create a paid order so customer stats and overview metrics are populated
        order = Order.objects.create(
            customer=self.customer,
            subtotal=Decimal("360.00"),
            total=Decimal("360.00"),
            status="completed",
            payment_status="PAID",
        )
        OrderItem.objects.create(
            order=order,
            menu_item=self.item_latte,
            name=self.item_latte.name,
            quantity=2,
            price=self.item_latte.price,
        )

        overview_resp = client.get("/api/admin/overview/")
        self.assertEqual(overview_resp.status_code, 200)
        self.assertIn("revenue_today", overview_resp.data)
        self.assertIn("active_orders", overview_resp.data)
        self.assertIn("top_selling", overview_resp.data)
        self.assertGreaterEqual(len(overview_resp.data["top_selling"]), 1)
        self.assertEqual(overview_resp.data["top_selling"][0]["name"], "Purr-fect Latte")
        self.assertEqual(overview_resp.data["top_selling"][0]["sold_count"], 2)

        customers_resp = client.get("/api/admin/customers/?search=cust_user")
        self.assertEqual(customers_resp.status_code, 200)
        cust_list = customers_resp.data["customers"]
        self.assertEqual(len(cust_list), 1)
        cust_record = cust_list[0]
        self.assertEqual(cust_record["username"], "cust_user")
        self.assertEqual(cust_record["orders_count"], 1)
        self.assertEqual(cust_record["recent_orders"][0]["payment_status"], "PAID")

    def test_order_preparation_and_status_updates_with_csrf_enforcement(self):
        client = APIClient(enforce_csrf_checks=True)

        # Customer places and pays for an order
        order = Order.objects.create(
            customer=self.customer,
            subtotal=Decimal("200.00"),
            total=Decimal("200.00"),
            status="pending",
            payment_status="PAID",
        )
        OrderItem.objects.create(
            order=order,
            menu_item=self.item_matcha,
            quantity=1,
            price=self.item_matcha.price,
        )

        # Admin logs in with CSRF enforcement
        csrf_resp = client.get("/api/auth/csrf/")
        csrf_token = csrf_resp.data["csrfToken"]
        login_resp = client.post(
            "/api/auth/login/",
            {"username": "admin@catopia.test", "password": "admin1234"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(login_resp.status_code, 200)
        admin_csrf = login_resp.data["csrfToken"]

        # Admin sees the paid customer order in /api/orders/
        orders_resp = client.get("/api/orders/")
        self.assertEqual(orders_resp.status_code, 200)
        order_list = orders_resp.data["results"]
        matching = [o for o in order_list if o["id"] == order.id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]["payment_status"], "PAID")

        # Admin transitions order: pending -> preparing -> ready -> completed with rotated CSRF token
        for next_status in ("preparing", "ready", "completed"):
            status_resp = client.post(
                f"/api/orders/{order.id}/status/",
                {"status": next_status},
                format="json",
                HTTP_X_CSRFTOKEN=admin_csrf,
            )
            self.assertEqual(status_resp.status_code, 200)
            self.assertEqual(status_resp.data["status"], next_status)

        order.refresh_from_db()
        self.assertEqual(order.status, "completed")
        self.assertTrue(order.loyalty_credited)

    def test_catroom_reservation_approval_with_expired_hold_and_csrf(self):
        future_date = timezone.localdate() + timedelta(days=3)

        # Create an expired pending_payment hold occupying full capacity (8 visitors)
        CatRoomReservation.objects.create(
            customer=self.customer,
            date=future_date,
            slot_start=time(13, 0),
            visitors=8,
            fee=Decimal("2400.00"),
            status="pending_payment",
            hold_expires_at=timezone.now() - timedelta(minutes=30),
        )

        # Create a valid pending_payment reservation to approve
        reservation = CatRoomReservation.objects.create(
            customer=self.customer,
            date=future_date,
            slot_start=time(13, 0),
            visitors=2,
            fee=Decimal("600.00"),
            status="pending_payment",
            hold_expires_at=timezone.now() + timedelta(minutes=15),
        )

        client = APIClient(enforce_csrf_checks=True)
        csrf_token = client.get("/api/auth/csrf/").data["csrfToken"]
        login_resp = client.post(
            "/api/auth/login/",
            {"username": "admin@catopia.test", "password": "admin1234"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        admin_csrf = login_resp.data["csrfToken"]

        approve_resp = client.post(
            f"/api/catroom/reservations/{reservation.id}/approve/",
            {},
            format="json",
            HTTP_X_CSRFTOKEN=admin_csrf,
        )
        self.assertEqual(approve_resp.status_code, 200)
        self.assertEqual(approve_resp.data["status"], "confirmed")

        reservation.refresh_from_db()
        self.assertEqual(reservation.status, "confirmed")
        self.assertIsNone(reservation.hold_expires_at)

    def test_best_selling_products_sync_with_paid_and_completed_orders(self):
        # Paid completed order: 4 Matchas, 2 Lattes
        o1 = Order.objects.create(
            customer=self.customer,
            subtotal=Decimal("1160.00"),
            total=Decimal("1160.00"),
            status="completed",
            payment_status="PAID",
        )
        OrderItem.objects.create(order=o1, menu_item=self.item_matcha, quantity=4, price=self.item_matcha.price)
        OrderItem.objects.create(order=o1, menu_item=self.item_latte, quantity=2, price=self.item_latte.price)

        # Cancelled order: 10 Croissants (must NOT count towards best sellers)
        o2 = Order.objects.create(
            customer=self.customer,
            subtotal=Decimal("1400.00"),
            total=Decimal("1400.00"),
            status="cancelled",
            payment_status="FAILED",
        )
        OrderItem.objects.create(
            order=o2,
            menu_item=self.item_pastry,
            name=self.item_pastry.name,
            quantity=10,
            price=self.item_pastry.price,
        )

        client = APIClient()
        pop_resp = client.get("/api/menu/items/popular/?limit=3")
        self.assertEqual(pop_resp.status_code, 200)
        self.assertEqual(len(pop_resp.data), 3)
        self.assertEqual(pop_resp.data[0]["name"], "Whisker Matcha")
        self.assertEqual(pop_resp.data[0]["sold_count"], 4)
        self.assertEqual(pop_resp.data[1]["name"], "Purr-fect Latte")
        self.assertEqual(pop_resp.data[1]["sold_count"], 2)
        self.assertEqual(pop_resp.data[2]["name"], "Cat Paw Croissant")
        self.assertEqual(pop_resp.data[2]["sold_count"], 0)

    def test_cat_availability_sync_between_admin_and_public_endpoints(self):
        client = APIClient()

        # Public endpoint with ?available=true only returns active cats
        pub_resp = client.get("/api/cats/residents/?available=true")
        self.assertEqual(pub_resp.status_code, 200)
        names = [c["name"] for c in pub_resp.data]
        self.assertIn("Mochi", names)
        self.assertIn("Boba", names)
        self.assertNotIn("Shadow", names)

        # Admin updates Mochi to vet_day and hides Boba (is_active=False)
        client.force_authenticate(user=self.admin)
        patch_mochi = client.patch(
            f"/api/cats/residents/{self.cat_mochi.id}/",
            {"status": "vet_day"},
            format="json",
        )
        self.assertEqual(patch_mochi.status_code, 200)
        self.assertEqual(patch_mochi.data["status"], "vet_day")
        self.assertEqual(patch_mochi.data["status_display"], "Vet day")

        patch_boba = client.patch(
            f"/api/cats/residents/{self.cat_boba.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(patch_boba.status_code, 200)
        self.assertFalse(patch_boba.data["is_active"])

        # Public endpoint immediately reflects updated status and visibility
        client.logout()
        pub_after = client.get("/api/cats/residents/?available=true")
        self.assertEqual(pub_after.status_code, 200)
        self.assertEqual(len(pub_after.data), 1)
        self.assertEqual(pub_after.data[0]["name"], "Mochi")
        self.assertEqual(pub_after.data[0]["status"], "vet_day")
        self.assertEqual(pub_after.data[0]["status_display"], "Vet day")
