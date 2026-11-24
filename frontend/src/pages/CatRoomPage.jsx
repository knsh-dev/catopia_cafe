import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { getCatPhotoUrl } from "@/lib/catPhotos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  Clock,
  Users,
  Minus,
  Plus,
  ShieldCheck,
  Cat,
  Heart,
  Sparkles,
  PawPrint,
  Droplets,
  HandHeart,
  Loader2,
  AlertCircle,
  CheckCircle,
  RotateCw,
  Ban,
  CreditCard,
  Crown,
} from "lucide-react";

// Format 24-hr time string to "10:00 AM" safely
function formatTime(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return "";
  const parts = timeStr.split(":");
  let h = parseInt(parts[0], 10);
  if (isNaN(h)) return timeStr;
  const m = parts[1] || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// Format "YYYY-MM-DD" to "Thursday, November 19" safely
function formatFullDate(isoString) {
  if (!isoString || typeof isoString !== "string") return "";
  const parts = isoString.split("-");
  if (parts.length < 3) return isoString;
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return isoString;
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Generate next 21 days starting today for a smooth sliding experience
function getUpcomingDays(count = 21) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const iso = `${year}-${month}-${day}`;
    days.push({
      iso,
      dayName: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
      monthName: d.toLocaleDateString("en-US", { month: "short" }),
      dayNumber: d.getDate(),
      isToday: i === 0,
    });
  }
  return days;
}

const FALLBACK_CATS = [
  {
    id: 1,
    name: "Mochi",
    age: 2,
    breed: "Orange Tabby",
    personality: "Mochi was our very first resident and still runs the place. Expect slow blinks, loud purrs and a greeting at the door.",
    photo: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80",
    status: "Ready to play",
  },
  {
    id: 2,
    name: "Pepper",
    age: 3,
    breed: "Black Short Hair",
    personality: "Pepper leaps from shelf to shelf and loves anyone holding a feather toy. Shy for five minutes, cuddly forever.",
    photo: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600&auto=format&fit=crop&q=80",
    status: "Ready to play",
  },
  {
    id: 3,
    name: "Luna",
    age: 1,
    breed: "Silver Tabby",
    personality: "Our youngest resident, expects seven naps, abandon and catbows. She naps hard after her morning zoomies.",
    photo: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600&auto=format&fit=crop&q=80",
    status: "Nap Day",
  },
  {
    id: 4,
    name: "Biscuit",
    age: 4,
    breed: "White & Ginger Shorthair",
    personality: "Biscuit greets every guest at the Cat Room door and is wonderful with first-time cat friends and quiet readers.",
    photo: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=600&auto=format&fit=crop&q=80",
    status: "Ready to play",
  },
  {
    id: 5,
    name: "Earl",
    age: 3,
    breed: "Brown Tabby",
    personality: "A calm senior gentleman who prefers the window seat and a quiet chat. Game for teasers in the afternoon.",
    photo: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=600&auto=format&fit=crop&q=80",
    status: "Ready to play",
  },
  {
    id: 6,
    name: "Cloud",
    age: 5,
    breed: "Fluffy Longhair",
    personality: "Cloud melts into any lap and has never met a brush she did not love. Grooming sessions are pure heaven.",
    photo: "https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?w=600&auto=format&fit=crop&q=80",
    status: "Ready to play",
  },
];

// Isolated Live Refresh Badge to prevent 1-second interval re-renders on the main page
function LiveRefreshBadge({ lastRefreshedAt, refreshing, loadingSlots, onRefresh }) {
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0);

  useEffect(() => {
    const update = () => {
      setSecondsSinceRefresh(Math.floor((Date.now() - lastRefreshedAt) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lastRefreshedAt]);

  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <div className="inline-flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="font-medium text-emerald-800">
          Live · {secondsSinceRefresh}s ago
        </span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing || loadingSlots}
        title="Refresh slot availability live"
        className="p-1 rounded-full hover:bg-latte text-espresso/70 hover:text-caramel transition-colors cursor-pointer"
        aria-label="Refresh availability"
      >
        <RotateCw className={`h-3.5 w-3.5 ${refreshing || loadingSlots ? "animate-spin text-caramel" : ""}`} />
      </button>
    </div>
  );
}

