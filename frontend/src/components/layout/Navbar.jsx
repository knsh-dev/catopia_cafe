import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CartPopover from "@/components/cart/CartPopover";
import {
  ShoppingCart,
  Menu as MenuIcon,
  X,
  User,
  CalendarDays,
  ClipboardList,
  LogOut,
  Settings,
  LayoutDashboard,
  Cat,
  Search,
} from "lucide-react";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
];

export default function Navbar() {
  const { user, logout, isStaffOrAdmin } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const userInitials = user
    ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() || user.username[0].toUpperCase()
    : "";

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
        <div className="mx-auto flex h-16 max-w-[var(--container-lg)] items-center justify-between px-4 md:px-6">
          {/* Left Nav (Desktop) / Mobile Logo */}
          <div className="flex items-center md:w-1/3">
            {/* Mobile Logo */}
            <Link
              to="/"
              className="flex md:hidden items-center gap-2 font-heading text-xl font-bold text-espresso hover:text-caramel transition-colors"
            >
              <Cat className="h-6 w-6 text-caramel" />
              <span>Catopia Café</span>
            </Link>

            {/* Desktop Left Nav Links */}
            <nav className="hidden md:flex items-center gap-2" role="navigation">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                      isActive
                        ? "text-caramel font-semibold"
                        : "text-espresso/90 hover:text-caramel hover:bg-latte/50"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => navigate("/catroom")}
                className="ml-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-caramel/40 bg-caramel/5 hover:bg-caramel hover:text-white text-caramel text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Reserve Cat Room</span>
              </button>
            </nav>
          </div>

          {/* Center Brand Logo (Desktop) */}
          <div className="hidden md:flex items-center justify-center md:w-1/3">
            <Link
              to="/"
              className="flex items-center gap-2 font-heading text-2xl font-bold text-espresso hover:text-caramel transition-colors tracking-tight"
            >
              <Cat className="h-6 w-6 text-caramel" />
              <span>Catopia Café</span>
            </Link>
          </div>

          {/* Right Actions (Search, User, Cart) */}
          <div className="flex items-center justify-end gap-2 sm:gap-3 md:w-1/3">
            {/* Search link (desktop) */}
            <Link
              to="/menu"
              className="hidden md:flex p-2 rounded-full text-espresso/80 hover:text-caramel hover:bg-latte/50 transition-colors cursor-pointer"
              aria-label="Search Menu"
            >
              <Search className="h-4.5 w-4.5" />
            </Link>

            {/* Cart dropdown popover */}
            <DropdownMenu open={cartOpen} onOpenChange={setCartOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative p-2 rounded-full text-espresso hover:bg-latte/60 hover:text-caramel transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  aria-label={`Shopping cart, ${totalItems} items`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {totalItems > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-caramel text-[10px] font-bold text-white px-1 shadow-xs">
                      {totalItems > 99 ? "99+" : totalItems}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="p-0 w-auto rounded-2xl shadow-xl border-border/80">
                <CartPopover onClose={() => setCartOpen(false)} />
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Auth / Profile */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer p-0.5"
                    aria-label="User menu"
                  >
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarImage
                        src={user.profile?.avatar || undefined}
                        alt={user.username}
                      />
                      <AvatarFallback className="bg-latte text-espresso text-xs font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:inline text-xs font-medium text-espresso max-w-28 truncate">
                      {user.first_name || user.username}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user.first_name} {user.last_name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/profile/edit")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Edit Profile & Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/reservations")}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    My Reservations
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/orders")}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Order History
                  </DropdownMenuItem>
                  {isStaffOrAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Admin Dashboard
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-espresso">
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-full hover:bg-latte/60 hover:text-caramel transition-colors"
                >
                  Login
                </Link>
                <span className="text-muted-foreground/50 select-none">·</span>
                <Link
                  to="/register"
                  className="px-3 py-1.5 rounded-full bg-espresso text-white hover:bg-espresso/90 transition-colors shadow-xs"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-cream">
            <nav className="flex flex-col px-4 py-3 space-y-1" role="navigation">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-colors ${
                      isActive
                        ? "text-caramel bg-caramel/10"
                        : "text-espresso hover:text-caramel hover:bg-latte/60"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <Button
                variant="accent"
                size="sm"
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/catroom");
                }}
                className="w-full justify-start mt-2"
              >
                <CalendarDays className="h-4 w-4" />
                Reserve Cat Room
              </Button>

              {!user && (
                <div className="flex gap-2 pt-3 border-t border-border/60">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link to="/login" onClick={() => setMobileOpen(false)}>
                      Login
                    </Link>
                  </Button>
                  <Button size="sm" className="flex-1" asChild>
                    <Link to="/register" onClick={() => setMobileOpen(false)}>
                      Register
                    </Link>
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
