import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  RotateCw,
  Search,
  Clock,
  Eye,
  Mail,
  Phone,
  User,
  CreditCard,
  Receipt,
  CheckCircle,
  AlertCircle,
  FileText,
} from "lucide-react";

function getPaymentBadgeClasses(paymentStatus) {
  const norm = (paymentStatus || "UNPAID").toUpperCase();
  if (norm === "PAID" || norm === "SETTLED") {
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  }
  if (norm === "REFUNDED") {
    return "bg-purple-500/10 text-purple-700 border-purple-500/30";
  }
  if (norm === "FAILED" || norm === "EXPIRED") {
    return "bg-red-500/10 text-red-700 border-red-500/30";
  }
  return "bg-amber-500/10 text-amber-800 border-amber-500/30";
}

function formatOrderDateTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append("page_size", "200");
      if (search.trim()) params.append("search", search.trim());
      const res = await api.get(`/api/orders/?${params.toString()}`);
      const list = Array.isArray(res) ? res : res?.results || [];
      setOrders(list);
      setError(null);
    } catch (err) {
      setError(err?.data?.detail || "Failed to load orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  // Initial fetch and auto-refresh every 15s
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post("/api/payments/sync/").catch(() => null);
    } finally {
      await fetchOrders();
    }
  };

  // Status transition handler
  const handleTransitionStatus = async (orderId, newStatus) => {
    setActionLoadingId(orderId);
    setActionFeedback(null);
    try {
      const updated = await api.post(`/api/orders/${orderId}/status/`, { status: newStatus });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
      setActionFeedback({
        type: "success",
        message: `Order #MC-${orderId} status updated to ${newStatus}.`,
      });
      await fetchOrders();
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      const detail =
        err?.data?.status?.[0] ||
        err?.data?.detail ||
        `Cannot transition order to ${newStatus}.`;
      setActionFeedback({
        type: "error",
        message: detail,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm(`Are you sure you want to cancel order #MC-${orderId}?`)) return;
    setActionLoadingId(orderId);
    setActionFeedback(null);
    try {
      const updated = await api.post(`/api/orders/${orderId}/status/`, { status: "cancelled" });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
      setActionFeedback({
        type: "success",
        message: `Order #MC-${orderId} has been cancelled.`,
      });
      await fetchOrders();
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      const detail = err?.data?.status?.[0] || err?.data?.detail || "Failed to cancel order.";
      setActionFeedback({
        type: "error",
        message: detail,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Split orders into columns (filtered per admin order board requirements)
  const isDemoCustomer = (o) => {
    const uname = String(o.customer_username || "").trim().toLowerCase();
    const cname = String(o.customer_name || "").trim().toLowerCase();
    const cemail = String(o.customer_email || "").trim().toLowerCase();
    return uname === "demo" || cname === "demo customer" || cemail === "demo@catopia.test";
  };
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "confirmed");
  const preparingOrders = orders.filter((o) => o.status === "preparing" && !isDemoCustomer(o));
  const readyOrders = orders.filter((o) => o.status === "ready");
  const completedOrders = orders.filter(
    (o) =>
      o.status === "completed" &&
      ["PAID", "SETTLED"].includes(String(o.payment_status || "").toUpperCase())
  );
  const cancelledOrders = orders.filter((o) => o.status === "cancelled" && !isDemoCustomer(o));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-heading italic text-caramel text-base md:text-lg">
            Counter
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-espresso tracking-tight">
            Order Management
          </h1>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Live Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white border border-border/80 px-3 py-1.5 rounded-full shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Auto-refreshing every 15s</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            className="rounded-full gap-1.5 cursor-pointer"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-caramel" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Cancelled Toggle Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order # or customer name..."
            className="w-full pl-9 pr-3 py-2 rounded-2xl border border-border bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel shadow-2xs"
          />
        </div>
        {cancelledOrders.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCancelled((prev) => !prev)}
            className="rounded-full text-xs cursor-pointer self-start sm:self-auto"
          >
            {showCancelled ? "Hide" : "Show"} Cancelled ({cancelledOrders.length})
          </Button>
        )}
      </div>

      {actionFeedback && (
        <div
          className={`rounded-2xl p-3.5 text-xs font-medium flex items-center gap-2 ${
            actionFeedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-800"
              : "bg-destructive/10 border border-destructive/20 text-destructive"
          }`}
        >
          {actionFeedback.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          )}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 text-xs text-destructive font-medium">
          {error}
        </div>
      )}

      {/* 4-COLUMN KANBAN BOARD */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* COLUMN 1: Pending */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-border/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="font-heading font-bold text-sm text-espresso">Pending</span>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-800 border-amber-500/30 text-xs px-2">
                {pendingOrders.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {pendingOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 bg-white/50 rounded-2xl border border-dashed border-border/80">
                  No pending orders
                </p>
              ) : (
                pendingOrders.map((ord) => (
                  <OrderCard
                    key={ord.id}
                    order={ord}
                    dateTimeStr={formatOrderDateTime(ord.created_at)}
                    primaryActionText="Start preparing ->"
                    onPrimaryAction={() => handleTransitionStatus(ord.id, "preparing")}
                    onCancel={() => handleCancelOrder(ord.id)}
                    onViewDetails={() => setSelectedOrder(ord)}
                    loading={actionLoadingId === ord.id}
                  />
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: Preparing */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-border/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                <span className="font-heading font-bold text-sm text-espresso">Preparing</span>
              </div>
              <Badge variant="outline" className="bg-orange-500/10 text-orange-800 border-orange-500/30 text-xs px-2">
                {preparingOrders.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {preparingOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 bg-white/50 rounded-2xl border border-dashed border-border/80">
                  No orders in preparation
                </p>
              ) : (
                preparingOrders.map((ord) => (
                  <OrderCard
                    key={ord.id}
                    order={ord}
                    dateTimeStr={formatOrderDateTime(ord.created_at)}
                    primaryActionText="Mark ready ->"
                    onPrimaryAction={() => handleTransitionStatus(ord.id, "ready")}
                    onCancel={() => handleCancelOrder(ord.id)}
                    onViewDetails={() => setSelectedOrder(ord)}
                    loading={actionLoadingId === ord.id}
                  />
                ))
              )}
            </div>
          </div>

          {/* COLUMN 3: Ready */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-border/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="font-heading font-bold text-sm text-espresso">Ready</span>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-800 border-emerald-500/30 text-xs px-2">
                {readyOrders.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {readyOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 bg-white/50 rounded-2xl border border-dashed border-border/80">
                  No orders awaiting pickup
                </p>
              ) : (
                readyOrders.map((ord) => (
                  <OrderCard
                    key={ord.id}
                    order={ord}
                    dateTimeStr={formatOrderDateTime(ord.created_at)}
                    primaryActionText="Complete pickup ->"
                    onPrimaryAction={() => handleTransitionStatus(ord.id, "completed")}
                    onCancel={() => handleCancelOrder(ord.id)}
                    onViewDetails={() => setSelectedOrder(ord)}
                    loading={actionLoadingId === ord.id}
                  />
                ))
              )}
            </div>
          </div>

          {/* COLUMN 4: Completed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-border/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-espresso/60" />
                <span className="font-heading font-bold text-sm text-espresso">Completed</span>
              </div>
              <Badge variant="outline" className="bg-latte text-espresso border-border text-xs px-2">
                {completedOrders.length}
              </Badge>
            </div>

            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {completedOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 bg-white/50 rounded-2xl border border-dashed border-border/80">
                  No completed orders yet
                </p>
              ) : (
                completedOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-2xl border border-border/70 bg-white/80 p-3.5 space-y-2 text-xs shadow-2xs opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-espresso">#MC-{ord.id}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-semibold ${getPaymentBadgeClasses(ord.payment_status)}`}
                      >
                        {(ord.payment_status || "UNPAID").toUpperCase()}
                      </Badge>
                    </div>

                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <p className="font-semibold text-espresso">{ord.customer_name || "Guest Customer"}</p>
                      {ord.customer_email && <p className="truncate">{ord.customer_email}</p>}
                      <p className="text-[10px]">{formatOrderDateTime(ord.created_at)}</p>
                    </div>

                    <div className="space-y-0.5 pt-0.5 border-t border-border/50">
                      {ord.items?.map((i) => {
                        const variantText = [i.size, i.temperature].filter(Boolean).join(" • ");
                        return (
                          <div key={i.id} className="flex justify-between text-[11px] text-muted-foreground">
                            <span className="truncate pr-2">
                              {i.quantity}x {i.name}
                              {variantText && (
                                <span className="text-[10px] text-caramel ml-1 font-medium">({variantText})</span>
                              )}
                            </span>
                            <span className="tabular-nums font-medium text-espresso">
                              {formatPHP(parseFloat(i.unit_price || i.price) * i.quantity)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {(ord.pickup_time || ord.order_note) && (
                      <div className="rounded-xl bg-[#FAF6F0] border border-caramel/25 p-2 space-y-1 text-[11px]">
                        {ord.pickup_time && (
                          <p className="font-semibold text-caramel-dark flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0 text-caramel" />
                            <span>Pickup: {ord.pickup_time}</span>
                          </p>
                        )}
                        {ord.order_note && (
                          <p className="text-espresso leading-snug whitespace-pre-wrap break-words">
                            <span className="font-semibold text-caramel-dark">Note: </span>
                            {ord.order_note}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                      <span className="font-semibold text-espresso">{formatPHP(parseFloat(ord.total))}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(ord)}
                          className="text-[11px] text-caramel font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" /> Details
                        </button>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-800 border-emerald-500/30 text-[10px]">
                          Completed
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Optional Cancelled Orders Section */}
      {showCancelled && cancelledOrders.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-border/80 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="font-heading font-bold text-sm text-espresso">Cancelled Orders</span>
            </div>
            <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30 text-xs px-2">
              {cancelledOrders.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {cancelledOrders.map((ord) => (
              <div
                key={ord.id}
                className="rounded-2xl border border-border/70 bg-white/70 p-3.5 space-y-2 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-espresso">#MC-{ord.id}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 font-semibold ${getPaymentBadgeClasses(ord.payment_status)}`}
                  >
                    {(ord.payment_status || "UNPAID").toUpperCase()}
                  </Badge>
                </div>
                <p className="font-semibold text-espresso text-xs">{ord.customer_name || "Guest Customer"}</p>
                <p className="text-[10px] text-muted-foreground">{formatOrderDateTime(ord.created_at)}</p>
                <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                  <span className="font-semibold text-espresso">{formatPHP(parseFloat(ord.total))}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(ord)}
                    className="text-[11px] text-caramel font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="h-3 w-3" /> Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-lg bg-white rounded-3xl p-6">
          {selectedOrder && (
            <>
              <DialogHeader className="space-y-1">
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="font-heading text-xl text-espresso">
                    Order #MC-{selectedOrder.id}
                  </DialogTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold ${getPaymentBadgeClasses(selectedOrder.payment_status)}`}
                    >
                      {(selectedOrder.payment_status || "UNPAID").toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="capitalize text-[10px] font-semibold">
                      {selectedOrder.status}
                    </Badge>
                  </div>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Placed on {formatOrderDateTime(selectedOrder.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Customer Info */}
                <div className="rounded-2xl bg-[#FAF6F0] border border-border/70 p-3.5 space-y-1.5">
                  <p className="font-semibold text-espresso text-[11px] uppercase tracking-wider text-muted-foreground">
                    Customer Information
                  </p>
                  <div className="flex items-center gap-2 text-espresso font-semibold">
                    <User className="h-3.5 w-3.5 text-caramel shrink-0" />
                    <span>
                      {selectedOrder.customer_name || "Guest Customer"}
                      {selectedOrder.customer_username ? ` (@${selectedOrder.customer_username})` : ""}
                    </span>
                  </div>
                  {selectedOrder.customer_email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-caramel shrink-0" />
                      <span>{selectedOrder.customer_email}</span>
                    </div>
                  )}
                  {selectedOrder.customer_phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-caramel shrink-0" />
                      <span>{selectedOrder.customer_phone}</span>
                    </div>
                  )}
                </div>

                {/* Pickup Time & Customer Order Notes */}
                {(selectedOrder.pickup_time || selectedOrder.order_note) && (
                  <div className="rounded-2xl bg-caramel/10 border border-caramel/30 p-3.5 space-y-1.5">
                    <p className="font-semibold text-[11px] uppercase tracking-wider text-caramel-dark flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-caramel" />
                      Order Details &amp; Pickup Notes
                    </p>
                    {selectedOrder.pickup_time && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Requested Pickup:</span>
                        <span className="font-semibold text-espresso">{selectedOrder.pickup_time}</span>
                      </div>
                    )}
                    {selectedOrder.order_note && (
                      <div className="pt-1 border-t border-caramel/20 space-y-0.5">
                        <span className="text-[11px] text-muted-foreground font-medium block">
                          Customer Instructions:
                        </span>
                        <p className="text-xs font-medium text-espresso whitespace-pre-wrap leading-relaxed">
                          {selectedOrder.order_note}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Ordered Items */}
                <div className="space-y-2">
                  <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                    Ordered Products
                  </p>
                  <div className="rounded-2xl border border-border/70 divide-y divide-border/60">
                    {selectedOrder.items?.map((item) => {
                      const variantText = [item.size, item.temperature].filter(Boolean).join(" • ");
                      const unitPrice = parseFloat(item.unit_price || item.price);
                      return (
                        <div key={item.id} className="p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-espresso">
                              {item.quantity}x {item.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatPHP(unitPrice)} each{variantText ? ` · ${variantText}` : ""}
                            </p>
                          </div>
                          <span className="font-semibold text-espresso tabular-nums shrink-0">
                            {formatPHP(unitPrice * item.quantity)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Totals */}
                <div className="rounded-2xl bg-[#FAF6F0] border border-border/70 p-3.5 space-y-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-medium text-espresso">
                      {formatPHP(parseFloat(selectedOrder.subtotal || selectedOrder.total))}
                    </span>
                  </div>
                  {parseFloat(selectedOrder.discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Discounts</span>
                      <span className="tabular-nums">
                        -{formatPHP(parseFloat(selectedOrder.discount_amount))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-heading font-bold text-espresso text-base pt-1.5 border-t border-border/60">
                    <span>Total Amount</span>
                    <span className="tabular-nums text-caramel-dark">
                      {formatPHP(parseFloat(selectedOrder.total))}
                    </span>
                  </div>
                </div>

                {/* Payment Metadata */}
                {selectedOrder.payment && (
                  <div className="rounded-2xl border border-border/70 p-3.5 space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-semibold text-espresso mb-1">
                      <CreditCard className="h-3.5 w-3.5 text-caramel" />
                      <span>Payment Details</span>
                    </div>
                    <p>Method: <span className="uppercase font-medium text-espresso">{selectedOrder.payment.method}</span></p>
                    <p>Reference: <span className="font-mono text-espresso">{selectedOrder.payment.reference_number}</span></p>
                    {selectedOrder.payment.receipt_number && (
                      <p className="flex items-center gap-1">
                        <Receipt className="h-3 w-3 text-caramel" />
                        Receipt: <span className="font-mono text-espresso">{selectedOrder.payment.receipt_number}</span>
                      </p>
                    )}
                    {selectedOrder.payment.paid_at && (
                      <p>Paid at: <span className="text-espresso">{formatOrderDateTime(selectedOrder.payment.paid_at)}</span></p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderCard({ order, dateTimeStr, primaryActionText, onPrimaryAction, onCancel, onViewDetails, loading }) {
  const paymentStatus = (order.payment_status || "UNPAID").toUpperCase();
  return (
    <Card className="rounded-2xl border-border/80 bg-white shadow-sm hover:shadow-md transition-shadow p-4 space-y-3">
      {/* Top row: Order ID & Payment Status */}
      <div className="flex items-center justify-between text-xs gap-2">
        <span className="font-mono font-bold text-espresso">#MC-{order.id}</span>
        <Badge
          variant="outline"
          className={`text-[10px] px-2 py-0 font-semibold ${getPaymentBadgeClasses(paymentStatus)}`}
        >
          {paymentStatus}
        </Badge>
      </div>

      {/* Customer Info & Order Date */}
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-espresso truncate">
          {order.customer_name || "Guest Customer"}
        </p>
        {order.customer_email && (
          <p className="text-[11px] text-muted-foreground truncate">
            {order.customer_email}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
          <Clock className="h-3 w-3 shrink-0" /> {dateTimeStr}
        </p>
      </div>

      {/* Items list */}
      <div className="space-y-1 border-y border-border/60 py-2">
        {order.items?.map((item) => {
          const variantText = [item.size, item.temperature].filter(Boolean).join(" • ");
          return (
            <div key={item.id} className="flex justify-between text-[11px] text-muted-foreground">
              <span className="truncate pr-1">
                <span className="font-semibold text-espresso mr-1">{item.quantity}x</span>
                {item.name}
                {variantText && (
                  <span className="text-[10px] text-caramel ml-1 font-medium">
                    ({variantText})
                  </span>
                )}
              </span>
              <span className="tabular-nums text-espresso font-medium shrink-0">
                {formatPHP(parseFloat(item.unit_price || item.price) * item.quantity)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Customer Pickup Time & Order Details / Notes */}
      {(order.pickup_time || order.order_note) && (
        <div className="rounded-xl bg-[#FAF6F0] border border-caramel/25 p-2.5 space-y-1 text-[11px]">
          {order.pickup_time && (
            <p className="font-semibold text-caramel-dark flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0 text-caramel" />
              <span>Pickup: {order.pickup_time}</span>
            </p>
          )}
          {order.order_note && (
            <p className="text-espresso leading-snug whitespace-pre-wrap break-words">
              <span className="font-semibold text-caramel-dark">Note: </span>
              {order.order_note}
            </p>
          )}
        </div>
      )}

      {/* Pricing, Details & Cancel row */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-heading font-bold text-espresso text-sm">
          {formatPHP(parseFloat(order.total))}
        </span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onViewDetails}
            className="text-[11px] text-caramel font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Eye className="h-3 w-3" /> Details
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            ✕ Cancel
          </button>
        </div>
      </div>

      {/* Action button */}
      <Button
        size="sm"
        onClick={onPrimaryAction}
        disabled={loading}
        className="w-full h-8 rounded-full bg-caramel hover:bg-caramel-dark text-white font-medium text-xs cursor-pointer shadow-xs transition-colors"
      >
        {loading ? "Updating..." : primaryActionText}
      </Button>
    </Card>
  );
}