// Isolated Hold Countdown Banner so 1-second countdown ticks don't re-render the booking page
function HoldCountdownBanner({ holdExpiresAt, holdMinutes = 15 }) {
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    if (!holdExpiresAt) return 0;
    return Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!holdExpiresAt) return;
    const expiresAtMs = new Date(holdExpiresAt).getTime();

    const updateTimer = () => {
      const diffSecs = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setSecondsRemaining(diffSecs);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  const formatRemaining = (seconds) => {
    if (seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (!holdExpiresAt) return null;

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-2xl border ${secondsRemaining > 0
          ? "bg-caramel/5 border-caramel/30 text-espresso"
          : "bg-red-50 border-red-200 text-red-700"
        }`}
    >
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-caramel shrink-0" />
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {holdMinutes}-Minute Payment Hold
          </p>
          <p className="text-xs font-medium">
            {secondsRemaining > 0
              ? "Slot temporarily reserved"
              : "Hold window expired"}
          </p>
        </div>
      </div>
      <div className="text-right">
        <span className="font-mono text-xl font-bold text-caramel">
          {formatRemaining(secondsRemaining)}
        </span>
        <p className="text-[10px] text-muted-foreground">remaining</p>
      </div>
    </div>
  );
}

export default function CatRoomPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const days = useMemo(() => getUpcomingDays(21), []);
  const initialParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // User-scoped draft storage key & refs
  const draftKey = user?.id ? `bookingDraft_${user.id}` : "bookingDraft_guest";
  const activeUserIdRef = useRef(user?.id ?? null);
  const dateScrollRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  // Form State
  const [selectedDate, setSelectedDate] = useState(() => initialParams.get("date") || days[0]?.iso || "");
  const [selectedSlot, setSelectedSlot] = useState(() => initialParams.get("slot") || "");
  const [visitors, setVisitors] = useState(() => {
    const v = Number(initialParams.get("visitors"));
    return v && !isNaN(v) ? Math.max(1, v) : 2;
  });
  const [paymentOption, setPaymentOption] = useState(() => {
    const p = initialParams.get("payment");
    return p === "deposit" || p === "full" ? p : "full";
  });
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);
  const [notes, setNotes] = useState("");
  const [catroomVouchers, setCatroomVouchers] = useState([]);
  const [applyVoucher, setApplyVoucher] = useState(false);
  const [loyaltyData, setLoyaltyData] = useState(null);

  // Data & Lifecycle State
  const [settings, setSettings] = useState(null);
  const [slots, setSlots] = useState([]);
  const [cats, setCats] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Live indicator & refresh timer
  const [lastRefreshedAt, setLastRefreshedAt] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  // Success State (Declared at top before any effects reference it)
  const [createdReservation, setCreatedReservation] = useState(null);

  // Payment State
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState(null);

  // Watch for user account switch or logout to reset booking form and wipe prior user's state
  useEffect(() => {
    if (activeUserIdRef.current !== (user?.id ?? null)) {
      activeUserIdRef.current = user?.id ?? null;
      setCreatedReservation(null);
      setError(null);
      setSubmitting(false);

      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.selectedDate) setSelectedDate(draft.selectedDate);
          setSelectedSlot(draft.selectedSlot || "");
          setVisitors(draft.visitors || 2);
          setPaymentOption(draft.paymentOption || "full");
          setNotes(draft.notes || "");
          setPolicyAcknowledged(draft.policyAcknowledged || false);
        } else {
          setSelectedSlot("");
          setVisitors(2);
          setPaymentOption("full");
          setNotes("");
          setPolicyAcknowledged(false);
        }
      } catch {
        setSelectedSlot("");
        setVisitors(2);
        setPaymentOption("full");
        setNotes("");
        setPolicyAcknowledged(false);
      }

      if (!user) {
        setCatroomVouchers([]);
        setLoyaltyData(null);
        setApplyVoucher(false);
      }
    }
  }, [user?.id, draftKey, user]);

  // Persist draft to user-scoped key in localStorage
  useEffect(() => {
    if (createdReservation) return;
    try {
      const draft = {
        selectedDate,
        selectedSlot,
        visitors,
        paymentOption,
        notes,
        policyAcknowledged,
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch { }
  }, [selectedDate, selectedSlot, visitors, paymentOption, notes, policyAcknowledged, draftKey, createdReservation]);

  // Listen for global auth changes (logout or account switch)
  useEffect(() => {
    const handleAuthChange = () => {
      setCreatedReservation(null);
      setSelectedSlot("");
      setNotes("");
      setPolicyAcknowledged(false);
      setCatroomVouchers([]);
      setLoyaltyData(null);
      setApplyVoucher(false);
      setError(null);
    };

    window.addEventListener("catopia:auth-change", handleAuthChange);
    return () => window.removeEventListener("catopia:auth-change", handleAuthChange);
  }, []);

  // Fetch Settings (callable on mount, refresh, focus, and cross-tab settings update)
  const fetchSettings = useCallback(async () => {
    try {
      const settingsData = await api.get("/api/catroom/settings/");
      if (settingsData) {
        setSettings(settingsData);
      }
    } catch {
      setSettings((prev) =>
        prev || {
          hourly_rate: "300.00",
          max_visitors: 8,
          min_deposit: "150.00",
          opening_hour: 10,
          closing_hour: 21,
          hold_minutes: 15,
          cancel_cutoff_hours: 24,
          daily_rest_hours: ["14:00"],
        }
      );
    }
  }, []);

  // Fetch Settings and Resident Cats on mount
  useEffect(() => {
    let isMounted = true;
    async function initData() {
      try {
        const [settingsData, catsData] = await Promise.all([
          api.get("/api/catroom/settings/").catch(() => null),
          api.get("/api/cats/residents/?available=true").catch(() => null),
        ]);

        if (!isMounted) return;

        if (settingsData) {
          setSettings(settingsData);
        } else {
          setSettings({
            hourly_rate: "300.00",
            max_visitors: 8,
            min_deposit: "150.00",
            opening_hour: 10,
            closing_hour: 21,
            hold_minutes: 15,
            cancel_cutoff_hours: 24,
            daily_rest_hours: ["14:00"],
          });
        }

        if (catsData) {
          const catList = Array.isArray(catsData) ? catsData : catsData?.results || [];
          setCats(catList);
        } else {
          setCats([]);
        }
      } catch {
        if (isMounted) setCats([]);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }
    initData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch user loyalty vouchers and profile strictly when user.id changes
  useEffect(() => {
    if (!user?.id) {
      setCatroomVouchers([]);
      setLoyaltyData(null);
      return;
    }

    let isMounted = true;
    Promise.all([
      api.get("/api/loyalty/vouchers/?status=active").catch(() => null),
      api.get("/api/users/me/loyalty/").catch(() => null),
    ]).then(([voucherData, loyalty]) => {
      if (!isMounted) return;
      if (voucherData) {
        const list = Array.isArray(voucherData) ? voucherData : voucherData?.results || [];
        setCatroomVouchers(list.filter((v) => v.reward_type === "catroom_50"));
      }
      if (loyalty) {
        setLoyaltyData(loyalty);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Fetch Slots
  const fetchSlots = useCallback(async (date) => {
    if (!date) return;
    setLoadingSlots(true);
    setError(null);
    try {
      const data = await api.get(`/api/catroom/slots/?date=${date}`);
      const slotList = Array.isArray(data) ? data : data?.results || [];
      setSlots(slotList);
      setLastRefreshedAt(Date.now());

      setSelectedSlot((prev) => {
        if (!prev) return "";
        const exists = slotList.some(
          (s) => s?.slot_start && typeof s.slot_start === "string" && s.slot_start.startsWith(prev.slice(0, 5)) && s.state === "available"
        );
        return exists ? prev : "";
      });
    } catch {
      setError("Unable to load time slots. Please refresh.");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  // Listen for reservation or dashboard room settings changes (same tab or cross-tab)
  useEffect(() => {
    const handleSync = () => {
      fetchSettings();
      fetchSlots(selectedDate);
    };
    const handleStorage = (e) => {
      if (e.key === "catopia_settings_updated_at") {
        handleSync();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleSync();
      }
    };

    window.addEventListener("catopia:reservation-change", handleSync);
    window.addEventListener("catopia:settings-change", handleSync);
    window.addEventListener("focus", handleSync);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("catopia:reservation-change", handleSync);
      window.removeEventListener("catopia:settings-change", handleSync);
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [selectedDate, fetchSlots, fetchSettings]);

  // Manual Live Refresh button
  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchSettings();
    fetchSlots(selectedDate);
  };

  // Pricing calculations synced with dashboard room settings:
  const hourlyRate = useMemo(() => {
    return settings?.hourly_rate && !isNaN(parseFloat(settings.hourly_rate))
      ? parseFloat(settings.hourly_rate)
      : 300;
  }, [settings]);

  const minDeposit = useMemo(() => {
    return settings?.min_deposit && !isNaN(parseFloat(settings.min_deposit))
      ? parseFloat(settings.min_deposit)
      : 150;
  }, [settings]);

  const holdMinutes = settings?.hold_minutes || 15;
  const cancelCutoffHours = settings?.cancel_cutoff_hours ?? 24;

  // Off-Peak Cat Room Voucher Eligibility: Weekdays (Mon-Thu) & 1 guest only
  const isWeekdaySlot = useMemo(() => {
    if (!selectedDate || typeof selectedDate !== "string") return false;
    const parts = selectedDate.split("-");
    if (parts.length < 3) return false;
    const [y, m, d] = parts.map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return false;
    const day = dateObj.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
    return day >= 1 && day <= 4;
  }, [selectedDate]);

  const isSingleVisitor = visitors === 1;
  const isVoucherEligible = isWeekdaySlot && isSingleVisitor;

  useEffect(() => {
    if (!isVoucherEligible && applyVoucher) {
      setApplyVoucher(false);
    }
  }, [isVoucherEligible, applyVoucher]);

  const userLifetimePoints =
    loyaltyData?.lifetime_paw_points ??
    loyaltyData?.lifetimePawPoints ??
    user?.profile?.lifetime_paw_points ??
    user?.lifetime_paw_points ??
    0;
  const isTubby = loyaltyData?.tier === "Tubby Club" || userLifetimePoints >= 2500;

  const maxVisitors = settings?.max_visitors || 8;

  const selectedSlotObj = useMemo(() => {
    if (!selectedSlot) return null;
    return (
      slots.find(
        (s) =>
          s?.slot_start &&
          typeof s.slot_start === "string" &&
          s.slot_start.startsWith(selectedSlot.slice(0, 5))
      ) || null
    );
  }, [slots, selectedSlot]);

  const effectiveMaxVisitors = useMemo(() => {
    if (!selectedSlotObj) return maxVisitors;
    const spotsLeft =
      selectedSlotObj.spots_left != null
        ? selectedSlotObj.spots_left
        : selectedSlotObj.remaining_spots != null
        ? selectedSlotObj.remaining_spots
        : maxVisitors;
    return Math.max(1, Math.min(maxVisitors, spotsLeft));
  }, [selectedSlotObj, maxVisitors]);

  useEffect(() => {
    if (visitors > effectiveMaxVisitors) {
      setVisitors(effectiveMaxVisitors);
    }
  }, [effectiveMaxVisitors, visitors]);

  // Memoized pricing calculation synced with hourlyRate and minDeposit from Room Settings
  const { totalCost, depositAmount, amountDue, balanceRemaining } = useMemo(() => {
    const raw = visitors * hourlyRate;
    const safeVouchers = Array.isArray(catroomVouchers) ? catroomVouchers : [];
    const hasVoucherDiscount = applyVoucher && isVoucherEligible && safeVouchers.length > 0;
    const discount = hasVoucherDiscount ? 0.5 : 1.0;
    const total = raw * discount;
    const fiftyPct = Math.round(total * 0.5 * 100) / 100; // 50% of total cost
    const deposit = hasVoucherDiscount
      ? fiftyPct
      : Math.min(total, Math.max(fiftyPct, minDeposit));
    const due = paymentOption === "deposit" ? deposit : total;
    const balance = paymentOption === "deposit" ? Math.max(0, total - deposit) : 0;
    return {
      totalCost: total,
      depositAmount: deposit,
      amountDue: due,
      balanceRemaining: balance,
    };
  }, [visitors, hourlyRate, minDeposit, applyVoucher, isVoucherEligible, catroomVouchers, paymentOption]);

  const selectedSlotData = useMemo(() => {
    if (!selectedSlot || !Array.isArray(slots) || !slots.length) return null;
    return slots.find((s) => s?.slot_start && typeof s.slot_start === "string" && s.slot_start.startsWith(selectedSlot.slice(0, 5)));
  }, [selectedSlot, slots]);

  // Mouse / Touch sliding handlers for Date chips
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - dateScrollRef.current.offsetLeft;
    scrollLeftRef.current = dateScrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const x = e.pageX - dateScrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 5) {
      hasMovedRef.current = true;
    }
    dateScrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Submit Reservation
  const handleBooking = async () => {
    setError(null);

    if (!user) {
      const params = new URLSearchParams({
        date: selectedDate,
        slot: selectedSlot,
        visitors: String(visitors),
        payment: paymentOption,
      });
      navigate(`/login?redirect=${encodeURIComponent(`/catroom?${params.toString()}`)}`);
      return;
    }

    if (!selectedDate) {
      setError("Please choose a date for your visit.");
      return;
    }
    if (!selectedSlot) {
      setError("Please choose a time slot.");
      return;
    }
    if (!policyAcknowledged) {
      setError("Please acknowledge and agree to the Cat Room house policies.");
      return;
    }

    setSubmitting(true);

    try {
      const latestSlotsData = await api.get(`/api/catroom/slots/?date=${selectedDate}`);
      const latestSlots = Array.isArray(latestSlotsData)
        ? latestSlotsData
        : latestSlotsData?.results || [];

      const target = latestSlots.find((s) =>
        s.slot_start.startsWith(selectedSlot.slice(0, 5))
      );

      if (!target || target.state !== "available") {
        setSlots(latestSlots);
        setSelectedSlot("");
        setError("This time slot was just booked or is no longer available. Please pick another.");
        setSubmitting(false);
        return;
      }

      const payload = {
        date: selectedDate,
        slot_start: selectedSlot.slice(0, 5),
        visitors: Number(visitors),
        payment_option: paymentOption,
        policy_acknowledged: true,
        voucher_code:
          applyVoucher && catroomVouchers.length > 0 ? catroomVouchers[0].code : undefined,
      };

      const res = await api.post("/api/catroom/reservations/", payload);
      try {
        localStorage.removeItem(draftKey);
      } catch { }
      setCreatedReservation(res);
      window.dispatchEvent(new CustomEvent("catopia:reservation-change"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const msg =
        err?.data?.slot_start ||
        err?.data?.date ||
        err?.data?.visitors ||
        err?.data?.detail ||
        err?.message ||
        "Failed to create reservation. Please try again.";
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayReservation = async () => {
    if (!createdReservation?.id) return;
    setPayLoading(true);
    setPayError(null);
    try {
      const data = await api.post("/api/payments/checkout/", {
        type: "reservation",
        id: createdReservation.id,
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
      const msg = err?.data?.detail || err?.message || "Failed to initialize payment checkout.";
      setPayError(msg);
      setPayLoading(false);
    }
  };

  const handleToggleFavoriteCat = async (catId) => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    try {
      await api.post(`/api/cats/residents/${catId}/favorite/`);
      setCats((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, is_favorite: !c.is_favorite } : c))
      );
    } catch {
      // silent
    }
  };

  // Success Confirmation View
  if (createdReservation) {
    return (
      <div className="bg-cream min-h-screen py-10 md:py-16">
        <div className="mx-auto max-w-xl px-4">
          <Card className="border-border/80 bg-white shadow-xl rounded-3xl overflow-hidden">
            <div className="bg-[#2D221B] p-7 md:p-8 text-white text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-caramel/20 text-caramel mb-2">
                <CheckCircle className="h-8 w-8 text-caramel" />
              </div>
              <p className="text-caramel italic font-heading text-sm">Your visit is confirmed</p>
              <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight text-white">
                Cat Room Session Held!
              </h1>
              <p className="text-white/75 text-xs max-w-sm mx-auto">
                Spend 60 cozy minutes with our feline residents. Complete payment to secure your booking.
              </p>
            </div>

            <CardContent className="p-6 md:p-8 space-y-6">
              <HoldCountdownBanner
                holdExpiresAt={createdReservation?.hold_expires_at}
                holdMinutes={holdMinutes}
              />

              <div className="rounded-2xl bg-cream/60 border border-border/80 p-5 space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2.5 border-b border-border/60">
                  <span className="text-muted-foreground">Reservation Ref</span>
                  <span className="font-mono font-bold text-caramel">#CR-{createdReservation.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-semibold text-espresso">{formatFullDate(createdReservation.date)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Time (1 hour)</span>
                  <span className="font-semibold text-espresso">
                    {formatTime(createdReservation.slot_start)} – {formatTime(createdReservation.slot_end)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Visitors</span>
                  <span className="font-semibold text-espresso">
                    {createdReservation.visitors} × {formatPHP(hourlyRate)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Payment Plan</span>
                  <span className="font-semibold text-espresso capitalize">
                    {createdReservation.payment_option === "deposit" ? "50% Deposit Only" : "Full Payment"}
                  </span>
                </div>
                <div className="pt-3 border-t border-border/60 flex justify-between items-center">
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Amount Due Now</span>
                    <span className="font-heading text-2xl font-bold text-caramel">
                      {formatPHP(createdReservation.amount_due)}
                    </span>
                  </div>
                  {createdReservation.payment_option === "deposit" && (
                    <div className="text-right">
                      <span className="text-muted-foreground text-[11px] block">Pay at the Café</span>
                      <span className="font-semibold text-espresso text-sm">
                        {formatPHP(parseFloat(createdReservation.fee) - parseFloat(createdReservation.amount_due))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {payError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Button
                  className="w-full py-6 rounded-full bg-gradient-to-r from-[#D4883E] to-[#B86E2A] hover:brightness-110 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                  onClick={handlePayReservation}
                  disabled={payLoading}
                >
                  {payLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Redirecting to Payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5 mr-2" />
                      Pay Now with Xendit ({formatPHP(createdReservation.amount_due)})
                    </>
                  )}
                </Button>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" className="flex-1 rounded-full" onClick={() => navigate("/reservations")}>
                    <CalendarDays className="h-4 w-4 mr-2" />
                    My Reservations
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 rounded-full text-muted-foreground hover:text-espresso"
                    onClick={() => {
                      setCreatedReservation(null);
                      setSelectedSlot("");
                      setPolicyAcknowledged(false);
                      fetchSlots(selectedDate);
                    }}
                  >
                    Book Another Session
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen pb-20 selection:bg-caramel/20">
      {/* 1. HERO HEADER */}
      <section className="pt-12 pb-8 md:pt-16 md:pb-12 text-center px-4 relative overflow-hidden">
        {/* Subtle decorative accents matching reference */}
        <div className="absolute top-8 left-8 sm:left-16 text-caramel/15 pointer-events-none select-none">
          <PawPrint className="h-7 w-7 rotate-[-12deg]" />
        </div>
        <div className="absolute top-10 right-8 sm:right-16 text-caramel/20 pointer-events-none select-none">
          <Sparkles className="h-6 w-6" />
        </div>

        <div className="mx-auto max-w-2xl space-y-2">
          {/* Script accent tag */}
          <p className="font-heading italic text-caramel text-base md:text-lg tracking-wide">
            Reserve
          </p>

          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-espresso tracking-tight leading-tight">
            The Cat Room, One Cozy Hour
          </h1>

          <p className="text-muted-foreground text-xs sm:text-sm max-w-md mx-auto leading-relaxed pt-1">
            Choose a date, pick a one-hour slot and tell us how many are coming.
            <br className="hidden sm:inline" /> Availability updates live.
          </p>
        </div>
      </section>

      {/* 2. MAIN BOOKING SECTION (Matching Reference Grid) */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* LEFT COLUMN: Large White Booking Card */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-9 shadow-[0_8px_30px_rgb(61,43,31,0.06)] border border-[#EFEAE2] space-y-8">
            {/* Step 1: Choose a date */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-espresso flex items-center gap-1.5">
                  <span className="text-caramel font-bold">1.</span>
                  <span>Choose a date</span>
                </h2>
                <span className="text-xs text-muted-foreground font-medium">
                  {selectedDate ? formatFullDate(selectedDate) : ""}
                </span>
              </div>

              {/* Tap-and-Slide Horizontal Date Chips */}
              <div
                ref={dateScrollRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-none select-none cursor-grab active:cursor-grabbing touch-pan-x"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {(Array.isArray(days) ? days : []).map((day) => {
                  const isSelected = selectedDate === day.iso;
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      onClick={() => {
                        if (!hasMovedRef.current) {
                          setSelectedDate(day.iso);
                        }
                      }}
                      className={`flex flex-col items-center justify-center shrink-0 w-16 sm:w-17 py-3 px-1 rounded-2xl transition-all duration-200 cursor-pointer text-center ${isSelected
                          ? "bg-caramel text-white shadow-md shadow-caramel/25 scale-[1.02]"
                          : "bg-[#FAF6F0] hover:bg-[#F3EDE4] border border-[#ECE4D8] text-espresso"
                        }`}
                    >
                      <span
                        className={`text-[11px] font-medium leading-none mb-1 ${isSelected ? "text-white/85" : "text-muted-foreground"
                          }`}
                      >
                        {day.dayName}
                      </span>
                      <span className="text-xl font-bold font-heading leading-tight my-0.5">
                        {day.dayNumber}
                      </span>
                      <span
                        className={`text-[10px] leading-none ${isSelected ? "text-white/80" : "text-muted-foreground/80"
                          }`}
                      >
                        {day.monthName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Pick your hour */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-espresso flex items-center gap-1.5">
                  <span className="text-caramel font-bold">2.</span>
                  <span>Pick your hour</span>
                </h2>

                {/* Live Indicator & Refresh Button */}
                <LiveRefreshBadge
                  lastRefreshedAt={lastRefreshedAt}
                  refreshing={refreshing}
                  loadingSlots={loadingSlots}
                  onRefresh={handleManualRefresh}
                />
              </div>

              {/* Slots Grid: 3 columns matching reference */}
              {loadingSlots ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                  ))}
                </div>
              ) : !Array.isArray(slots) || slots.length === 0 ? (
                <div className="text-center py-8 rounded-2xl bg-[#FAF6F0] border border-dashed border-border/80 text-muted-foreground text-xs">
                  <Clock className="h-6 w-6 mx-auto mb-1 text-caramel/50" />
                  {error || "No slots scheduled for this date."}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {slots.map((slot, idx) => {
                    if (!slot || !slot.slot_start) return null;
                    const isAvailable = slot.state === "available";
                    const isPassed = slot.state === "past";
                    const isBooked = slot.state === "booked";
                    const isBlocked = slot.state === "blocked";

                    const isSelected =
                      selectedSlot && typeof slot.slot_start === "string" && slot.slot_start.startsWith(selectedSlot.slice(0, 5));

                    const capacity = slot.max_capacity ?? slot.capacity ?? maxVisitors;
                    const spotsLeft =
                      slot.spots_left != null
                        ? slot.spots_left
                        : slot.remaining_spots != null
                        ? slot.remaining_spots
                        : isAvailable
                        ? capacity
                        : 0;

                    return (
                      <button
                        key={slot.slot_start || idx}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => isAvailable && setSelectedSlot(slot.slot_start)}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all select-none ${isSelected
                            ? "bg-caramel/10 border-caramel ring-2 ring-caramel shadow-xs cursor-pointer"
                            : isPassed
                              ? "bg-[#F5F1EB] text-[#8C827A] border-[#EBE4D8]/80 cursor-not-allowed opacity-65"
                              : isBooked || isBlocked
                                ? "bg-[#F5F1EB] text-[#8C827A] border-[#EBE4D8]/80 cursor-not-allowed opacity-75"
                                : "bg-white hover:bg-[#FAF6F0] border-[#E2D9CC] hover:border-caramel/60 cursor-pointer shadow-2xs"
                          }`}
                      >
                        <span
                          className={`text-xs font-semibold tracking-tight ${isSelected
                              ? "text-caramel font-bold"
                              : isPassed || isBooked || isBlocked
                                ? "text-[#8C827A]"
                                : "text-espresso"
                            }`}
                        >
                          {formatTime(slot.slot_start)} – {formatTime(slot.slot_end)}
                        </span>

                        {isPassed ? (
                          <span className="mt-1 flex items-center gap-1 text-[10px] text-[#9A9188]">
                            <Clock className="h-2.5 w-2.5" />
                            Passed
                          </span>
                        ) : isBooked ? (
                          <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                            Booked
                          </span>
                        ) : isBlocked ? (
                          <span className="mt-1 text-[10px] text-muted-foreground font-medium">
                            Rest hours
                          </span>
                        ) : (
                          <span
                            className={`mt-1 flex items-center gap-1 text-[10px] font-medium ${isSelected ? "text-caramel font-semibold" : "text-caramel/90"
                              }`}
                          >
                            <Users className="h-2.5 w-2.5 shrink-0" />
                            {spotsLeft} of {capacity} spots left
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3: Visitors & Optional Note */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                {/* Stepper */}
                <div className="sm:col-span-5 space-y-1.5">
                  <h2 className="text-sm font-semibold text-espresso flex items-center gap-1.5">
                    <span className="text-caramel font-bold">3.</span>
                    <span>Visitors</span>
                  </h2>

                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-white border-border/80 hover:bg-latte/50"
                      disabled={visitors <= 1}
                      onClick={() => setVisitors((v) => Math.max(1, v - 1))}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-lg font-bold font-heading text-espresso">
                      {visitors}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-white border-border/80 hover:bg-latte/50"
                      disabled={visitors >= effectiveMaxVisitors}
                      onClick={() => setVisitors((v) => Math.min(effectiveMaxVisitors, v + 1))}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Up to {effectiveMaxVisitors} {effectiveMaxVisitors === 1 ? "visitor" : "visitors"} per reservation
                  </p>
                </div>

                {/* Optional Note */}
                <div className="sm:col-span-7 space-y-1.5">
                  <label htmlFor="catroom-notes" className="text-xs text-muted-foreground block font-medium">
                    Anything we should know? <span className="opacity-80">(optional)</span>
                  </label>
                  <input
                    id="catroom-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Celebrating something? First time with cats?"
                    className="w-full text-xs rounded-2xl border border-border/80 px-3.5 py-2.5 bg-[#FAF6F0] focus:bg-white focus:outline-none focus:ring-1 focus:ring-caramel text-espresso placeholder:text-muted-foreground/70"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Dark Espresso Summary Card */}
          <div className="lg:col-span-5 bg-[#2D221B] text-white rounded-3xl p-7 sm:p-8 shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Card Header */}
              <div>
                <p className="font-heading italic text-caramel text-sm">Your visit</p>
                <h3 className="font-heading text-2xl font-bold text-white tracking-tight mt-0.5">
                  Cat Room Summary
                </h3>
              </div>

              {/* Tubby Club Member Perk Badge */}
              {isTubby && (
                <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 to-caramel/20 border border-amber-400/40 p-3 flex items-start gap-2.5 text-xs text-amber-200 shadow-sm">
                  <Crown className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-100 block">👑 Tubby Club Member</span>
                    <span className="text-[11px] text-amber-200/90 leading-tight block">
                      Priority weekday booking & complimentary 15-min extension
                    </span>
                  </div>
                </div>
              )}

              {/* Reservation summary items */}
              <div className="space-y-3 text-xs border-b border-white/10 pb-4">
                <div className="flex items-center justify-between text-white/90">
                  <span className="text-white/60">Date</span>
                  <span className="font-medium text-white">{selectedDate ? formatFullDate(selectedDate) : "—"}</span>
                </div>

                <div className="flex items-center justify-between text-white/90">
                  <span className="text-white/60">Time (1 hour)</span>
                  <span className="font-medium text-white">
                    {selectedSlotData
                      ? `${formatTime(selectedSlotData.slot_start)} – ${formatTime(selectedSlotData.slot_end)}`
                      : "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-white/90">
                  <span className="text-white/60">Visitors</span>
                  <span className="font-medium text-white">
                    {visitors} × {formatPHP(hourlyRate)}
                  </span>
                </div>
              </div>

              {/* Cat Room Voucher Selector */}
              {catroomVouchers.length > 0 && (
                <div className="rounded-xl bg-white/10 border border-white/15 p-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-caramel" />
                      50% Off Voucher Available
                    </span>
                    <button
                      type="button"
                      disabled={!isVoucherEligible}
                      onClick={() => isVoucherEligible && setApplyVoucher(!applyVoucher)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${!isVoucherEligible
                          ? "bg-white/10 text-white/40 cursor-not-allowed"
                          : applyVoucher
                            ? "bg-caramel text-white"
                            : "bg-white/20 text-white/70 hover:bg-white/30"
                        }`}
                    >
                      {applyVoucher ? "Applied (-50%)" : "Apply Voucher"}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/60 font-mono">
                    {catroomVouchers[0]?.code} · {catroomVouchers[0]?.title}
                  </p>
                  {!isVoucherEligible && (
                    <p className="text-[10px] text-amber-300/90 italic pt-0.5">
                      * 50% off voucher is valid for 1 guest on weekdays (Mon–Thu) only
                    </p>
                  )}
                </div>
              )}

              {/* Payment Option Selector */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider block">
                    Payment Option
                  </span>
                  <span className="text-[10px] text-white/55">
                    Min. deposit: {formatPHP(minDeposit)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentOption("deposit")}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${paymentOption === "deposit"
                        ? "bg-caramel/25 border-caramel text-white font-semibold ring-1 ring-caramel"
                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      }`}
                  >
                    <span className="block text-xs">
                      {depositAmount > Math.round(totalCost * 0.5 * 100) / 100
                        ? "Min. Deposit"
                        : "50% Deposit"}
                    </span>
                    <span className="text-[10px] text-caramel-light font-bold">
                      {formatPHP(depositAmount)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentOption("full")}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${paymentOption === "full"
                        ? "bg-caramel/25 border-caramel text-white font-semibold ring-1 ring-caramel"
                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      }`}
                  >
                    <span className="block text-xs">Full Payment</span>
                    <span className="text-[10px] text-caramel-light font-bold">
                      {formatPHP(totalCost)}
                    </span>
                  </button>
                </div>
              </div>

              {/* Amount Display */}
              <div className="pt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-white/70">
                    {paymentOption === "deposit" ? "Deposit Due Now" : "Pay at the café"}
                  </span>
                  <span className="font-heading text-3xl font-bold text-caramel">
                    {formatPHP(amountDue)}
                  </span>
                </div>
                {paymentOption === "deposit" && (
                  <p className="text-[11px] text-white/60 text-right mt-1">
                    Remaining balance at check-in: {formatPHP(balanceRemaining)}
                  </p>
                )}
              </div>

              {/* Policy Checkbox inside dark card */}
              <div className="flex items-start gap-3 pt-2">
                <Checkbox
                  id="catroom-policy"
                  checked={policyAcknowledged}
                  onCheckedChange={(checked) => setPolicyAcknowledged(!!checked)}
                  className="mt-0.5 border-white/40 data-[state=checked]:bg-caramel data-[state=checked]:border-caramel"
                />
                <label
                  htmlFor="catroom-policy"
                  className="text-xs text-white/80 leading-relaxed cursor-pointer select-none"
                >
                  I understand no outside pets are allowed and that I&apos;ll play only with Catopia Café&apos;s resident cats.
                </label>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Glowing Pill Button */}
              <button
                type="button"
                disabled={submitting || (user && (!selectedSlot || !policyAcknowledged))}
                onClick={handleBooking}
                className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#D4883E] to-[#B86E2A] hover:brightness-110 text-white font-semibold text-sm shadow-[0_6px_25px_rgba(212,136,62,0.45)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : !user ? (
                  <span>Sign in to reserve</span>
                ) : (
                  <span>Confirm Reservation</span>
                )}
              </button>

              <p className="text-[11px] text-white/50 text-center">
                Free cancellation up to {cancelCutoffHours}h before your slot from your profile.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOUSE POLICY SECTION (True to Reference) */}
      <section id="house-policy" className="mx-auto max-w-5xl px-4 sm:px-6 mt-16 md:mt-24 scroll-mt-24">
        <div className="rounded-3xl bg-[#2D221B] text-white p-7 sm:p-10 md:p-12 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left side: Residents Only, Please */}
            <div className="lg:col-span-5 space-y-4">
              <p className="font-heading italic text-caramel text-sm">House policy</p>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
                Residents Only,
                <br />
                Please
              </h2>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-start gap-3 mt-4">
                <div className="h-9 w-9 rounded-full bg-caramel/20 flex items-center justify-center shrink-0 text-caramel mt-0.5">
                  <Ban className="h-4.5 w-4.5" />
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  <span className="font-semibold text-white">No outside pets are allowed.</span> Guests play exclusively with Catopia Café&apos;s own resident cats, so our cats can stay calm, healthy and safe at home.
                </p>
              </div>

              <p className="text-xs text-white/60 leading-relaxed pt-1">
                We maintain strict hygiene protocols and vaccination standards to ensure our resident felines live their happiest, healthiest lives.
              </p>
            </div>

            {/* Right side: 2x2 grid of white rounded cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Card 1 */}
              <div className="bg-white rounded-2xl p-5 text-espresso shadow-xs space-y-2">
                <div className="h-8 w-8 rounded-full bg-caramel/15 text-caramel flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <h3 className="font-heading font-bold text-sm text-espresso">Exactly one hour</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Every reservation is a fixed 1-hour slot in our single Cat Room.
                </p>
              </div>

              {/* Card 2 */}
              <div className="bg-white rounded-2xl p-5 text-espresso shadow-xs space-y-2">
                <div className="h-8 w-8 rounded-full bg-caramel/15 text-caramel flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="font-heading font-bold text-sm text-espresso">
                  Up to {maxVisitors} {maxVisitors === 1 ? "visitor" : "visitors"} per hour
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Book up to {maxVisitors} {maxVisitors === 1 ? "visitor" : "visitors"} per reservation to ensure plenty of personal cat time.
                </p>
              </div>

              {/* Card 3 */}
              <div className="bg-white rounded-2xl p-5 text-espresso shadow-xs space-y-2">
                <div className="h-8 w-8 rounded-full bg-caramel/15 text-caramel flex items-center justify-center">
                  <Droplets className="h-4 w-4" />
                </div>
                <h3 className="font-heading font-bold text-sm text-espresso">Wash up on arrival</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Fresh hands keep our residents healthy and happy. Sanitizers provided at door.
                </p>
              </div>

              {/* Card 4 */}
              <div className="bg-white rounded-2xl p-5 text-espresso shadow-xs space-y-2">
                <div className="h-8 w-8 rounded-full bg-caramel/15 text-caramel flex items-center justify-center">
                  <HandHeart className="h-4 w-4" />
                </div>
                <h3 className="font-heading font-bold text-sm text-espresso">Let cats come to you</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  No picking up, and please let sleeping cats lie. Gentle scratches are adored.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MEET OUR RESIDENT CATS SECTION */}
      <section id="our-cats" className="mx-auto max-w-5xl px-4 sm:px-6 mt-16 md:mt-24 text-center scroll-mt-24">
        <p className="font-heading italic text-caramel text-sm">Who you&apos;ll meet</p>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-espresso tracking-tight mt-1 mb-2">
          Meet Our Resident Cats
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mb-10 leading-relaxed">
          Each resident keeps their own play schedule and rest days. Tap the heart to save your favorites.
        </p>

        {/* Resident Cats Grid */}
        {initialLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-72 w-full rounded-3xl" />
            ))}
          </div>
        ) : cats.length === 0 ? (
          <p className="text-xs sm:text-sm text-muted-foreground py-8">
            No resident cats are currently available in the Cat Room.
          </p>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          {cats.map((cat) => {
            const photoUrl = getCatPhotoUrl(cat);
            return (
            <Card
              key={cat.id}
              className="group overflow-hidden bg-white rounded-3xl border border-border/70 shadow-xs hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-latte/30 flex items-center justify-center">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={cat.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      No Image
                    </span>
                  )}
                  <div className="absolute top-3 right-3">
                    <button
                      type="button"
                      onClick={() => handleToggleFavoriteCat(cat.id)}
                      className="p-2 rounded-full bg-white/90 backdrop-blur-xs text-caramel flex items-center justify-center shadow-xs cursor-pointer hover:bg-white transition-colors"
                      aria-label="Toggle favorite"
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${cat.is_favorite
                            ? "fill-caramel text-caramel"
                            : "fill-caramel/20 text-caramel"
                          }`}
                      />
                    </button>
                  </div>
                  <div className="absolute top-3 left-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold backdrop-blur-xs ${
                        cat.status === "resting"
                          ? "bg-amber-100/90 text-amber-800"
                          : cat.status === "vet_day"
                          ? "bg-rose-100/90 text-rose-800"
                          : "bg-emerald-100/90 text-emerald-800"
                      }`}
                    >
                      {cat.status_display || (cat.status === "resting" ? "Resting" : cat.status === "vet_day" ? "Vet day" : "Ready to play")}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-heading font-bold text-espresso text-base">
                      {cat.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {cat.breed || "Resident"} · {cat.age} {cat.age === 1 ? "yr" : "yrs"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {cat.personality || "Friendly and cuddly resident cat who loves afternoon playtime."}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-caramel" />
                  {cat.schedule?.plays || "All day"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-caramel" />
                  {cat.schedule?.rest_days ? `Rest: ${cat.schedule.rest_days}` : "Loves treats"}
                </span>
              </div>
            </Card>
            );
          })}
        </div>
        )}

        {/* Circular Cat Avatars Row (Matching bottom of reference) */}
        {cats.length > 0 && (
          <div className="flex items-center justify-center -space-x-3 mt-12">
            {cats
              .filter((cat) => Boolean(getCatPhotoUrl(cat)))
              .slice(0, 5)
              .map((cat) => (
                <img
                  key={cat.id}
                  src={getCatPhotoUrl(cat)}
                  alt={cat.name}
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-black/5"
                  loading="lazy"
                  decoding="async"
                />
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
