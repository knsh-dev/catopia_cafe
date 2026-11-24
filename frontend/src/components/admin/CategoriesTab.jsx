import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
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
  ChevronUp,
  ChevronDown,
  Sparkles,
  Check,
  Eye,
  EyeOff,
  Coffee,
  AlertCircle,
  Layers,
  Thermometer,
  Maximize2,
} from "lucide-react";

export default function CategoriesTab({ onNavigateToMenu }) {
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBadgeTag, setFormBadgeTag] = useState("");
  const [formEnableSizing, setFormEnableSizing] = useState(false);
  const [formEnableTemp, setFormEnableTemp] = useState(false);
  const [formQualifiesStamps, setFormQualifiesStamps] = useState(true);
  const [formIsVisible, setFormIsVisible] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/menu/categories/");
      setCategories(Array.isArray(res) ? res : res?.results || []);
    } catch {
      setError("Failed to load menu categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const slugify = (text) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleNameChange = (val) => {
    setFormName(val);
    if (!editingCategory) {
      setFormSlug(slugify(val));
    }
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormBadgeTag("");
    setFormEnableSizing(false);
    setFormEnableTemp(false);
    setFormQualifiesStamps(true);
    setFormIsVisible(true);
    setFormError("");
    setModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormDescription(cat.description || "");
    setFormBadgeTag(cat.badge_tag || "");
    setFormEnableSizing(Boolean(cat.enable_sizing));
    setFormEnableTemp(Boolean(cat.enable_temperature));
    setFormQualifiesStamps(cat.qualifies_for_stamps !== false);
    setFormIsVisible(cat.is_visible !== false);
    setFormError("");
    setModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      setFormError("Category Name and Slug are required.");
      return;
    }

    setFormSubmitting(true);
    setFormError("");

    const payload = {
      name: formName.trim(),
      slug: formSlug.trim(),
      description: formDescription.trim(),
      badge_tag: formBadgeTag.trim(),
      enable_sizing: formEnableSizing,
      enable_temperature: formEnableTemp,
      qualifies_for_stamps: formQualifiesStamps,
      is_visible: formIsVisible,
    };

    try {
      if (editingCategory) {
        await api.patch(`/api/menu/categories/${editingCategory.id}/`, payload);
      } else {
        payload.sort_order = categories.length + 1;
        await api.post("/api/menu/categories/", payload);
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err) {
      const detail =
        err?.data?.slug ||
        err?.data?.name ||
        err?.data?.detail ||
        "Failed to save category. Check if slug is unique.";
      setFormError(Array.isArray(detail) ? detail.join(" ") : String(detail));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleVisibility = async (cat) => {
    try {
      await api.post(`/api/menu/categories/${cat.id}/toggle-visibility/`);
      fetchCategories();
    } catch {
      alert("Failed to toggle category visibility.");
    }
  };

  const handleMoveOrder = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newOrder = [...categories];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    // Optimistic UI update
    setCategories(newOrder);

    try {
      await api.post("/api/menu/categories/reorder/", {
        order: newOrder.map((c) => c.id),
      });
    } catch {
      fetchCategories();
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/menu/categories/${deleteTarget.id}/`);
      setDeleteTarget(null);
      fetchCategories();
    } catch (err) {
      alert(err?.data?.detail || "Failed to delete category.");
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
            Catalog Structure & Options
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-espresso tracking-tight">
            Menu Categories
          </h1>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onNavigateToMenu && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToMenu}
              className="rounded-full gap-1.5 cursor-pointer text-xs"
            >
              <Coffee className="h-3.5 w-3.5 text-caramel" />
              View Menu Items
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCategories}
            className="rounded-full gap-1.5 cursor-pointer text-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-caramel" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="rounded-full bg-caramel hover:bg-caramel-dark text-white gap-1.5 cursor-pointer shadow-xs text-xs"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Info Card Banner */}
      <Card className="rounded-3xl border-border/80 bg-white shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-2xl bg-caramel/10 text-caramel shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="font-semibold text-espresso text-sm">
              Category Customization & Default Settings
            </p>
            <p className="leading-relaxed">
              Items created in a category inherit these settings by default. When <strong>Sizing</strong> is enabled, drinks offer Regular and Grande (+₱30.00). When <strong>Temperature</strong> is enabled, drinks offer Hot and Cold (+₱30.00). Use the up/down arrows to adjust the order categories appear on the public menu.
            </p>
          </div>
        </div>
      </Card>

      {/* Categories Table Card */}
      <Card className="rounded-3xl border-border/80 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Layers className="h-10 w-10 mx-auto text-caramel/40" />
            <p className="font-heading text-lg font-bold text-espresso">No Categories Found</p>
            <p className="text-xs">Add your first menu category to organize drinks and food.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Order</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Badge / Tag</TableHead>
                <TableHead>Optional Settings</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat, idx) => (
                <TableRow key={cat.id}>
                  {/* Order / Reorder */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveOrder(idx, -1)}
                        className="p-1 rounded-md hover:bg-latte text-muted-foreground hover:text-espresso disabled:opacity-20 cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === categories.length - 1}
                        onClick={() => handleMoveOrder(idx, 1)}
                        className="p-1 rounded-md hover:bg-latte text-muted-foreground hover:text-espresso disabled:opacity-20 cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>

                  {/* Name & Slug */}
                  <TableCell>
                    <div>
                      <p className="font-bold text-espresso text-sm leading-tight">{cat.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        slug: {cat.slug}
                      </p>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground/80 line-clamp-1 mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  {/* Badge Tag */}
                  <TableCell>
                    {cat.badge_tag ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-caramel/10 text-caramel text-[11px] font-semibold">
                        <Sparkles className="h-3 w-3" />
                        {cat.badge_tag}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Optional Category Settings */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                      {/* Sizing option */}
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                          cat.enable_sizing
                            ? "bg-amber-500/10 text-amber-900 border-amber-500/30"
                            : "bg-muted/40 text-muted-foreground/50 border-border line-through"
                        }`}
                      >
                        <Maximize2 className="h-2.5 w-2.5" />
                        Regular / Grande (+₱30)
                      </span>

                      {/* Temperature option */}
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                          cat.enable_temperature
                            ? "bg-sky-500/10 text-sky-900 border-sky-500/30"
                            : "bg-muted/40 text-muted-foreground/50 border-border line-through"
                        }`}
                      >
                        <Thermometer className="h-2.5 w-2.5" />
                        Hot / Cold (+₱30)
                      </span>

                      {/* Stamp card */}
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                          cat.qualifies_for_stamps
                            ? "bg-emerald-500/10 text-emerald-900 border-emerald-500/30"
                            : "bg-muted/40 text-muted-foreground/50 border-border line-through"
                        }`}
                      >
                        🐾 Earns Stamps
                      </span>
                    </div>
                  </TableCell>

                  {/* Items Count */}
                  <TableCell>
                    <span className="font-mono text-xs font-semibold text-espresso">
                      {cat.items_count || 0} active
                    </span>
                  </TableCell>

                  {/* Visibility Toggle */}
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(cat)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                        cat.is_visible
                          ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/30 hover:bg-emerald-500/20"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      }`}
                    >
                      {cat.is_visible ? (
                        <>
                          <Eye className="h-3 w-3 text-emerald-600" />
                          Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3 text-muted-foreground" />
                          Hidden
                        </>
                      )}
                    </button>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(cat)}
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-espresso cursor-pointer"
                        title="Edit category"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>

                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(cat)}
                          className="h-8 w-8 rounded-full text-destructive/70 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Delete category (Admin)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Add / Edit Category Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-heading text-xl text-espresso">
              {editingCategory ? "Edit Category" : "Add Menu Category"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure name, slug, badge note, and optional sizing/temperature settings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="space-y-3.5 py-2 text-xs">
            <div>
              <label className="font-semibold text-espresso block mb-1">Category Name *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Non-Coffee / Lattes"
                className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-espresso block mb-1">Slug (URL identifier) *</label>
                <input
                  type="text"
                  required
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g. non-coffee-lattes"
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs font-mono focus:outline-none focus:ring-1 focus:ring-caramel"
                />
              </div>

              <div>
                <label className="font-semibold text-espresso block mb-1">Badge Tag / Note</label>
                <input
                  type="text"
                  value={formBadgeTag}
                  onChange={(e) => setFormBadgeTag(e.target.value)}
                  placeholder="e.g. Barista Favorite"
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-espresso block mb-1">Description</label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Sub-heading shown on menu sliders..."
                className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel resize-none"
              />
            </div>

            {/* Optional Settings Toggles */}
            <div className="space-y-2.5 pt-2 border-t border-border/60">
              <p className="font-semibold text-espresso text-xs">Optional Category Settings</p>

              {/* Enable Sizing */}
              <label className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF6F0] border border-border/80 cursor-pointer hover:bg-latte/40 transition-colors">
                <div>
                  <p className="font-semibold text-espresso text-xs">Enable Sizing Options</p>
                  <p className="text-[11px] text-muted-foreground">
                    Items offer Regular (+₱0) and Grande (+₱30.00)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formEnableSizing}
                  onChange={(e) => setFormEnableSizing(e.target.checked)}
                  className="h-4 w-4 rounded text-caramel focus:ring-caramel accent-caramel cursor-pointer"
                />
              </label>

              {/* Enable Temperature */}
              <label className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF6F0] border border-border/80 cursor-pointer hover:bg-latte/40 transition-colors">
                <div>
                  <p className="font-semibold text-espresso text-xs">Enable Temperature Options</p>
                  <p className="text-[11px] text-muted-foreground">
                    Items offer Hot (+₱0) and Cold (+₱30.00)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formEnableTemp}
                  onChange={(e) => setFormEnableTemp(e.target.checked)}
                  className="h-4 w-4 rounded text-caramel focus:ring-caramel accent-caramel cursor-pointer"
                />
              </label>

              {/* Qualifies for Stamps */}
              <label className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF6F0] border border-border/80 cursor-pointer hover:bg-latte/40 transition-colors">
                <div>
                  <p className="font-semibold text-espresso text-xs">Earn Loyalty Stamps</p>
                  <p className="text-[11px] text-muted-foreground">
                    Items in this category count toward the Café Stamp Card
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formQualifiesStamps}
                  onChange={(e) => setFormQualifiesStamps(e.target.checked)}
                  className="h-4 w-4 rounded text-caramel focus:ring-caramel accent-caramel cursor-pointer"
                />
              </label>

              {/* Public Visibility */}
              <label className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF6F0] border border-border/80 cursor-pointer hover:bg-latte/40 transition-colors">
                <div>
                  <p className="font-semibold text-espresso text-xs">Visible in Customer Menu</p>
                  <p className="text-[11px] text-muted-foreground">
                    Show category and items on public customer menu
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formIsVisible}
                  onChange={(e) => setFormIsVisible(e.target.checked)}
                  className="h-4 w-4 rounded text-caramel focus:ring-caramel accent-caramel cursor-pointer"
                />
              </label>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                {formError}
              </div>
            )}

            <DialogFooter className="flex gap-2 sm:justify-end pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="rounded-full cursor-pointer text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={formSubmitting}
                className="rounded-full bg-caramel hover:bg-caramel-dark text-white cursor-pointer shadow-xs text-xs"
              >
                {formSubmitting
                  ? "Saving..."
                  : editingCategory
                  ? "Update Category"
                  : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm bg-white rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-heading text-xl text-espresso">
              Delete Menu Category
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete{" "}
              <strong className="text-espresso font-semibold">{deleteTarget?.name}</strong>? Items in this category will become unassigned. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 sm:justify-end pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              className="rounded-full cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={deleting}
              onClick={handleDeleteCategory}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90 cursor-pointer shadow-xs text-xs"
            >
              {deleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
