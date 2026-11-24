import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

export default function SubscribeSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    setTimeout(() => {
      setEmail("");
      setSubmitted(false);
    }, 3000);
  };

  return (
    <section className="bg-cream py-14 md:py-20 relative">
      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6">
        {/* Rich Espresso Brown Card matching the design reference */}
        <div className="rounded-[28px] sm:rounded-[36px] bg-[#3D2B1F] py-10 px-6 sm:px-12 md:px-16 text-white shadow-2xl relative overflow-hidden">
          {/* Subtle 4-pointed star / sparkle doodle in top right corner */}
          <div className="absolute top-6 right-8 sm:top-8 sm:right-12 text-caramel/40 select-none pointer-events-none">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
            </svg>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Tilted Landscape Photo Card with White Border */}
            <div className="relative flex items-center justify-center lg:justify-start">
              <div className="relative rotate-[-3.5deg] hover:rotate-0 transition-transform duration-500 rounded-2xl overflow-hidden border-4 sm:border-[5px] border-white shadow-2xl w-full max-w-[320px] sm:max-w-sm aspect-[4/3] bg-espresso-light">
                <img
                  src="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80"
                  alt="Freshly baked artisanal loaf on wooden prep board"
                  className="w-full h-full object-cover"
                />
                {/* Small warm caramel badge at bottom-left corner */}
                <div className="absolute bottom-3 left-3 h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-caramel text-white flex items-center justify-center shadow-md">
                  <span className="text-base select-none">🐾</span>
                </div>
              </div>
            </div>

            {/* Right: Newsletter Copy & Pill Form matching reference */}
            <div className="space-y-4 text-center lg:text-left flex flex-col justify-center">
              <div>
                <span className="inline-block text-xs font-semibold text-caramel tracking-widest uppercase mb-1.5">
                  Newsletter
                </span>
                <h2
                  className="font-heading text-3xl sm:text-4xl lg:text-[42px] font-bold leading-tight"
                  style={{ color: "#FFFFFF" }}
                >
                  Subscribe for<br />Purrfect Perks
                </h2>
              </div>

              {/* White Pill Input Container with Nested Caramel Button */}
              <form onSubmit={handleSubmit} className="pt-2 max-w-md mx-auto lg:mx-0 w-full">
                {submitted ? (
                  <div className="rounded-full bg-caramel/20 border border-caramel/50 px-6 py-3.5 text-sm text-caramel-light flex items-center justify-center gap-2 shadow-inner">
                    <Check className="h-4 w-4" />
                    <span className="font-medium">You're subscribed to perks!</span>
                  </div>
                ) : (
                  <div className="bg-white rounded-full p-1.5 sm:p-2 flex items-center shadow-xl border border-white/30 w-full">
                    <input
                      type="email"
                      required
                      placeholder="Enter your email address..."
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-transparent text-espresso placeholder:text-[#A89888] pl-5 pr-2 py-1.5 text-sm focus:outline-none flex-1 w-full"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-6 py-2.5 sm:py-3 rounded-full bg-caramel hover:bg-caramel-dark text-white text-xs sm:text-sm font-semibold shadow-xs transition-all shrink-0 cursor-pointer active:scale-95"
                    >
                      <span>Subscribe</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
