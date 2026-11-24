import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Printer,
  ArrowLeft,
  CheckCircle,
  Cat,
} from "lucide-react";

function formatReceiptAmount(amount) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num == null || isNaN(num)) return "PHP 0.00";
  return `PHP ${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ReceiptPage() {
  const { paymentId } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/api/payments/${paymentId}/receipt/`)
      .then(setReceipt)
      .catch((err) => {
        setError(err?.data?.detail || "Unable to load receipt.");
      })
      .finally(() => setLoading(false));
  }, [paymentId]);

  if (loading) {
    return (
      <div className="bg-cream min-h-screen py-10 px-4">
        <div className="mx-auto max-w-lg space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-cream min-h-screen py-16 px-4 flex items-center justify-center">
        <Card className="max-w-md w-full bg-white rounded-3xl shadow-card">
          <CardContent className="p-8 text-center space-y-4">
            <h1 className="font-heading text-xl font-bold text-espresso">
              Receipt Unavailable
            </h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOrder = !!receipt.order_items;
  const isReservation = !!receipt.reservation_details;

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-card, #receipt-card * { visibility: visible; }
          #receipt-card {
            position: absolute; left: 0; top: 0;
            width: 100%; max-width: 100%;
            box-shadow: none; border: none; border-radius: 0;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="bg-cream min-h-screen py-8 md:py-12 px-4">
        <div className="mx-auto max-w-lg">
          <Button variant="ghost" size="sm" asChild className="mb-4 no-print">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Link>
          </Button>

          <Card
            id="receipt-card"
            className="bg-white rounded-3xl shadow-xl border-border/80 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#2D221B] p-6 md:p-8 text-center text-white">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Cat className="h-6 w-6 text-caramel" />
                <span className="font-heading text-xl font-bold tracking-wide">
                  Catopia Caf&eacute;
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span className="font-semibold">Payment Receipt</span>
              </div>
            </div>

            <CardContent className="p-6 md:p-8 space-y-5">
              {/* Receipt meta */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Receipt No.</span>
                  <span className="font-mono font-bold text-caramel">
                    {receipt.receipt_number}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block">Date</span>
                  <span className="font-medium text-espresso">
                    {receipt.paid_at
                      ? new Date(receipt.paid_at).toLocaleString("en-PH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Reference</span>
                  <span className="font-mono text-[11px] font-semibold text-espresso">
                    {receipt.reference_number}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block">Transaction ID</span>
                  <span className="font-mono text-[11px] font-semibold text-espresso">
                    {String(receipt.transaction_id).slice(0, 13)}...
                  </span>
                </div>
              </div>

              <Separator />

              {/* Order Items */}
              {isOrder && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-espresso">Order Items</h3>
                  <div className="space-y-2">
                    {receipt.order_items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-espresso font-medium">{item.name}</span>
                          <span className="text-muted-foreground text-xs">
                            x{item.quantity}
                          </span>
                        </div>
                        <span className="font-medium tabular-nums text-espresso">
                          {formatPHP(item.line_total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reservation Details */}
              {isReservation && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-espresso">
                    Cat Room Reservation
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium text-espresso">
                        {receipt.reservation_details.date}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time Slot</span>
                      <span className="font-medium text-espresso">
                        {receipt.reservation_details.slot_start} &ndash;{" "}
                        {receipt.reservation_details.slot_end}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Visitors</span>
                      <span className="font-medium text-espresso">
                        {receipt.reservation_details.visitors}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Session Fee</span>
                      <span className="font-medium text-espresso">
                        {formatPHP(receipt.reservation_details.fee)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Plan</span>
                      <span className="font-medium text-espresso capitalize">
                        {receipt.reservation_details.payment_option === "deposit"
                          ? "50% Deposit"
                          : "Full Payment"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Total */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-medium text-espresso capitalize">
                    {receipt.method || "Xendit"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-espresso">Total Paid</span>
                  <span className="font-heading text-2xl font-bold text-caramel">
                    {formatReceiptAmount(receipt.amount)}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Footer */}
              <p className="text-center text-xs text-muted-foreground">
                Thank you for visiting Catopia Caf&eacute;!
                <br />
                Coffee for the humans, chin scratches for the cats.
              </p>

              {/* Print button */}
              <Button
                className="w-full no-print"
                variant="outline"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
