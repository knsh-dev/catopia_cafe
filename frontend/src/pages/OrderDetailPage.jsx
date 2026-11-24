import { useState, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFetch } from "@/hooks/useFetch";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  Clock,
  Coffee,
  ArrowLeft,
  ShoppingBag,
  CreditCard,
  Loader2,
  AlertCircle,
  XCircle,
  RotateCcw,
} from "lucide-react";

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const paymentRedirectParam = searchParams.get("payment");

  const { data: initialOrder, loading, error } = useFetch(`/api/orders/${id}/`, {
    enabled: !!user,
    deps: [user?.id, id],
  });
  const [order, setOrder] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState(null);

  // Cancellation state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Prevent multiple or loop payment verification calls
  const hasVerifiedRef = useRef(false);

  useEffect(() => {
    hasVerifiedRef.current = false;
  }, [id]);

  // Sync initial fetch data
  useEffect(() => {
    setOrder(initialOrder || null);
  }, [initialOrder]);

  // Poll active orders every 10s so admin status transitions reflect live for the customer
  useEffect(() => {
    if (!user || !order?.id) return;
    if (!["pending", "confirmed", "preparing", "ready"].includes(order.status)) return;

    const interval = setInterval(() => {
      api
        .get(`/api/orders/${order.id}/`)
        .then((latest) => {
          if (latest?.id) setOrder(latest);
        })
        .catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, [user, order?.id, order?.status]);

  // Sync / verify payment on load (especially on redirect with ?payment=success or while status is pending)
  useEffect(() => {
    if (!order?.id || hasVerifiedRef.current) return;

    const rawPaymentStatus = (
      order.payment_status ||
      order.paymentStatus ||
      order.payment?.status ||
      ""
    ).toUpperCase();

    const isAlreadyPaid = rawPaymentStatus === "PAID" || rawPaymentStatus === "SETTLED";

    // Trigger verification if redirected from Xendit with payment=success or if order is still pending
    if (!isAlreadyPaid && (paymentRedirectParam === "success" || order.status === "pending")) {
      hasVerifiedRef.current = true;
      let isMounted = true;
      setVerifying(true);

      api
        .post(`/api/orders/${order.id}/verify-payment/`)
        .then((updated) => {
          if (isMounted && updated?.id) {
            setOrder(updated);
          }
        })
        .catch((err) => {
          console.warn("Payment verification skipped or failed:", err);
        })
        .finally(() => {
          if (isMounted) {
            setVerifying(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [order?.id, order?.status, paymentRedirectParam]);

  const handlePayOrder = async () => {
    if (!order?.id) return;
    setPayLoading(true);
    setPayError(null);
    try {
      const data = await api.post("/api/payments/checkout/", {
        type: "order",
        id: order.id,
      });
      if (data?.invoice_url) {
        window.location.href = data.invoice_url;
      } else {
        throw new Error("No invoice URL returned");
      }
    } catch (err) {
      const msg = err?.data?.detail || err?.message || "Failed to initiate payment checkout.";
      setPayError(msg);
      setPayLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order?.id) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await api.post(`/api/orders/${order.id}/cancel/`);
      setOrder(updated);
      setCancelDialogOpen(false);
    } catch (err) {
      const msg =
        err?.data?.detail || err?.message || "Failed to cancel order. Please try again.";
      setCancelError(msg);
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="bg-cream min-h-screen py-8">
        <div className="mx-auto max-w-2xl px-4">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-64 w-full rounded-[var(--radius-xl)]" />
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-cream px-4">
        <div className="text-center space-y-4">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="font-heading text-2xl font-bold text-espresso">Order Not Found</h1>
          <p className="text-muted-foreground">This order doesn't exist or you don't have permission to view it.</p>
          <Button asChild>
            <Link to="/orders">View All Orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  // Determine payment and order status (case-insensitive check)
  const rawPaymentStatus = (
    order.payment_status ||
    order.paymentStatus ||
    order.payment?.status ||
    ""
  ).toUpperCase();

  const isRefunded =
    rawPaymentStatus === "REFUNDED" ||
    order.status === "refunded";

  const isCancelled = order.status === "cancelled";

  const isPaid =
    !isRefunded &&
    !isCancelled &&
    (rawPaymentStatus === "PAID" || rawPaymentStatus === "SETTLED");

  const isUnpaidPending =
    !isPaid && !isCancelled && !isRefunded && order.status === "pending";

  const canCancel = isUnpaidPending;

  // Badge configuration based on payment and fulfillment status
  let badgeVariant = "pending";
  let badgeLabel = "Pending";
  let BadgeIcon = Clock;

  if (isRefunded) {
    badgeVariant = "refunded";
    badgeLabel = "Refunded";
    BadgeIcon = RotateCcw;
  } else if (isCancelled) {
    badgeVariant = "failed";
    badgeLabel = "Cancelled";
    BadgeIcon = XCircle;
  } else if (order.status === "ready") {
    badgeVariant = "paid";
    badgeLabel = "Ready for Pickup";
    BadgeIcon = CheckCircle;
  } else if (order.status === "completed") {
    badgeVariant = "paid";
    badgeLabel = "Completed";
    BadgeIcon = CheckCircle;
  } else if (order.status === "preparing") {
    badgeVariant = "paid";
    badgeLabel = "Preparing for Pickup";
    BadgeIcon = Coffee;
  } else if (isPaid) {
    badgeVariant = "paid";
    badgeLabel = "Paid · Pending Prep";
    BadgeIcon = CheckCircle;
  } else {
    badgeVariant = "pending";
    badgeLabel = "Pending";
    BadgeIcon = Clock;
  }

  return (
    <div className="bg-cream min-h-screen py-8">
      <div className="mx-auto max-w-2xl px-4">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/orders">
            <ArrowLeft className="h-4 w-4" />
            Order History
          </Link>
        </Button>

        {/* Verifying indicator if redirected from payment checkout */}
        {verifying && (
          <div className="rounded-[var(--radius-md)] bg-cream border border-caramel/30 p-3 mb-4 flex items-center justify-center gap-2 text-xs text-caramel font-medium animate-pulse shadow-xs">
            <Loader2 className="h-4 w-4 animate-spin text-caramel" />
            <span>Checking payment confirmation with Xendit...</span>
          </div>
        )}

        {/* Top Alert Banner: Refunded vs Cancelled vs Paid vs Unpaid */}
        {isRefunded ? (
          <div className="rounded-[var(--radius-lg)] bg-status-refunded-bg border border-status-refunded/20 p-4 mb-6 flex items-center gap-3">
            <RotateCcw className="h-6 w-6 text-status-refunded shrink-0" />
            <div>
              <p className="font-semibold text-status-refunded">Order Refunded</p>
              <p className="text-sm text-status-refunded/80">
                Your payment has been refunded via Xendit.
              </p>
            </div>
          </div>
        ) : isCancelled ? (
          <div className="rounded-[var(--radius-lg)] bg-status-failed-bg border border-status-failed/20 p-4 mb-6 flex items-center gap-3">
            <XCircle className="h-6 w-6 text-status-failed shrink-0" />
            <div>
              <p className="font-semibold text-status-failed">Order Cancelled</p>
              <p className="text-sm text-status-failed/80">
                This order was canceled before payment.
              </p>
            </div>
          </div>
        ) : isPaid ? (
          <div className="rounded-[var(--radius-lg)] bg-status-paid-bg border border-status-paid/20 p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-status-paid shrink-0" />
            <div>
              <p className="font-semibold text-status-paid">Payment Confirmed!</p>
              <p className="text-sm text-status-paid/80">
                Thank you—your order is being prepared for pickup.
              </p>
            </div>
          </div>
        ) : isUnpaidPending ? (
          <div className="rounded-[var(--radius-lg)] bg-status-pending-bg border border-status-pending/20 p-4 mb-6 flex items-center gap-3">
            <Clock className="h-6 w-6 text-status-pending shrink-0" />
            <div>
              <p className="font-semibold text-status-pending">Order Placed!</p>
              <p className="text-sm text-status-pending/80">
                Your order has been received. Payment will be handled separately.
              </p>
            </div>
          </div>
        ) : null}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Order #{order.id}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(order.created_at).toLocaleString("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <Badge variant={badgeVariant} className="gap-1.5 py-1 px-3 text-xs font-semibold">
              <BadgeIcon className="h-3.5 w-3.5" />
              {badgeLabel}
            </Badge>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Items */}
            <div className="space-y-3">
              {order.items?.map((item) => {
                const variantText = [item.size, item.temperature].filter(Boolean).join(" • ");
                return (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="text-sm font-medium text-espresso">
                        {item.name}
                      </span>
                      {variantText && (
                        <span className="text-[11px] font-semibold text-caramel bg-caramel/10 px-2 py-0.5 rounded-full self-start">
                          {variantText}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        × {item.quantity}
                      </span>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-espresso">
                      {formatPHP(item.line_total)}
                    </span>
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Pickup Time & Customer Order Note */}
            {(order.pickup_time || order.order_note) && (
              <>
                <div className="rounded-[var(--radius-md)] bg-[#FAF6F0] border border-border/80 p-3.5 space-y-1.5 text-xs">
                  {order.pickup_time && (
                    <div className="flex items-center justify-between text-espresso">
                      <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-caramel" />
                        Requested Pickup Time:
                      </span>
                      <span className="font-semibold text-caramel-dark">{order.pickup_time}</span>
                    </div>
                  )}
                  {order.order_note && (
                    <div className="pt-1 border-t border-border/50 space-y-0.5">
                      <span className="text-muted-foreground font-medium block">
                        Order / Pickup Note:
                      </span>
                      <p className="text-espresso font-medium whitespace-pre-wrap leading-relaxed">
                        {order.order_note}
                      </p>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPHP(order.subtotal)}</span>
              </div>
              {Boolean(order.free_treat_redeemed && parseFloat(order.discount_amount || 0) > 0) && (
                <div className="flex justify-between text-sm text-status-paid font-medium">
                  <span>Stamp Card Free Treat</span>
                  <span className="tabular-nums">-{formatPHP(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-espresso text-lg">
                <span>Total</span>
                <span>{formatPHP(order.total)}</span>
              </div>
            </div>

            {/* Payment Section: Refunded vs Paid confirmation vs Pay Now button */}
            {isRefunded ? (
              <div className="rounded-[var(--radius-md)] bg-status-refunded-bg/60 border border-status-refunded/30 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-5 w-5 text-status-refunded shrink-0" />
                  <div>
                    <p className="font-semibold text-xs text-status-refunded uppercase tracking-wide">
                      Payment Refunded
                    </p>
                    <p className="text-sm font-medium text-espresso">
                      Refunded via Xendit
                      {order.payment?.reference_number ? (
                        <span className="text-xs text-muted-foreground ml-2 font-mono">
                          • Ref: {order.payment.reference_number}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <Badge variant="refunded" className="font-medium text-xs px-2.5 py-0.5">
                  Refunded
                </Badge>
              </div>
            ) : isPaid ? (
              <div className="space-y-3 pt-2">
                <div className="rounded-[var(--radius-md)] bg-status-paid-bg/60 border border-status-paid/30 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-status-paid shrink-0" />
                    <div>
                      <p className="font-semibold text-xs text-status-paid uppercase tracking-wide">
                        Payment Confirmed
                      </p>
                      <p className="text-sm font-medium text-espresso">
                        Paid via Xendit
                        {order.payment?.reference_number ? (
                          <span className="text-xs text-muted-foreground ml-2 font-mono">
                            • Ref: {order.payment.reference_number}
                          </span>
                        ) : null}
                      </p>
                      {order.payment?.paid_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(order.payment.paid_at).toLocaleString("en-PH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="paid" className="bg-status-paid text-white border-0 font-medium text-xs px-2.5 py-0.5">
                    Paid
                  </Badge>
                </div>

                {/* Informational note for paid orders */}
                <p className="text-xs text-muted-foreground text-center bg-latte/40 rounded-[var(--radius-md)] p-2.5 border border-border/60">
                  Paid orders cannot be canceled online once preparation begins. Please contact the café directly for urgent concerns.
                </p>
              </div>
            ) : isUnpaidPending ? (
              <div className="space-y-3 pt-2">
                {payError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{payError}</span>
                  </div>
                )}
                <Button
                  className="w-full py-6 rounded-full bg-gradient-to-r from-[#D4883E] to-[#B86E2A] hover:brightness-110 text-white font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer"
                  onClick={handlePayOrder}
                  disabled={payLoading || verifying}
                >
                  {payLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Redirecting to Payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5 mr-2" />
                      Pay Now with Xendit ({formatPHP(order.total)})
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Pay securely online via credit/debit card, GCash, or Maya, or pay at the café counter upon pickup.
                </p>
              </div>
            ) : null}

            <Separator />

            {/* Navigation buttons */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <Link to="/menu">Order More</Link>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link to="/orders">All Orders</Link>
              </Button>
            </div>

            {/* Cancel Order button for unpaid pending orders */}
            {canCancel && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setCancelDialogOpen(true)}
                  className="text-xs font-medium text-muted-foreground hover:text-destructive hover:underline transition-colors cursor-pointer py-1 px-3"
                >
                  Cancel Order
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog for Order Cancellation */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg text-espresso">
              Cancel Order #{order.id}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              Are you sure you want to cancel this order?
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            This order has not been paid yet. Cancelling will release any reserved items and close this order. This action cannot be undone.
          </p>

          {cancelError && (
            <div className="rounded-[var(--radius-md)] bg-status-failed-bg p-2.5 text-xs text-status-failed">
              {cancelError}
            </div>
          )}

          <DialogFooter className="flex flex-row gap-2 justify-end sm:justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelling}
              className="cursor-pointer"
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="cursor-pointer"
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
