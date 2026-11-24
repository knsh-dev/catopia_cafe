import { Coffee } from "lucide-react";

export default function CozyComfortSection() {
  return (
    <section className="bg-cream py-16 md:py-24 relative overflow-hidden">
      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left: Overlapping Circular Photo Montage (Reference Style) */}
          <div className="relative flex items-center justify-center min-h-[320px] sm:min-h-[380px]">
            {/* Large Circle – Cat sitting on sunny windowsill */}
            <div className="w-60 h-60 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-full overflow-hidden border-4 sm:border-8 border-white shadow-2xl z-10">
              <img
                src="https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80"
                alt="Cat resting peacefully on a sunny window"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Overlapping Bottom-Right Circle – Freshly baked golden croissant */}
            <div className="absolute -bottom-4 right-4 sm:bottom-0 sm:right-12 md:right-16 w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full overflow-hidden border-4 sm:border-6 border-white shadow-xl z-20">
              <img
                src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80"
                alt="Fresh buttery croissant"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Delicate doodle sketch flourish accent */}
            <div className="absolute -top-6 left-12 text-caramel/30 select-none pointer-events-none hidden sm:block">
              <span className="text-3xl font-serif">❧</span>
            </div>
          </div>

          {/* Right: Text content */}
          <div className="space-y-5 text-center lg:text-left">
            {/* Tag */}
            <div>
              <span className="inline-block px-3.5 py-1 rounded-full bg-caramel/10 text-caramel text-xs font-semibold tracking-wider uppercase mb-2">
                About Us
              </span>
            </div>

            {/* Title with decorative warm accent */}
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-espresso leading-tight">
              We Provide <span className="inline-block h-3.5 w-3.5 rounded-full bg-caramel align-middle mx-1" /> Cozy Comfort
            </h2>

            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-lg mx-auto lg:mx-0">
              Step into our warm sanctuary where the aroma of freshly ground beans meets the gentle purrs of our rescue cats. Whether you're here to work, unwind with a book, or bond with playful felines, Catopia Café offers the purrfect escape from daily hustle.
            </p>

            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-lg mx-auto lg:mx-0">
              Every cup of coffee is crafted with ethically sourced beans, and every visit supports the shelter and care of our resident rescue cats.
            </p>

            <div className="pt-2 flex items-center justify-center lg:justify-start gap-4 text-xs font-medium text-espresso/80">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-latte/50 border border-border/40">
                <Coffee className="h-3.5 w-3.5 text-caramel" />
                Artisan Coffee
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-latte/50 border border-border/40">
                🐾 Loving Rescue Cats
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
