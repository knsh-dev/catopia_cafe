import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { getCatPhotoUrl } from "@/lib/catPhotos";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, ArrowRight } from "lucide-react";

const STATUS_LABELS = {
  ready_to_play: "Ready to play",
  resting: "Resting",
  vet_day: "Vet day",
};

function ResidentCatCard({ cat, onToggleFavorite }) {
  const statusText = cat.status_display || STATUS_LABELS[cat.status] || cat.badge || "Ready to play";
  const photoUrl = getCatPhotoUrl(cat);
  return (
    <Card className="group relative overflow-hidden bg-white rounded-2xl border border-[#F2ECE4] shadow-[0_4px_20px_rgba(61,43,31,0.06)] hover:shadow-[0_8px_30px_rgba(61,43,31,0.12)] transition-all duration-300 flex flex-col justify-between h-full p-4">
      <div>
        {/* Inset Rounded Photo with Status Badge */}
        <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-latte/30 mb-3.5 flex items-center justify-center">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={cat.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              No Image
            </span>
          )}

          {/* Status Badge Pill */}
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-[11px] font-semibold text-caramel shadow-xs">
              {statusText}
            </span>
          </div>
        </div>

        {/* Text info */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-espresso text-base sm:text-lg">
              {cat.name}
            </h3>
            <span className="text-xs text-muted-foreground font-medium">
              {typeof cat.age === "number" ? `${cat.age} ${cat.age === 1 ? "yr" : "yrs"}` : cat.age}
            </span>
          </div>
          <p className="text-xs text-caramel font-medium">{cat.breed || "Resident Cat"}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pt-1">
            {cat.personality}
          </p>
        </div>
      </div>

      {/* Card Footer: Heart icon */}
      <div className="flex items-center justify-end pt-3 mt-2 border-t border-border/40">
        <button
          type="button"
          onClick={() => onToggleFavorite(cat.id)}
          aria-label={`Like ${cat.name}`}
          className={`h-8 w-8 rounded-full border border-caramel/30 flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
            cat.is_favorite
              ? "bg-caramel text-white shadow-xs"
              : "bg-caramel/5 hover:bg-caramel hover:text-white text-caramel"
          }`}
        >
          <Heart className={`h-4 w-4 ${cat.is_favorite ? "fill-white" : ""}`} />
        </button>
      </div>
    </Card>
  );
}

export default function ResidentCatsSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/api/cats/residents/?available=true")
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : data?.results || [];
        const featuredNames = ["biscuit", "cinnamon", "cloud"];
        const filtered = list.filter((c) =>
          featuredNames.includes(String(c.name || "").trim().toLowerCase())
        );
        const displayList = (filtered.length > 0 ? filtered : list).slice(0, 3);
        setCats(
          displayList.map((c) => ({
            ...c,
            image: getCatPhotoUrl(c),
            badge: c.status_display || STATUS_LABELS[c.status] || "Ready to play",
          }))
        );
      })
      .catch(() => {
        if (isMounted) setCats([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleToggleFavorite = async (catId) => {
    if (!user) {
      navigate("/login?redirect=/");
      return;
    }
    try {
      await api.post(`/api/cats/residents/${catId}/favorite/`);
      setCats((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, is_favorite: !c.is_favorite } : c))
      );
    } catch {
      // silent
    }
  };

  return (
    <section id="resident-cats" className="bg-cream py-16 md:py-20 relative scroll-mt-20">
      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6">
        {/* Centered Heading */}
        <div className="text-center mb-10">
          <p className="section-subtitle mb-2">Meet The Family</p>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-espresso">
            Our Resident Cats
          </h2>
        </div>

        {/* 3-Column Card Grid matching reference */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#F2ECE4] p-4 space-y-3">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : cats.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No resident cats are currently available. Check back soon!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {cats.map((cat) => (
              <ResidentCatCard
                key={cat.id}
                cat={cat}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}

        {/* Centered Minimal Link with Arrow */}
        <div className="text-center mt-10">
          <Link
            to="/catroom"
            className="inline-flex items-center gap-2 text-sm font-semibold text-caramel hover:text-caramel-dark transition-colors group"
          >
            <span>Meet All Resident Cats in the Cat Room</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
