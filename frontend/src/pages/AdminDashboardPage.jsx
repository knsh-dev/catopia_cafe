import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import OverviewTab from "@/components/admin/OverviewTab";
import PaymentsTab from "@/components/admin/PaymentsTab";
import CatRoomTab from "@/components/admin/CatRoomTab";
import MenuTab from "@/components/admin/MenuTab";
import CategoriesTab from "@/components/admin/CategoriesTab";
import OrdersTab from "@/components/admin/OrdersTab";
import CatsTab from "@/components/admin/CatsTab";
import CustomersTab from "@/components/admin/CustomersTab";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Coffee,
  Cat,
  Users,
  CreditCard,
  Store,
  ShieldAlert,
  ArrowLeft,
  Menu as MenuIcon,
  X,
  FolderTree,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "catroom", label: "Cat Room Bookings", icon: CalendarDays },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "menu", label: "Menu & Inventory", icon: Coffee },
  { id: "categories", label: "Menu Categories", icon: FolderTree },
  { id: "cats", label: "Resident Cats", icon: Cat },
  { id: "customers", label: "Customers", icon: Users },
  { id: "payments", label: "Payments", icon: CreditCard },
];

export default function AdminDashboardPage() {
  const { user, isStaffOrAdmin, isAdmin, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const tabParam = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(tabParam);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  // Redirect unauthenticated users to login page instead of treating them as authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login?redirect=/admin", { replace: true });
    }
  }, [loading, user, navigate]);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
    setMobileSidebarOpen(false);
  };

  // Live formatted date for top bar (e.g. "Tuesday, November 17, 2026")
  const currentDateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-caramel"></div>
      </div>
    );
  }

  // Permission Guard
  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-cream px-4">
        <Card className="w-full max-w-md bg-white rounded-3xl p-6 text-center space-y-4 shadow-sm border-border/80">
          <ShieldAlert className="h-12 w-12 text-caramel mx-auto" />
          <h1 className="font-heading text-2xl font-bold text-espresso">Staff Login Required</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The Catopia Café admin portal is restricted to authorized team members. Please sign in with your staff or administrator account.
          </p>
          <Button asChild className="w-full rounded-full bg-caramel hover:bg-caramel-dark text-white">
            <Link to="/login?redirect=/admin">Sign In as Staff</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (!isStaffOrAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-cream px-4">
        <Card className="w-full max-w-md bg-white rounded-3xl p-6 text-center space-y-4 shadow-sm border-border/80">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="font-heading text-2xl font-bold text-espresso">Access Restricted</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your account ({user.email}) does not have staff or administrator privileges. If you are a team member, please contact the manager.
          </p>
          <Button asChild variant="outline" className="w-full rounded-full">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Return to Café
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const userInitials =
    (user.first_name?.[0] || "") + (user.last_name?.[0] || "") ||
    user.username.slice(0, 2).toUpperCase();

  const userRoleDisplay = isAdmin ? "Administrator" : "Café staff";

  return (
    <div className="min-h-screen bg-[#FBF8F4] flex flex-col md:flex-row selection:bg-caramel/20">
      {/* MOBILE HEADER BAR */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-border/80 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-1.5 rounded-xl border border-border text-espresso hover:bg-latte"
            aria-label="Toggle menu"
          >
            {mobileSidebarOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
          <span className="font-heading font-bold text-base text-espresso">
            Catopia Café Admin
          </span>
        </div>
        <Link
          to="/"
          className="flex items-center gap-1 text-xs text-caramel font-semibold px-2.5 py-1 rounded-full border border-caramel/30 hover:bg-caramel/10"
        >
          <Store className="h-3.5 w-3.5" />
          <span>Café</span>
        </Link>
      </div>

      {/* LEFT SIDEBAR (Desktop Fixed, Mobile Drawer) */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[#FAF6F0] border-r border-[#ECE4D8] flex flex-col justify-between p-5 z-40 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="space-y-6">
          {/* Logo & Subtitle matching reference */}
          <div className="px-2 pt-1">
            <Link to="/" className="flex items-center gap-2 text-espresso group">
              <span className="text-xl">🐱</span>
              <span className="font-heading text-xl font-bold tracking-tight text-espresso group-hover:text-caramel transition-colors">
                Catopia Café
              </span>
            </Link>
            <p className="font-heading italic text-caramel text-xs tracking-wide pl-7 -mt-1">
              Admin dashboard
            </p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-[#D4883E] to-[#B86E2A] text-white shadow-md shadow-caramel/25 font-bold"
                      : "text-espresso/75 hover:text-espresso hover:bg-latte/60"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-espresso/60"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Card matching reference */}
        <div className="pt-4 border-t border-border/60">
          <div className="rounded-2xl bg-white border border-border/80 p-3 flex items-center gap-3 shadow-2xs">
            <div className="h-9 w-9 rounded-full bg-caramel text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-espresso text-xs truncate">
                {user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.username}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {userRoleDisplay}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
        />
      )}

      {/* RIGHT MAIN WORKSPACE */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar matching reference */}
        <header className="h-16 border-b border-[#ECE4D8] bg-[#FAF6F0]/80 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 backdrop-blur-sm">
          {/* Current Date */}
          <span className="text-xs text-muted-foreground font-medium">
            {currentDateStr}
          </span>

          {/* Switcher Buttons */}
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-white text-xs font-semibold text-espresso hover:bg-latte transition-colors shadow-2xs"
            >
              <Store className="h-3.5 w-3.5 text-caramel" />
              <span>Café</span>
            </Link>

            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-espresso text-white text-xs font-semibold shadow-xs"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-caramel" />
              <span>Admin</span>
            </button>
          </div>
        </header>

        {/* Tab View Container */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          {activeTab === "overview" && <OverviewTab onNavigateTab={handleSelectTab} />}
          {activeTab === "payments" && <PaymentsTab />}
          {activeTab === "catroom" && <CatRoomTab />}
          {activeTab === "menu" && <MenuTab onNavigateCategories={() => handleSelectTab("categories")} />}
          {activeTab === "categories" && <CategoriesTab onNavigateToMenu={() => handleSelectTab("menu")} />}
          {activeTab === "orders" && <OrdersTab />}
          {activeTab === "cats" && <CatsTab />}
          {activeTab === "customers" && <CustomersTab />}
        </div>
      </main>
    </div>
  );
}
