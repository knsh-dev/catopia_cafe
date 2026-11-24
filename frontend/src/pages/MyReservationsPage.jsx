import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  Clock,
  Users,
  Cat,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  Sparkles,
  Info,
  CreditCard,
  Receipt,
} from "lucide-react";

// Format 24-hr time string (e.g. "10:00:00" or "10:00") to 12-hr format (e.g. "10:00 AM")
function formatTime(timeStr) {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  let h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// Format date string "YYYY-MM-DD" to human readable format
function formatFullDate(isoString) {
  if (!isoString) return "";
  const [year, month, day] = isoString.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Status config mapping
const STATUS_CONFIG = {
  pending_payment: {
    label: "Pending Payment",
    classes: "bg-amber-100 text-amber-800 border-amber-300",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    classes: "bg-green-100 text-green-800 border-green-300",
    icon: CheckCircle,
  },
  completed: {
    label: "Completed",
    classes: "bg-blue-100 text-blue-800 border-blue-300",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Cancelled",
    classes: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle,
  },
  rescheduled: {
    label: "Rescheduled",
    classes: "bg-purple-100 text-purple-800 border-purple-300",
    icon: Sparkles,
  },
};

export default function MyReservationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [cancelError, setCancelError] = useState({});
  const [payingId, setPayingId] = useState(null);
  const [payError, setPayError] = useState({});

  const fetchReservations = useCallback(async () => {
    if (!user) {
      setReservations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/catroom/reservations/?mine=true");
      let list = Array.isArray(data) ? data : (data?.results || []);

      // Verify any pending_payment reservations with Xendit in the background
      const pendingItems = list.filter((r) => r.status === "pending_payment");
      if (pendingItems.length > 0) {
        const verifiedMap = new Map();
        await Promise.all(
          pendingItems.map(async (r) => {
            try {
              const updated = await api.post(`/api/catroom/reservations/${r.id}/verify-payment/`);
              if (updated?.id) verifiedMap.set(updated.id, updated);
            } catch {}
          })
        );
        if (verifiedMap.size > 0) {
          list = list.map((r) => verifiedMap.get(r.id) || r);
        }
      }

      // Sort newest date & slot first
      list.sort((a, b) => {
        const dateComp = new Date(b.date) - new Date(a.date);
        if (dateComp !== 0) return dateComp;
        return (b.slot_start || "").localeCompare(a.slot_start || "");
      });
      setReservations(list);
      if (user?.id) {
        try {
          localStorage.setItem(`reservations_${user.id}`, JSON.stringify(list));
        } catch {}
      }
    } catch (err) {
      console.error("Error fetching reservations:", err);
      setError("Unable to load your reservations. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      try {
        const cached = localStorage.getItem(`reservations_${user.id}`);
        setReservations(cached ? JSON.parse(cached) : []);
      } catch {
        setReservations([]);
      }
      fetchReservations();
    } else if (!authLoading && !user) {
      setReservations([]);
      setLoading(false);
    }
  }, [user?.id, authLoading, fetchReservations]);

  // Listen for global auth-change (logout or account switch)
  useEffect(() => {
    const handleAuthChange = () => {
      setReservations([]);
      setError(null);
    };
    window.addEventListener("catopia:auth-change", handleAuthChange);
    return () => window.removeEventListener("catopia:auth-change", handleAuthChange);
  }, []);

  const handleCancelReservation = async (reservationId) => {
    setCancellingId(reservationId);
    setCancelError((prev) => ({ ...prev, [reservationId]: null }));
    try {
      const updated = await api.post(`/api/catroom/reservations/${reservationId}/cancel/`);
      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, ...updated, status: "cancelled" } : r))
      );
      setCancelConfirmId(null);
      window.dispatchEvent(new CustomEvent("catopia:reservation-change"));
    } catch (err) {
      console.error("Error cancelling reservation:", err);
      const msg =
        err?.data?.detail ||
        err?.message ||
        "Could not cancel this reservation. Cutoff hours may apply.";
      setCancelError((prev) => ({ ...prev, [reservationId]: msg }));
    } finally {
      setCancellingId(null);
    }
  };

  const handlePayReservation = async (reservationId) => {
    setPayingId(reservationId);
    setPayError((prev) => ({ ...prev, [reservationId]: null }));
    try {
      const data = await api.post("/api/payments/checkout/", {
        type: "reservation",
        id: reservationId,
      });
      if (data?.status === "paid" && data?.payment_id) {
        navigate(`/payment/success?payment_id=${data.payment_id}`);
        return;
      }
      if (data?.invoice_url) {
        window.location.href = data.invoice_url;
      } else {
        throw new Error("No invoice URL returned");
      }
    } catch (err) {
      console.error("Error initiating reservation payment:", err);
      const msg =
        err?.data?.detail ||
        err?.message ||
        "Could not initiate payment. The hold may have expired.";
      setPayError((prev) => ({ ...prev, [reservationId]: msg }));
      setPayingId(null);
    }
  };

  // 1. Login Guard
  if (!authLoading && !user) {
    return (
      <div className="bg-cream min-h-screen py-16 px-4 flex items-center justify-center">
        <Card className="max-w-md w-full bg-white border-border/80 rounded-2xl shadow-card p-8 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-latte/60 flex items-center justify-center text-caramel">
            <Cat className="h-8 w-8" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-espresso">
            My Reservations
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please log in with your Catopia account to view and manage your Cat Room reservations.
          </p>
          <div className="pt-2">
            <Button
              className="w-full"
              onClick={() => navigate("/login?redirect=/reservations")}
            >
              Sign In to View Reservations
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen py-8 md:py-12">
      <div className="mx-auto max-w-[var(--container-md)] px-4 md:px-6 space-y-6">
        {/* Header / Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="inline-flex items-center gap-1.5 text-caramel text-xs font-semibold uppercase tracking-wider mb-1">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Sanctuary Bookings</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-espresso tracking-tight">
              My Reservations
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage your upcoming visits and view past sessions in the Cat Room.
            </p>
          </div>

          <Button
            asChild
            className="shadow-sm hover:shadow-md shrink-0 self-start sm:self-auto"
          >
            <Link to="/catroom">
              <Sparkles className="h-4 w-4 mr-1.5" />
              Book New Session
            </Link>
          </Button>
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && reservations.length === 0 && (
          <Card className="bg-white border-border/80 rounded-2xl shadow-card p-10 md:p-14 text-center space-y-4">
            <div className="mx-auto h-20 w-20 rounded-full bg-latte/60 flex items-center justify-center text-caramel shadow-inner">
              <Cat className="h-10 w-10" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h2 className="font-heading text-2xl font-bold text-espresso">
                No Reservations Yet
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You haven&apos;t reserved any cozy hours in the Cat Room yet. Come spend time with our resident rescue cats!
              </p>
            </div>
            <div className="pt-3">
              <Button size="lg" asChild className="shadow-md hover:shadow-lg">
                <Link to="/catroom">
                  <span>Book a Cozy Hour</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </Card>
        )}

        {/* Reservations List */}
        {!loading && reservations.length > 0 && (
          <div className="space-y-4">
            {reservations.map((reservation) => {
              const statusInfo = STATUS_CONFIG[reservation.status] || {
                label: reservation.status,
                classes: "bg-latte text-espresso border-border",
                icon: Info,
              };
              const StatusIcon = statusInfo.icon;

              const isCancellable =
                reservation.status === "pending_payment" ||
                reservation.status === "confirmed";

              const feeNum = parseFloat(reservation.fee || 0);
              const dueNum = parseFloat(reservation.amount_due || 0);
              const balanceNum = Math.max(0, feeNum - dueNum);

              return (
                <Card
                  key={reservation.id}
                  className="bg-white border-border/80 rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden"
                >
                  <CardContent className="p-5 md:p-6 space-y-4">
                    {/* Top Row: Reference, Date, Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-cream text-caramel border border-caramel/30">
                          #CR-{reservation.id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Booked on {new Date(reservation.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.classes}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          <span>{statusInfo.label}</span>
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Session Info & Pricing Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs md:text-sm">
                      {/* Date */}
                      <div className="flex items-start gap-2.5">
                        <CalendarDays className="h-4 w-4 text-caramel shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase font-medium">
                            Date
                          </p>
                          <p className="font-semibold text-espresso">
                            {formatFullDate(reservation.date)}
                          </p>
                        </div>
                      </div>

                      {/* Time */}
                      <div className="flex items-start gap-2.5">
                        <Clock className="h-4 w-4 text-caramel shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase font-medium">
                            Time Slot
                          </p>
                          <p className="font-semibold text-espresso">
                            {formatTime(reservation.slot_start)} -{" "}
                            {formatTime(reservation.slot_end)}
                          </p>
                        </div>
                      </div>

                      {/* Guests */}
                      <div className="flex items-start gap-2.5">
                        <Users className="h-4 w-4 text-caramel shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase font-medium">
                            Guests
                          </p>
                          <p className="font-semibold text-espresso">
                            {reservation.visitors}{" "}
                            {reservation.visitors === 1 ? "Visitor" : "Visitors"}
                          </p>
                        </div>
                      </div>

                      {/* Fee & Payment Option */}
                      <div className="flex items-start gap-2.5">
                        <Cat className="h-4 w-4 text-caramel shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase font-medium">
                            Payment Plan
                          </p>
                          <p className="font-semibold text-espresso capitalize">
                            {reservation.payment_option === "deposit"
                              ? "Deposit Plan"
                              : "Full Payment"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-latte/30 border border-border/70 text-xs">
                      <div className="flex flex-wrap items-center gap-6">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">
                            Session Fee
                          </span>
                          <span className="font-semibold text-espresso text-sm">
                            {formatPHP(reservation.fee)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">
                            Amount Due / Paid
                          </span>
                          <span className="font-semibold text-caramel text-sm">
                            {formatPHP(reservation.amount_due)}
                          </span>
                        </div>
                        {reservation.payment_option === "deposit" && (
                          <div>
                            <span className="text-muted-foreground block text-[11px]">
                              Balance on Arrival
                            </span>
                            <span className="font-semibold text-espresso text-sm">
                              {formatPHP(balanceNum)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Pending payment notice */}
                      {reservation.status === "pending_payment" && reservation.hold_expires_at && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                          <span>Hold expires {new Date(reservation.hold_expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>

                    {/* Cancellation Error Alert if any */}
                    {cancelError[reservation.id] && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{cancelError[reservation.id]}</span>
                      </div>
                    )}

                    {/* Payment Error Alert if any */}
                    {payError[reservation.id] && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{payError[reservation.id]}</span>
                      </div>
                    )}

                    {/* Bottom Action Strip: Receipt, Pay Now & Cancel Buttons */}
                    {(isCancellable || reservation.receipt?.payment_id) && (
                      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                        {reservation.receipt?.payment_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="rounded-full text-xs"
                          >
                            <Link to={`/payment/${reservation.receipt.payment_id}/receipt`}>
                              <Receipt className="h-3.5 w-3.5 mr-1.5 text-caramel" />
                              View Receipt
                            </Link>
                          </Button>
                        )}
                        {isCancellable && reservation.status === "pending_payment" && (
                          <Button
                            size="sm"
                            className="bg-caramel hover:bg-caramel-dark text-white rounded-full shadow-xs"
                            disabled={payingId === reservation.id}
                            onClick={() => handlePayReservation(reservation.id)}
                          >
                            {payingId === reservation.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                Redirecting...
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                Pay Now ({formatPHP(reservation.amount_due)})
                              </>
                            )}
                          </Button>
                        )}

                        {isCancellable && (cancelConfirmId === reservation.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Are you sure you want to cancel?
                            </span>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={cancellingId === reservation.id}
                              onClick={() => handleCancelReservation(reservation.id)}
                            >
                              {cancellingId === reservation.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : null}
                              Yes, Cancel
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={cancellingId === reservation.id}
                              onClick={() => setCancelConfirmId(null)}
                            >
                              Keep
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setCancelConfirmId(reservation.id)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                            Cancel Reservation
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
