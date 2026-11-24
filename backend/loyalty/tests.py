from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Profile
from menu.models import MenuItem
from orders.models import Order, OrderItem
from orders.services import award_order_stamps_and_loyalty
from payments.models import Payment
from loyalty.models import LoyaltyTransaction, RewardVoucher


class PawPointsLoyaltyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="pawtester",
            email="paw@example.com",
            password="testpassword123",
            first_name="Paw",
            last_name="Tester",
        )
        self.profile, _ = Profile.objects.get_or_create(user=self.user)
        self.client.force_login(self.user)

        self.drink = MenuItem.objects.create(
            name="Meow-cha Latte",
            description="Warm green tea latte with cat latte art",
            price=Decimal("175.00"),
            category="coffee",
            is_available=True,
            stock_quantity=50,
        )
        self.pastry = MenuItem.objects.create(
            name="Paw Print Cookie",
            description="Cinnamon butter cookie",
            price=Decimal("85.00"),
            category="pastries",
            is_available=True,
            stock_quantity=50,
        )
        self.mug = MenuItem.objects.create(
            name="Paw Print Ceramic Mug",
            description="Handmade ceramic mug",
            price=Decimal("300.00"),
            category="merchandise",
            is_available=True,
            stock_quantity=50,
        )

    def test_award_points_on_paid_order(self):
        """1 Paw Point is awarded per full ₱10 spent (e.g. ₱175 -> 17 points, ₱515 -> 51 points)."""
        order = Order.objects.create(
            customer=self.user,
            subtotal=Decimal("175.00"),
            total=Decimal("175.00"),
            status="preparing",
            payment_status="PAID",
        )
        OrderItem.objects.create(
            order=order,
            menu_item=self.drink,
            name=self.drink.name,
            price=self.drink.price,
            quantity=1,
        )

        award_order_stamps_and_loyalty(order)
        self.profile.refresh_from_db()
        order.refresh_from_db()

        self.assertEqual(self.profile.paw_points, 17)
        self.assertEqual(self.profile.lifetime_paw_points, 17)
        self.assertTrue(order.points_credited)
        self.assertTrue(order.loyalty_credited)

        tx = LoyaltyTransaction.objects.filter(order=order).first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.points, 17)

    def test_points_calculation_515_order(self):
        """₱515 order awards exactly 51 points."""
        order = Order.objects.create(
            customer=self.user,
            subtotal=Decimal("515.00"),
            total=Decimal("515.00"),
            status="preparing",
            payment_status="PAID",
        )
        award_order_stamps_and_loyalty(order)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.paw_points, 51)
        self.assertEqual(self.profile.lifetime_paw_points, 51)

    def test_idempotent_points_awarding(self):
        """Calling award_order_stamps_and_loyalty multiple times does not duplicate points."""
        order = Order.objects.create(
            customer=self.user,
            subtotal=Decimal("200.00"),
            total=Decimal("200.00"),
            status="preparing",
            payment_status="PAID",
        )
        award_order_stamps_and_loyalty(order)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.paw_points, 20)

        # Call again
        award_order_stamps_and_loyalty(order)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.paw_points, 20)
        self.assertEqual(LoyaltyTransaction.objects.filter(order=order).count(), 1)

    def test_unpaid_or_cancelled_orders_do_not_award_points(self):
        """Pending unpaid orders and cancelled orders never award points."""
        # 1. Unpaid order created via checkout API
        res = self.client.post(
            "/api/orders/",
            {"items": [{"menu_item_id": self.drink.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=res.data["id"])
        self.assertEqual(order.payment_status, "UNPAID")
        self.assertEqual(order.status, "pending")
        self.assertFalse(order.points_credited)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.paw_points, 0)

        # 2. Cancelled order never awards points
        order.status = "cancelled"
        order.save()
        award_order_stamps_and_loyalty(order)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.paw_points, 0)
        self.assertFalse(order.points_credited)

    def test_tier_calculation_kitten_vs_tabby_club(self):
        """Under 800 lifetime points is Kitten, 800+ is Tabby Club."""
        self.profile.lifetime_paw_points = 500
        self.profile.paw_points = 500
        self.profile.save()

        res = self.client.get("/api/users/me/loyalty/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["tier"], "Kitten")
        self.assertEqual(res.data["points_to_next_tier"], 300)
        self.assertEqual(res.data["paw_points"], 500)

        # Upgrade to Tabby Club
        self.profile.lifetime_paw_points = 850
        self.profile.paw_points = 850
        self.profile.save()

        res2 = self.client.get("/api/users/me/loyalty/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["tier"], "Tabby Club")
        self.assertEqual(res2.data["next_tier"], "Tubby Club")
        self.assertEqual(res2.data["points_to_next_tier"], 1650)  # 2500 - 850

        # Upgrade to Tubby Club
        self.profile.lifetime_paw_points = 2600
        self.profile.paw_points = 2600
        self.profile.save()

        res3 = self.client.get("/api/users/me/loyalty/")
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.assertEqual(res3.data["tier"], "Tubby Club")
        self.assertIsNone(res3.data["next_tier"])
        self.assertEqual(res3.data["points_to_next_tier"], 0)
        self.assertEqual(res3.data["tier_progress"], 100.0)

    def test_redeem_reward_deducts_paw_points_preserving_lifetime(self):
        """Redeeming a reward deducts spendable paw_points, keeps lifetime_paw_points unchanged."""
        self.profile.paw_points = 500
        self.profile.lifetime_paw_points = 850
        self.profile.save()

        # Redeem "Any Drink On Us" (400 pts, id=1)
        res = self.client.post("/api/loyalty/redeem/", {"reward_id": 1})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.profile.refresh_from_db()

        self.assertEqual(self.profile.paw_points, 100)  # 500 - 400
        self.assertEqual(self.profile.lifetime_paw_points, 850)  # Untouched!
        self.assertIn("voucher", res.data)
        self.assertEqual(res.data["voucher"]["reward_type"], "free_drink")
        self.assertTrue(res.data["voucher"]["code"].startswith("VCHR-"))

        # Check voucher in DB
        voucher = RewardVoucher.objects.get(code=res.data["voucher"]["code"])
        self.assertEqual(voucher.status, "active")
        self.assertEqual(voucher.user, self.user)

    def test_redeem_insufficient_points_rejected(self):
        """Attempting to redeem without enough points returns 400."""
        self.profile.paw_points = 200
        self.profile.save()

        res = self.client.post("/api/loyalty/redeem/", {"reward_id": 2})  # Free Pastry costs 300 pts
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient", res.data["detail"])

    def test_apply_voucher_at_checkout(self):
        """A free_pastry voucher applied at checkout discounts the pastry and marks voucher used."""
        voucher = RewardVoucher.objects.create(
            user=self.user,
            reward_type="free_pastry",
            title="Free Pastry",
            points_cost=300,
            code="VCHR-TESTPASTRY",
            status="active",
        )

        res = self.client.post(
            "/api/orders/",
            {
                "items": [
                    {"menu_item_id": self.pastry.id, "quantity": 1},
                    {"menu_item_id": self.drink.id, "quantity": 1},
                ],
                "voucher_id": voucher.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order_id = res.data["id"]
        order = Order.objects.get(pk=order_id)

        # Pastry was ₱85, drink was ₱175. Total = ₱175, voucher_discount = ₱85
        self.assertEqual(order.voucher_discount, Decimal("85.00"))
        self.assertEqual(order.total, Decimal("175.00"))

        voucher.refresh_from_db()
        self.assertEqual(voucher.status, "used")
        self.assertEqual(voucher.order, order)
        self.assertIsNotNone(voucher.used_at)

    @patch("payments.xendit_service.create_refund")
    def test_refund_deducts_paw_points(self, mock_refund):
        """Admin refunding a paid order deducts credited points."""
        admin_user = User.objects.create_user(
            username="admin_refund",
            email="admin@example.com",
            password="testpassword123",
            is_staff=True,
        )
        from django.contrib.auth.models import Group
        admin_group, _ = Group.objects.get_or_create(name="admin")
        admin_user.groups.add(admin_group)

        order = Order.objects.create(
            customer=self.user,
            subtotal=Decimal("200.00"),
            total=Decimal("200.00"),
            status="preparing",
            payment_status="PAID",
        )
        award_order_stamps_and_loyalty(order)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.paw_points, 20)

        payment = Payment.objects.create(
            customer=self.user,
            order=order,
            amount=Decimal("200.00"),
            status="paid",
            method="xendit",
        )

        self.client.force_login(admin_user)
        res = self.client.post(f"/api/payments/{payment.pk}/refund/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.paw_points, 0)
        self.assertEqual(self.profile.lifetime_paw_points, 0)

    def test_tabby_club_earn_rate_and_bonus(self):
        """Crossing 800 lifetime points unlocks Tabby Club, grants +30 bonus points once, and earns at 1.25x."""
        self.profile.paw_points = 0
        self.profile.lifetime_paw_points = 780
        self.profile.tabby_bonus_credited = False
        self.profile.save()

        # Place ₱200 order while still Kitten -> base 1.0x earn rate = 20 pts
        # 780 + 20 = 800 pts -> unlocks Tabby Club (+30 bonus pts)
        order1 = Order.objects.create(
            customer=self.user,
            subtotal=Decimal("200.00"),
            total=Decimal("200.00"),
            status="preparing",
            payment_status="PAID",
        )
        award_order_stamps_and_loyalty(order1)
        self.profile.refresh_from_db()

        self.assertTrue(self.profile.tabby_bonus_credited)
        # 20 pts earned + 30 bonus = 50 spendable paw points
        self.assertEqual(self.profile.paw_points, 50)
        # 780 + 20 + 30 = 830 lifetime paw points
        self.assertEqual(self.profile.lifetime_paw_points, 830)
        self.assertEqual(self.profile.tier, "Tabby Club")

        # Now in Tabby Club: next ₱200 order earns at 1.25x -> math.floor((200/10) * 1.25) = 25 pts
        order2 = Order.objects.create(
            customer=self.user,
            subtotal=Decimal("200.00"),
            total=Decimal("200.00"),
            status="preparing",
            payment_status="PAID",
        )
        award_order_stamps_and_loyalty(order2)
        self.profile.refresh_from_db()

        # 50 + 25 = 75 spendable points (no second +30 bonus because tabby_bonus_credited is True)
        self.assertEqual(self.profile.paw_points, 75)
        self.assertEqual(self.profile.lifetime_paw_points, 855)

    def test_tubby_club_earn_rate_and_bonus(self):
        """Crossing 2,500 lifetime points unlocks Tubby Club, grants +75 bonus points once, and earns at 1.5x."""
        self.profile.paw_points = 100
        self.profile.lifetime_paw_points = 2480
        self.profile.tabby_bonus_credited = True
        self.profile.tubby_bonus_credited = False
        self.profile.save()

        # At 2480 (Tabby Club), order of ₱200 earns 25 pts (1.25x)
        # 2480 + 25 = 2505 (>= 2500) -> unlocks Tubby Club (+75 bonus pts)
        order1 = Order.objects.create(
            customer=self.user,
            subtotal=Decimal("200.00"),
            total=Decimal("200.00"),
            status="preparing",
            payment_status="PAID",
        )
        award_order_stamps_and_loyalty(order1)
        self.profile.refresh_from_db()

        self.assertTrue(self.profile.tubby_bonus_credited)
        # 100 + 25 + 75 bonus = 200 spendable paw points
        self.assertEqual(self.profile.paw_points, 200)
        # 2480 + 25 + 75 = 2580 lifetime points
        self.assertEqual(self.profile.lifetime_paw_points, 2580)
        self.assertEqual(self.profile.tier, "Tubby Club")

        # Now in Tubby Club: next ₱200 order earns at 1.5x -> math.floor((200/10) * 1.5) = 30 pts
        order2 = Order.objects.create(
            customer=self.user,
            subtotal=Decimal("200.00"),
            total=Decimal("200.00"),
            status="preparing",
            payment_status="PAID",
        )
        award_order_stamps_and_loyalty(order2)
        self.profile.refresh_from_db()

        self.assertEqual(self.profile.paw_points, 230)
        self.assertEqual(self.profile.lifetime_paw_points, 2610)

    def test_no_stacking_guardrail_at_checkout(self):
        """Customer cannot redeem both a Stamp Card free treat and a Reward Voucher in the same order."""
        self.profile.stamps_count = 10
        self.profile.free_treats_available = 1
        self.profile.save()

        voucher = RewardVoucher.objects.create(
            user=self.user,
            reward_type="free_pastry",
            title="Free Pastry",
            points_cost=300,
            code="VCHR-STACK-TEST",
            status="active",
        )

        res = self.client.post(
            "/api/orders/",
            {
                "items": [
                    {"menu_item_id": self.pastry.id, "quantity": 1},
                    {"menu_item_id": self.drink.id, "quantity": 1},
                ],
                "redeem_free_treat": True,
                "voucher_id": voucher.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only one loyalty redemption", str(res.data))

    def test_minimum_paid_purchase_guardrail_at_checkout(self):
        """Loyalty redemption requires at least ₱100 paid subtotal after discounts (no ₱0 orders)."""
        voucher = RewardVoucher.objects.create(
            user=self.user,
            reward_type="free_pastry",
            title="Free Pastry",
            points_cost=300,
            code="VCHR-MIN-PAID",
            status="active",
        )

        # Cart with only 1 pastry (₱85). Voucher covers ₱85 -> tentative paid total is ₱0.00 (< ₱100)
        res = self.client.post(
            "/api/orders/",
            {
                "items": [
                    {"menu_item_id": self.pastry.id, "quantity": 1},
                ],
                "voucher_id": voucher.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("minimum paid purchase of ₱100.00", str(res.data))

        # Adding a drink (₱175) makes subtotal ₱260, voucher discount ₱85 -> net total ₱175 (>= ₱100). Succeeded!
        res_ok = self.client.post(
            "/api/orders/",
            {
                "items": [
                    {"menu_item_id": self.pastry.id, "quantity": 1},
                    {"menu_item_id": self.drink.id, "quantity": 1},
                ],
                "voucher_id": voucher.id,
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_ok.data["total"], "175.00")

    def test_tabby_and_tubby_member_perks_at_checkout(self):
        """Tabby Club gets -₱30 and Tubby Club gets -₱50 perk discount on one drink at checkout."""
        # 1. Tabby Club member (-₱30 on drink)
        self.profile.lifetime_paw_points = 1200
        self.profile.save()

        res_tabby = self.client.post(
            "/api/orders/",
            {
                "items": [{"menu_item_id": self.drink.id, "quantity": 1}],
            },
            format="json",
        )
        self.assertEqual(res_tabby.status_code, status.HTTP_201_CREATED)
        order_tabby = Order.objects.get(id=res_tabby.data["id"])
        self.assertEqual(order_tabby.perk_discount, Decimal("30.00"))
        self.assertEqual(order_tabby.total, Decimal("145.00"))  # 175 - 30
        self.assertIn("Tabby Club Perk", order_tabby.tier_perk_applied)

        # 2. Tubby Club member (-₱50 on drink)
        self.profile.lifetime_paw_points = 2600
        self.profile.save()

        res_tubby = self.client.post(
            "/api/orders/",
            {
                "items": [{"menu_item_id": self.drink.id, "quantity": 1}],
            },
            format="json",
        )
        self.assertEqual(res_tubby.status_code, status.HTTP_201_CREATED)
        order_tubby = Order.objects.get(id=res_tubby.data["id"])
        self.assertEqual(order_tubby.perk_discount, Decimal("50.00"))
        self.assertEqual(order_tubby.total, Decimal("125.00"))  # 175 - 50
        self.assertIn("Tubby Club Perk", order_tubby.tier_perk_applied)

    def test_off_peak_cat_room_voucher_rules(self):
        """Cat Room 50% voucher is strictly valid for 1 guest on weekdays (Mon–Thu) only."""
        import datetime
        voucher = RewardVoucher.objects.create(
            user=self.user,
            reward_type="catroom_50",
            title="50% Off Cat Room Hour",
            points_cost=600,
            code="VCHR-CAT50-TEST",
            status="active",
        )

        # Find upcoming Monday (weekday 0) and upcoming Saturday (weekday 5)
        today = datetime.date.today()
        monday = today + datetime.timedelta(days=(0 - today.weekday()) % 7)
        if monday == today:
            monday += datetime.timedelta(days=7)

        saturday = today + datetime.timedelta(days=(5 - today.weekday()) % 7)
        if saturday == today:
            saturday += datetime.timedelta(days=7)

        # 1. Attempt on Saturday -> 400
        res_weekend = self.client.post(
            "/api/catroom/reservations/",
            {
                "date": saturday.isoformat(),
                "slot_start": "10:00",
                "visitors": 1,
                "payment_option": "full",
                "policy_acknowledged": True,
                "voucher_code": voucher.code,
            },
            format="json",
        )
        self.assertEqual(res_weekend.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("weekdays", str(res_weekend.data))

        # 2. Attempt on Monday with 2 visitors -> 400
        res_multi = self.client.post(
            "/api/catroom/reservations/",
            {
                "date": monday.isoformat(),
                "slot_start": "10:00",
                "visitors": 2,
                "payment_option": "full",
                "policy_acknowledged": True,
                "voucher_code": voucher.code,
            },
            format="json",
        )
        self.assertEqual(res_multi.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("1 guest only", str(res_multi.data))

        # 3. Monday with 1 guest -> 201 Created with 50% discount (₱300 -> ₱150)
        res_ok = self.client.post(
            "/api/catroom/reservations/",
            {
                "date": monday.isoformat(),
                "slot_start": "10:00",
                "visitors": 1,
                "payment_option": "full",
                "policy_acknowledged": True,
                "voucher_code": voucher.code,
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(res_ok.data["fee"])), Decimal("150.00"))
        voucher.refresh_from_db()
        self.assertEqual(voucher.status, "used")
