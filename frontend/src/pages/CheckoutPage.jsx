import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { getMenuItemImageUrl } from "@/lib/menuImages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  Loader2,
  ArrowLeft,
  LogIn,
  Store,
  Clock,
  MapPin,
  User,
  Phone,
  FileText,
  Sparkles,
  AlertCircle,
  Crown,
} from "lucide-react";

export default function CheckoutPage() {
  const { items, updateQuantity, removeItem, totalItems, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  // Storefront pickup options
  const [pickupTiming, setPickupTiming] = useState("asap");
  const [scheduledSlot, setScheduledSlot] = useState("30");
  const [contactPhone, setContactPhone] = useState(
    user?.phone || user?.profile?.phone || ""
  );
  const [orderNote, setOrderNote] = useState("");

  // Stamp card free treat redemption state
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [redeemFreeTreat, setRedeemFreeTreat] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState(null);

  useEffect(() => {
    if (user) {
      api
        .get("/api/users/me/loyalty/")
        .then((data) => setLoyaltyData(data))
        .catch(() => {});
    }
  }, [user]);

  const customerName =
    user?.full_name ||
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.username ||
    "Demo Customer";

  // Stamp progress & treat eligibility
  const stampsCount =
    loyaltyData?.stamp_card?.stamps_count ??
    loyaltyData?.stamp_card?.stampsCount ??
    user?.profile?.stamps_count ??
    user?.stamps_count ??
    0;

  const freeTreatsAvailable =
    loyaltyData?.stamp_card?.free_treats_available ??
    loyaltyData?.stamp_card?.freeTreatsAvailable ??
    user?.profile?.free_treats_available ??
    user?.free_treats_available ??
    0;

  const hasFreeTreatEligible = freeTreatsAvailable > 0 || stampsCount >= 10;

  // Qualifying items in cart: drinks, pastries, food (exclude retail merch like mugs)
  const qualifyingItems = items.filter((item) => {
    if (item.category) {
      return ["coffee", "non_coffee_tea", "pastries", "light_bites"].includes(item.category);
    }
    const lower = item.name.toLowerCase();
    return !lower.includes("mug") && !lower.includes("merch") && !lower.includes("tote");
  });

  const hasQualifyingItem = qualifyingItems.length > 0;
  const canRedeemTreat = hasFreeTreatEligible && hasQualifyingItem;

  // Lowest-priced qualifying item for discount
  const eligibleTreatItem = hasQualifyingItem
    ? [...qualifyingItems].sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0]
    : null;

  const treatDiscount =
    eligibleTreatItem && canRedeemTreat && redeemFreeTreat
      ? Math.min(175, parseFloat(eligibleTreatItem.price))
      : 0;

  // User tier & multiplier for Paw Points calculation
  const userLifetimePoints =
    loyaltyData?.lifetime_paw_points ??
    loyaltyData?.lifetimePawPoints ??
    user?.profile?.lifetime_paw_points ??
    user?.lifetime_paw_points ??
    0;

  const isTubby = userLifetimePoints >= 2500;
  const isTabby = userLifetimePoints >= 800 && !isTubby;
  const tierMultiplier = isTubby ? 1.5 : isTabby ? 1.25 : 1.0;
  const userTierName = isTubby ? "Tubby Club" : isTabby ? "Tabby Club" : "Kitten";

  // High-Margin Member Perks:
  // Tabby Club: Free Drink Customization (-₱30) on 1 drink
  // Tubby Club: Free Drink Size Upgrade & Add-on (-₱50) on 1 drink
  const drinkItems = items.filter((i) =>
    i.category
      ? ["coffee", "non_coffee_tea"].includes(i.category)
      : i.name.toLowerCase().includes("latte") ||
        i.name.toLowerCase().includes("espresso") ||
        i.name.toLowerCase().includes("tea")
  );

  let perkDiscount = 0;
  let perkLabel = "";
  if (drinkItems.length > 0) {
    const targetDrink = drinkItems[0];
    if (isTubby) {
      perkDiscount = Math.min(50, parseFloat(targetDrink.price));
      perkLabel = "Tubby Club Perk: Free Drink Upgrade & Add-on";
    } else if (isTabby) {
      perkDiscount = Math.min(30, parseFloat(targetDrink.price));
      perkLabel = "Tabby Club Perk: Free Drink Customization";
    }
  }

  // Active loyalty reward vouchers from profile/loyalty endpoint
  const activeVouchers = (loyaltyData?.vouchers || []).filter(
    (v) => v.status === "active" && v.reward_type !== "catroom_50"
  );

  // Check which vouchers match current cart items
  const eligibleVouchers = activeVouchers.filter((vchr) => {
    if (vchr.reward_type === "free_pastry") {
      return items.some((i) => i.category === "pastries");
    }
    if (vchr.reward_type === "free_drink") {
      return items.some((i) => ["coffee", "non_coffee_tea"].includes(i.category));
    }
    if (vchr.reward_type === "free_mug") {
      return items.some(
        (i) => i.category === "merchandise" || i.name.toLowerCase().includes("mug")
      );
    }
    return false;
  });

  const selectedVoucher = eligibleVouchers.find((v) => v.id === selectedVoucherId);

  let voucherDiscount = 0;
  if (selectedVoucher) {
    if (selectedVoucher.reward_type === "free_pastry") {
      const pastries = items.filter((i) => i.category === "pastries");
      if (pastries.length > 0) {
        voucherDiscount = Math.min(...pastries.map((p) => parseFloat(p.price)));
      }
    } else if (selectedVoucher.reward_type === "free_drink") {
      const drinks = items.filter((i) => ["coffee", "non_coffee_tea"].includes(i.category));
      if (drinks.length > 0) {
        voucherDiscount = Math.min(...drinks.map((d) => parseFloat(d.price)));
      }
    } else if (selectedVoucher.reward_type === "free_mug") {
      const mugs = items.filter(
        (i) => i.category === "merchandise" || i.name.toLowerCase().includes("mug")
      );
      if (mugs.length > 0) {
        voucherDiscount = Math.min(...mugs.map((m) => parseFloat(m.price)));
      }
    }
  }

  // Net total & guardrails calculation
  const redemptionDiscount = redeemFreeTreat ? treatDiscount : voucherDiscount;
  const finalTotal = Math.max(0, subtotal - redemptionDiscount - perkDiscount);
  const hasRedemption = Boolean(
    (redeemFreeTreat && treatDiscount > 0) || (selectedVoucher && voucherDiscount > 0)
  );
  const isBelowMinPaidPurchase = hasRedemption && finalTotal < 100;
  const earnedPointsPreview = Math.floor((finalTotal / 10) * tierMultiplier);

  // Toggle Stamp Card Free Treat (No Stacking with vouchers)
  const handleToggleFreeTreat = () => {
    if (!redeemFreeTreat) {
      setSelectedVoucherId(null);
    }
    setRedeemFreeTreat(!redeemFreeTreat);
  };

  // Select Voucher (No Stacking with free treat)
  const handleSelectVoucher = (vId) => {
    if (selectedVoucherId === vId) {
      setSelectedVoucherId(null);
    } else {
      setSelectedVoucherId(vId);
      setRedeemFreeTreat(false);
    }
  };

  const handleCheckout = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setLoading(true);
    try {
      const pickupTimeLabel =
        pickupTiming === "asap"
          ? "ASAP (10–15 mins)"
          : `In ~${scheduledSlot} mins`;

      const payload = {
        items: items.map((i) => ({
          menu_item_id: i.id,
          quantity: i.quantity,
          size: i.size || "",
          temperature: i.temperature || "",
        })),
        redeem_free_treat: Boolean(redeemFreeTreat && canRedeemTreat),
        voucher_id: selectedVoucher ? selectedVoucher.id : null,
        pickup_time: pickupTimeLabel,
        order_note: orderNote.trim(),
        contact_phone: contactPhone.trim(),
      };
      const order = await api.post("/api/orders/", payload);
      clearCart();
      navigate(`/orders/${order.id}`);
    } catch (err) {
      const data = err.data;
      if (data?.items) {
        // Validation errors from the backend
        const msgs = Array.isArray(data.items) ? data.items : [data.items];
        setError(msgs.flat().join(" "));
      } else if (data?.redeem_free_treat) {
        const msgs = Array.isArray(data.redeem_free_treat) ? data.redeem_free_treat : [data.redeem_free_treat];
        setError(msgs.flat().join(" "));
      } else if (typeof data === "string") {
        setError(data);
      } else if (data?.detail) {
        setError(data.detail);
      } else {
        setError("Failed to place order. Please try again.");
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-cream px-4">
        <div className="text-center space-y-4">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="font-heading text-2xl font-bold text-espresso">Your Cart is Empty</h1>
          <p className="text-muted-foreground">Add some items from our menu to get started!</p>
          <Button asChild>
            <Link to="/menu">Browse Menu</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Not logged in: prompt to login
  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-cream px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <LogIn className="h-10 w-10 text-caramel mx-auto mb-2" />
            <CardTitle>Login to Checkout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              You need to be logged in to place an order. Your cart will be waiting for you!
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" asChild>
                <Link to="/login?redirect=/checkout">Login</Link>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link to="/register?redirect=/checkout">Register</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen py-8">
      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/menu">
            <ArrowLeft className="h-4 w-4" />
            Back to Menu
          </Link>
        </Button>

        <h1 className="font-heading text-2xl md:text-3xl font-bold text-espresso mb-6">
          Checkout
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => {
              const itemKey = item.cartKey || item.id;
              const variantText = [item.size, item.temperature].filter(Boolean).join(" • ");
              const itemPrice = item.unitPrice != null ? item.unitPrice : item.price;

              return (
                <Card key={itemKey} className="border-border bg-card shadow-sm">
                  <CardContent className="p-4 flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-[var(--radius-md)] overflow-hidden bg-latte/30 shrink-0 border border-border/40 flex items-center justify-center">
                      {getMenuItemImageUrl(item) ? (
                        <img src={getMenuItemImageUrl(item)} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground text-center px-1">
                          No Image
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-espresso truncate">{item.name}</h3>
                      {variantText && (
                        <p className="text-xs text-muted-foreground font-medium">
                          {variantText}
                        </p>
                      )}
                      <p className="text-sm text-caramel font-semibold">
                        {formatPHP(itemPrice)}
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                        className="h-8 w-8 flex items-center justify-center rounded-[var(--radius-md)] border border-border hover:bg-latte transition-colors cursor-pointer"
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-medium tabular-nums text-espresso">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                        className="h-8 w-8 flex items-center justify-center rounded-[var(--radius-md)] border border-border hover:bg-latte transition-colors cursor-pointer"
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-right min-w-20">
                      <p className="font-semibold text-espresso">
                        {formatPHP(parseFloat(itemPrice) * item.quantity)}
                      </p>
                    </div>

                    <button
                      onClick={() => removeItem(itemKey)}
                      className="p-2 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-[var(--radius-md)] transition-colors cursor-pointer"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Order Summary with In-Store Pickup & Free Treat Redemption */}
          <div>
            <Card className="sticky top-20 border-border bg-card shadow-card">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="font-heading text-xl text-espresso">
                    Order Summary
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="bg-caramel/10 text-caramel-dark border-caramel/25 gap-1 py-1 px-2.5 text-xs font-semibold shrink-0"
                  >
                    <Store className="h-3.5 w-3.5 text-caramel" />
                    In-Store Pickup
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* 1. Fulfillment Header / Badge Info Box */}
                <div className="rounded-[var(--radius-md)] bg-cream border border-border/80 p-3 space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5 text-espresso">
                    <MapPin className="h-4 w-4 text-caramel mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-espresso">Pickup at Catopia Café Counter</p>
                      <p className="text-muted-foreground text-[11px] leading-tight mt-0.5">
                        89-G Barlin St, Sta. Cruz, Naga City
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-espresso pt-2 border-t border-border/60">
                    <Clock className="h-3.5 w-3.5 text-caramel shrink-0" />
                    <span className="text-muted-foreground">
                      Estimated prep time:{" "}
                      <strong className="text-espresso font-semibold">Ready in 10–15 mins</strong>
                    </span>
                  </div>
                </div>

                {/* 2. Pickup Details */}
                <div className="space-y-3">
                  {/* Customer & Contact info */}
                  <div className="rounded-[var(--radius-md)] bg-latte/30 border border-border/60 p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-espresso">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-caramel" /> Pickup for:
                      </span>
                      <span className="font-semibold text-espresso">{customerName}</span>
                    </div>

                    <div className="flex items-center justify-between text-espresso">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-caramel" /> Contact:
                      </span>
                      {contactPhone ? (
                        <span className="font-mono text-espresso text-[11px]">{contactPhone}</span>
                      ) : (
                        <input
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="Add contact number"
                          className="text-right text-[11px] bg-transparent text-espresso placeholder:text-muted-foreground/60 border-b border-border focus:outline-none focus:border-caramel"
                        />
                      )}
                    </div>
                  </div>

                  {/* Pickup Time Selector */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-espresso">Pickup Time</span>
                      <span className="text-[11px] text-caramel font-medium">
                        {pickupTiming === "asap" ? "Ready ASAP" : `In ~${scheduledSlot} mins`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPickupTiming("asap")}
                        className={`py-1.5 px-2.5 rounded-[var(--radius-md)] border text-center transition-all cursor-pointer font-medium ${
                          pickupTiming === "asap"
                            ? "bg-caramel text-white border-caramel shadow-xs"
                            : "bg-cream border-border text-espresso hover:bg-latte"
                        }`}
                      >
                        ASAP (10–15 mins)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickupTiming("scheduled")}
                        className={`py-1.5 px-2.5 rounded-[var(--radius-md)] border text-center transition-all cursor-pointer font-medium ${
                          pickupTiming === "scheduled"
                            ? "bg-caramel text-white border-caramel shadow-xs"
                            : "bg-cream border-border text-espresso hover:bg-latte"
                        }`}
                      >
                        Schedule Time
                      </button>
                    </div>

                    {pickupTiming === "scheduled" && (
                      <select
                        value={scheduledSlot}
                        onChange={(e) => setScheduledSlot(e.target.value)}
                        className="w-full text-xs rounded-[var(--radius-md)] border border-border bg-white px-2.5 py-1.5 text-espresso focus:outline-none focus:ring-1 focus:ring-caramel transition-colors"
                      >
                        <option value="30">In 30 minutes (~30 mins)</option>
                        <option value="45">In 45 minutes (~45 mins)</option>
                        <option value="60">In 1 hour (~60 mins)</option>
                        <option value="90">In 1.5 hours (~90 mins)</option>
                        <option value="120">In 2 hours (~120 mins)</option>
                      </select>
                    )}
                  </div>

                  {/* Order / Pickup Note for barista */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="order-note" className="font-medium text-espresso flex items-center gap-1.5">
                        <FileText className="h-3 w-3 text-caramel" />
                        Order / Pickup Note
                      </label>
                      <span className="text-[11px] text-muted-foreground">Optional</span>
                    </div>
                    <textarea
                      id="order-note"
                      rows={2}
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      placeholder="e.g. Sugar/ice level, oat milk preference, or gift wrapping for merch..."
                      className="w-full text-xs rounded-[var(--radius-md)] border border-border bg-white p-2.5 text-espresso placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-caramel resize-none transition-colors"
                    />
                  </div>
                </div>

                {/* 3. Stamp Card Free Treat Redemption Banner / Toggle */}
                {canRedeemTreat && (
                  <div className="rounded-[var(--radius-md)] bg-caramel/10 border border-caramel/30 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🐾</span>
                        <div>
                          <p className="text-xs font-semibold text-espresso">
                            Redeem Free Treat (10 Stamps)
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {stampsCount} stamps available • 1 free treat ready
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleFreeTreat}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          redeemFreeTreat ? "bg-caramel" : "bg-border"
                        }`}
                        role="switch"
                        aria-checked={redeemFreeTreat}
                        aria-label="Toggle Free Treat Redemption"
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            redeemFreeTreat ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    {redeemFreeTreat && eligibleTreatItem && (
                      <div className="text-[11px] text-caramel-dark font-medium pt-1.5 border-t border-caramel/25 flex items-center justify-between">
                        <span>Free item: {eligibleTreatItem.name}</span>
                        <span className="font-semibold">-{formatPHP(treatDiscount)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 3b. Active Reward Vouchers Selector */}
                {eligibleVouchers.length > 0 && (
                  <div className="rounded-[var(--radius-md)] bg-[#2D221B]/5 border border-espresso/15 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-caramel" />
                        <div>
                          <p className="text-xs font-semibold text-espresso">
                            Apply Reward Voucher
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {eligibleVouchers.length} applicable voucher{eligibleVouchers.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      {selectedVoucherId && (
                        <button
                          type="button"
                          onClick={() => setSelectedVoucherId(null)}
                          className="text-[11px] text-caramel font-medium hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {eligibleVouchers.map((v) => {
                        const isSelected = selectedVoucherId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleSelectVoucher(v.id)}
                            className={`w-full text-left p-2 rounded-[var(--radius-sm)] border text-xs flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? "bg-caramel/15 border-caramel text-espresso font-medium"
                                : "bg-white border-border text-muted-foreground hover:border-caramel/40"
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="font-medium text-espresso block">{v.title}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{v.code}</span>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                                isSelected ? "bg-caramel text-white" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {isSelected ? "Applied" : "Apply"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Points Earning Preview Banner */}
                <div className="rounded-[var(--radius-md)] bg-caramel/10 border border-caramel/25 p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-espresso font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-caramel shrink-0" />
                    <span>Earn +{earnedPointsPreview} Paw Points with this order</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-semibold text-caramel border-caramel/30 bg-white/60">
                    {tierMultiplier}x rate
                  </Badge>
                </div>

                <Separator />

                {/* 4. Itemized Price Breakdown */}
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-espresso flex items-center justify-between">
                    <span>Itemized Breakdown</span>
                    <span className="text-muted-foreground font-normal text-[11px]">
                      {totalItems} {totalItems === 1 ? "item" : "items"}
                    </span>
                  </div>

                  {/* Compact itemized list */}
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {items.map((item) => {
                      const itemKey = item.cartKey || item.id;
                      const variantText = [item.size, item.temperature].filter(Boolean).join(" • ");
                      const itemPrice = item.unitPrice != null ? item.unitPrice : item.price;

                      return (
                        <div
                          key={itemKey}
                          className="flex items-center justify-between text-xs text-muted-foreground"
                        >
                          <span className="truncate pr-2">
                            <span className="text-espresso font-medium">{item.name}</span>
                            {variantText && (
                              <span className="text-[10px] text-muted-foreground ml-1 font-normal">
                                ({variantText})
                              </span>
                            )}
                            <span className="text-muted-foreground font-mono text-[11px] ml-1">
                              ×{item.quantity}
                            </span>
                          </span>
                          <span className="tabular-nums font-medium text-espresso shrink-0">
                            {formatPHP(parseFloat(itemPrice) * item.quantity)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-border/60 space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums text-espresso font-medium">
                        {formatPHP(subtotal)}
                      </span>
                    </div>

                    {perkDiscount > 0 && (
                      <div className="flex justify-between text-status-paid font-medium">
                        <span>{perkLabel}</span>
                        <span className="tabular-nums font-semibold">
                          -{formatPHP(perkDiscount)}
                        </span>
                      </div>
                    )}

                    {redeemFreeTreat && treatDiscount > 0 && (
                      <div className="flex justify-between text-status-paid font-medium">
                        <span>Stamp Card Free Treat ({eligibleTreatItem?.name})</span>
                        <span className="tabular-nums font-semibold">
                          -{formatPHP(treatDiscount)}
                        </span>
                      </div>
                    )}

                    {voucherDiscount > 0 && selectedVoucher && (
                      <div className="flex justify-between text-status-paid font-medium">
                        <span>Voucher: {selectedVoucher.title}</span>
                        <span className="tabular-nums font-semibold">
                          -{formatPHP(voucherDiscount)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-muted-foreground">
                      <span>Pickup Fee & VAT</span>
                      <span className="text-status-paid font-medium">
                        Included (₱0.00)
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Total */}
                <div className="flex justify-between items-baseline text-espresso">
                  <span className="font-semibold text-sm">Total</span>
                  <span className="text-xl font-heading font-bold text-caramel-dark">
                    {formatPHP(finalTotal)}
                  </span>
                </div>

                {isBelowMinPaidPurchase && (
                  <div className="rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-900 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      Loyalty redemptions require a minimum paid purchase of ₱100.00 after discounts (current: {formatPHP(finalTotal)}). Please add items to proceed.
                    </span>
                  </div>
                )}

                {error && (
                  <div className="rounded-[var(--radius-md)] bg-status-failed-bg p-3 text-xs text-status-failed">
                    {error}
                  </div>
                )}

                {/* Action button */}
                <Button
                  className="w-full bg-caramel hover:bg-caramel-dark text-white font-medium py-2.5 shadow-card transition-colors cursor-pointer"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={loading || isBelowMinPaidPurchase}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Placing Order...
                    </>
                  ) : (
                    "Place Order"
                  )}
                </Button>

                {/* Clearer Pickup & Payment Flow Subtext */}
                <p className="text-xs text-center text-muted-foreground leading-relaxed px-1">
                  Your order will be prepared once submitted. Pay at the counter upon pickup or via online payment on the next screen.
                </p>
              </CardContent>
            </Card>

            {/* Refund & Cancellation Policy Note */}
            <p className="text-[11px] text-center text-muted-foreground mt-3 px-2 leading-relaxed">
              Unpaid orders can be canceled anytime. Once paid and in preparation, refunds apply only to unavailable, incorrect, or defective items.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
