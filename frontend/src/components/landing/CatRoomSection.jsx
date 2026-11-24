import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { ArrowRight, Sparkles, Clock, Users, ShieldCheck } from "lucide-react";

export default function CatRoomSection() {
  const [hourlyRate, setHourlyRate] = useState(300);
  const [maxVisitors, setMaxVisitors] = useState(10);

  useEffect(() => {
    let isMounted = true;
    const loadSettings = () => {
      api
        .get("/api/catroom/settings/")
        .then((res) => {
          if (!isMounted || !res) return;
          const parsedRate = parseFloat(res.hourly_rate);
          if (!isNaN(parsedRate) && parsedRate > 0) {
            setHourlyRate(parsedRate);
          }
          if (res.max_visitors) {
            setMaxVisitors(Number(res.max_visitors));
          }
        })
        .catch(() => {});
    };

    loadSettings();

    const handleStorage = (e) => {
      if (e.key === "catopia_settings_updated_at") loadSettings();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadSettings();
    };

    window.addEventListener("catopia:settings-change", loadSettings);
    window.addEventListener("catopia:reservation-change", loadSettings);
    window.addEventListener("focus", loadSettings);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      window.removeEventListener("catopia:settings-change", loadSettings);
      window.removeEventListener("catopia:reservation-change", loadSettings);
      window.removeEventListener("focus", loadSettings);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <section id="cat-room-preview" className="bg-cream py-16 md:py-24 relative overflow-hidden">
      {/* Decorative accent */}
      <div className="absolute top-12 left-10 text-caramel/20 select-none pointer-events-none hidden md:block">
        <Sparkles className="h-6 w-6" />
      </div>

      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left: Text Content */}
          <div className="space-y-6 text-center lg:text-left order-2 lg:order-1">
            {/* Tag */}
            <div>
              <span className="inline-block px-3.5 py-1 rounded-full bg-caramel/10 text-caramel text-xs font-semibold tracking-wider uppercase mb-2">
                Cozy Space
              </span>
            </div>

            {/* Heading */}
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-espresso leading-tight">
              The Cat Room,<br />One Cozy Hour
            </h2>

            {/* Description */}
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-lg mx-auto lg:mx-0">
              Spend 60 uninterrupted minutes in our spacious, sunlit cat playroom. Home to our loving, socialized resident cats who love cuddles, playtime, and gentle scratches.
            </p>

            {/* Bullets matching reference */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-medium text-espresso/80 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-border/60 shadow-xs">
                <Clock className="h-3.5 w-3.5 text-caramel" />
                1-Hour Sessions
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-border/60 shadow-xs">
                <Users className="h-3.5 w-3.5 text-caramel" />
                Max {maxVisitors} Visitors
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-border/60 shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-caramel" />
                Resident Cats Only
              </span>
            </div>

            {/* CTA Button */}
            <div className="pt-2">
              <Link
                to="/catroom"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-caramel hover:bg-caramel-dark text-white font-medium text-sm sm:text-base shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <span>Book Now - {formatPHP(hourlyRate)}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right: Overlapping Circular Composition */}
          <div className="relative flex items-center justify-center min-h-[340px] sm:min-h-[400px] order-1 lg:order-2">
            {/* Main Circle – Cat reaching up against pastel circle background */}
            <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full overflow-hidden border-4 sm:border-8 border-white shadow-2xl z-10 bg-[#DDF4F2]">
              <img
                src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop&q=80"
                alt="Playful cat reaching up in the cat playroom"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Overlapping Bottom-Left Circle – Cup of latte */}
            <div className="absolute -bottom-4 left-4 sm:bottom-2 sm:left-10 w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full overflow-hidden border-4 sm:border-6 border-white shadow-xl z-20">
              <img
                src="https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop&q=80"
                alt="Cup of warm coffee"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Decorative background blur */}
            <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full bg-blush/30 blur-2xl pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}
