import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { getCatPhotoUrl } from "@/lib/catPhotos";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Plus,
  RotateCw,
  Edit,
  Trash2,
  Clock,
  Heart,
  Cat,
  AlertCircle,
  Calendar,
} from "lucide-react";

const STATUS_LABELS = {
  ready_to_play: "Ready to play",
  resting: "Resting",
  vet_day: "Vet day",
};

export default function CatsTab() {
  const { isAdmin } = useAuth();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [formName, setFormName] = useState("");
  const [formBreed, setFormBreed] = useState("");
  const [formAge, setFormAge] = useState("");
  const [formPersonality, setFormPersonality] = useState("");
  const [formStatus, setFormStatus] = useState("ready_to_play");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPlays, setFormPlays] = useState("All day");
  const [formRestDays, setFormRestDays] = useState("Mon");
  const [formPhoto, setFormPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/cats/residents/");
      setCats(Array.isArray(res) ? res : res?.results || []);
    } catch {
      setError("Failed to load resident cats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCats();
  }, [fetchCats]);

  // Counts for pills
  const readyCount = cats.filter((c) => c.is_active !== false && (c.status || "ready_to_play") === "ready_to_play").length;
  const restingCount = cats.filter((c) => c.is_active !== false && c.status === "resting").length;
  const vetCount = cats.filter((c) => c.is_active !== false && c.status === "vet_day").length;
  const unavailableCount = cats.filter((c) => c.is_active === false).length;

  // Filtered cats
  const filteredCats = cats.filter((c) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "unavailable") return c.is_active === false;
    return c.is_active !== false && (c.status || "ready_to_play") === statusFilter;
  });

  const handleOpenAdd = () => {
    setEditingCat(null);
    setFormName("");
    setFormBreed("");
    setFormAge("");
    setFormPersonality("");
    setFormStatus("ready_to_play");
    setFormIsActive(true);
    setFormPlays("All day");
    setFormRestDays("Mon");
    setFormPhoto(null);
    setFormError("");
    setModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCat(cat);
    setFormName(cat.name);
    setFormBreed(cat.breed || "");
    setFormAge(String(cat.age || ""));
    setFormPersonality(cat.personality || "");
    setFormStatus(cat.status || "ready_to_play");
    setFormIsActive(cat.is_active !== false);
    setFormPlays(cat.schedule?.plays || "All day");
    setFormRestDays(cat.schedule?.rest_days || "Mon");
    setFormPhoto(null);
    setFormError("");
    setModalOpen(true);
  };

  const handleSaveCat = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formAge) {
      setFormError("Name and age are required.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const formData = new FormData();
      formData.append("name", formName.trim());
      formData.append("breed", formBreed.trim());
      formData.append("age", parseInt(formAge, 10) || 1);
      formData.append("personality", formPersonality.trim());
      formData.append("status", formStatus);
      formData.append("is_active", formIsActive ? "true" : "false");
      formData.append(
        "schedule",
        JSON.stringify({
          ...(editingCat?.schedule || {}),
          plays: formPlays,
          rest_days: formRestDays,
        })
      );
      if (formPhoto) {
        formData.append("photo", formPhoto);
      }

      if (editingCat) {
        await api.patch(`/api/cats/residents/${editingCat.id}/`, formData);
      } else {
        await api.post("/api/cats/residents/", formData);
      }
      setModalOpen(false);
      fetchCats();
    } catch (err) {
      setFormError(err?.data?.detail || "Failed to save cat profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (catId, newStatus) => {
    try {
      const updated = await api.patch(`/api/cats/residents/${catId}/`, { status: newStatus });
      setCats((prev) =>
        prev.map((c) =>
          c.id === catId
            ? {
                ...c,
                ...updated,
                status: newStatus,
                status_display: updated?.status_display || STATUS_LABELS[newStatus] || newStatus,
              }
            : c
        )
      );
    } catch {
      alert("Failed to update status.");
    }
  };

  const handleToggleAvailability = async (cat) => {
    const nextActive = cat.is_active === false;
    try {
      const updated = await api.patch(`/api/cats/residents/${cat.id}/`, { is_active: nextActive });
      setCats((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, ...updated, is_active: nextActive } : c))
      );
    } catch {
      alert("Failed to update cat availability.");
    }
  };

  const handleDeleteCat = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/cats/residents/${deleteTarget.id}/`);
      setDeleteTarget(null);
      fetchCats();
    } catch (err) {
      alert(err?.data?.detail || "Failed to delete cat.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-heading italic text-caramel text-base md:text-lg">
            The family
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-espresso tracking-tight">
            Resident Cats Roster
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCats}
            className="rounded-full gap-1.5 cursor-pointer"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-caramel" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="rounded-full bg-caramel hover:bg-caramel-dark text-white gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Add resident
          </Button>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-espresso text-white shadow-xs"
              : "bg-white text-espresso border border-border/80 hover:bg-latte"
          }`}
        >
          All Residents ({cats.length})
        </button>
        <button
          onClick={() => setStatusFilter("ready_to_play")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === "ready_to_play"
              ? "bg-caramel text-white shadow-xs"
              : "bg-white text-espresso border border-border/80 hover:bg-latte"
          }`}
        >
          Ready to play: {readyCount}
        </button>
        <button
          onClick={() => setStatusFilter("resting")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === "resting"
              ? "bg-caramel text-white shadow-xs"
              : "bg-white text-espresso border border-border/80 hover:bg-latte"
          }`}
        >
          Resting: {restingCount}
        </button>
        <button
          onClick={() => setStatusFilter("vet_day")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === "vet_day"
              ? "bg-caramel text-white shadow-xs"
              : "bg-white text-espresso border border-border/80 hover:bg-latte"
          }`}
        >
          Vet day: {vetCount}
        </button>
        <button
          onClick={() => setStatusFilter("unavailable")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            statusFilter === "unavailable"
              ? "bg-espresso text-white shadow-xs"
              : "bg-white text-espresso border border-border/80 hover:bg-latte"
          }`}
        >
          Unavailable: {unavailableCount}
        </button>
      </div>

      {/* Cats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center text-destructive space-y-2 bg-white rounded-3xl border border-destructive/20">
          <AlertCircle className="h-8 w-8 mx-auto" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      ) : filteredCats.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground bg-white rounded-3xl border border-border/80 space-y-2">
          <Cat className="h-10 w-10 mx-auto text-caramel/40" />
          <p className="font-heading text-lg font-bold text-espresso">No cats match filter</p>
          <p className="text-xs">Select "All Residents" to view all cats.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCats.map((cat) => {
            const currentStatus = cat.status || "ready_to_play";
            const playsText = cat.schedule?.plays || "All day";
            const restDaysText = cat.schedule?.rest_days || "Mon";
            const isAvailable = cat.is_active !== false;

            return (
              <Card
                key={cat.id}
                className={`rounded-3xl border-border/80 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden p-5 flex flex-col justify-between space-y-4 ${
                  !isAvailable ? "opacity-70" : ""
                }`}
              >
                <div className="space-y-3">
                  {/* Photo & Basic Info */}
                  <div className="flex gap-3.5 items-start">
                    <div className="h-16 w-16 rounded-2xl bg-latte/40 overflow-hidden shrink-0 border border-border/60 flex items-center justify-center text-center p-1">
                      {getCatPhotoUrl(cat) ? (
                        <img
                          src={getCatPhotoUrl(cat)}
                          alt={cat.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground leading-tight">
                          No Image
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-heading text-lg font-bold text-espresso truncate">
                          {cat.name}
                        </h3>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                          <Heart className="h-3 w-3 text-caramel fill-caramel" />
                          {cat.favorited_by_count ?? 0}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground truncate">
                        {cat.breed || "Resident"} · {cat.age} {cat.age === 1 ? "yr" : "yrs"}
                      </p>

                      {/* Quick Status Dropdown & Availability Toggle */}
                      <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                        <select
                          value={currentStatus}
                          onChange={(e) => handleQuickStatusChange(cat.id, e.target.value)}
                          className="text-[11px] font-semibold rounded-full border border-border/80 px-2.5 py-1 bg-[#FAF6F0] text-espresso focus:outline-none focus:ring-1 focus:ring-caramel"
                        >
                          <option value="ready_to_play">Ready to play</option>
                          <option value="resting">Resting</option>
                          <option value="vet_day">Vet day</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(cat)}
                          className={`text-[10px] font-semibold rounded-full px-2.5 py-1 border transition-colors cursor-pointer ${
                            isAvailable
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-muted text-muted-foreground border-border hover:bg-latte"
                          }`}
                          title={isAvailable ? "Click to hide from customer website" : "Click to make available on customer website"}
                        >
                          {isAvailable ? "Available" : "Unavailable"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Personality Blurb */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {cat.personality || "Sweet and friendly resident cat."}
                  </p>

                  {/* Schedule Info */}
                  <div className="pt-2 border-t border-border/60 space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-caramel shrink-0" />
                      <span>Plays: {playsText}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-caramel shrink-0" />
                      <span>Rest days: {restDaysText}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(cat)}
                    className="flex-1 rounded-full text-xs font-semibold gap-1.5 cursor-pointer bg-[#FAF6F0] hover:bg-latte border-border/80"
                  >
                    <Edit className="h-3.5 w-3.5 text-caramel" />
                    Edit profile
                  </Button>

                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(cat)}
                      className="h-8 w-8 ml-2 rounded-full text-destructive/70 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Delete resident (Admin)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Cat Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-heading text-xl text-espresso">
              {editingCat ? "Edit Cat Profile" : "Add Resident Cat"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update cat personality, schedule, and play status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCat} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-espresso block mb-1">Cat Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Mochi"
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
                />
              </div>

              <div>
                <label className="font-semibold text-espresso block mb-1">Breed</label>
                <input
                  type="text"
                  value={formBreed}
                  onChange={(e) => setFormBreed(e.target.value)}
                  placeholder="e.g. Orange Tabby"
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-espresso block mb-1">Age (Years) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formAge}
                  onChange={(e) => setFormAge(e.target.value)}
                  placeholder="3"
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-espresso block mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none"
                >
                  <option value="ready_to_play">Ready to play</option>
                  <option value="resting">Resting</option>
                  <option value="vet_day">Vet day</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-espresso block mb-1">Play Hours</label>
                <input
                  type="text"
                  value={formPlays}
                  onChange={(e) => setFormPlays(e.target.value)}
                  placeholder="All day or Afternoons · 1–6"
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-espresso block mb-1">Rest Days</label>
                <input
                  type="text"
                  value={formRestDays}
                  onChange={(e) => setFormRestDays(e.target.value)}
                  placeholder="Mon, Tue, Wed..."
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-espresso block mb-1">Upload Photo (Optional)</label>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-latte/40 border border-border/70 overflow-hidden shrink-0 flex items-center justify-center text-center p-1">
                  {formPhoto ? (
                    <img
                      src={URL.createObjectURL(formPhoto)}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : editingCat && getCatPhotoUrl(editingCat) ? (
                    <img
                      src={getCatPhotoUrl(editingCat)}
                      alt={editingCat.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[9px] font-semibold text-muted-foreground leading-tight">
                      No Image
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormPhoto(e.target.files?.[0] || null)}
                  className="w-full py-1 text-[11px] text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-xl file:border file:border-border file:text-xs file:bg-latte"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-espresso block mb-1">Personality Blurb</label>
              <textarea
                rows={2}
                value={formPersonality}
                onChange={(e) => setFormPersonality(e.target.value)}
                placeholder="Describe personality, favorite toys, or cuddle habits..."
                className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel resize-none"
              />
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded border-border text-caramel focus:ring-caramel"
              />
              <span className="font-semibold text-espresso">
                Available on customer website
              </span>
            </label>

            {formError && (
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                {formError}
              </div>
            )}

            <DialogFooter className="flex gap-2 sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="rounded-full cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="rounded-full bg-caramel hover:bg-caramel-dark text-white cursor-pointer shadow-xs"
              >
                {submitting ? "Saving..." : editingCat ? "Update Cat" : "Add Cat"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal (Admin Only) */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm bg-white rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-heading text-xl text-espresso">
              Remove Resident Cat
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently remove{" "}
              <strong className="text-espresso font-semibold">{deleteTarget?.name}</strong> from the resident roster?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 sm:justify-end pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              className="rounded-full cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={deleting}
              onClick={handleDeleteCat}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90 cursor-pointer shadow-xs"
            >
              {deleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
