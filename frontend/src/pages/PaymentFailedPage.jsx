import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  XCircle,
  Clock,
  Loader2,
  Home,
  RotateCw,
} from "lucide-react";

export default function PaymentFailedPage() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("payment_id");

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      return;
    }
    api
      .get(`/api/payments/${paymentId}/status/`)
      .then(setPayment)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [paymentId]);

  const handleRetry = async () => {
    if (!payment) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const checkoutType = payment.order ? "order" : "reservation";
      const checkoutId = payment.order || payment.reservation;
      const data = await api.post("/api/payments/checkout/", {
        type: checkoutType,
        id: checkoutId,
      });
      window.location.href = data.invoice_url;
    } catch (err) {
      const msg = err?.data?.detail || "Unable to retry payment. Please try again later.";
      setRetryError(msg);
      setRetrying(false);
    }
  };

  const isExpired = payment?.status === "expired";
  const title = isExpired ? "Payment Expired" : "Payment Failed";
  const description = isExpired
    ? "Your payment window has expired. You can try again to complete your purchase."
    : "Something went wrong with your payment. Please try again or contact us for help.";

  if (loading) {
    return (
      <div className="bg-cream min-h-screen py-16 px-4 flex items-center justify-center">
        <Card className="max-w-md w-full bg-white rounded-3xl shadow-card border-border/80">
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-14 w-14 rounded-full mx-auto" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen py-10 md:py-16 px-4">
      <div className="mx-auto max-w-lg">
        <Card className="bg-white rounded-3xl shadow-xl border-border/80 overflow-hidden">
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-8 text-center text-white space-y-3">
            <div className="mx-auto h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
              {isExpired ? (
                <Clock className="h-9 w-9 text-white" />
              ) : (
                <XCircle className="h-9 w-9 text-white" />
              )}
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold">
              {title}
            </h1>
            <p className="text-white/80 text-sm max-w-sm mx-auto">
              {description}
            </p>
          </div>

          <CardContent className="p-6 md:p-8 space-y-5">
            {payment && (
              <div className="rounded-2xl bg-cream/60 border border-border/80 p-5 space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">Reference</span>
                  <span className="font-mono text-xs font-semibold text-espresso">
                    {payment.reference_number}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">Amount</span>
                  <span className="font-heading text-lg font-bold text-espresso">
                    {formatPHP(payment.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">Status</span>
                  <span className="text-xs font-semibold text-red-600 uppercase">
                    {payment.status}
                  </span>
                </div>
              </div>
            )}

            {retryError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {retryError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleRetry}
                disabled={retrying || !payment}
                className="flex-1"
              >
                {retrying ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RotateCw className="h-4 w-4 mr-2" />
                )}
                Try Again
              </Button>
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
