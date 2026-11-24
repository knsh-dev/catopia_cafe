import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Loader2,
  Clock,
  Receipt,
  Home,
  AlertCircle,
  CalendarDays,
  ShoppingBag,
} from "lucide-react";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = searchParams.get("payment_id");

  const [payment, setPayment] = useState(null);
  const [polling, setPolling] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    if (!paymentId) {
      setPolling(false);
      setError("No payment ID provided.");
      return;
    }

    let attempts = 0;
    const maxAttempts = 20;

    const poll = async () => {
      if (stoppedRef.current) return;

      try {
        const data = await api.get(`/api/payments/${paymentId}/status/`, {
          timeout: 25000,
        });
        if (stoppedRef.current) return;

        setPayment(data);
        setError(null);

        if (data.status === "paid") {
          stoppedRef.current = true;
          setPolling(false);
          window.dispatchEvent(new CustomEvent("catopia:reservation-change"));
          return;
        }

        if (data.status === "failed" || data.status === "expired") {
          stoppedRef.current = true;
          setPolling(false);
          navigate(`/payment/failed?payment_id=${paymentId}`, { replace: true });
          return;
        }
      } catch (err) {
        if (stoppedRef.current) return;
        // Only abort immediately on 404 Not Found; retry transient errors
        if (err?.status === 404) {
          stoppedRef.current = true;
          setPolling(false);
          setError("Payment record not found.");
          return;
        }
      }

      attempts += 1;
      setPollCount(attempts);

      if (attempts >= maxAttempts) {
        stoppedRef.current = true;
        setPolling(false);
        return;
      }

      if (!stoppedRef.current) {
        timeoutRef.current = setTimeout(poll, 2500);
      }
    };

    poll();

    return () => {
      stoppedRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [paymentId, navigate]);

  if (error && (!payment || payment.status !== "paid")) {
    return (
      <div className="bg-cream min-h-screen py-16 px-4 flex items-center justify-center">
        <Card className="max-w-md w-full bg-white rounded-3xl shadow-card border-border/80">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-red-500" />
            </div>
            <h1 className="font-heading text-xl font-bold text-espresso">Error</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button asChild className="w-full">
              <Link to="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (polling) {
    return (
      <div className="bg-cream min-h-screen py-16 px-4 flex items-center justify-center">
        <Card className="max-w-md w-full bg-white rounded-3xl shadow-card border-border/80">
          <CardContent className="p-10 text-center space-y-5">
            <div className="mx-auto h-16 w-16 rounded-full bg-caramel/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-caramel animate-spin" />
            </div>
            <h1 className="font-heading text-xl font-bold text-espresso">
              Verifying your payment...
            </h1>
            <p className="text-sm text-muted-foreground">
              Please wait while we confirm your payment with Xendit.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Checking... ({pollCount}/20)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Still pending after max polls
  if (!payment || payment.status !== "paid") {
    return (
      <div className="bg-cream min-h-screen py-16 px-4 flex items-center justify-center">
        <Card className="max-w-md w-full bg-white rounded-3xl shadow-card border-border/80">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="h-7 w-7 text-amber-600" />
            </div>
            <h1 className="font-heading text-xl font-bold text-espresso">
              Payment is Being Processed
            </h1>
            <p className="text-sm text-muted-foreground">
              Your payment is still being verified. This may take a few moments.
              Check your reservations or orders page for updated status.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button asChild className="flex-1">
                <Link to="/reservations">My Reservations</Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link to="/orders">My Orders</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Payment confirmed!
  return (
    <div className="bg-cream min-h-screen py-10 md:py-16 px-4">
      <div className="mx-auto max-w-lg">
        <Card className="bg-white rounded-3xl shadow-xl border-border/80 overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 text-center text-white space-y-3">
            <div className="mx-auto h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle className="h-9 w-9 text-white" />
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold">
              Payment Successful!
            </h1>
            <p className="text-white/80 text-sm">
              Your payment has been confirmed. Thank you for your purchase!
            </p>
          </div>

          <CardContent className="p-6 md:p-8 space-y-5">
            <div className="rounded-2xl bg-cream/60 border border-border/80 p-5 space-y-3 text-sm">
              {payment.receipt_number && (
                <div className="flex justify-between items-center pb-2 border-b border-border/60">
                  <span className="text-muted-foreground text-xs">Receipt Number</span>
                  <span className="font-mono font-bold text-caramel">
                    {payment.receipt_number}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Reference</span>
                <span className="font-mono text-xs font-semibold text-espresso">
                  {payment.reference_number}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Amount Paid</span>
                <span className="font-heading text-xl font-bold text-caramel">
                  {formatPHP(payment.amount)}
                </span>
              </div>
              {payment.paid_at && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">Paid At</span>
                  <span className="text-xs font-medium text-espresso">
                    {new Date(payment.paid_at).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1">
                <Link to={`/payment/${payment.id}/receipt`}>
                  <Receipt className="h-4 w-4 mr-2" />
                  View Receipt
                </Link>
              </Button>
              {(payment.reservation || payment.payment_type === "reservation") && (
                <Button variant="outline" asChild className="flex-1">
                  <Link to="/reservations">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    My Reservations
                  </Link>
                </Button>
              )}
              {payment.order && (
                <Button variant="outline" asChild className="flex-1">
                  <Link to={`/orders/${payment.order}`}>
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    View Order
                  </Link>
                </Button>
              )}
              <Button variant="outline" asChild className="flex-1">
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
