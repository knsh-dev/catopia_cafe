from decimal import Decimal

from django.test import TestCase
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient

from menu.models import MenuItem
from orders.models import Order, OrderItem


class OrderCreationTests(TestCase):
    """Test order creation with server-side price validation."""

    def setUp(self):
        self.client = APIClient()
        for name in ("customer", "staff", "admin"):
            Group.objects.get_or_create(name=name)

        self.customer = User.objects.create_user("cust", "cust@test.com", "pass1234")
        self.customer.groups.add(Group.objects.get(name="customer"))

        self.staff = User.objects.create_user("staffuser", "staff@test.com", "pass1234")
        self.staff.groups.add(Group.objects.get(name="staff"))

        self.item1 = MenuItem.objects.create(
            name="Latte", category="coffee", price=Decimal("160.00"),
            is_available=True, stock_quantity=10,
        )
        self.item2 = MenuItem.objects.create(
            name="Croissant", category="pastries", price=Decimal("120.00"),
            is_available=True, stock_quantity=5,
        )
        self.unavailable = MenuItem.objects.create(
            name="Seasonal Special", category="coffee", price=Decimal("200.00"),
            is_available=False, stock_quantity=0,
        )

    def test_create_order_success(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/orders/", {
            "items": [
                {"menu_item_id": self.item1.id, "quantity": 2},
                {"menu_item_id": self.item2.id, "quantity": 1},
            ]
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], "pending")
        # Server calculates: 160*2 + 120*1 = 440
        self.assertEqual(Decimal(resp.data["total"]), Decimal("440.00"))
        self.assertEqual(len(resp.data["items"]), 2)

        # Stock should be decremented
        self.item1.refresh_from_db()
        self.assertEqual(self.item1.stock_quantity, 8)

    def test_price_tampering_ignored(self):
        """Client-sent prices should be ignored; server uses DB prices."""
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/orders/", {
            "items": [
                {"menu_item_id": self.item1.id, "quantity": 1, "price": "1.00"},
            ]
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        # Price should be the real DB price, not "1.00"
        self.assertEqual(Decimal(resp.data["items"][0]["price"]), Decimal("160.00"))
        self.assertEqual(Decimal(resp.data["total"]), Decimal("160.00"))

    def test_unavailable_item_rejected(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/orders/", {
            "items": [
                {"menu_item_id": self.unavailable.id, "quantity": 1},
            ]
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_out_of_stock_rejected(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/orders/", {
            "items": [
                {"menu_item_id": self.item2.id, "quantity": 100},
            ]
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_empty_cart_rejected(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/orders/", {"items": []}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_nonexistent_item_rejected(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/orders/", {
            "items": [{"menu_item_id": 9999, "quantity": 1}]
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_unauthenticated_cannot_order(self):
        resp = self.client.post("/api/orders/", {
            "items": [{"menu_item_id": self.item1.id, "quantity": 1}]
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_customer_sees_own_orders_only(self):
        self.client.force_authenticate(user=self.customer)
        self.client.post("/api/orders/", {
            "items": [{"menu_item_id": self.item1.id, "quantity": 1}]
        }, format="json")

        # Another customer
        other = User.objects.create_user("other", "other@test.com", "pass1234")
        other.groups.add(Group.objects.get(name="customer"))
        self.client.force_authenticate(user=other)
        resp = self.client.get("/api/orders/")
        self.assertEqual(resp.data["count"], 0)

    def test_staff_sees_all_orders(self):
        self.client.force_authenticate(user=self.customer)
        self.client.post("/api/orders/", {
            "items": [{"menu_item_id": self.item1.id, "quantity": 1}]
        }, format="json")

        self.client.force_authenticate(user=self.staff)
        resp = self.client.get("/api/orders/")
        self.assertGreaterEqual(resp.data["count"], 1)

    def test_mine_param_scopes_to_own_orders_even_for_staff(self):
        self.client.force_authenticate(user=self.customer)
        self.client.post("/api/orders/", {
            "items": [{"menu_item_id": self.item1.id, "quantity": 1}]
        }, format="json")

        self.client.force_authenticate(user=self.staff)
        resp = self.client.get("/api/orders/?mine=true")
        self.assertEqual(resp.data["count"], 0)


class OrderStatusTransitionTests(TestCase):
    """Test staff status updates with valid transition enforcement."""

    def setUp(self):
        self.client = APIClient()
        for name in ("customer", "staff", "admin"):
            Group.objects.get_or_create(name=name)

        self.customer = User.objects.create_user("cust", "cust@test.com", "pass1234")
        self.customer.groups.add(Group.objects.get(name="customer"))
        self.staff = User.objects.create_user("staffuser", "staff@test.com", "pass1234")
        self.staff.groups.add(Group.objects.get(name="staff"))

        self.item = MenuItem.objects.create(
            name="Latte", category="coffee", price=Decimal("160.00"),
            is_available=True, stock_quantity=10,
        )

    def _create_order(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/orders/", {
            "items": [{"menu_item_id": self.item.id, "quantity": 1}]
        }, format="json")
        return resp.data["id"]

    def test_valid_transition_pending_to_preparing(self):
        order_id = self._create_order()
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post(f"/api/orders/{order_id}/status/", {"status": "preparing"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "preparing")

    def test_full_lifecycle(self):
        order_id = self._create_order()
        self.client.force_authenticate(user=self.staff)
        for s in ["preparing", "ready", "completed"]:
            resp = self.client.post(f"/api/orders/{order_id}/status/", {"status": s}, format="json")
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.data["status"], s)

    def test_invalid_transition_rejected(self):
        order_id = self._create_order()
        self.client.force_authenticate(user=self.staff)
        # Cannot skip from pending to ready
        resp = self.client.post(f"/api/orders/{order_id}/status/", {"status": "ready"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_cancel_restores_stock(self):
        order_id = self._create_order()
        self.item.refresh_from_db()
        stock_after_order = self.item.stock_quantity

        self.client.force_authenticate(user=self.staff)
        resp = self.client.post(f"/api/orders/{order_id}/status/", {"status": "cancelled"}, format="json")
        self.assertEqual(resp.status_code, 200)

        self.item.refresh_from_db()
        self.assertEqual(self.item.stock_quantity, stock_after_order + 1)

    def test_customer_cannot_update_status(self):
        order_id = self._create_order()
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post(f"/api/orders/{order_id}/status/", {"status": "preparing"}, format="json")
        self.assertEqual(resp.status_code, 403)


class OrderPaymentVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        for name in ("customer", "staff", "admin"):
            Group.objects.get_or_create(name=name)

        self.customer = User.objects.create_user("cust1", "cust1@test.com", "pass1234")
        self.customer.groups.add(Group.objects.get(name="customer"))

        self.other_customer = User.objects.create_user("cust2", "cust2@test.com", "pass1234")
        self.other_customer.groups.add(Group.objects.get(name="customer"))

        self.order = Order.objects.create(
            customer=self.customer,
            subtotal=Decimal("300.00"),
            total=Decimal("300.00"),
            status="pending",
        )
        from payments.models import Payment
        self.payment = Payment.objects.create(
            customer=self.customer,
            order=self.order,
            amount=self.order.total,
            method="xendit",
            status="pending",
            xendit_invoice_id="inv_test_123",
        )

    def test_verify_payment_paid_syncs_order(self):
        from unittest.mock import patch
        with patch("payments.xendit_service.get_invoice", return_value={"status": "PAID", "id": "inv_test_123"}):
            self.client.force_authenticate(user=self.customer)
            resp = self.client.post(f"/api/orders/{self.order.id}/verify-payment/")
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.data["payment_status"], "PAID")
            self.assertEqual(resp.data["paymentStatus"], "PAID")
            self.assertEqual(resp.data["status"], "preparing")

            self.order.refresh_from_db()
            self.assertEqual(self.order.payment_status, "PAID")
            self.assertEqual(self.order.status, "preparing")

            self.payment.refresh_from_db()
            self.assertEqual(self.payment.status, "paid")

    def test_verify_payment_already_paid(self):
        self.payment.status = "paid"
        self.payment.save()
        self.order.payment_status = "PAID"
        self.order.status = "preparing"
        self.order.save()

        self.client.force_authenticate(user=self.customer)
        resp = self.client.post(f"/api/orders/{self.order.id}/verify-payment/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["payment_status"], "PAID")
        self.assertEqual(resp.data["status"], "preparing")

    def test_verify_payment_other_user_denied(self):
        self.client.force_authenticate(user=self.other_customer)
        resp = self.client.post(f"/api/orders/{self.order.id}/verify-payment/")
        self.assertEqual(resp.status_code, 404)


class OrderCancellationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        for name in ("customer", "staff", "admin"):
            Group.objects.get_or_create(name=name)

        self.customer = User.objects.create_user("cancel_cust", "cust@test.com", "pass1234")
        self.customer.groups.add(Group.objects.get(name="customer"))

        self.other_customer = User.objects.create_user("cancel_other", "other@test.com", "pass1234")
        self.other_customer.groups.add(Group.objects.get(name="customer"))

        self.item = MenuItem.objects.create(
            name="Latte", category="coffee", price=Decimal("150.00"),
            is_available=True, stock_quantity=10,
        )

        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/orders/", {
            "items": [{"menu_item_id": self.item.id, "quantity": 2}]
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.order_id = resp.data["id"]

    def test_customer_can_cancel_unpaid_order(self):
        self.item.refresh_from_db()
        self.assertEqual(self.item.stock_quantity, 8)

        self.client.force_authenticate(user=self.customer)
        resp = self.client.post(f"/api/orders/{self.order_id}/cancel/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "cancelled")

        # Stock should be restored
        self.item.refresh_from_db()
        self.assertEqual(self.item.stock_quantity, 10)

    def test_customer_can_cancel_unpaid_order_via_patch(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.patch(f"/api/orders/{self.order_id}/cancel/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "cancelled")

    def test_customer_cannot_cancel_paid_order(self):
        order = Order.objects.get(id=self.order_id)
        order.payment_status = "PAID"
        order.status = "preparing"
        order.save()

        self.client.force_authenticate(user=self.customer)
        resp = self.client.post(f"/api/orders/{self.order_id}/cancel/")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Only unpaid pending orders can be canceled online", resp.data["detail"])

    def test_customer_cannot_cancel_other_user_order(self):
        self.client.force_authenticate(user=self.other_customer)
        resp = self.client.post(f"/api/orders/{self.order_id}/cancel/")
        self.assertEqual(resp.status_code, 404)

    def test_unauthenticated_cannot_cancel(self):
        self.client.logout()
        resp = self.client.post(f"/api/orders/{self.order_id}/cancel/")
        self.assertEqual(resp.status_code, 403)


class StampCardAndFreeTreatTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        for name in ("customer", "staff", "admin"):
            Group.objects.get_or_create(name=name)

        self.customer = User.objects.create_user("stamp_cust", "stamp@test.com", "pass1234")
        self.customer.groups.add(Group.objects.get(name="customer"))
        self.profile = self.customer.profile

        self.coffee = MenuItem.objects.create(
            name="Latte", category="coffee", price=Decimal("150.00"),
            is_available=True, stock_quantity=20,
        )
        self.pastry = MenuItem.objects.create(
            name="Croissant", category="pastries", price=Decimal("120.00"),
            is_available=True, stock_quantity=20,
        )
        self.merch = MenuItem.objects.create(
            name="Paw Print Mug", category="merch", price=Decimal("300.00"),
            is_available=True, stock_quantity=10,
        )

    def test_stamps_awarded_for_qualifying_items_on_payment(self):
        # Order with 2 lattes, 1 croissant, 1 mug
        # Qualifying items: 2 + 1 = 3 stamps (mug excluded)
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/orders/", {
            "items": [
                {"menu_item_id": self.coffee.id, "quantity": 2},
                {"menu_item_id": self.pastry.id, "quantity": 1},
                {"menu_item_id": self.merch.id, "quantity": 1},
            ]
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        order_id = resp.data["id"]

        order = Order.objects.get(id=order_id)
        self.assertFalse(order.loyalty_credited)

        # Pending order: stamps must be 0
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.stamps_count, 0)

        # Simulate payment confirmation
        from orders.services import award_order_stamps_and_loyalty
        award_order_stamps_and_loyalty(order)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.stamps_count, 3)

        order.refresh_from_db()
        self.assertTrue(order.loyalty_credited)

        # Idempotency check: calling again must not double award
        award_order_stamps_and_loyalty(order)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.stamps_count, 3)

    def test_redeem_free_treat_discounts_lowest_qualifying_item(self):
        # Give user 12 stamps
        self.profile.stamps_count = 12
        self.profile.free_treats_available = 1
        self.profile.save()

        self.client.force_authenticate(user=self.customer)
        # Order contains Latte (150) and Croissant (120)
        # Lowest qualifying item is Croissant (120)
        # Subtotal: 150 + 120 = 270. Discount: 120. Total: 150.
        resp = self.client.post("/api/orders/", {
            "items": [
                {"menu_item_id": self.coffee.id, "quantity": 1},
                {"menu_item_id": self.pastry.id, "quantity": 1},
            ],
            "redeem_free_treat": True,
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Decimal(resp.data["discount_amount"]), Decimal("120.00"))
        self.assertEqual(Decimal(resp.data["total"]), Decimal("150.00"))
        self.assertTrue(resp.data["free_treat_redeemed"])

        # Stamps should be deducted: 12 - 10 = 2 remaining
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.stamps_count, 2)
        self.assertEqual(self.profile.free_treats_available, 0)

    def test_cancel_unpaid_order_restores_redeemed_stamps(self):
        self.profile.stamps_count = 10
        self.profile.free_treats_available = 1
        self.profile.save()

        self.client.force_authenticate(user=self.customer)
        # Order with 2 coffees (subtotal 300). Discount: 150. Total: 150 (unpaid pending)
        resp = self.client.post("/api/orders/", {
            "items": [{"menu_item_id": self.coffee.id, "quantity": 2}],
            "redeem_free_treat": True,
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], "pending")
        order_id = resp.data["id"]

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.stamps_count, 0)

        # Cancel the unpaid order
        cancel_resp = self.client.post(f"/api/orders/{order_id}/cancel/")
        self.assertEqual(cancel_resp.status_code, 200)

        # Stamps restored back to 10
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.stamps_count, 10)
        self.assertEqual(self.profile.free_treats_available, 1)

    def test_redeem_free_treat_rejected_if_insufficient_stamps(self):
        self.profile.stamps_count = 5
        self.profile.free_treats_available = 0
        self.profile.save()

        self.client.force_authenticate(user=self.customer)
        resp = self.client.post("/api/orders/", {
            "items": [{"menu_item_id": self.coffee.id, "quantity": 1}],
            "redeem_free_treat": True,
        }, format="json")
        self.assertEqual(resp.status_code, 400)

