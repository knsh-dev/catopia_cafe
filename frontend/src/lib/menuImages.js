/**
 * Shared high-resolution photos for seeded menu items, matched identically across
 * Menu (MenuPage), Product Details (MenuItemDetailPage), Popular Picks (PopularPicksSection),
 * Checkout (CheckoutPage), and Admin Dashboard Menu & Inventory (MenuTab).
 *
 * Newly created products with no uploaded photo return "" so the UI displays
 * "No Image" until an admin uploads a photo manually.
 */
export const MENU_ITEM_IMAGES = {
  // Coffee
  "Catpuccino":
    "https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80",
  "Purrista Latte":
    "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80",
  "Meow-cha Espresso":
    "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
  "Whisker Brew":
    "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80",
  "Paw Cat Latte":
    "https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80",

  // Non-Coffee & Tea
  "Chai Purrfection":
    "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
  "Matcha Kitty":
    "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80",
  "Berry Paws Iced Tea":
    "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80",
  "Hot Chocolate Tabby":
    "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=600&auto=format&fit=crop&q=80",

  // Pastries
  "Cat-shaped Croissant":
    "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
  "Butter Croissant":
    "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
  "Paw Print Cookie":
    "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&auto=format&fit=crop&q=80",
  "Catnip Muffin":
    "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=600&auto=format&fit=crop&q=80",
  "Cinnamon Roll":
    "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=600&auto=format&fit=crop&q=80",

  // Light Bites
  "Tuna Melt Panini":
    "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80",
  "Kitty Caprese Salad":
    "https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=600&auto=format&fit=crop&q=80",
  "Salmon Paw Rice Bowl":
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
  "Egg Toast":
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",

  // Merch
  "Catopia Tote Bag":
    "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
  "Paw Print Mug":
    "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
  "Cat Ear Headband":
    "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600&auto=format&fit=crop&q=80",
  "Cat Plush Toy":
    "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&auto=format&fit=crop&q=80",
};

/**
 * Resolve a menu item's display image URL.
 * Prefers `item.image` if uploaded, then matches by name in `MENU_ITEM_IMAGES`.
 * Returns "" for newly created items without an uploaded image so the UI displays "No Image".
 */
export function getMenuItemImageUrl(item) {
  if (!item) return "";
  if (item.image && typeof item.image === "string" && item.image.trim()) {
    return item.image.trim();
  }
  const rawName = String(item.name || "").trim();
  if (!rawName) return "";
  if (MENU_ITEM_IMAGES[rawName]) return MENU_ITEM_IMAGES[rawName];
  const lower = rawName.toLowerCase();
  const matchKey = Object.keys(MENU_ITEM_IMAGES).find(
    (k) => k.toLowerCase() === lower
  );
  return matchKey ? MENU_ITEM_IMAGES[matchKey] : "";
}
