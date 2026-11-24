from django.db import migrations

DEFAULT_CATEGORIES = [
    {
        "name": "Coffee",
        "slug": "coffee",
        "description": "Handcrafted espresso brews & specialty drinks",
        "enable_sizing": True,
        "enable_temperature": True,
        "qualifies_for_stamps": True,
        "badge_tag": "Espresso & Brews",
        "sort_order": 1,
        "is_visible": True,
    },
    {
        "name": "Non-Coffee & Tea",
        "slug": "non_coffee_tea",
        "description": "Soothing teas, matcha & velvety cocoas",
        "enable_sizing": True,
        "enable_temperature": True,
        "qualifies_for_stamps": True,
        "badge_tag": "Specialty Drinks",
        "sort_order": 2,
        "is_visible": True,
    },
    {
        "name": "Pastries",
        "slug": "pastries",
        "description": "Freshly baked croissants, cookies & sweet treats",
        "enable_sizing": False,
        "enable_temperature": False,
        "qualifies_for_stamps": True,
        "badge_tag": "Freshly Baked",
        "sort_order": 3,
        "is_visible": True,
    },
    {
        "name": "Light Bites",
        "slug": "light_bites",
        "description": "Savory paninis, bowls & gourmet snacks",
        "enable_sizing": False,
        "enable_temperature": False,
        "qualifies_for_stamps": True,
        "badge_tag": "Savory Plates",
        "sort_order": 4,
        "is_visible": True,
    },
    {
        "name": "Merchandise",
        "slug": "merch",
        "description": "Cat-themed souvenirs, mugs & apparel",
        "enable_sizing": False,
        "enable_temperature": False,
        "qualifies_for_stamps": False,
        "badge_tag": "Souvenirs",
        "sort_order": 5,
        "is_visible": True,
    },
]


def seed_categories(apps, schema_editor):
    MenuCategory = apps.get_model("menu", "MenuCategory")
    MenuItem = apps.get_model("menu", "MenuItem")

    category_map = {}
    for cat_data in DEFAULT_CATEGORIES:
        category, _ = MenuCategory.objects.get_or_create(
            slug=cat_data["slug"],
            defaults=cat_data,
        )
        category_map[cat_data["slug"]] = category

    for item in MenuItem.objects.all():
        if item.category in category_map and not item.category_obj:
            item.category_obj = category_map[item.category]
            item.save(update_fields=["category_obj"])


def rollback_categories(apps, schema_editor):
    MenuCategory = apps.get_model("menu", "MenuCategory")
    MenuItem = apps.get_model("menu", "MenuItem")

    MenuItem.objects.all().update(category_obj=None)
    MenuCategory.objects.filter(slug__in=[c["slug"] for c in DEFAULT_CATEGORIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("menu", "0002_menucategory_menuitem_override_sizing_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_categories, rollback_categories),
    ]
