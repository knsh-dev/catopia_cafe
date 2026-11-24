import { useCart } from "@/context/CartContext";
import { formatPHP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingBag, Cat, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function CartPopover({ onClose }) {
  const { items, updateQuantity, removeItem, totalItems, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="w-80 p-6 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-latte/60 flex items-center justify-center text-caramel">
          <Cat className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <p className="font-heading font-semibold text-espresso text-base">Your Cart is Empty</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            No treats in your cart yet! Add some cozy brews or warm pastries from our menu.
          </p>
        </div>
        <Button size="sm" className="w-full bg-caramel hover:bg-caramel-dark text-white rounded-full" asChild>
          <Link to="/menu" onClick={onClose}>
            Browse Menu
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-84 sm:w-92">
      {/* Header */}
      <div className="p-4 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-caramel" />
          <p className="font-heading font-semibold text-sm text-espresso">
            Your Cart
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-caramel/10 text-caramel">
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Item List */}
      <div className="max-h-72 overflow-y-auto divide-y divide-border/40 p-2">
        {items.map((item) => {
          const itemKey = item.cartKey || item.id;
          const variantText = [item.size, item.temperature].filter(Boolean).join(" • ");
          const displayPrice = item.unitPrice != null ? item.unitPrice : item.price;

          return (
            <div key={itemKey} className="flex gap-3 p-2.5 items-center">
              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-latte/30 shrink-0 border border-border/40">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    ☕
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-espresso truncate">{item.name}</p>
                {variantText && (
                  <p className="text-[11px] text-muted-foreground font-medium truncate">
                    {variantText}
                  </p>
                )}
                <p className="text-xs text-caramel font-semibold mt-0.5">{formatPHP(displayPrice)}</p>

                {/* Quantity controls */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                    className="h-6 w-6 flex items-center justify-center rounded-md border border-border bg-white hover:bg-latte text-espresso transition-colors cursor-pointer active:scale-95"
                    aria-label={`Decrease ${item.name} quantity`}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-semibold tabular-nums text-espresso">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                    className="h-6 w-6 flex items-center justify-center rounded-md border border-border bg-white hover:bg-latte text-espresso transition-colors cursor-pointer active:scale-95"
                    aria-label={`Increase ${item.name} quantity`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(itemKey)}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors ml-auto cursor-pointer"
                    aria-label={`Remove ${item.name} from cart`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Footer Subtotal & Checkout */}
      <div className="p-4 space-y-3 bg-cream/30 rounded-b-2xl">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground font-medium">Subtotal</span>
          <span className="font-bold text-espresso text-base">{formatPHP(subtotal)}</span>
        </div>
        <Button className="w-full bg-caramel hover:bg-caramel-dark text-white rounded-full font-medium shadow-sm flex items-center justify-center gap-2" size="sm" asChild>
          <Link to="/checkout" onClick={onClose}>
            <span>Proceed to Checkout</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
