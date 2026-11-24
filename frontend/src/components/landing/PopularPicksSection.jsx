import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { getMenuItemImageUrl } from "@/lib/menuImages";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ArrowRight } from "lucide-react";

const ITEM_IMAGES = {
  "Catpuccino": "https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80",
  "Purrista Latte": "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80",
  "Meow-cha Espresso": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
  "Whisker Brew": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80",
  "Paw Cat Latte": "https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80",
  "Chai Purrfection": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
  "Matcha Kitty": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80",
  "Berry Paws Iced Tea": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80",
  "Hot Chocolate Tabby": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=600&auto=format&fit=crop&q=80",
  "Cat-shaped Croissant": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
  "Butter Croissant": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
  "Paw Print Cookie": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&auto=format&fit=crop&q=80",
  "Catnip Muffin": "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=600&auto=format&fit=crop&q=80",
  "Cinnamon Roll": "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=600&auto=format&fit=crop&q=80",
  "Tuna Melt Panini": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80",
  "Kitty Caprese Salad": "https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=600&auto=format&fit=crop&q=80",
  "Salmon Paw Rice Bowl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
  "Catopia Tote Bag": "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
  "Paw Print Mug": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
  "Cat Ear Headband": "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600&auto=format&fit=crop&q=80",
};

const CATEGORY_FALLBACK_IMAGES = {
  coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80",
  non_coffee_tea: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
  pastries: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
  light_bites: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80",
  merch: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
};

function PopularCard({ item }) {
  const imageSrc = getMenuItemImageUrl(item);

  const ratingScore = Number(item.averageRating ?? item.avg_rating ?? item.average_rating ?? 0);
  const revCount = Number(item.reviewCount ?? item.review_count ?? 0);
  const hasReviews = revCount > 0 && ratingScore > 0;

  return (
    <Link
      to={`/menu/${item.id}`}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className="block h-full cursor-pointer focus:outline-none select-none"
    >
      <Card className="group relative overflow-hidden bg-white rounded-2xl border border-[#F2ECE4] shadow-[0_4px_20px_rgba(61,43,31,0.06)] hover:shadow-[0_8px_30px_rgba(61,43,31,0.12)] transition-all duration-300 flex flex-col justify-between h-full p-4 select-none">
        <div>
          {/* Inset Rounded Image */}
          <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-latte/30 mb-3.5 select-none pointer-events-none flex items-center justify-center">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={item.name}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 select-none pointer-events-none"
                loading="lazy"
              />
            ) : (
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                No Image
              </span>
            )}
          </div>

          {/* Text */}
          <div className="space-y-1">
            <h3 className="font-heading font-semibold text-espresso text-base sm:text-lg leading-snug line-clamp-1 group-hover:text-caramel transition-colors">
              {item.name}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          </div>
        </div>

        {/* Card Footer: Price & Rating / Sold count */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/40">
          <span className="font-semibold text-caramel text-base sm:text-lg tabular-nums">
            {formatPHP(item.price)}
          </span>

          <div className="flex items-center gap-2">
            {item.sold_count > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F2ECE4]/80 text-espresso/80 border border-[#E8DFC8]/60">
                {item.sold_count} sold
              </span>
            )}
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
            ) : !item.sold_count ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F2ECE4]/80 text-espresso/80 border border-[#E8DFC8]/60">
                New
              </span>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function PopularPicksSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/api/menu/items/popular/?limit=3")
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : data?.results || [];
        setItems(list);
      })
      .catch(() => {
        if (isMounted) setItems([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="bg-cream py-16 md:py-20 relative">
      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6">
        {/* Centered Heading */}
        <div className="text-center mb-10">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-espresso">
            Popular Picks
          </h2>
        </div>

        {/* 3-Column Card Grid matching reference */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#F2ECE4] p-4 space-y-3">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No featured products available right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {items.map((item) => (
              <PopularCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Centered Minimal Link with Arrow */}
        <div className="text-center mt-10">
          <Link
            to="/menu"
            className="inline-flex items-center gap-2 text-sm font-semibold text-caramel hover:text-caramel-dark transition-colors group"
          >
            <span>View All Products</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
