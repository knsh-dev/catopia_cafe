import { Link } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { useAuth } from "@/context/AuthContext";
import { formatPHP } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, ArrowRight, ShoppingBag } from "lucide-react";

const STATUS_VARIANT = {
  pending: "pending",
  confirmed: "paid",
  preparing: "paid",
  ready: "paid",
  completed: "paid",
  cancelled: "failed",
  refunded: "refunded",
};

export default function OrdersPage() {
  const { user } = useAuth();
  const { data, loading, error } = useFetch("/api/orders/?mine=true", {
    enabled: !!user,
    deps: [user?.id],
  });

  const orders = data?.results || [];

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-cream px-4">
        <div className="text-center space-y-3">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="font-heading text-2xl font-bold text-espresso">Order History</h1>
          <p className="text-muted-foreground">Please log in to view your orders.</p>
          <Button asChild>
            <Link to="/login?redirect=/orders">Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen py-8">
      <div className="mx-auto max-w-2xl px-4">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-espresso mb-6">
          Order History
        </h1>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-[var(--radius-lg)]" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Unable to load orders. Please try again.</p>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="font-heading text-xl font-semibold text-espresso">No Orders Yet</h2>
            <p className="text-muted-foreground">Your order history will appear here.</p>
            <Button asChild>
              <Link to="/menu">Browse Menu</Link>
            </Button>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link key={order.id} to={`/orders/${order.id}`}>
                <Card className="hover:shadow-card-hover transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-espresso">Order #{order.id}</span>
                        <Badge
                          variant={
                            (order.payment_status || order.paymentStatus || "").toUpperCase() === "REFUNDED" ||
                            order.status === "refunded"
                              ? "refunded"
                              : STATUS_VARIANT[order.status] || "secondary"
                          }
                          className="capitalize text-xs font-semibold"
                        >
                          {(order.payment_status || order.paymentStatus || "").toUpperCase() === "REFUNDED" ||
                          order.status === "refunded"
                            ? "Refunded"
                            : order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString("en-PH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {" · "}
                        {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-caramel">
                        {formatPHP(order.total)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
