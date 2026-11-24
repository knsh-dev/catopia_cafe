import { Link } from "react-router-dom";
import { Cat, MapPin, Clock, Phone } from "lucide-react";

function InstagramIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function TwitterIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="bg-cream border-t border-border/80 text-espresso mt-auto">
      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6 pt-14 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand column */}
          <div className="space-y-4">
            <Link
              to="/"
              className="flex items-center gap-2 font-heading text-2xl font-bold text-espresso hover:text-caramel transition-colors"
            >
              <Cat className="h-6 w-6 text-caramel" />
              <span>Catopia Café</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A cozy cat cafe where delicious coffee and feline companionship meet. Come for the brews, stay for the purrs.
            </p>
          </div>

          {/* Main Menu */}
          <div>
            <h4 className="font-heading font-semibold text-espresso mb-4 text-base">
              Main Menu
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-caramel transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/menu" className="hover:text-caramel transition-colors">
                  Menu
                </Link>
              </li>
              <li>
                <Link to="/catroom" className="hover:text-caramel transition-colors">
                  Cat Room
                </Link>
              </li>
              <li>
                <Link to="/catroom#our-cats" className="hover:text-caramel transition-colors">
                  Our Cats
                </Link>
              </li>
            </ul>
          </div>

          {/* Information */}
          <div>
            <h4 className="font-heading font-semibold text-espresso mb-4 text-base">
              Information
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/catroom#house-policy" className="hover:text-caramel transition-colors">
                  Cat Room Policy
                </Link>
              </li>
              <li>
                <Link to="/reservations" className="hover:text-caramel transition-colors">
                  Reservations
                </Link>
              </li>
              <li>
                <Link to="/catroom#house-policy" className="hover:text-caramel transition-colors">
                  House Rules
                </Link>
              </li>
              <li>
                <Link to="/#visit-us" className="hover:text-caramel transition-colors">
                  Store Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Address & Contact */}
          <div>
            <h4 className="font-heading font-semibold text-espresso mb-4 text-base">
              Address
            </h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link
                  to="/#visit-us"
                  className="flex items-start gap-2.5 hover:text-caramel transition-colors"
                >
                  <MapPin className="h-4 w-4 mt-0.5 text-caramel shrink-0" />
                  <span>89-G Barlin St, Sta. Cruz, Naga City, 4400 Camarines Sur</span>
                </Link>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-caramel shrink-0" />
                <span>10:00 AM - 9:00 PM Daily</span>
              </li>
              <li>
                <a
                  href="tel:09123456789"
                  className="flex items-center gap-2.5 hover:text-caramel transition-colors"
                >
                  <Phone className="h-4 w-4 text-caramel shrink-0" />
                  <span>09123456789</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar matching reference */}
        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          {/* Left: Social Circles */}
          <div className="flex items-center gap-2">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 rounded-full bg-caramel text-white flex items-center justify-center hover:bg-caramel-dark transition-colors shadow-xs"
              aria-label="Instagram"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 rounded-full bg-caramel text-white flex items-center justify-center hover:bg-caramel-dark transition-colors shadow-xs"
              aria-label="Facebook"
            >
              <FacebookIcon />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 rounded-full bg-caramel text-white flex items-center justify-center hover:bg-caramel-dark transition-colors shadow-xs"
              aria-label="Twitter"
            >
              <TwitterIcon />
            </a>
          </div>

          {/* Center: Copyright */}
          <div className="text-center">
            <p>Copyright © {new Date().getFullYear()} Catopia Café. All rights reserved.</p>
          </div>

          {/* Right: Payment Partner Badges */}
          <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground/80">
            <span className="px-2 py-0.5 rounded-sm bg-white border border-border/80 shadow-2xs">GCash</span>
            <span className="px-2 py-0.5 rounded-sm bg-white border border-border/80 shadow-2xs">Maya</span>
            <span className="px-2 py-0.5 rounded-sm bg-white border border-border/80 shadow-2xs font-serif italic">VISA</span>
            <span className="px-2 py-0.5 rounded-sm bg-white border border-border/80 shadow-2xs">Mastercard</span>
            <span className="px-2 py-0.5 rounded-sm bg-white border border-border/80 shadow-2xs text-caramel font-bold">Xendit</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
