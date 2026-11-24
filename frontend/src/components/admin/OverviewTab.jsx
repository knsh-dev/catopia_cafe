import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  Percent,
  ShoppingBag,
  CalendarCheck,
  TrendingUp,
  ArrowRight,
  Users,
  Cat,
  RotateCw,
  AlertCircle,
} from "lucide-react";

export default function OverviewTab({ onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = async () => {
    try {
      const res = await api.get("/api/admin/overview/");
      setData(res);
      setError(null);
    } catch (err) {
      setError("Failed to load overview data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const handleSync = () => fetchOverview();
    const handleStorage = (e) => {
      if (e.key === "catopia_settings_updated_at") fetchOverview();
    };
    window.addEventListener("catopia:settings-change", handleSync);
    window.addEventListener("catopia:reservation-change", handleSync);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("catopia:settings-change", handleSync);
      window.removeEventListener("catopia:reservation-change", handleSync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOverview();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-7 h-72 rounded-2xl" />
          <Skeleton className="lg:col-span-5 h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-6 text-center text-destructive space-y-3">
        <AlertCircle className="h-8 w-8 mx-auto" />
        <p className="font-medium text-sm">{error}</p>
        <button
          onClick={handleRefresh}
          className="text-xs underline font-semibold cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  const revenueNum = parseFloat(data?.revenue_today || 0);
  const occupancyRate = data?.catroom_occupancy_rate ?? 0;
  const bookedSpots = data?.booked_spots ?? 0;
  const totalSpots = data?.total_spots ?? 72;
  const activeOrdersCount = data?.active_orders_count ?? 0;
  const awaitingApproval = data?.awaiting_approval_count ?? 0;
  const hourlyOccupancy = data?.hourly_occupancy || [];
  const revenue7Days = data?.revenue_7days || [];
  const topSelling = data?.top_selling || [];
  const activeOrders = data?.active_orders || [];
  const membersCount = data?.registered_members_count ?? 0;
  const catsReady = data?.cats_ready_count ?? 0;
  const catsTotal = data?.cats_total_count ?? 0;

  // Max value for revenue chart
  const maxRevenue = Math.max(...revenue7Days.map((d) => d.revenue), 100);

  return (
    <div className="space-y-6">
      {/* Script Accent & Title */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading italic text-caramel text-base md:text-lg">
            Good day, Admin
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-espresso tracking-tight">
            Overview & Analytics
          </h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-border/80 text-xs text-espresso hover:bg-latte transition-colors cursor-pointer shadow-2xs"
        >
          <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-caramel" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 1. TOP METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Revenue Today */}
        <Card className="rounded-2xl border-border/80 bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Revenue today</p>
              <p className="font-heading text-2xl font-bold text-espresso">
                {formatPHP(revenueNum)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {data?.paid_today_count || 0} orders so far
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-caramel/15 text-caramel flex items-center justify-center font-bold text-xs shrink-0">
              ₱
            </div>
          </CardContent>
        </Card>

        {/* Cat Room Occupancy */}
        <Card className="rounded-2xl border-border/80 bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Cat Room occupancy</p>
              <p className="font-heading text-2xl font-bold text-espresso">
                {occupancyRate}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {bookedSpots}/{totalSpots} visitor-hours in use
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
              %
            </div>
          </CardContent>
        </Card>

        {/* Active Orders */}
        <Card className="rounded-2xl border-border/80 bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Active orders</p>
              <p className="font-heading text-2xl font-bold text-espresso">
                {activeOrdersCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Pending, preparing or ready
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. MIDDLE ROW: Cat Room Hourly Occupancy & Revenue Last 7 Days */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cat Room Hourly Occupancy Today */}
        <Card className="lg:col-span-7 rounded-3xl border-border/80 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-base font-bold text-espresso">
                Cat Room · hourly occupancy today
              </h2>
              <p className="text-xs text-muted-foreground">Single room 1-hour slots</p>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {data?.capacity_per_hour || 8} visitors per hour
            </span>
          </div>

          {/* Visual slot bars */}
          <div className="grid grid-cols-10 gap-2 pt-4 pb-2 items-end min-h-[170px]">
            {hourlyOccupancy.map((slot) => {
              const pct = Math.min(100, Math.round((slot.booked / slot.capacity) * 100));
              const isRest = slot.is_rest || slot.status === "blocked";

              return (
                <div key={slot.hour} className="flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {slot.booked}/{slot.capacity}
                  </span>
                  <div className="w-full bg-latte/40 rounded-xl h-28 relative overflow-hidden flex flex-col justify-end border border-border/40">
                    {isRest ? (
                      <div className="h-full w-full bg-latte/80 flex items-center justify-center text-muted-foreground/60">
                        <span className="text-xs">🌙</span>
                      </div>
                    ) : (
                      <div
                        style={{ height: `${Math.max(8, pct)}%` }}
                        className={`w-full rounded-b-xl transition-all ${
                          pct >= 100 ? "bg-espresso" : pct > 0 ? "bg-caramel" : "bg-transparent"
                        }`}
                      />
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-espresso/80 truncate w-full text-center">
                    {slot.time}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 pt-2 border-t border-border/60 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-caramel inline-block"></span>
              Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-espresso inline-block"></span>
              Full
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-latte border border-border inline-block"></span>
              Rest / blocked
            </span>
          </div>
        </Card>

        {/* Revenue Last 7 Days */}
        <Card className="lg:col-span-5 rounded-3xl border-border/80 bg-white shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-heading text-base font-bold text-espresso">
              Revenue · last 7 days
            </h2>
            <p className="text-xs text-muted-foreground">From paid online and counter transactions</p>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-4 pb-2 items-end min-h-[170px]">
            {revenue7Days.map((d) => {
              const heightPct = Math.min(100, Math.round((d.revenue / maxRevenue) * 100));
              const isToday = d.date === new Date().toISOString().split("T")[0];

              return (
                <div key={d.date} className="flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[10px] font-mono text-espresso font-semibold">
                    ₱{Math.round(d.revenue)}
                  </span>
                  <div className="w-full bg-latte/30 rounded-xl h-28 relative overflow-hidden flex flex-col justify-end border border-border/40">
                    <div
                      style={{ height: `${Math.max(6, heightPct)}%` }}
                      className={`w-full rounded-b-xl transition-all ${
                        isToday ? "bg-gradient-to-t from-caramel to-[#B86E2A]" : "bg-latte"
                      }`}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${isToday ? "text-caramel font-bold" : "text-muted-foreground"}`}>
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground text-center">
            Daily revenue totals in Philippine Peso (PHP)
          </div>
        </Card>
      </div>

      {/* 3. BOTTOM ROW: Top-Selling Items & Active Orders Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top-Selling Items */}
        <Card className="lg:col-span-6 rounded-3xl border-border/80 bg-white shadow-sm p-6 space-y-4">
          <h2 className="font-heading text-base font-bold text-espresso">
            Top-selling items
          </h2>

          <div className="space-y-3.5 pt-1">
            {topSelling.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No product sales recorded yet.
              </p>
            ) : (
              topSelling.map((item, idx) => {
                const maxSold = Math.max(...topSelling.map((t) => t.sold_count), 1);
                const barWidth = Math.min(100, Math.round((item.sold_count / maxSold) * 100));

                return (
                  <div key={`${item.id || item.name}-${idx}`} className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-espresso flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-latte/80 text-espresso text-[11px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span>{item.name}</span>
                      </span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {item.sold_count} sold · {formatPHP(item.revenue)}
                      </span>
                    </div>
                    <div className="w-full bg-latte/40 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.max(8, barWidth)}%` }}
                        className="h-full bg-caramel rounded-full"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Active Orders Preview */}
        <Card className="lg:col-span-6 rounded-3xl border-border/80 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-espresso">
              Active orders
            </h2>
            <button
              onClick={() => onNavigateTab("orders")}
              className="text-xs text-caramel font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Order board <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-2.5 pt-1 max-h-64 overflow-y-auto pr-1">
            {activeOrders.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No active orders at the moment.
              </p>
            ) : (
              activeOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 rounded-2xl bg-cream/70 border border-border/70 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 truncate pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-espresso">#MC-{ord.id}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium text-espresso truncate">{ord.customer_name}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {ord.items?.map((i) => `${i.quantity}x ${i.name}`).join(", ") || "No items"}
                    </p>
                    {(ord.pickup_time || ord.order_note) && (
                      <p className="text-[10px] text-caramel-dark font-medium truncate">
                        {ord.pickup_time ? `Pickup: ${ord.pickup_time}` : ""}
                        {ord.pickup_time && ord.order_note ? " · " : ""}
                        {ord.order_note ? `Note: ${ord.order_note}` : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-espresso">
                      {formatPHP(parseFloat(ord.total))}
                    </span>
                    <Badge
                      variant="outline"
                      className={`capitalize text-[10px] py-0.5 px-2 font-semibold ${
                        ord.status === "ready"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                          : ord.status === "preparing"
                          ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                          : "bg-blue-500/10 text-blue-700 border-blue-500/30"
                      }`}
                    >
                      {ord.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* 4. FOOTER STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Registered Members */}
        <Card className="rounded-2xl border-border/80 bg-white shadow-sm p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Registered members</p>
            <p className="font-heading text-2xl font-bold text-espresso">{membersCount}</p>
            <button
              onClick={() => onNavigateTab("customers")}
              className="text-[11px] text-caramel font-semibold hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
            >
              Customer directory <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="h-10 w-10 rounded-full bg-caramel/10 text-caramel flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
        </Card>

        {/* Residents Ready to Play */}
        <Card className="rounded-2xl border-border/80 bg-white shadow-sm p-5 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Residents ready to play</p>
            <p className="font-heading text-2xl font-bold text-espresso">
              {catsReady}/{catsTotal}
            </p>
            <button
              onClick={() => onNavigateTab("cats")}
              className="text-[11px] text-caramel font-semibold hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
            >
              Manage roster <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="h-10 w-10 rounded-full bg-latte text-espresso flex items-center justify-center shrink-0">
            <Cat className="h-5 w-5" />
          </div>
        </Card>
      </div>
    </div>
  );
}
