import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { getMenuItemImageUrl } from "@/lib/menuImages";
import { useAuth } from "@/context/AuthContext";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Search,
  RotateCw,
  Edit,
  Trash2,
  AlertCircle,
  Coffee,
  Check,
  AlertTriangle,
  FolderTree,
  Sparkles,
  Maximize2,
  Thermometer,
} from "lucide-react";

export default function MenuTab({ onNavigateCategories }) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategorySlug, setFormCategorySlug] = useState("coffee");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("50");
  const [formImage, setFormImage] = useState(null);

  // Per-item override options: "inherit" | "true" | "false"
  const [formOverrideSizing, setFormOverrideSizing] = useState("inherit");
  const [formOverrideTemp, setFormOverrideTemp] = useState("inherit");
  const [formOverrideStamps, setFormOverrideStamps] = useState("inherit");

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/api/menu/categories/");
      setCategories(Array.isArray(res) ? res : res?.results || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Fetch Items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (availabilityFilter !== "all") params.append("is_available", availabilityFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await api.get(`/api/menu/items/?${params.toString()}`);
      setItems(Array.isArray(res) ? res : res?.results || []);
    } catch {
      setError("Failed to fetch menu items.");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, availabilityFilter, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Selected Category Object in form for live defaults display
  const selectedCategoryObj = useMemo(() => {
    if (formCategoryId) {
      return categories.find((c) => String(c.id) === String(formCategoryId));
    }
    return categories.find((c) => c.slug === formCategorySlug);
  }, [categories, formCategoryId, formCategorySlug]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName("");
    setFormDescription("");
    const defaultCat = categories[0];
    setFormCategorySlug(defaultCat ? defaultCat.slug : "coffee");
    setFormCategoryId(defaultCat ? String(defaultCat.id) : "");
    setFormPrice("");
    setFormStock("50");
    setFormImage(null);
    setFormOverrideSizing("inherit");
    setFormOverrideTemp("inherit");
    setFormOverrideStamps("inherit");
    setFormError("");
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormDescription(item.description || "");
    setFormCategorySlug(item.category || item.category_detail?.slug || "coffee");
    setFormCategoryId(item.category_obj ? String(item.category_obj) : "");
    setFormPrice(item.price);
    setFormStock(String(item.stock_quantity));
    setFormImage(null);

    // Overrides
    setFormOverrideSizing(
      item.override_sizing === true
        ? "true"
        : item.override_sizing === false
        ? "false"
        : "inherit"
    );
    setFormOverrideTemp(
      item.override_temperature === true
        ? "true"
        : item.override_temperature === false
        ? "false"
        : "inherit"
    );
    setFormOverrideStamps(
      item.override_stamps === true
        ? "true"
        : item.override_stamps === false
        ? "false"
        : "inherit"
    );

    setFormError("");
    setModalOpen(true);
  };

  const handleCategoryChange = (catIdOrSlug) => {
    const found = categories.find(
      (c) => String(c.id) === String(catIdOrSlug) || c.slug === catIdOrSlug
    );
    if (found) {
      setFormCategoryId(String(found.id));
      setFormCategorySlug(found.slug);
    } else {
      setFormCategorySlug(catIdOrSlug);
      setFormCategoryId("");
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice) {
      setFormError("Name and price are required.");
      return;
    }

    setFormSubmitting(true);
    setFormError("");

    try {
      const formData = new FormData();
      formData.append("name", formName.trim());
      formData.append("description", formDescription.trim());
      formData.append("category", formCategorySlug);
      if (formCategoryId) {
        formData.append("category_obj", formCategoryId);
      }
      formData.append("price", parseFloat(formPrice).toFixed(2));
      formData.append("stock_quantity", parseInt(formStock, 10) || 0);

      // Overrides
      formData.append(
        "override_sizing",
        formOverrideSizing === "true"
          ? "true"
          : formOverrideSizing === "false"
          ? "false"
          : "inherit"
      );
      formData.append(
        "override_temperature",
        formOverrideTemp === "true"
          ? "true"
          : formOverrideTemp === "false"
          ? "false"
          : "inherit"
      );
      formData.append(
        "override_stamps",
        formOverrideStamps === "true"
          ? "true"
          : formOverrideStamps === "false"
          ? "false"
          : "inherit"
      );

      if (formImage) {
        formData.append("image", formImage);
      }

      if (editingItem) {
        await api.patch(`/api/menu/items/${editingItem.id}/`, formData);
      } else {
        await api.post("/api/menu/items/", formData);
      }
      setModalOpen(false);
      fetchItems();
    } catch (err) {
      const errData = err?.data;
      let msg = "Failed to save menu item.";
      if (errData && typeof errData === "object") {
        if (errData.detail) {
          msg = errData.detail;
        } else {
          const fieldErrors = Object.entries(errData)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
            .join(" | ");
          if (fieldErrors) msg = fieldErrors;
        }
      }
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await api.post(`/api/menu/items/${item.id}/toggle/`);
      fetchItems();
    } catch {
      alert("Failed to toggle availability.");
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/menu/items/${deleteTarget.id}/`);
      setDeleteTarget(null);
      fetchItems();
    } catch (err) {
      alert(err?.data?.detail || "Failed to delete menu item.");
    } finally {
      setDeleting(false);
    }
  };

  // Combine categories with "all"
  const categoryFilterOptions = [
    { id: "all", label: "All Items" },
    ...categories.map((c) => ({ id: c.slug, label: c.name })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-heading italic text-caramel text-base md:text-lg">
            Catalog & Stock
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-espresso tracking-tight">
            Menu & Inventory
          </h1>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {onNavigateCategories && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateCategories}
              className="rounded-full gap-1.5 cursor-pointer text-xs"
            >
              <FolderTree className="h-3.5 w-3.5 text-caramel" />
              Manage Categories
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchItems}
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
            Add Menu Item
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="rounded-3xl border-border/80 bg-white shadow-sm p-4 sm:p-5 space-y-3">
        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categoryFilterOptions.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-espresso text-white shadow-xs"
                  : "bg-latte/40 text-espresso hover:bg-latte"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Availability */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs pt-1">
          <div className="sm:col-span-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by name..."
              className="w-full pl-9 pr-3 py-2 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] text-espresso text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-caramel"
            >
              <option value="all">All Availability</option>
              <option value="true">In Stock & Active</option>
              <option value="false">Unavailable / Hidden</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Items Table Card */}
      <Card className="rounded-3xl border-border/80 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Coffee className="h-10 w-10 mx-auto text-caramel/40" />
            <p className="font-heading text-lg font-bold text-espresso">No items found</p>
            <p className="text-xs">Try selecting a different category or clear search.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Customization Options</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isLowStock = item.stock_quantity < 10;
                const catLabel = item.category_detail?.name || item.category.replace("_", " ");
                const hasOverrides =
                  item.override_sizing !== null ||
                  item.override_temperature !== null ||
                  item.override_stamps !== null;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-latte/40 border border-border overflow-hidden shrink-0 flex items-center justify-center text-center p-0.5">
                          {getMenuItemImageUrl(item) ? (
                            <img
                              src={getMenuItemImageUrl(item)}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[9px] font-semibold text-muted-foreground leading-tight">
                              No Image
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-espresso truncate">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-xs">
                            {item.description || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <Badge
                          variant="outline"
                          className="capitalize text-[10px] bg-[#FAF6F0] text-espresso border-border font-medium"
                        >
                          {catLabel}
                        </Badge>
                        {item.badge_tag && (
                          <span className="block text-[10px] text-caramel font-semibold">
                            ★ {item.badge_tag}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Customization Options */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {item.enable_sizing && (
                          <span className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-900 border border-amber-500/30 font-medium">
                            Sizing
                          </span>
                        )}
                        {item.enable_temperature && (
                          <span className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-900 border border-sky-500/30 font-medium">
                            Hot/Cold
                          </span>
                        )}
                        {item.qualifies_for_stamps && (
                          <span className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-900 border border-emerald-500/30 font-medium">
                            Stamps
                          </span>
                        )}
                        {hasOverrides && (
                          <span className="text-[9px] text-muted-foreground italic">
                            (custom override)
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="font-semibold text-espresso">
                      {formatPHP(parseFloat(item.price))}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-espresso">
                          {item.stock_quantity}
                        </span>
                        {isLowStock && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-800 border-amber-500/30 gap-0.5"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" /> Low
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(item)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                          item.is_available
                            ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${item.is_available ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                        {item.is_available ? "Available" : "Hidden"}
                      </button>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-espresso cursor-pointer"
                          title="Edit item"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>

                        {/* Delete Menu Item: Admin Only */}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(item)}
                            className="h-8 w-8 rounded-full text-destructive/70 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            title="Delete item (Admin)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-heading text-xl text-espresso">
              {editingItem ? "Edit Menu Item" : "Add Menu Item"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure name, category inheritance, custom option overrides, and stock.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveItem} className="space-y-3.5 py-2 text-xs">
            <div>
              <label className="font-semibold text-espresso block mb-1">Item Name *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Vanilla Catpuccino"
                className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-espresso block mb-1">Category</label>
                <select
                  value={formCategoryId || formCategorySlug}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none"
                >
                  {categories.length > 0 ? (
                    categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="coffee">Coffee</option>
                      <option value="non_coffee_tea">Tea & Non-Coffee</option>
                      <option value="pastries">Pastries</option>
                      <option value="light_bites">Light Bites</option>
                      <option value="merch">Merchandise</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="font-semibold text-espresso block mb-1">Price (PHP ₱) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="160.00"
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
                />
              </div>
            </div>

            {/* Category Default Info Banner */}
            {selectedCategoryObj && (
              <div className="rounded-2xl bg-caramel/10 border border-caramel/25 p-3 space-y-1 text-xs text-espresso">
                <p className="font-semibold text-caramel-dark flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Category Defaults ({selectedCategoryObj.name}):</span>
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  • Sizing: {selectedCategoryObj.enable_sizing ? "Enabled (Grande +₱30)" : "Disabled"}{" "}
                  • Temp: {selectedCategoryObj.enable_temperature ? "Enabled (Cold +₱30)" : "Disabled"}{" "}
                  • Stamps: {selectedCategoryObj.qualifies_for_stamps ? "Eligible" : "Not eligible"}
                </p>
              </div>
            )}

            {/* Per-Item Customization Overrides */}
            <div className="p-3.5 rounded-2xl border border-border/80 bg-[#FAF6F0]/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-espresso text-xs">
                  Per-Item Overrides (Optional)
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Leave on Inherit to follow category defaults
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Sizing override */}
                <div>
                  <label className="text-[11px] font-medium text-espresso block mb-1">
                    Sizing (+₱30 Grande)
                  </label>
                  <select
                    value={formOverrideSizing}
                    onChange={(e) => setFormOverrideSizing(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl border border-border bg-white text-espresso text-xs focus:outline-none"
                  >
                    <option value="inherit">Inherit from category</option>
                    <option value="true">Force Enable</option>
                    <option value="false">Force Disable</option>
                  </select>
                </div>

                {/* Temp override */}
                <div>
                  <label className="text-[11px] font-medium text-espresso block mb-1">
                    Temp (+₱30 Cold)
                  </label>
                  <select
                    value={formOverrideTemp}
                    onChange={(e) => setFormOverrideTemp(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl border border-border bg-white text-espresso text-xs focus:outline-none"
                  >
                    <option value="inherit">Inherit from category</option>
                    <option value="true">Force Enable</option>
                    <option value="false">Force Disable</option>
                  </select>
                </div>

                {/* Stamps override */}
                <div>
                  <label className="text-[11px] font-medium text-espresso block mb-1">
                    Stamp Card
                  </label>
                  <select
                    value={formOverrideStamps}
                    onChange={(e) => setFormOverrideStamps(e.target.value)}
                    className="w-full py-1.5 px-2.5 rounded-xl border border-border bg-white text-espresso text-xs focus:outline-none"
                  >
                    <option value="inherit">Inherit from category</option>
                    <option value="true">Qualifies for Stamps</option>
                    <option value="false">No Stamps</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-espresso block mb-1">Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-espresso block mb-1">Upload Photo (Optional)</label>
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-latte/40 border border-border overflow-hidden shrink-0 flex items-center justify-center text-center p-0.5">
                    {formImage ? (
                      <img
                        src={URL.createObjectURL(formImage)}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : editingItem && getMenuItemImageUrl(editingItem) ? (
                      <img
                        src={getMenuItemImageUrl(editingItem)}
                        alt={editingItem.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[8px] font-semibold text-muted-foreground leading-tight">
                        No Image
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormImage(e.target.files?.[0] || null)}
                    className="w-full py-1 text-[11px] text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-xl file:border file:border-border file:text-xs file:bg-latte"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="font-semibold text-espresso block mb-1">Description</label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Item ingredients, flavors or cat art description..."
                className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel resize-none"
              />
            </div>

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
                {formSubmitting ? "Saving..." : editingItem ? "Update Item" : "Create Item"}
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
              Delete Menu Item
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete{" "}
              <strong className="text-espresso font-semibold">{deleteTarget?.name}</strong>? This action cannot be undone.
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
              onClick={handleDeleteItem}
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
