/**
 * Shared unique high-resolution photos for the 10 seeded resident cats.
 * Every seeded cat has a distinct photo matched identically across
 * Home (ResidentCatsSection), Cat Room (CatRoomPage), Profile (ProfilePage),
 * and Admin Dashboard (CatsTab).
 *
 * Newly created resident cats with no uploaded photo return "" so components
 * display an empty / "No Image" placeholder until an admin uploads a photo manually.
 */
export const CAT_PHOTOS_BY_NAME = {
  Biscuit:
    "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=600&auto=format&fit=crop&q=80",
  Cinnamon:
    "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600&auto=format&fit=crop&q=80",
  Cloud:
    "https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?w=600&auto=format&fit=crop&q=80",
  Earl:
    "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=600&auto=format&fit=crop&q=80",
  Espresso:
    "https://images.unsplash.com/photo-1513245543132-31f507417b26?w=600&auto=format&fit=crop&q=80",
  Latte:
    "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=600&auto=format&fit=crop&q=80",
  Luna:
    "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600&auto=format&fit=crop&q=80",
  Mochi:
    "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80",
  Pepper:
    "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600&auto=format&fit=crop&q=80",
  Sesame:
    "https://images.unsplash.com/photo-1561948955-570b270e7c36?w=600&auto=format&fit=crop&q=80",
};

/**
 * Resolve a cat's display photo URL.
 * Prefers the uploaded `cat.photo` / `cat.image`, then falls back to the
 * seeded cat's matched photo by name. Returns "" for newly created cats
 * without an uploaded image so the UI renders "No Image".
 */
export function getCatPhotoUrl(cat) {
  if (!cat) return "";
  if (cat.photo && typeof cat.photo === "string" && cat.photo.trim()) {
    return cat.photo.trim();
  }
  if (cat.image && typeof cat.image === "string" && cat.image.trim()) {
    return cat.image.trim();
  }
  const rawName = String(cat.name || "").trim();
  if (!rawName) return "";
  if (CAT_PHOTOS_BY_NAME[rawName]) return CAT_PHOTOS_BY_NAME[rawName];
  const lower = rawName.toLowerCase();
  const matchKey = Object.keys(CAT_PHOTOS_BY_NAME).find(
    (k) => k.toLowerCase() === lower
  );
  return matchKey ? CAT_PHOTOS_BY_NAME[matchKey] : "";
}
