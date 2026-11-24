import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { getCatPhotoUrl } from "@/lib/catPhotos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  Mail,
  Phone,
  Pencil,
  Cat,
  Coffee,
  Heart,
  ShoppingBag,
  Receipt,
  ArrowRight,
  Sparkles,
  CreditCard,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  Crown,
} from "lucide-react";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [reservations, setReservations] = useState({ upcoming: [], past: [] });
  const [orders, setOrders] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [payingResId, setPayingResId] = useState(null);
  const [redeemingId, setRedeemingId] = useState(null);
  const [redeemSuccess, setRedeemSuccess] = useState(null);
  const [showTierPerks, setShowTierPerks] = useState(false);

  const fetchProfileData = useCallback(async () => {
    try {
      const [uData, resData, ordData, loyData, favData] = await Promise.all([
        api.get("/api/users/me/"),
        api.get("/api/users/me/reservations/").catch(() => ({ upcoming: [], past: [] })),
        api.get("/api/users/me/orders/").catch(() => []),
        api.get("/api/users/me/loyalty/").catch(() => null),
        api.get("/api/users/me/favorites/").catch(() => []),
      ]);
      let upcomingList = Array.isArray(resData?.upcoming) ? resData.upcoming : [];
      const pastList = Array.isArray(resData?.past) ? resData.past : [];

      // Verify any pending_payment reservations with Xendit
      const pendingRes = upcomingList.filter((r) => r.status === "pending_payment");
      if (pendingRes.length > 0) {
        const verifiedMap = new Map();
        await Promise.all(
          pendingRes.map(async (r) => {
            try {
              const updated = await api.post(`/api/catroom/reservations/${r.id}/verify-payment/`);
              if (updated?.id) verifiedMap.set(updated.id, updated);
            } catch {}
          })
        );
        if (verifiedMap.size > 0) {
          upcomingList = upcomingList.map((r) => verifiedMap.get(r.id) || r);
        }
      }

      setProfileData(uData);
      setReservations({ upcoming: upcomingList, past: pastList });
      setOrders(Array.isArray(ordData) ? ordData : []);
      setLoyalty(loyData);
      setFavorites(Array.isArray(favData) ? favData : []);
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      setProfileData(null);
      setReservations({ upcoming: [], past: [] });
      setOrders([]);
      setLoyalty(null);
      setFavorites([]);
      navigate("/login?redirect=/profile");
    } else if (user) {
      setProfileData(null);
      setReservations({ upcoming: [], past: [] });
      setOrders([]);
      setLoyalty(null);
      setFavorites([]);
      setLoading(true);
      fetchProfileData();
    }
  }, [user?.id, authLoading, navigate, fetchProfileData]);

  // Handle Cancel Reservation
  const handleCancelReservation = async (reservationId) => {
    setCancellingId(reservationId);
    try {
      await api.post(`/api/catroom/reservations/${reservationId}/cancel/`);
      window.dispatchEvent(new CustomEvent("catopia:reservation-change"));
      fetchProfileData();
    } catch (err) {
      alert(err?.data?.detail || "Could not cancel reservation.");
    } finally {
      setCancellingId(null);
    }
  };

  // Handle Pay Reservation
  const handlePayReservation = async (reservationId) => {
    setPayingResId(reservationId);
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
      }
    } catch (err) {
      alert(err?.data?.detail || "Could not initiate payment.");
      setPayingResId(null);
    }
  };

  // Toggle favorite on a cat
  const handleToggleFavorite = async (catId) => {
    try {
      await api.post(`/api/cats/residents/${catId}/favorite/`);
      // Update favorites list
      setFavorites((prev) => prev.filter((c) => c.id !== catId));
    } catch {
      // Silent error handling
    }
  };

  // Handle Redeem Reward
  const handleRedeem = async (reward) => {
    const currentPawPoints = loyalty?.paw_points ?? loyalty?.points ?? 0;
    if (currentPawPoints < reward.points) {
      alert(`You need ${reward.points} points for this reward. You have ${currentPawPoints} points.`);
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to redeem "${reward.title}" for ${reward.points} paw points?`
    );
    if (!confirmed) return;

    setRedeemingId(reward.id);
    try {
      const res = await api.post("/api/loyalty/redeem/", { reward_id: reward.id });
      const voucherCode = res?.voucher?.code || "";
      setRedeemSuccess(
        `Voucher "${reward.title}" unlocked! (${voucherCode}) It is now available to apply at checkout or booking.`
      );
      await fetchProfileData();
    } catch (err) {
      alert(err?.data?.detail || "Could not redeem reward.");
    } finally {
      setRedeemingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="bg-cream min-h-screen py-10 px-4 md:px-6">
        <div className="mx-auto max-w-[var(--container-lg)] space-y-6">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
            <div className="lg:col-span-7 space-y-6">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentUser = profileData || user;
  const initials =
    `${currentUser?.first_name?.[0] || ""}${currentUser?.last_name?.[0] || ""}`.toUpperCase() ||
    currentUser?.username?.[0]?.toUpperCase() || "C";

  const pawPointsBalance = loyalty?.paw_points ?? loyalty?.points ?? 0;
  const lifetimePoints = loyalty?.lifetime_paw_points ?? loyalty?.paw_points ?? loyalty?.points ?? 0;

  // Multi-tier: Kitten (< 800), Tabby Club (800 - 2,499), Tubby Club (2,500+)
  const isTubby = lifetimePoints >= 2500;
  const isTabby = lifetimePoints >= 800 && !isTubby;
  const tierName = isTubby ? "Tubby Club" : isTabby ? "Tabby Club" : "Kitten";

  const earnRateLabel = isTubby
    ? "1.5 pts per ₱10 spent"
    : isTabby
    ? "1.25 pts per ₱10 spent"
    : "1 pt per ₱10 spent";

  let nextTierName = "Tabby Club";
  let pointsToNextTier = Math.max(0, 800 - lifetimePoints);
  let progressBarPercent = Math.min(100, Math.max(0, (lifetimePoints / 800) * 100));

  if (isTubby) {
    nextTierName = null;
    pointsToNextTier = 0;
    progressBarPercent = 100;
  } else if (isTabby) {
    nextTierName = "Tubby Club";
    pointsToNextTier = Math.max(0, 2500 - lifetimePoints);
    progressBarPercent = Math.min(100, Math.max(0, ((lifetimePoints - 800) / 1700) * 100));
  }

  const stats = {
    paw_points: pawPointsBalance,
    upcoming_visits: reservations.upcoming.length,
    cafe_orders: orders.length,
  };

  return (
    <div className="bg-cream min-h-screen py-8 md:py-12 selection:bg-caramel/20">
      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6 space-y-8">
        {/* 1. HERO BANNER (True to Reference) */}
        <div className="rounded-3xl bg-gradient-to-r from-[#FCEFE3] via-[#F8E8D8] to-[#F1DFC8] border border-[#E9D3BD] p-6 sm:p-8 md:p-10 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Avatar Circle with initials or photo */}
            <div className="relative shrink-0">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.full_name}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-caramel/20"
                />
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-caramel text-white font-heading font-bold text-xl sm:text-2xl flex items-center justify-center border-2 border-white shadow-md">
                  {initials}
                </div>
              )}
            </div>

            {/* User Greeting and Tier */}
            <div className="space-y-1">
              <p className="font-heading italic text-caramel text-sm sm:text-base">
                Welcome back
              </p>
              <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-espresso tracking-tight">
                {currentUser?.full_name || currentUser?.username}
              </h1>
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/80 border border-caramel/30 font-semibold text-caramel">
                  <Cat className="h-3 w-3" />
                  <span>{tierName} Member</span>
                </span>
                <span>·</span>
                <span>Member since {currentUser?.member_since || "2026"}</span>
              </div>
            </div>
          </div>

          {/* Top-Right Stats Pills */}
          <div className="flex items-center gap-2 sm:gap-3 bg-white/70 backdrop-blur-xs p-2 sm:p-2.5 rounded-2xl border border-white/80 shadow-xs self-stretch md:self-auto justify-around md:justify-start">
            <div className="text-center px-3 py-1">
              <p className="font-heading text-xl sm:text-2xl font-bold text-espresso">
                {stats.paw_points}
              </p>
              <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">
                Paw points
              </p>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="text-center px-3 py-1">
              <p className="font-heading text-xl sm:text-2xl font-bold text-espresso">
                {stats.upcoming_visits}
              </p>
              <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">
                Upcoming visits
              </p>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="text-center px-3 py-1">
              <p className="font-heading text-xl sm:text-2xl font-bold text-espresso">
                {stats.cafe_orders}
              </p>
              <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">
                Café orders
              </p>
            </div>
          </div>
        </div>

        {/* Redeem notification alert */}
        {redeemSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{redeemSuccess}</span>
          </div>
        )}

        {/* 2. MAIN TWO-COLUMN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* LEFT COLUMN: My Details & Loyalty Rewards Card */}
          <div className="lg:col-span-5 space-y-6">
            {/* Card 1: My Details */}
            <Card className="bg-white rounded-3xl border-[#EFEAE2] shadow-[0_4px_25px_rgba(61,43,31,0.05)] p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2 text-espresso font-semibold text-sm">
                  <div className="h-7 w-7 rounded-full bg-caramel/10 text-caramel flex items-center justify-center">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <span>My Details</span>
                </div>
                <Link
                  to="/profile/edit"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-caramel hover:text-caramel-dark transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  <span>Edit</span>
                </Link>
              </div>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex items-center justify-between text-espresso">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground/70" />
                    Email
                  </span>
                  <span className="font-medium text-right max-w-[180px] truncate">
                    {currentUser?.email || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-espresso">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                    Phone
                  </span>
                  <span className="font-medium">
                    {currentUser?.phone || "Not set"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-espresso">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/70" />
                    Member since
                  </span>
                  <span className="font-medium">
                    {currentUser?.member_since || "November 2026"}
                  </span>
                </div>
              </div>
            </Card>

            {/* Card 2: Loyalty & Stamp Card (Dark Espresso true to reference) */}
            <div className="bg-[#2D221B] text-white rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
              {/* Header */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="font-heading italic text-caramel text-base flex items-center gap-1.5">
                    {isTubby && <Crown className="h-4 w-4 text-caramel" />}
                    <span>{tierName}</span>
                  </p>
                  <span className="text-[10px] bg-white/10 text-white/80 border border-white/15 px-2 py-0.5 rounded-full font-medium">
                    {earnRateLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-heading text-3xl font-bold text-white">
                    {pawPointsBalance}
                  </span>
                  <span className="text-xs text-white/70">
                    paw points · {earnRateLabel}
                  </span>
                </div>

                {/* Progress bar to next tier */}
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-caramel rounded-full transition-all duration-500"
                      style={{
                        width: `${progressBarPercent}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/60">
                    <span>
                      {isTubby
                        ? "Tubby Club Member • Top Tier VIP"
                        : isTabby
                        ? `${pointsToNextTier} points to Tubby Club`
                        : `${pointsToNextTier} points to Tabby Club`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTierPerks(!showTierPerks)}
                      className="text-[10px] text-caramel-light hover:text-white underline font-medium cursor-pointer"
                    >
                      {showTierPerks ? "Hide Perks" : "View Tier Perks"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expandable Tier Perks Drawer */}
              {showTierPerks && (
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                    <span className="font-semibold text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-caramel" />
                      Loyalty Tiers & Member Perks
                    </span>
                    <span className="text-[10px] text-white/50">Net spend</span>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    {/* Kitten */}
                    <div
                      className={`p-2.5 rounded-xl border ${
                        tierName === "Kitten"
                          ? "bg-caramel/20 border-caramel/50 text-white"
                          : "bg-black/20 border-white/10 text-white/70"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>🐾 Kitten (0–799 pts / ₱0–₱7,999)</span>
                        <span className="text-caramel-light font-bold">1 pt / ₱10</span>
                      </div>
                      <p className="text-[10px] text-white/70 mt-0.5">
                        Base earn rate · 1 stamp per drink/food towards free treat
                      </p>
                    </div>

                    {/* Tabby Club */}
                    <div
                      className={`p-2.5 rounded-xl border ${
                        tierName === "Tabby Club"
                          ? "bg-caramel/20 border-caramel/50 text-white"
                          : "bg-black/20 border-white/10 text-white/70"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>🐱 Tabby Club (800–2,499 pts / ₱8,000–₱24,999)</span>
                        <span className="text-caramel-light font-bold">1.25 pts / ₱10 (+25%)</span>
                      </div>
                      <p className="text-[10px] text-white/70 mt-0.5">
                        +30 one-time bonus pts · Free Drink Customization (oat/soy milk, extra shot, syrup) on 1 drink per order (-₱30)
                      </p>
                    </div>

                    {/* Tubby Club */}
                    <div
                      className={`p-2.5 rounded-xl border ${
                        tierName === "Tubby Club"
                          ? "bg-caramel/20 border-caramel/50 text-white"
                          : "bg-black/20 border-white/10 text-white/70"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>👑 Tubby Club (2,500+ pts / ₱25,000+ spend)</span>
                        <span className="text-caramel-light font-bold">1.5 pts / ₱10 (+50%)</span>
                      </div>
                      <p className="text-[10px] text-white/70 mt-0.5">
                        +75 one-time bonus pts · Free Drink Size Upgrade & Add-on on 1 drink per order (-₱50) · Priority Weekday Cat Room Booking
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-white/50 italic border-t border-white/10 pt-2 text-center">
                    Points apply to net paid spend. Limit 1 reward per order with min. ₱100 purchase.
                  </p>
                </div>
              )}

              {/* Stamp Card */}
              {(() => {
                const stampsCount =
                  loyalty?.stamp_card?.stamps_count ??
                  loyalty?.stamp_card?.stampsCount ??
                  profileData?.profile?.stamps_count ??
                  profileData?.stamps_count ??
                  0;
                const freeTreats =
                  loyalty?.stamp_card?.free_treats_available ??
                  loyalty?.stamp_card?.freeTreatsAvailable ??
                  profileData?.profile?.free_treats_available ??
                  profileData?.free_treats_available ??
                  0;
                const hasUnlockedTreat = freeTreats > 0 || stampsCount >= 10;
                const currentStamps = hasUnlockedTreat ? 10 : stampsCount % 10;
                const itemsRemaining = hasUnlockedTreat ? 0 : 10 - currentStamps;

                return (
                  <div className="pt-2 border-t border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                        Café Stamp Card
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasUnlockedTreat && (
                          <span className="text-[10px] bg-caramel/25 text-caramel-light border border-caramel/40 px-2 py-0.5 rounded-full font-bold">
                            Treat Ready!
                          </span>
                        )}
                        <Coffee className="h-3.5 w-3.5 text-caramel" />
                      </div>
                    </div>

                    {/* 10 Stamps circles */}
                    <div className="flex items-center justify-between gap-1 py-1">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const isStamped = idx < currentStamps;
                        return (
                          <div
                            key={idx}
                            className={`h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                              isStamped
                                ? "bg-caramel text-white shadow-xs"
                                : "border border-white/20 text-white/40 bg-white/5"
                            }`}
                            title={isStamped ? `Stamp ${idx + 1} earned` : `Stamp ${idx + 1}`}
                          >
                            {isStamped ? "🐾" : idx + 1}
                          </div>
                        );
                      })}
                    </div>

                    {hasUnlockedTreat ? (
                      <p className="text-[11px] text-caramel-light font-medium flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-caramel shrink-0" />
                        Free treat unlocked! Redeem on your next order at checkout.
                      </p>
                    ) : (
                      <p className="text-[11px] text-white/60">
                        {itemsRemaining} more item{itemsRemaining === 1 ? "" : "s"} until a free treat
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Redeem Rewards Section */}
              <div className="pt-2 border-t border-white/10 space-y-2.5">
                <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider block">
                  Redeem
                </span>

                <div className="space-y-2">
                  {(loyalty?.rewards || []).map((reward) => {
                    const canAfford = pawPointsBalance >= reward.points;
                    return (
                      <div
                        key={reward.id}
                        className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-white">{reward.title}</p>
                          <p className="text-[11px] text-white/60">
                            {reward.points} pts · {reward.description}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={!canAfford || redeemingId === reward.id}
                          onClick={() => handleRedeem(reward)}
                          className={`h-7 px-3 text-[11px] rounded-full shrink-0 ${
                            canAfford
                              ? "bg-caramel hover:bg-caramel-dark text-white shadow-xs cursor-pointer"
                              : "bg-white/10 text-white/40 cursor-not-allowed hover:bg-white/10"
                          }`}
                        >
                          {redeemingId === reward.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Redeem"
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Unlocked Vouchers */}
              {loyalty?.vouchers && loyalty.vouchers.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                      Active Vouchers ({loyalty.vouchers.length})
                    </span>
                    <Sparkles className="h-3.5 w-3.5 text-caramel" />
                  </div>
                  <div className="space-y-2">
                    {loyalty.vouchers.map((vchr) => (
                      <div
                        key={vchr.id}
                        className="p-2.5 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-white text-[11px]">{vchr.title}</p>
                          <p className="text-[10px] text-caramel-light font-mono font-medium">
                            {vchr.code}
                          </p>
                        </div>
                        <span className="text-[10px] bg-caramel/25 text-caramel-light border border-caramel/40 px-2 py-0.5 rounded-full font-semibold shrink-0">
                          Ready to use
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-white/45 text-center italic pt-1 border-t border-white/10">
                Points apply to net paid spend. Limit 1 reward per order with min. ₱100 purchase.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Cat Room Reservations & Order History */}
          <div className="lg:col-span-7 space-y-6">
            {/* Card 1: Cat Room Reservations */}
            <Card className="bg-white rounded-3xl border-[#EFEAE2] shadow-[0_4px_25px_rgba(61,43,31,0.05)] p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2 text-espresso font-semibold text-base">
                  <div className="h-7 w-7 rounded-full bg-caramel/10 text-caramel flex items-center justify-center">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </div>
                  <span>Cat Room Reservations</span>
                </div>
                <Link
                  to="/catroom"
                  className="text-xs font-semibold text-caramel hover:text-caramel-dark transition-colors"
                >
                  Book an hour
                </Link>
              </div>

              {/* Upcoming Visits */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Upcoming
                </span>

                {reservations.upcoming.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-border/70 text-xs text-muted-foreground text-center">
                    No upcoming visits.{" "}
                    <Link to="/catroom" className="text-caramel font-semibold hover:underline">
                      Reserve a 1-hour slot
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {reservations.upcoming.map((res) => (
                      <div
                        key={res.id}
                        className="p-3.5 rounded-2xl border border-border/80 bg-[#FAF6F0] flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-espresso">
                              {res.date}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">
                              {res.slot_start?.slice(0, 5)} - {res.slot_end?.slice(0, 5)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {res.visitors} {res.visitors === 1 ? "visitor" : "visitors"} ·{" "}
                            {formatPHP(res.fee)} ({res.payment_option})
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant={res.status === "confirmed" ? "paid" : "pending"}
                            className="capitalize text-[10px]"
                          >
                            {res.status.replace("_", " ")}
                          </Badge>

                          {res.receipt?.payment_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-7 px-2.5 rounded-full text-[11px]"
                            >
                              <Link to={`/payment/${res.receipt.payment_id}/receipt`}>
                                <Receipt className="h-3 w-3 mr-1" />
                                Receipt
                              </Link>
                            </Button>
                          )}

                          {res.status === "pending_payment" && (
                            <Button
                              size="sm"
                              className="h-7 text-[11px] rounded-full bg-caramel hover:bg-caramel-dark text-white shadow-xs"
                              disabled={payingResId === res.id}
                              onClick={() => handlePayReservation(res.id)}
                            >
                              {payingResId === res.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Pay Now
                                </>
                              )}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"
                            disabled={cancellingId === res.id}
                            onClick={() => handleCancelReservation(res.id)}
                          >
                            {cancellingId === res.id ? "Cancelling..." : "Cancel"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Past Visits */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Past Visits
                </span>

                {reservations.past.length === 0 ? (
                  <p className="text-xs text-muted-foreground/80 py-1">
                    Your visit history will appear here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reservations.past.slice(0, 3).map((res) => (
                      <div
                        key={res.id}
                        className="p-3 rounded-xl border border-border/60 bg-white flex items-center justify-between text-xs text-muted-foreground"
                      >
                        <div>
                          <span className="font-medium text-espresso">{res.date}</span>
                          <span className="mx-1">·</span>
                          <span>{res.slot_start?.slice(0, 5)}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {res.status.replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Card 2: Order History */}
            <Card className="bg-white rounded-3xl border-[#EFEAE2] shadow-[0_4px_25px_rgba(61,43,31,0.05)] p-6 sm:p-7 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2 text-espresso font-semibold text-base">
                  <div className="h-7 w-7 rounded-full bg-caramel/10 text-caramel flex items-center justify-center">
                    <ShoppingBag className="h-3.5 w-3.5" />
                  </div>
                  <span>Order History</span>
                </div>
                <Link
                  to="/menu"
                  className="text-xs font-semibold text-caramel hover:text-caramel-dark transition-colors"
                >
                  Order again
                </Link>
              </div>

              {orders.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-border/70 text-xs text-muted-foreground text-center">
                  No orders yet.{" "}
                  <Link to="/menu" className="text-caramel font-semibold hover:underline">
                    Browse the menu
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-2xl border border-border/70 bg-[#FAF6F0] flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-espresso">
                            Order #{order.id}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate max-w-xs">
                          {order.items?.map((i) => {
                            const v = [i.size, i.temperature].filter(Boolean).join(" • ");
                            return `${i.name}${v ? ` (${v})` : ""} x${i.quantity}`;
                          }).join(", ") || "Cafe item"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-heading font-bold text-sm text-caramel">
                          {formatPHP(order.total)}
                        </span>

                        <Badge
                          variant={order.status === "completed" || order.status === "ready" ? "paid" : "pending"}
                          className="capitalize text-[10px]"
                        >
                          {order.status}
                        </Badge>

                        {order.receipt && (
                          <Button size="sm" variant="outline" asChild className="h-7 px-2.5 rounded-full text-[11px]">
                            <Link to={`/payment/${order.receipt.payment_id}/receipt`}>
                              <Receipt className="h-3 w-3 mr-1" />
                              Receipt
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* 3. BOTTOM SECTION: FAVORITE RESIDENT CATS (True to Reference) */}
        <div className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-heading italic text-caramel text-sm">
                Your favorites
              </p>
              <h2 className="font-heading text-xl sm:text-2xl font-bold text-espresso tracking-tight">
                Favorite Resident Cats 🧡
              </h2>
            </div>
            <Link
              to="/catroom"
              className="text-xs font-semibold text-caramel hover:text-caramel-dark transition-colors"
            >
              Meet all residents
            </Link>
          </div>

          {favorites.length === 0 ? (
            <div className="rounded-3xl bg-white border border-[#EFEAE2] p-8 text-center text-xs sm:text-sm text-muted-foreground shadow-xs">
              No favorites yet. Tap the heart on any resident cat to keep them here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {favorites.map((cat) => {
                const photoUrl = getCatPhotoUrl(cat);
                return (
                <Card
                  key={cat.id}
                  className="bg-white rounded-3xl border-[#EFEAE2] overflow-hidden shadow-xs hover:shadow-card-hover transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-latte/30 flex items-center justify-center">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          No Image
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(cat.id)}
                        className="absolute top-3 right-3 p-2 rounded-full bg-white/90 text-caramel shadow-xs hover:bg-white transition-colors cursor-pointer"
                        aria-label="Remove from favorites"
                      >
                        <Heart className="h-4 w-4 fill-caramel text-caramel" />
                      </button>
                    </div>

                    <div className="p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-heading font-bold text-espresso text-base">
                          {cat.name}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {cat.age} {cat.age === 1 ? "yr" : "yrs"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {cat.personality || "Sweet and affectionate resident cat."}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 pt-0 border-t border-border/50 flex justify-end">
                    <Button size="sm" variant="ghost" asChild className="text-xs text-caramel hover:text-caramel-dark p-0">
                      <Link to="/catroom">
                        Book a session with {cat.name}
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
