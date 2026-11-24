import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  Clock,
  Users,
  Plus,
  Ban,
  CheckCircle,
  XCircle,
  RotateCw,
  AlertCircle,
  Save,
  Moon,
  Sun,
} from "lucide-react";

function formatTime(timeStr) {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  let h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function getUpcomingDays(count = 14) {
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

export default function CatRoomTab() {
  const days = useMemo(() => getUpcomingDays(14), []);
  const [selectedDate, setSelectedDate] = useState(days[0]?.iso || "");
  const [slots, setSlots] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [pendingReservations, setPendingReservations] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [decliningId, setDecliningId] = useState(null);

  // Room settings form
  const [savingSettings, setSavingSettings] = useState(false);
  const [hourlyRate, setHourlyRate] = useState("300.00");
  const [maxVisitors, setMaxVisitors] = useState(8);
  const [minDeposit, setMinDeposit] = useState("150.00");
  const [dailyRestHours, setDailyRestHours] = useState(["14:00"]);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState("");

  // Reschedule Modal
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");

  // Walk-in Modal
  const [walkinTargetSlot, setWalkinTargetSlot] = useState(null);
  const [walkinVisitors, setWalkinVisitors] = useState(1);
  const [walkinLoading, setWalkinLoading] = useState(false);

  // Fetch Room Settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get("/api/catroom/settings/");
      setSettings(res);
      setHourlyRate(res.hourly_rate || "300.00");
      setMaxVisitors(res.max_visitors || 8);
      setMinDeposit(res.min_deposit || "150.00");
      setDailyRestHours(Array.isArray(res.daily_rest_hours) ? res.daily_rest_hours : ["14:00"]);
    } catch {
      // fallback
    }
  }, []);

  // Fetch Slots for selectedDate and all pending_payment reservations awaiting approval
  const fetchSlotsAndReservations = useCallback(async () => {
    setLoadingSlots(true);
    setError(null);
    try {
      const [slotsData, resData, pendingData] = await Promise.all([
        api.get(`/api/catroom/slots/?date=${selectedDate}`),
        api.get(`/api/catroom/reservations/?date=${selectedDate}`),
        api.get(`/api/catroom/reservations/?status=pending_payment`).catch(() => null),
      ]);
      const dateResList = Array.isArray(resData) ? resData : resData?.results || [];
      setSlots(Array.isArray(slotsData) ? slotsData : slotsData?.results || []);
      setReservations(dateResList);
      if (pendingData) {
        const pendingList = Array.isArray(pendingData) ? pendingData : pendingData?.results || [];
        setPendingReservations(pendingList);
      } else {
        setPendingReservations(dateResList.filter((r) => r.status === "pending_payment"));
      }
    } catch (err) {
      setError("Unable to load slots or bookings.");
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchSlotsAndReservations();
  }, [fetchSlotsAndReservations]);

  // Listen to reservation changes from customer cancellations or bookings
  useEffect(() => {
    const handleReservationChange = () => {
      fetchSlotsAndReservations();
    };
    window.addEventListener("catopia:reservation-change", handleReservationChange);
    return () => {
      window.removeEventListener("catopia:reservation-change", handleReservationChange);
    };
  }, [fetchSlotsAndReservations]);

  // Handle Save Room Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSavedMsg("");
    setError(null);
    try {
      const updated = await api.patch("/api/catroom/settings/", {
        hourly_rate: hourlyRate,
        max_visitors: Number(maxVisitors),
        min_deposit: minDeposit,
        daily_rest_hours: dailyRestHours,
      });
      if (updated) {
        setSettings(updated);
        setHourlyRate(updated.hourly_rate || hourlyRate);
        setMaxVisitors(updated.max_visitors || Number(maxVisitors));
        setMinDeposit(updated.min_deposit || minDeposit);
        setDailyRestHours(
          Array.isArray(updated.daily_rest_hours) ? updated.daily_rest_hours : dailyRestHours
        );
      }
      setSettingsSavedMsg("Settings saved & synced to pages!");
      await fetchSlotsAndReservations();
      window.dispatchEvent(new CustomEvent("catopia:settings-change", { detail: updated }));
      window.dispatchEvent(new CustomEvent("catopia:reservation-change"));
      try {
        localStorage.setItem("catopia_settings_updated_at", String(Date.now()));
      } catch {}
      setTimeout(() => setSettingsSavedMsg(""), 3500);
    } catch {
      setError("Failed to save room settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Toggle Slot Block
  const handleToggleBlock = async (slot) => {
    const isBlocked = slot.state === "blocked";
    try {
      if (isBlocked) {
        await api.post("/api/catroom/blocked-slots/unblock/", {
          date: selectedDate,
          slot_start: slot.slot_start.slice(0, 5),
        });
      } else {
        await api.post("/api/catroom/blocked-slots/block/", {
          date: selectedDate,
          slot_start: slot.slot_start.slice(0, 5),
          reason: "blocked",
        });
      }
      window.dispatchEvent(new CustomEvent("catopia:settings-change"));
      window.dispatchEvent(new CustomEvent("catopia:reservation-change"));
      try {
        localStorage.setItem("catopia_settings_updated_at", String(Date.now()));
      } catch {}
      await fetchSlotsAndReservations();
    } catch (err) {
      console.error("Failed to toggle slot block:", err);
      alert(err?.data?.detail || "Failed to update slot block.");
    }
  };

  // Approve Reservation
  const handleApprove = async (reservationId) => {
    setApprovingId(reservationId);
    setActionFeedback(null);
    try {
      const updated = await api.post(`/api/catroom/reservations/${reservationId}/approve/`);
      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, ...updated, status: "confirmed" } : r))
      );
      setPendingReservations((prev) => prev.filter((r) => r.id !== reservationId));
      setActionFeedback({
        type: "success",
        message: `Reservation #CR-${reservationId} for ${updated?.customer_name || "customer"} approved and confirmed!`,
      });
      window.dispatchEvent(new CustomEvent("catopia:reservation-change"));
      await fetchSlotsAndReservations();
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err) {
      const detail = err?.data?.detail || "Failed to approve reservation.";
      setActionFeedback({
        type: "error",
        message: detail,
      });
    } finally {
      setApprovingId(null);
    }
  };

  // Cancel / Decline Reservation
  const handleCancelReservation = async (reservationId) => {
    if (!window.confirm("Are you sure you want to cancel/decline this booking?")) return;
    setDecliningId(reservationId);
    setActionFeedback(null);
    try {
      await api.post(`/api/catroom/reservations/${reservationId}/cancel/`);
      setPendingReservations((prev) => prev.filter((r) => r.id !== reservationId));
      setActionFeedback({
        type: "success",
        message: `Reservation #CR-${reservationId} has been declined/cancelled.`,
      });
      window.dispatchEvent(new CustomEvent("catopia:reservation-change"));
      await fetchSlotsAndReservations();
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err) {
      const detail = err?.data?.detail || "Failed to cancel reservation.";
      setActionFeedback({
        type: "error",
        message: detail,
      });
    } finally {
      setDecliningId(null);
    }
  };

  // Reschedule submit
  const handleRescheduleSubmit = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleSlot) return;
    setRescheduleLoading(true);
    setRescheduleError("");
    try {
      await api.post(`/api/catroom/reservations/${rescheduleTarget.id}/reschedule/`, {
        date: rescheduleDate,
        slot_start: rescheduleSlot,
      });
      setRescheduleTarget(null);
      window.dispatchEvent(new CustomEvent("catopia:reservation-change"));
      fetchSlotsAndReservations();
    } catch (err) {
      setRescheduleError(err?.data?.detail || "Failed to reschedule booking.");
    } finally {
      setRescheduleLoading(false);
    }
  };

  // Walk-in booking submit
  const handleWalkinSubmit = async () => {
    if (!walkinTargetSlot) return;
    setWalkinLoading(true);
    try {
      await api.post("/api/catroom/reservations/walkin/", {
        date: selectedDate,
        slot_start: walkinTargetSlot.slot_start,
        visitors: walkinVisitors,
      });
      setWalkinTargetSlot(null);
      window.dispatchEvent(new CustomEvent("catopia:reservation-change"));
      fetchSlotsAndReservations();
    } catch (err) {
      alert(err?.data?.detail || "Failed to create walk-in booking.");
    } finally {
      setWalkinLoading(false);
    }
  };

  // Filter Awaiting Approval Reservations (combine selected date and global pending_payment bookings)
  const awaitingApprovalList = useMemo(() => {
    const map = new Map();
    for (const r of pendingReservations) {
      if (r.status === "pending_payment") map.set(r.id, r);
    }
    for (const r of reservations) {
      if (r.status === "pending_payment") map.set(r.id, r);
    }
    return Array.from(map.values());
  }, [pendingReservations, reservations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-heading italic text-caramel text-base md:text-lg">
            Single Cat Room
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-espresso tracking-tight">
            Cat Room Bookings
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSlotsAndReservations}
          className="rounded-full gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loadingSlots ? "animate-spin text-caramel" : ""}`} />
          Refresh Slots
        </Button>
      </div>

      {/* Date Carousel Chips */}
      <div className="rounded-3xl bg-white border border-border/80 p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-espresso">
            {new Date(selectedDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {reservations.length} total booking{reservations.length === 1 ? "" : "s"} today
          </span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 pt-1 scrollbar-none select-none">
          {days.map((day) => {
            const isSelected = selectedDate === day.iso;
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => setSelectedDate(day.iso)}
                className={`flex flex-col items-center justify-center shrink-0 w-16 sm:w-18 py-3 px-1 rounded-2xl transition-all cursor-pointer text-center ${
                  isSelected
                    ? "bg-caramel text-white shadow-md shadow-caramel/25 scale-[1.02]"
                    : "bg-[#FAF6F0] hover:bg-[#F3EDE4] border border-[#ECE4D8] text-espresso"
                }`}
              >
                <span
                  className={`text-[11px] font-medium leading-none mb-1 ${
                    isSelected ? "text-white/85" : "text-muted-foreground"
                  }`}
                >
                  {day.dayName}
                </span>
                <span className="text-xl font-bold font-heading leading-tight my-0.5">
                  {day.dayNumber}
                </span>
                <span
                  className={`text-[10px] leading-none ${
                    isSelected ? "text-white/80" : "text-muted-foreground/80"
                  }`}
                >
                  {day.monthName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Slots on Left, Awaiting & Settings on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 1-Hour Slots List */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-espresso">
              Hourly Schedule & Capacity
            </h2>
            <span className="text-xs text-muted-foreground">
              Capacity: {maxVisitors} guests / hr
            </span>
          </div>

          {loadingSlots ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground rounded-3xl bg-white border border-border/80">
              No slots scheduled for this date.
            </div>
          ) : (
            slots.map((slot) => {
              const isBlocked = slot.state === "blocked";
              const isPast = slot.state === "past";
              const isBooked = slot.state === "booked";
              const capacity = slot.max_capacity ?? slot.capacity ?? maxVisitors;
              const bookedCount = slot.booked_visitors != null
                ? slot.booked_visitors
                : (slot.spots_left != null
                    ? Math.max(0, capacity - slot.spots_left)
                    : (slot.remaining_spots != null ? Math.max(0, capacity - slot.remaining_spots) : 0));
              const remaining = slot.spots_left ?? slot.remaining_spots ?? Math.max(0, capacity - bookedCount);
              const bookedPct = capacity > 0 ? Math.min(100, Math.round((bookedCount / capacity) * 100)) : 0;

              // Active reservations for this slot
              const slotReservations = reservations.filter((r) =>
                r.slot_start.startsWith(slot.slot_start.slice(0, 5))
              );

              return (
                <Card
                  key={slot.slot_start}
                  className={`rounded-2xl border transition-all ${
                    isBlocked
                      ? "bg-latte/30 border-border/60 opacity-80"
                      : "bg-white border-border/80 shadow-2xs hover:shadow-xs"
                  }`}
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Time & Visitor Bar */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-sm text-espresso">
                          {formatTime(slot.slot_start)} – {formatTime(slot.slot_end)}
                        </span>
                        {isBlocked ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-muted/60 text-muted-foreground border-border"
                          >
                            Closed to visitors this hour
                          </Badge>
                        ) : isPast ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Past slot
                          </Badge>
                        ) : null}
                      </div>

                      {!isBlocked && (
                        <div className="space-y-1 max-w-xs">
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>
                              <Users className="h-3 w-3 inline mr-1 text-caramel" />
                              {bookedCount}/{capacity} visitors
                            </span>
                            <span className="font-medium">
                              {remaining} spots left
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-latte/40 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${bookedPct}%` }}
                              className={`h-full rounded-full transition-all ${
                                bookedPct >= 100 ? "bg-espresso" : "bg-caramel"
                              }`}
                            />
                          </div>
                        </div>
                      )}

                      {/* Attached Bookings Names */}
                      {slotReservations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {slotReservations.map((res) => (
                            <span
                              key={res.id}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-caramel/10 text-espresso font-medium flex items-center gap-1 border border-caramel/20"
                            >
                              <span>{res.customer_name} ({res.visitors}p)</span>
                              <button
                                onClick={() => {
                                  setRescheduleTarget(res);
                                  setRescheduleDate(res.date);
                                  setRescheduleSlot(res.slot_start.slice(0, 5));
                                }}
                                title="Reschedule booking"
                                className="text-caramel hover:underline cursor-pointer ml-1 text-[9px]"
                              >
                                Edit
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {!isPast && !isBlocked && remaining > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setWalkinTargetSlot(slot);
                            setWalkinVisitors(1);
                          }}
                          className="h-8 rounded-full text-xs gap-1 border-caramel/30 text-espresso hover:bg-caramel/10 cursor-pointer"
                        >
                          <Plus className="h-3 w-3 text-caramel" />
                          Walk-in
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleBlock(slot)}
                        className={`h-8 rounded-full text-xs gap-1 cursor-pointer ${
                          isBlocked
                            ? "text-emerald-700 hover:bg-emerald-500/10"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {isBlocked ? (
                          <>
                            <Sun className="h-3.5 w-3.5 text-emerald-600" />
                            Unblock
                          </>
                        ) : (
                          <>
                            <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                            Block hour
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN: Awaiting Approval & Room Settings */}
        <div className="lg:col-span-4 space-y-6">
          {/* Awaiting Approval Card */}
          <Card className="rounded-3xl border-border/80 bg-white shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-bold text-espresso">
                Awaiting approval
              </h2>
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-800 border-amber-500/30 text-xs px-2"
              >
                {awaitingApprovalList.length}
              </Badge>
            </div>

            {actionFeedback && (
              <div
                className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2 ${
                  actionFeedback.type === "success"
                    ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/30"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}
              >
                {actionFeedback.type === "success" ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
            )}

            {awaitingApprovalList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No bookings awaiting approval.
              </p>
            ) : (
              <div className="space-y-3">
                {awaitingApprovalList.map((res) => (
                  <div
                    key={res.id}
                    className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-border/80 space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-espresso">{res.customer_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {res.date} · {formatTime(res.slot_start)} · {res.visitors} guest{res.visitors > 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="font-semibold text-caramel font-mono">
                        {formatPHP(parseFloat(res.fee))}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={approvingId === res.id || decliningId === res.id}
                        onClick={() => handleApprove(res.id)}
                        className="flex-1 h-7 rounded-full bg-caramel hover:bg-caramel-dark text-white text-xs cursor-pointer shadow-2xs"
                      >
                        {approvingId === res.id ? "Approving..." : "Approve"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={approvingId === res.id || decliningId === res.id}
                        onClick={() => handleCancelReservation(res.id)}
                        className="flex-1 h-7 rounded-full text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        {decliningId === res.id ? "Declining..." : "Decline"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Room Settings Card */}
          <Card className="rounded-3xl border-border/80 bg-white shadow-sm p-5 space-y-4">
            <div>
              <h2 className="font-heading text-base font-bold text-espresso">
                Room settings
              </h2>
              <p className="text-xs text-muted-foreground">Single room parameters</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-espresso block mb-1">
                    Price (PHP / hr)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => {
                      const nextRate = e.target.value;
                      const prevHalf = (parseFloat(hourlyRate) * 0.5).toFixed(2);
                      setHourlyRate(nextRate);
                      if (
                        !isNaN(parseFloat(nextRate)) &&
                        (parseFloat(minDeposit).toFixed(2) === prevHalf || !minDeposit)
                      ) {
                        setMinDeposit((parseFloat(nextRate) * 0.5).toFixed(2));
                      }
                    }}
                    className="w-full py-1.5 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-espresso block mb-1">
                    Max Guests / hr
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxVisitors}
                    onChange={(e) => setMaxVisitors(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full py-1.5 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-espresso block mb-1">
                  Min. Deposit (PHP)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={minDeposit}
                  onChange={(e) => setMinDeposit(e.target.value)}
                  className="w-full py-1.5 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none"
                />
              </div>

              {/* Daily rest hours toggles */}
              <div>
                <label className="text-[11px] font-semibold text-espresso block mb-1.5">
                  Daily Cat Rest Hours
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(
                    {
                      length: Math.max(
                        1,
                        (settings?.closing_hour || 21) - (settings?.opening_hour || 10)
                      ),
                    },
                    (_, i) => `${String((settings?.opening_hour || 10) + i).padStart(2, "0")}:00`
                  ).map((t) => {
                    const isRest = dailyRestHours.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          if (isRest) {
                            setDailyRestHours(dailyRestHours.filter((x) => x !== t));
                          } else {
                            setDailyRestHours([...dailyRestHours, t]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border transition-all cursor-pointer ${
                          isRest
                            ? "bg-espresso text-white border-espresso"
                            : "bg-[#FAF6F0] text-muted-foreground border-border hover:bg-latte"
                        }`}
                      >
                        {formatTime(t)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {settingsSavedMsg && (
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{settingsSavedMsg}</span>
                </div>
              )}

              <Button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full py-2.5 rounded-full bg-caramel hover:bg-caramel-dark text-white font-medium text-xs cursor-pointer shadow-xs transition-colors"
              >
                {savingSettings ? "Saving..." : "Save settings"}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Reschedule Modal */}
      <Dialog open={!!rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-heading text-xl text-espresso">
              Reschedule Booking
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Move booking for {rescheduleTarget?.customer_name} ({rescheduleTarget?.visitors} guests).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div>
              <label className="font-semibold text-espresso block mb-1">New Date</label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-espresso block mb-1">New Time Slot</label>
              <select
                value={rescheduleSlot}
                onChange={(e) => setRescheduleSlot(e.target.value)}
                className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso focus:outline-none"
              >
                {["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"].map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </div>

            {rescheduleError && (
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                {rescheduleError}
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRescheduleTarget(null)}
              className="rounded-full cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRescheduleSubmit}
              disabled={rescheduleLoading}
              className="rounded-full bg-caramel hover:bg-caramel-dark text-white cursor-pointer shadow-xs"
            >
              {rescheduleLoading ? "Saving..." : "Confirm Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Walk-in Modal */}
      <Dialog open={!!walkinTargetSlot} onOpenChange={(open) => !open && setWalkinTargetSlot(null)}>
        <DialogContent className="sm:max-w-sm bg-white rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-heading text-xl text-espresso">
              Log Walk-in Guest
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Slot: {walkinTargetSlot && formatTime(walkinTargetSlot.slot_start)} on {selectedDate}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div>
              <label className="font-semibold text-espresso block mb-1">
                Number of Visitors (1 to {walkinTargetSlot ? (walkinTargetSlot.spots_left ?? walkinTargetSlot.remaining_spots ?? maxVisitors) : maxVisitors})
              </label>
              <input
                type="number"
                min={1}
                max={walkinTargetSlot ? (walkinTargetSlot.spots_left ?? walkinTargetSlot.remaining_spots ?? maxVisitors) : maxVisitors}
                value={walkinVisitors}
                onChange={(e) => setWalkinVisitors(Math.max(1, Number(e.target.value)))}
                className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Total fee: {formatPHP(parseFloat(hourlyRate) * walkinVisitors)}. Payment collected at counter.
            </p>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWalkinTargetSlot(null)}
              className="rounded-full cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleWalkinSubmit}
              disabled={walkinLoading}
              className="rounded-full bg-caramel hover:bg-caramel-dark text-white cursor-pointer shadow-xs"
            >
              {walkinLoading ? "Creating..." : "Confirm Walk-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
