import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  RotateCw,
  Users,
  Sparkles,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Heart,
  Phone,
  Calendar,
  ShoppingBag,
  Shield,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

export default function CustomersTab() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState(null);

  // Point Adjustment state
  const [pointsDeltaMap, setPointsDeltaMap] = useState({});
  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustSuccessId, setAdjustSuccessId] = useState(null);

  // Role Changer state
  const [roleChangingId, setRoleChangingId] = useState(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      const query = params.toString();
      const res = await api.get(`/api/admin/customers/${query ? `?${query}` : ""}`);
      setData(res);
    } catch (err) {
      setError(err?.data?.detail || "Failed to fetch customer directory.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const toggleExpand = (userId) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  const handleAdjustPoints = async (userId) => {
    const rawVal = pointsDeltaMap[userId];
    const delta = parseInt(rawVal, 10);
    if (!delta || isNaN(delta)) {
      alert("Please enter a non-zero number of points (e.g. +50 or -100).");
      return;
    }

    setAdjustingId(userId);
    try {
      await api.post(`/api/admin/customers/${userId}/adjust-points/`, {
        points_delta: delta,
        reason: "Admin manual points adjustment",
      });
      setAdjustSuccessId(userId);
      setPointsDeltaMap((prev) => ({ ...prev, [userId]: "" }));
      fetchCustomers();
      setTimeout(() => setAdjustSuccessId(null), 3000);
    } catch (err) {
      alert(err?.data?.detail || "Failed to adjust points.");
    } finally {
      setAdjustingId(null);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    if (!window.confirm(`Change role of this user to '${newRole}'?`)) return;
    setRoleChangingId(userId);
    try {
      await api.post(`/api/admin/customers/${userId}/role/`, { role: newRole });
      fetchCustomers();
    } catch (err) {
      alert(err?.data?.detail || "Failed to change user role.");
    } finally {
      setRoleChangingId(null);
    }
  };

  const stats = data?.stats || {};
  const customers = data?.customers || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-heading italic text-caramel text-base md:text-lg">
            Our regulars
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-espresso tracking-tight">
            Customer Directory
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchCustomers}
          className="rounded-full gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-caramel" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Top 3 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border/80 bg-white shadow-sm p-5 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Members</p>
          <p className="font-heading text-2xl font-bold text-espresso">
            {stats.total_members ?? 0}
          </p>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-white shadow-sm p-5 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Paw points outstanding</p>
          <p className="font-heading text-2xl font-bold text-espresso">
            {(stats.paw_points_outstanding ?? 0).toLocaleString()}
          </p>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-white shadow-sm p-5 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Lifetime member spend</p>
          <p className="font-heading text-2xl font-bold text-espresso">
            {formatPHP(parseFloat(stats.lifetime_member_spend || 0))}
          </p>
        </Card>
      </div>

      {/* Search Input Card */}
      <Card className="rounded-3xl border-border/80 bg-white shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members by name, email or phone..."
            className="w-full pl-9 pr-3 py-2 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
          />
        </div>
      </Card>

      {/* Customer Table */}
      <Card className="rounded-3xl border-border/80 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive space-y-3">
            <AlertCircle className="h-8 w-8 mx-auto" />
            <p className="text-sm font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCustomers}
              className="rounded-full text-xs cursor-pointer"
            >
              Try again
            </Button>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Users className="h-10 w-10 mx-auto text-caramel/40" />
            <p className="font-heading text-lg font-bold text-espresso">No members found</p>
            <p className="text-xs">Try searching by another term.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Paw Points</TableHead>
                <TableHead>Cat Room Visits</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Member Since</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => {
                const isExpanded = expandedUserId === c.id;
                const initials =
                  (c.full_name || c.username)
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "U";

                return (
                  <React.Fragment key={c.id}>
                    {/* Main Row */}
                    <TableRow
                      onClick={() => toggleExpand(c.id)}
                      className="cursor-pointer hover:bg-latte/30"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-caramel text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-espresso">{c.full_name}</span>
                              {c.role !== "customer" && (
                                <Badge
                                  variant="outline"
                                  className={`capitalize text-[9px] py-0 px-1.5 font-semibold ${
                                    c.role === "admin"
                                      ? "bg-purple-500/10 text-purple-800 border-purple-500/30"
                                      : "bg-emerald-500/10 text-emerald-800 border-emerald-500/30"
                                  }`}
                                >
                                  {c.role === "staff" ? "Staff" : "Admin"}
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground block">
                              {c.email || c.username}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-bold text-espresso block">
                          {c.paw_points.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          {c.tier}
                        </span>
                      </TableCell>

                      <TableCell className="font-medium text-espresso">
                        {c.visits_count}
                      </TableCell>

                      <TableCell>
                        <span className="font-medium text-espresso block">
                          {c.orders_count} · {formatPHP(parseFloat(c.total_spend))}
                        </span>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {c.member_since}
                      </TableCell>

                      <TableCell className="text-right">
                        <button
                          type="button"
                          className="p-1 rounded-full text-muted-foreground hover:bg-latte transition-colors cursor-pointer"
                          aria-label={isExpanded ? "Collapse row" : "Expand row"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-caramel" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Details Row */}
                    {isExpanded && (
                      <TableRow className="bg-[#FAF6F0]/60 hover:bg-[#FAF6F0]/60 border-b border-border/80">
                        <TableCell colSpan={6} className="p-4 sm:p-6 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
                            {/* Left: Booking History */}
                            <div className="md:col-span-7 space-y-2.5">
                              <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase block">
                                Booking History
                              </span>

                              {c.recent_bookings.length === 0 ? (
                                <p className="text-muted-foreground italic text-[11px]">
                                  No reservation history.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {c.recent_bookings.map((b) => (
                                    <div
                                      key={b.id}
                                      className="p-2.5 rounded-xl bg-white border border-border/80 flex items-center justify-between text-xs"
                                    >
                                      <div>
                                        <span className="font-semibold text-espresso">
                                          {b.date} · {b.slot_start} – {b.slot_end}
                                        </span>
                                        <span className="text-muted-foreground ml-2">
                                          ({b.visitors} guest{b.visitors > 1 ? "s" : ""})
                                        </span>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className={`capitalize text-[10px] py-0 px-2 font-semibold ${
                                          b.status === "confirmed" || b.status === "completed"
                                            ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/30"
                                            : b.status === "pending_payment"
                                            ? "bg-amber-500/10 text-amber-800 border-amber-500/30"
                                            : "bg-muted text-muted-foreground border-border"
                                        }`}
                                      >
                                        {b.status_display}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Right: Contact, Favorite Cats, and Admin Actions */}
                            <div className="md:col-span-5 space-y-3.5">
                              {/* Contact */}
                              <div>
                                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase block mb-1">
                                  Contact
                                </span>
                                <p className="font-mono text-espresso text-xs">
                                  {c.phone || "No phone registered"}
                                </p>
                              </div>

                              {/* Favorite Cats */}
                              <div>
                                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase block mb-1">
                                  Favorite Cats
                                </span>
                                {c.favorite_cats.length === 0 ? (
                                  <p className="text-muted-foreground italic text-[11px]">
                                    No favorited cats yet.
                                  </p>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {c.favorite_cats.map((catName) => (
                                      <Badge
                                        key={catName}
                                        variant="outline"
                                        className="text-[10px] bg-white border-caramel/30 text-caramel-dark font-medium gap-1 py-0.5"
                                      >
                                        <Heart className="h-2.5 w-2.5 fill-caramel text-caramel" />
                                        {catName}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Admin Points Adjustment */}
                              {isAdmin && (
                                <div className="space-y-1.5 pt-1">
                                  <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase block">
                                    Adjust Paw Points (Admin)
                                  </span>
                                  <div className="flex gap-2">
                                    <input
                                      type="number"
                                      placeholder="+50 or -100"
                                      value={pointsDeltaMap[c.id] || ""}
                                      onChange={(e) =>
                                        setPointsDeltaMap({
                                          ...pointsDeltaMap,
                                          [c.id]: e.target.value,
                                        })
                                      }
                                      className="w-28 py-1.5 px-3 rounded-xl border border-border bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => handleAdjustPoints(c.id)}
                                      disabled={adjustingId === c.id}
                                      className="h-8 rounded-xl bg-caramel hover:bg-caramel-dark text-white text-xs cursor-pointer shadow-2xs"
                                    >
                                      {adjustingId === c.id ? "Applying..." : "Apply"}
                                    </Button>
                                  </div>
                                  {adjustSuccessId === c.id && (
                                    <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                                      <CheckCircle className="h-3 w-3" /> Points adjusted!
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Admin User Role Changer */}
                              {isAdmin && (
                                <div className="space-y-1.5 pt-1">
                                  <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase block">
                                    Assign Role (Admin)
                                  </span>
                                  <select
                                    value={c.role}
                                    disabled={roleChangingId === c.id}
                                    onChange={(e) => handleChangeRole(c.id, e.target.value)}
                                    className="py-1.5 px-3 rounded-xl border border-border bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
                                  >
                                    <option value="customer">Customer</option>
                                    <option value="staff">Café Staff</option>
                                    <option value="admin">Administrator</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
