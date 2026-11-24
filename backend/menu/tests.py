from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from menu.models import MenuCategory, MenuItem, Review
from orders.models import Order, OrderItem

User = get_user_model()


class MenuCategoryModelAndAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_group, _ = Group.objects.get_or_create(name="admin")
        self.staff_group, _ = Group.objects.get_or_create(name="staff")

        self.customer = User.objects.create_user(
            username="customer1",
            email="cust1@catopia.test",
            password="Password123!",
        )
        self.staff = User.objects.create_user(
            username="staff1",
            email="staff1@catopia.test",
            password="Password123!",
        )
        self.staff.groups.add(self.staff_group)

        self.category, _ = MenuCategory.objects.get_or_create(
            slug="specialty-coffee",
            defaults={
                "name": "Specialty Coffee",
                "description": "Our house special coffee brews",
                "enable_sizing": True,
                "enable_temperature": True,
                "qualifies_for_stamps": True,
                "badge_tag": "Barista Favorite",
                "sort_order": 10,
                "is_visible": True,
            },
        )

        self.hidden_category, _ = MenuCategory.objects.get_or_create(
            slug="secret-menu",
            defaults={
                "name": "Secret Menu",
                "description": "Hidden items for VIPs",
                "is_visible": False,
                "sort_order": 20,
            },
        )

    def test_category_list_public_vs_staff(self):
        # Public sees only visible categories
        res = self.client.get("/api/menu/categories/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = res.data if isinstance(res.data, list) else res.data.get("results", [])
        slugs = [c["slug"] for c in items if "slug" in c]
        self.assertIn("specialty-coffee", slugs)
        self.assertNotIn("secret-menu", slugs)

        # Staff sees all categories including hidden
        self.client.force_authenticate(user=self.staff)
        res_staff = self.client.get("/api/menu/categories/")
        self.assertEqual(res_staff.status_code, status.HTTP_200_OK)
        staff_items = res_staff.data if isinstance(res_staff.data, list) else res_staff.data.get("results", [])
        staff_slugs = [c["slug"] for c in staff_items if "slug" in c]
        self.assertIn("specialty-coffee", staff_slugs)
        self.assertIn("secret-menu", staff_slugs)

    def test_category_crud_permissions(self):
        # Anonymous cannot create
        payload = {
            "name": "Artisan Teas",
            "slug": "artisan-teas",
            "enable_sizing": True,
            "enable_temperature": True,
        }
        res_anon = self.client.post("/api/menu/categories/", payload)
        self.assertIn(res_anon.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # Customer cannot create
        self.client.force_authenticate(user=self.customer)
        res_cust = self.client.post("/api/menu/categories/", payload)
        self.assertEqual(res_cust.status_code, status.HTTP_403_FORBIDDEN)

        # Staff can create
        self.client.force_authenticate(user=self.staff)
        res_staff = self.client.post("/api/menu/categories/", payload)
        self.assertEqual(res_staff.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MenuCategory.objects.filter(slug="artisan-teas").count(), 1)

    def test_category_reorder_action(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post(
            "/api/menu/categories/reorder/",
            {"order": [self.hidden_category.id, self.category.id]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.hidden_category.refresh_from_db()
        self.category.refresh_from_db()
        self.assertEqual(self.hidden_category.sort_order, 0)
        self.assertEqual(self.category.sort_order, 1)


class MenuItemCustomizationAndInheritanceTest(TestCase):
    def setUp(self):
        self.category, _ = MenuCategory.objects.get_or_create(
            slug="coffee-cat",
            defaults={
                "name": "Coffee Cat",
                "enable_sizing": True,
                "enable_temperature": True,
                "qualifies_for_stamps": True,
                "badge_tag": "Fresh Beans",
            },
        )
        self.item = MenuItem.objects.create(
            name="Vanilla Catpuccino",
            category="coffee",
            category_obj=self.category,
            price=Decimal("150.00"),
            stock_quantity=50,
            is_available=True,
        )

    def test_menu_item_inherits_category_settings(self):
        self.assertTrue(self.item.effective_enable_sizing)
        self.assertTrue(self.item.effective_enable_temperature)
        self.assertTrue(self.item.effective_qualifies_for_stamps)

        client = APIClient()
        res = client.get(f"/api/menu/items/{self.item.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["enable_sizing"])
        self.assertTrue(res.data["enable_temperature"])
        self.assertTrue(res.data["qualifies_for_stamps"])
        self.assertEqual(res.data["badge_tag"], "Fresh Beans")

    def test_menu_item_per_item_override(self):
        # Override sizing to False and stamps to False
        self.item.override_sizing = False
        self.item.override_stamps = False
        self.item.save()

        self.assertFalse(self.item.effective_enable_sizing)
        self.assertTrue(self.item.effective_enable_temperature)  # still inherited
        self.assertFalse(self.item.effective_qualifies_for_stamps)

        client = APIClient()
        res = client.get(f"/api/menu/items/{self.item.id}/")
        self.assertFalse(res.data["enable_sizing"])
        self.assertTrue(res.data["enable_temperature"])
        self.assertFalse(res.data["qualifies_for_stamps"])


class ReviewAndRatingTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username="reviewer",
            first_name="Jane",
            last_name="Doe",
            email="jane@catopia.test",
            password="Password123!",
        )
        self.item = MenuItem.objects.create(
            name="Matcha Latte",
            category="non_coffee_tea",
            price=Decimal("160.00"),
            stock_quantity=20,
            is_available=True,
        )

    def test_create_and_update_review(self):
        self.client.force_authenticate(user=self.customer)

        # Create review
        payload = {
            "menu_item": self.item.id,
            "rating": 5,
            "headline": "Purrfect Matcha!",
            "comment": "Silky smooth with lovely cat foam art.",
        }
        res = self.client.post("/api/menu/reviews/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["rating"], 5)
        self.assertEqual(res.data["user_name"], "Jane Doe")
        self.assertEqual(res.data["user_initials"], "JD")
        self.assertFalse(res.data["is_verified_order"])

        # Item rating summary updates
        item_res = self.client.get(f"/api/menu/items/{self.item.id}/")
        self.assertEqual(item_res.data["avg_rating"], 5.0)
        self.assertEqual(item_res.data["averageRating"], 5.0)
        self.assertEqual(item_res.data["review_count"], 1)
        self.assertEqual(item_res.data["reviewCount"], 1)

        # Menu list queries include live averageRating and reviewCount
        list_res = self.client.get("/api/menu/items/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        items_list = list_res.data if isinstance(list_res.data, list) else list_res.data.get("results", [])
        matched = next((i for i in items_list if i["id"] == self.item.id), None)
        self.assertIsNotNone(matched)
        self.assertEqual(matched["averageRating"], 5.0)
        self.assertEqual(matched["reviewCount"], 1)

        # Root menu list GET /api/menu/ also works
        root_res = self.client.get("/api/menu/")
        self.assertEqual(root_res.status_code, status.HTTP_200_OK)

        # Submitting again updates existing review (no 500 error)
        payload_update = {
            "menu_item": self.item.id,
            "rating": 4,
            "headline": "Still great!",
            "comment": "Reduced sugar slightly.",
        }
        res_up = self.client.post("/api/menu/reviews/", payload_update)
        self.assertEqual(res_up.status_code, status.HTTP_200_OK)
        self.assertEqual(res_up.data["rating"], 4)
        self.assertEqual(Review.objects.filter(menu_item=self.item).count(), 1)

    def test_verified_order_badge(self):
        # Create an order with this item for the user and mark it PAID
        order = Order.objects.create(
            customer=self.customer,
            status="preparing",
            payment_status="PAID",
            subtotal=Decimal("160.00"),
            total=Decimal("160.00"),
        )
        OrderItem.objects.create(
            order=order,
            menu_item=self.item,
            name=self.item.name,
            price=self.item.price,
            unit_price=self.item.price,
            quantity=1,
        )

        review = Review.objects.create(
            menu_item=self.item,
            user=self.customer,
            rating=5,
            headline="Verified Drinker",
            comment="Loved it!",
        )

        res = self.client.get(f"/api/menu/reviews/?menu_item={self.item.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reviews = res.data if isinstance(res.data, list) else res.data.get("results", [])
        self.assertTrue(len(reviews) > 0)
        self.assertTrue(reviews[0]["is_verified_order"])


class OrderVariantAndCustomizationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username="drinker",
            email="drinker@catopia.test",
            password="Password123!",
        )
        self.category, _ = MenuCategory.objects.get_or_create(
            slug="coffee",
            defaults={
                "name": "Coffee",
                "enable_sizing": True,
                "enable_temperature": True,
                "qualifies_for_stamps": True,
            },
        )
        self.category.enable_sizing = True
        self.category.enable_temperature = True
        self.category.qualifies_for_stamps = True
        self.category.save()

        self.item = MenuItem.objects.create(
            name="Purrista Latte",
            category="coffee",
            category_obj=self.category,
            price=Decimal("140.00"),
            stock_quantity=10,
            is_available=True,
        )

    def test_create_order_with_variants(self):
        self.client.force_authenticate(user=self.customer)

        # Order 1: Regular Hot (₱140.00 + ₱0 + ₱0 = ₱140.00)
        # Order 2: Grande Cold (₱140.00 + ₱30.00 (Grande) + ₱30.00 (Cold) = ₱200.00)
        payload = {
            "items": [
                {
                    "menu_item_id": self.item.id,
                    "quantity": 1,
                    "size": "Regular",
                    "temperature": "Hot",
                },
                {
                    "menu_item_id": self.item.id,
                    "quantity": 2,
                    "size": "Grande",
                    "temperature": "Cold",
                },
            ]
        }

        res = self.client.post("/api/orders/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        order_id = res.data["id"]
        order = Order.objects.get(id=order_id)

        # Expected subtotal: 1 * 140 + 2 * 200 = 140 + 400 = ₱540.00
        self.assertEqual(order.subtotal, Decimal("540.00"))
        self.assertEqual(order.total, Decimal("540.00"))

        # Verify OrderItem line items
        items = list(order.items.order_by("unit_price"))
        self.assertEqual(len(items), 2)

        reg_hot = items[0]
        self.assertEqual(reg_hot.size, "Regular")
        self.assertEqual(reg_hot.temperature, "Hot")
        self.assertEqual(reg_hot.unit_price, Decimal("140.00"))
        self.assertEqual(reg_hot.line_total, Decimal("140.00"))

        grande_cold = items[1]
        self.assertEqual(grande_cold.size, "Grande")
        self.assertEqual(grande_cold.temperature, "Cold")
        self.assertEqual(grande_cold.unit_price, Decimal("200.00"))
        self.assertEqual(grande_cold.line_total, Decimal("400.00"))

        # Verify stock was decremented by 1 + 2 = 3
        self.item.refresh_from_db()
        self.assertEqual(self.item.stock_quantity, 7)
