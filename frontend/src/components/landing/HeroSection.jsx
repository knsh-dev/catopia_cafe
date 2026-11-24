import { Link } from "react-router-dom";
import { Coffee, ArrowRight, Heart } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-cream pt-8 pb-16 md:py-20">
      {/* Warm Ambient Glow Effects matching the reference design */}
      <div className="absolute top-0 left-0 w-96 md:w-[500px] h-96 md:h-[500px] bg-caramel/15 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-10 right-0 w-96 md:w-[500px] h-96 md:h-[500px] bg-blush/30 rounded-full blur-3xl pointer-events-none translate-x-1/3 -translate-y-1/4" />

      {/* Delicate floating botanical accents */}
      <div className="absolute top-1/4 left-10 text-caramel/25 select-none pointer-events-none hidden md:block">
        <span className="text-2xl font-serif">❦</span>
      </div>
      <div className="absolute bottom-12 right-12 text-caramel/25 select-none pointer-events-none hidden md:block">
        <span className="text-2xl font-serif">❧</span>
      </div>

      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left: Text Content */}
          <div className="space-y-6 text-center lg:text-left">
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-espresso leading-[1.15] tracking-tight">
              Enjoy Cozy<br />
              <span className="inline-flex items-center gap-3 mt-1">
                <span className="inline-flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-espresso text-cream shadow-sm">
                  <Coffee className="h-5 w-5 sm:h-6 sm:w-6 text-caramel" />
                </span>
                <span>Purrfect Brews</span>
              </span>
            </h1>

            <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-md mx-auto lg:mx-0 leading-relaxed">
              Handcrafted coffee, soothing teas, and gourmet treats made with love. Sip your favorite brew while resident cats keep you company.
            </p>

            {/* CTA Button matching the reference */}
            <div className="flex items-center gap-3 justify-center lg:justify-start pt-2">
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-caramel hover:bg-caramel-dark text-white font-medium text-sm sm:text-base shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <span>Order Now</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/catroom"
                className="h-11 w-11 rounded-full bg-espresso hover:bg-espresso-light text-white flex items-center justify-center shadow-sm transition-all active:scale-95"
                aria-label="Reserve Cat Room"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right: Overlapping Circular Photo Montage (Reference Style) */}
          <div className="relative flex items-center justify-center min-h-[340px] sm:min-h-[420px] md:min-h-[460px]">
            {/* Large Circle – Top-down Latte in Deep Red Cup on Rustic Wood */}
            <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full overflow-hidden border-4 sm:border-8 border-white shadow-2xl z-10 relative">
              <img
                src="https://images.unsplash.com/photo-1534778101976-62847782c213?w=800&auto=format&fit=crop&q=80"
                alt="Artisan latte with coffee art in a ceramic cup"
                className="w-full h-full object-cover"
              />
              {/* Cute orange paw badge on the rim */}
              <div className="absolute bottom-6 right-8 h-8 w-8 rounded-full bg-caramel text-white flex items-center justify-center shadow-md">
                <Heart className="h-4 w-4 fill-white" />
              </div>
            </div>

            {/* Overlapping Bottom-Left Circle – Resident Cat playing in cat room */}
            <div className="absolute -bottom-4 left-2 sm:bottom-0 sm:left-4 md:left-8 w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full overflow-hidden border-4 sm:border-6 border-white shadow-xl z-20">
              <img
                src="https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=600&auto=format&fit=crop&q=80"
                alt="Resident cats in the cozy playroom"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Decorative background circle */}
            <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full bg-caramel/10 blur-xl pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}
