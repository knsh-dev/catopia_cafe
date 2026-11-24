"""
Management command to seed the database with demo data.
Usage: python manage.py seed_demo
"""
from decimal import Decimal

from django.contrib.auth.models import User, Group
from django.core.management.base import BaseCommand

from menu.models import MenuItem
from cats.models import ResidentCat


class Command(BaseCommand):
    help = "Seed the database with demo users, menu items, and resident cats."

    def handle(self, *args, **options):
        self.stdout.write("Seeding groups...")
        for name in ("customer", "staff", "admin"):
            Group.objects.get_or_create(name=name)

        # ----- Users -----
        self.stdout.write("Seeding users...")
        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@catopia.test",
                "first_name": "Catopia",
                "last_name": "Admin",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            admin_user.set_password("admin1234")
            admin_user.save()
            admin_user.groups.add(Group.objects.get(name="admin"))
            self.stdout.write(self.style.SUCCESS("  Created admin user (admin / admin1234)"))

        staff_user, created = User.objects.get_or_create(
            username="staff",
            defaults={
                "email": "staff@catopia.test",
                "first_name": "Barista",
                "last_name": "Staff",
            },
        )
        if created:
            staff_user.set_password("staff1234")
            staff_user.save()
            staff_user.groups.add(Group.objects.get(name="staff"))
            self.stdout.write(self.style.SUCCESS("  Created staff user (staff / staff1234)"))

        demo_user, created = User.objects.get_or_create(
            username="demo",
            defaults={
                "email": "demo@catopia.test",
                "first_name": "Demo",
                "last_name": "Customer",
            },
        )
        if created:
            demo_user.set_password("demo1234")
            demo_user.save()
            demo_user.groups.add(Group.objects.get(name="customer"))
            self.stdout.write(self.style.SUCCESS("  Created demo customer (demo / demo1234)"))

        # ----- Menu Items -----
        self.stdout.write("Seeding menu items...")
        menu_items = [
            # Coffee
            {"name": "Catpuccino", "description": "Rich espresso topped with steamed milk and cocoa paw art.", "category": "coffee", "price": Decimal("160.00"), "stock_quantity": 50},
            {"name": "Purrista Latte", "description": "Creamy vanilla latte with a hint of caramel.", "category": "coffee", "price": Decimal("175.00"), "stock_quantity": 50},
            {"name": "Meow-cha Espresso", "description": "Double-shot espresso with a mocha twist.", "category": "coffee", "price": Decimal("150.00"), "stock_quantity": 50},
            {"name": "Whisker Brew", "description": "Cold brew infused with hazelnut and oat milk.", "category": "coffee", "price": Decimal("185.00"), "stock_quantity": 40},
            # Non-Coffee & Tea
            {"name": "Chai Purrfection", "description": "Spiced chai latte with cinnamon and nutmeg.", "category": "non_coffee_tea", "price": Decimal("155.00"), "stock_quantity": 40},
            {"name": "Matcha Kitty", "description": "Ceremonial-grade matcha with oat milk.", "category": "non_coffee_tea", "price": Decimal("170.00"), "stock_quantity": 40},
            {"name": "Berry Paws Iced Tea", "description": "Mixed berry iced tea with a splash of lemonade.", "category": "non_coffee_tea", "price": Decimal("130.00"), "stock_quantity": 60},
            {"name": "Hot Chocolate Tabby", "description": "Velvety hot chocolate with marshmallow whiskers.", "category": "non_coffee_tea", "price": Decimal("145.00"), "stock_quantity": 40},
            # Pastries
            {"name": "Cat-shaped Croissant", "description": "Buttery croissant baked in an adorable cat mold.", "category": "pastries", "price": Decimal("120.00"), "stock_quantity": 30},
            {"name": "Paw Print Cookie", "description": "Vanilla sugar cookie with royal icing paw prints.", "category": "pastries", "price": Decimal("85.00"), "stock_quantity": 50},
            {"name": "Catnip Muffin", "description": "Blueberry muffin topped with streusel crumble.", "category": "pastries", "price": Decimal("110.00"), "stock_quantity": 35},
            # Light Bites
            {"name": "Tuna Melt Panini", "description": "Grilled tuna and cheese panini on sourdough.", "category": "light_bites", "price": Decimal("195.00"), "stock_quantity": 25},
            {"name": "Kitty Caprese Salad", "description": "Fresh mozzarella, tomato, and basil drizzled with balsamic.", "category": "light_bites", "price": Decimal("175.00"), "stock_quantity": 25},
            {"name": "Salmon Paw Rice Bowl", "description": "Seasoned rice bowl with smoked salmon and avocado.", "category": "light_bites", "price": Decimal("220.00"), "stock_quantity": 20},
            # Merch
            {"name": "Catopia Tote Bag", "description": "Canvas tote with the Catopia Café logo.", "category": "merch", "price": Decimal("350.00"), "stock_quantity": 15},
            {"name": "Paw Print Mug", "description": "Ceramic mug with hand-painted paw prints.", "category": "merch", "price": Decimal("280.00"), "stock_quantity": 20},
            {"name": "Cat Ear Headband", "description": "Soft plush headband with cat ears — perfect for photos!", "category": "merch", "price": Decimal("150.00"), "stock_quantity": 25},
        ]
        for item_data in menu_items:
            MenuItem.objects.get_or_create(
                name=item_data["name"],
                defaults=item_data,
            )
        self.stdout.write(self.style.SUCCESS(f"  Seeded {len(menu_items)} menu items."))

        # ----- Resident Cats -----
        self.stdout.write("Seeding resident cats...")
        cats = [
            {
                "name": "Mochi",
                "breed": "Orange Tabby",
                "age": 4,
                "personality": "Professional lap warmer and gentle greeter who loves chin scratches.",
                "status": "ready_to_play",
                "schedule": {"plays": "All day", "rest_days": "Mon", "play": ["10:00-12:00", "14:00-17:00"], "rest": ["12:00-14:00", "17:00-21:00"]},
            },
            {
                "name": "Pepper",
                "breed": "Black Shorthair",
                "age": 3,
                "personality": "Shadow-chasing acrobat leaping from shelf to shelf. Shy for five minutes, cuddly forever.",
                "status": "ready_to_play",
                "schedule": {"plays": "Afternoons · 1–6", "rest_days": "Tue", "play": ["13:00-18:00"], "rest": ["10:00-13:00", "18:00-21:00"]},
            },
            {
                "name": "Luna",
                "breed": "Gray Kitten",
                "age": 1,
                "personality": "Tiny curious explorer. Expects seven naps, abandon and catbows after morning zoomies.",
                "status": "resting",
                "schedule": {"plays": "Mornings · 9–1", "rest_days": "Wed", "play": ["09:00-13:00"], "rest": ["13:00-21:00"]},
            },
            {
                "name": "Biscuit",
                "breed": "White & Ginger Shorthair",
                "age": 6,
                "personality": "Gentle door greeter who is wonderful with first-time cat friends and quiet readers.",
                "status": "ready_to_play",
                "schedule": {"plays": "All day", "rest_days": "Thu", "play": ["10:00-17:00"], "rest": ["17:00-21:00"]},
            },
            {
                "name": "Earl",
                "breed": "Brown Tabby",
                "age": 7,
                "personality": "Distinguished window watcher and senior gentleman who prefers a quiet chat.",
                "status": "ready_to_play",
                "schedule": {"plays": "Evenings · 4–9", "rest_days": "Sun", "play": ["16:00-21:00"], "rest": ["10:00-16:00"]},
            },
            {
                "name": "Cloud",
                "breed": "Fluffy Longhair",
                "age": 5,
                "personality": "Cloud-soft cuddle expert who melts into any lap and adores grooming sessions.",
                "status": "ready_to_play",
                "schedule": {"plays": "Afternoons · 1–6", "rest_days": "Fri", "play": ["13:00-18:00"], "rest": ["10:00-13:00", "18:00-21:00"]},
            },
        ]
        for cat_data in cats:
            cat, _ = ResidentCat.objects.update_or_create(
                name=cat_data["name"],
                defaults=cat_data,
            )
        self.stdout.write(self.style.SUCCESS(f"  Seeded {len(cats)} resident cats."))

        self.stdout.write(self.style.SUCCESS("\nDemo seed complete! 🐱"))
