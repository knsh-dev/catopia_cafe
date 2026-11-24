import { useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { formatPHP } from "@/lib/format";
import { getMenuItemImageUrl } from "@/lib/menuImages";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Coffee,
  Star,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const CATEGORIES = [
  { key: "coffee", label: "Coffee", desc: "Handcrafted espresso brews & specialty drinks" },
  { key: "non_coffee_tea", label: "Non-Coffee & Tea", desc: "Soothing teas, matcha & velvety cocoas" },
  { key: "pastries", label: "Pastries", desc: "Freshly baked croissants, cookies & sweet treats" },
  { key: "light_bites", label: "Light Bites", desc: "Savory paninis, bowls & gourmet snacks" },
  { key: "merch", label: "Café Merch", desc: "Cat-themed souvenirs, mugs & apparel" },
];

// Curated high-res imagery matching the cozy cafe reference design
const ITEM_IMAGES = {
  // Coffee
  "Catpuccino": "https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80",
  "Purrista Latte": "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80",
  "Meow-cha Espresso": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
  "Whisker Brew": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80",
  "Paw Cat Latte": "https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80",
  // Non-Coffee & Tea
  "Chai Purrfection": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
  "Matcha Kitty": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80",
  "Berry Paws Iced Tea": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80",
  "Hot Chocolate Tabby": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=600&auto=format&fit=crop&q=80",
  // Pastries
  "Cat-shaped Croissant": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
  "Butter Croissant": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
  "Paw Print Cookie": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&auto=format&fit=crop&q=80",
  "Catnip Muffin": "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=600&auto=format&fit=crop&q=80",
  "Cinnamon Roll": "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=600&auto=format&fit=crop&q=80",
  // Light Bites
  "Tuna Melt Panini": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80",
  "Kitty Caprese Salad": "https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=600&auto=format&fit=crop&q=80",
  "Salmon Paw Rice Bowl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
  "Egg Toast": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",
  // Merch
  "Catopia Tote Bag": "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
  "Paw Print Mug": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
  "Cat Ear Headband": "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600&auto=format&fit=crop&q=80",
  "Cat Plush Toy": "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&auto=format&fit=crop&q=80",
};

const CATEGORY_FALLBACK_IMAGES = {
  coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80",
  non_coffee_tea: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
  pastries: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
  light_bites: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80",
  merch: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
};

function MenuItemCard({ item }) {
  const isSoldOut = !item.is_available || item.stock_quantity <= 0;

  const imageSrc = getMenuItemImageUrl(item);

  const ratingScore = Number(
    item.averageRating != null
      ? item.averageRating
      : item.avg_rating != null
      ? item.avg_rating
      : item.average_rating != null
      ? item.average_rating
      : 0
  );

  const revCount = Number(
    item.reviewCount != null
      ? item.reviewCount
      : item.review_count != null
      ? item.review_count
      : 0
  );

  const hasReviews = revCount > 0 && ratingScore > 0;

  return (
    <Link
      to={`/menu/${item.id}`}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className="block h-full cursor-pointer focus:outline-none select-none"
    >
      <Card
        className={`group relative overflow-hidden bg-white rounded-2xl border border-[#F2ECE4] shadow-[0_4px_20px_rgba(61,43,31,0.06)] hover:shadow-[0_8px_30px_rgba(61,43,31,0.12)] transition-all duration-300 flex flex-col justify-between h-full p-4 select-none ${
          isSoldOut ? "opacity-60" : ""
        }`}
      >
        <div>
          {/* Card Image */}
          <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-latte/30 mb-3.5 select-none pointer-events-none flex items-center justify-center">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={item.name}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none select-none"
                loading="lazy"
              />
            ) : (
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                No Image
              </span>
            )}

            {/* Badge Tag if available */}
            {item.badge_tag && (
              <div className="absolute top-2 left-2 pointer-events-none">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-caramel text-white text-[10px] font-semibold shadow-xs">
                  <Sparkles className="h-2.5 w-2.5" />
                  {item.badge_tag}
                </span>
              </div>
            )}

            {/* Sold Out Overlay */}
            {isSoldOut && (
              <div className="absolute inset-0 flex items-center justify-center bg-espresso/50 backdrop-blur-[2px]">
                <span className="text-white text-xs font-semibold px-3 py-1 rounded-full bg-destructive/90 shadow-sm">
                  Sold Out
                </span>
              </div>
            )}
          </div>

          {/* Card Content */}
          <div className="space-y-1">
            <h3 className="font-heading font-semibold text-espresso text-base sm:text-lg leading-snug line-clamp-1 group-hover:text-caramel transition-colors">
              {item.name}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          </div>
        </div>

        {/* Card Footer: Price & Star Rating Indicator */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/40">
          <div>
            <span className="font-semibold text-caramel text-base sm:text-lg tabular-nums">
              {formatPHP(item.price)}
            </span>
          </div>

          {/* Rating in bottom-right corner */}
          {hasReviews ? (
            <div className="flex items-center gap-1 text-xs">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0" />
              <span className="font-bold text-espresso tabular-nums">
                {ratingScore.toFixed(1)}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                ({revCount})
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F2ECE4]/80 text-espresso/80 border border-[#E8DFC8]/60">
              New
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

function CategorySlider({ category, items }) {
  const trackRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Mouse drag-to-slide handlers for desktop & trackpad
  const handleMouseDown = (e) => {
    // Left-click only
    if (e.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;

    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - track.offsetLeft;
    scrollLeftRef.current = track.scrollLeft;

    // Temporarily disable smooth scroll and snapping during active dragging
    track.style.scrollBehavior = "auto";
    track.style.scrollSnapType = "none";
    track.classList.add("cursor-grabbing");
    track.classList.remove("cursor-grab");
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const track = trackRef.current;
    if (!track) return;

    const x = e.pageX - track.offsetLeft;
    const diff = x - startXRef.current;

    // Threshold check: 6px distinguishes a genuine click/tap from a slide
    if (Math.abs(diff) > 6) {
      hasDraggedRef.current = true;
      e.preventDefault();
      track.scrollLeft = scrollLeftRef.current - diff * 1.3;
    }
  };

  const stopDragging = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const track = trackRef.current;
    if (track) {
      // Re-enable smooth scrolling and snapping
      track.style.scrollBehavior = "smooth";
      track.style.scrollSnapType = "x mandatory";
      track.classList.remove("cursor-grabbing");
      track.classList.add("cursor-grab");
    }

    // Keep hasDraggedRef = true for a brief window so any click event triggered
    // immediately upon releasing the mouse is captured and prevented
    if (hasDraggedRef.current) {
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 120);
    }
  };

  // Prevent accidental card navigation if user was actively sliding/dragging (>6px)
  const handleClickCapture = (e) => {
    if (hasDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <section id={category.key} className="space-y-4 scroll-mt-28">
      {/* Category Header: Clean, effortless title with slide hint (No buttons) */}
      <div className="flex items-end justify-between border-b border-border/40 pb-3">
        <div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-espresso">
            {category.label}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {category.desc} · <span className="font-medium text-caramel">{items.length} items</span>
          </p>
        </div>

        {/* Subtle, welcoming tap & slide indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 select-none pb-0.5">
          <span className="hidden sm:inline">Tap & slide</span>
          <ArrowRight className="h-3.5 w-3.5 text-caramel/70 animate-pulse" />
        </div>
      </div>

      {/* Tap-and-Slide Horizontal Track (Mouse drag + Touch swipe + Snap) */}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onClickCapture={handleClickCapture}
        className="flex gap-5 sm:gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory py-2 px-1 cursor-grab active:cursor-grabbing select-none touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[270px] sm:w-[290px] md:w-[320px] shrink-0 snap-start select-none"
          >
            <MenuItemCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

function MenuSkeleton() {
  return (
    <div className="space-y-12">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-border/40">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex gap-5 overflow-hidden">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="w-[290px] shrink-0 p-4 bg-white rounded-2xl border border-border/40 space-y-3">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MenuPage() {
  const { data, loading, error } = useFetch("/api/menu/items/?page_size=100");
  const { data: categoryData } = useFetch("/api/menu/categories/");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const allItems = data?.results || [];

  const categories = useMemo(() => {
    const list = Array.isArray(categoryData) ? categoryData : categoryData?.results;
    if (list && list.length > 0) {
      return list.map((c) => ({
        key: c.slug,
        label: c.name,
        desc: c.description || "",
      }));
    }
    return CATEGORIES;
  }, [categoryData]);

  // Group items by category and filter by search query
  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? allItems.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q)
        )
      : allItems;

    const map = {};
    for (const cat of categories) {
      const items = filtered.filter(
        (i) =>
          i.category === cat.key ||
          (i.category_detail && i.category_detail.slug === cat.key)
      );
      if (items.length > 0) {
        map[cat.key] = items;
      }
    }
    return map;
  }, [allItems, categories, search]);

  const handleCategoryNav = (key) => {
    setActiveCategory(key);
    if (key === "all") {
      window.scrollTo({ top: 380, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(key);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="bg-cream min-h-screen relative overflow-hidden">
      {/* Warm Ambient Glow Effects matching the reference design */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-caramel/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-10 right-0 w-[450px] h-[450px] bg-blush/25 rounded-full blur-3xl pointer-events-none translate-x-1/3 -translate-y-1/4" />

      {/* Hero Header Section */}
      <div className="pt-12 pb-8 text-center relative z-10 px-4 md:px-6">
        <div className="mx-auto max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-caramel/10 text-caramel text-xs font-semibold tracking-wider uppercase mb-3 shadow-xs">
            <Sparkles className="h-3 w-3" />
            <span>Our Menu</span>
          </div>

          {/* Heading */}
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-espresso tracking-tight mb-3">
            Brewed With Love
          </h1>

          {/* Subtitle */}
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-7">
            Handcrafted coffees, soothing teas, and fresh baked goodies made with love and resident cat warmth.
          </p>

          {/* Search Pill Input */}
          <div className="max-w-md mx-auto relative mb-6">
            <Input
              type="text"
              placeholder="Search drinks, pastries, treats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-border/80 bg-white/90 pl-5 pr-11 py-3 text-sm shadow-sm placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-caramel/40"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-caramel">
              <Search className="h-4 w-4" />
            </div>
          </div>

          {/* Category Quick Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => handleCategoryNav("all")}
              className={`px-3.5 py-1 rounded-full transition-all duration-200 cursor-pointer ${
                activeCategory === "all"
                  ? "bg-caramel text-white font-medium shadow-xs"
                  : "bg-white/80 hover:bg-white text-espresso border border-border/60 hover:border-caramel/40"
              }`}
            >
              All
            </button>
            <span className="text-muted-foreground/40 text-xs select-none">·</span>
            {categories.map((cat, idx) => (
              <span key={cat.key} className="inline-flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handleCategoryNav(cat.key)}
                  className={`px-3.5 py-1 rounded-full transition-all duration-200 cursor-pointer ${
                    activeCategory === cat.key
                      ? "bg-caramel text-white font-medium shadow-xs"
                      : "bg-white/80 hover:bg-white text-espresso border border-border/60 hover:border-caramel/40"
                  }`}
                >
                  {cat.label}
                </button>
                {idx < categories.length - 1 && (
                  <span className="text-muted-foreground/40 text-xs select-none">·</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Slideable Menu Content */}
      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6 pb-20 relative z-10">
        {loading && <MenuSkeleton />}

        {error && (
          <div className="text-center py-16 bg-white/60 rounded-2xl border border-border/60 p-8 max-w-md mx-auto">
            <Coffee className="h-12 w-12 mx-auto mb-3 text-caramel/60" />
            <h3 className="font-heading font-semibold text-lg text-espresso mb-1">
              Menu Unavailable
            </h3>
            <p className="text-sm text-muted-foreground">
              Unable to load the menu right now. Please make sure the backend server is running.
            </p>
          </div>
        )}

        {!loading && !error && Object.keys(grouped).length === 0 && (
          <div className="text-center py-16 bg-white/60 rounded-2xl border border-border/60 p-8 max-w-md mx-auto">
            <Coffee className="h-12 w-12 mx-auto mb-3 text-caramel/60" />
            <h3 className="font-heading font-semibold text-lg text-espresso mb-1">
              {search ? "No Matches Found" : "No Menu Items"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search
                ? `No menu treats match "${search}". Try another keyword or browse all items.`
                : "Menu items are being prepared. Check back soon!"}
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-caramel text-white hover:bg-caramel-dark transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-12 sm:space-y-16">
            {categories.map((cat) => {
              const items = grouped[cat.key];
              if (!items || items.length === 0) return null;
              return (
                <CategorySlider
                  key={cat.key}
                  category={cat}
                  items={items}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
