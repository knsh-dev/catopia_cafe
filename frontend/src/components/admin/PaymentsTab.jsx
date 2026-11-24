import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
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
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  Search,
  Filter,
  CreditCard,
  RotateCw,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function PaymentsTab() {
  const { isAdmin } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null);

  // Filters & Sorting state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Refund Modal State
  const [refundTarget, setRefundTarget] = useState(null);
  const [auditNote, setAuditNote] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState("");

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (methodFilter !== "all") params.append("method", methodFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      params.append("sort", sortBy);
      params.append("page", String(page));
      params.append("page_size", String(pageSize));

      const res = await api.get(`/api/payments/?${params.toString()}`);
      if (Array.isArray(res)) {
        setPayments(res);
        setTotalCount(res.length);
        setTotalPages(Math.max(1, Math.ceil(res.length / pageSize)));
      } else if (res?.results) {
        setPayments(res.results);
        const count = res.count != null ? res.count : res.results.length;
        setTotalCount(count);
        setTotalPages(Math.max(1, Math.ceil(count / pageSize)));
      } else {
        setPayments([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err) {
      setError("Failed to fetch payments.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, methodFilter, typeFilter, dateFrom, dateTo, sortBy, page, pageSize]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setSyncNotice(null);
    try {
      const syncRes = await api.post("/api/payments/sync/");
      if (syncRes?.updated_count > 0 || syncRes?.deduplicated_count > 0) {
        setSyncNotice(
          `Synced: ${syncRes.updated_count || 0} updated, ${syncRes.deduplicated_count || 0} duplicate rows cleaned.`
        );
        setTimeout(() => setSyncNotice(null), 5000);
      }
    } catch (err) {
      console.warn("Backend payment sync failed:", err);
    } finally {
      await fetchPayments();
      setRefreshing(false);
    }
  };

  const handleHeaderSort = (column) => {
    if (column === "amount") {
      setSortBy((prev) => (prev === "amount_desc" ? "amount_asc" : "amount_desc"));
    } else if (column === "date") {
      setSortBy((prev) => (prev === "date_desc" ? "date_asc" : "date_desc"));
    } else if (column === "status") {
      setSortBy((prev) => (prev === "status" ? "status_desc" : "status"));
    }
    setPage(1);
  };

  const renderSortIcon = (column) => {
    if (column === "amount") {
      if (sortBy === "amount_desc") return <ArrowDown className="h-3 w-3 text-caramel shrink-0" />;
      if (sortBy === "amount_asc") return <ArrowUp className="h-3 w-3 text-caramel shrink-0" />;
    } else if (column === "date") {
      if (sortBy === "date_desc") return <ArrowDown className="h-3 w-3 text-caramel shrink-0" />;
      if (sortBy === "date_asc") return <ArrowUp className="h-3 w-3 text-caramel shrink-0" />;
    } else if (column === "status") {
      if (sortBy === "status") return <ArrowDown className="h-3 w-3 text-caramel shrink-0" />;
      if (sortBy === "status_desc") return <ArrowUp className="h-3 w-3 text-caramel shrink-0" />;
    }
    return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-caramel shrink-0" />;
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 3) {
      return [1, 2, 3, 4, "...", totalPages];
    }
    if (page >= totalPages - 2) {
      return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  };

  const handleOpenRefund = (payment) => {
    setRefundTarget(payment);
    setAuditNote("");
    setRefundError("");
  };

  const handleConfirmRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    setRefundError("");
    try {
      await api.post(`/api/payments/${refundTarget.id}/refund/`, {
        audit_note: auditNote.trim() || "Admin manual refund",
      });
      setRefundTarget(null);
      fetchPayments();
    } catch (err) {
      setRefundError(err?.data?.detail || "Failed to process refund.");
    } finally {
      setRefunding(false);
    }
  };

  const displayStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const displayEnd = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-heading italic text-caramel text-base md:text-lg">
            Finances
          </p>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-espresso tracking-tight">
              Payments & Transactions
            </h1>
            {syncNotice && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-caramel/10 text-caramel border border-caramel/20 animate-fade-in">
                <CheckCircle className="h-3 w-3" />
                {syncNotice}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {syncNotice && (
            <span className="md:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-caramel/10 text-caramel border border-caramel/20">
              <CheckCircle className="h-3 w-3" />
              Synced
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="rounded-full gap-1.5 cursor-pointer border-border/80 hover:bg-latte/40 text-espresso"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing || loading ? "animate-spin text-caramel" : ""}`} />
            {refreshing ? "Syncing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="rounded-3xl border-border/80 bg-white shadow-sm p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 text-xs">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search ref #, customer or trans id..."
              className="w-full pl-9 pr-3 py-2 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white focus:outline-none focus:ring-1 focus:ring-caramel text-espresso placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] text-espresso focus:bg-white focus:outline-none focus:ring-1 focus:ring-caramel transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Method Filter */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] text-espresso focus:bg-white focus:outline-none focus:ring-1 focus:ring-caramel transition-colors"
            >
              <option value="all">All Methods</option>
              <option value="xendit">Xendit</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] text-espresso focus:bg-white focus:outline-none focus:ring-1 focus:ring-caramel transition-colors"
            >
              <option value="all">All Types</option>
              <option value="order">Orders Only</option>
              <option value="reservation">Reservations Only</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] text-espresso focus:bg-white focus:outline-none focus:ring-1 focus:ring-caramel transition-colors"
            >
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
              <option value="amount_desc">Amount: High to Low</option>
              <option value="amount_asc">Amount: Low to High</option>
              <option value="status">Status (Pending → Paid → Refunded)</option>
              {sortBy === "status_desc" && (
                <option value="status_desc">Status (Refunded → Paid → Pending)</option>
              )}
            </select>
          </div>

          {/* Date range inputs */}
          <div className="flex gap-1">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-2 text-[11px] rounded-2xl border border-border bg-[#FAF6F0] text-espresso focus:bg-white focus:outline-none"
              title="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-2 text-[11px] rounded-2xl border border-border bg-[#FAF6F0] text-espresso focus:bg-white focus:outline-none"
              title="To date"
            />
          </div>
        </div>
      </Card>

      {/* Payments Table Card */}
      <Card className="rounded-3xl border-border/80 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <CreditCard className="h-10 w-10 mx-auto text-caramel/40" />
            <p className="font-heading text-lg font-bold text-espresso">No payments found</p>
            <p className="text-xs">Try adjusting your filters or date range.</p>
          </div>
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trans ID / Ref #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead
                    className="cursor-pointer select-none group hover:text-caramel transition-colors"
                    onClick={() => handleHeaderSort("amount")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Amount</span>
                      {renderSortIcon("amount")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none group hover:text-caramel transition-colors"
                    onClick={() => handleHeaderSort("date")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Date & Time</span>
                      {renderSortIcon("date")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none group hover:text-caramel transition-colors"
                    onClick={() => handleHeaderSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      {renderSortIcon("status")}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const isPaid = p.status === "paid";
                  const isRefunded = p.status === "refunded";
                  const isFailed = p.status === "failed";
                  const isPending = p.status === "pending";

                  const createdDate = new Date(p.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">
                        <span className="font-bold text-espresso block">
                          {p.reference_number || "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground block truncate max-w-[140px]">
                          {p.transaction_id}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="font-medium text-espresso block">
                          {p.customer_name || "Guest"}
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          {p.customer_email || ""}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className="capitalize text-[10px] font-semibold bg-latte/40 text-espresso border-border/80"
                        >
                          {p.payment_type || (p.order ? "Order" : "Reservation")}
                        </Badge>
                      </TableCell>

                      <TableCell className="capitalize text-xs font-medium text-muted-foreground">
                        {p.method}
                      </TableCell>

                      <TableCell className="font-semibold text-espresso">
                        {formatPHP(parseFloat(p.amount))}
                      </TableCell>

                      <TableCell className="text-muted-foreground text-[11px] whitespace-nowrap">
                        {createdDate}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize text-[10px] py-0.5 px-2 font-semibold ${
                            isPaid
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                              : isPending
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                              : isRefunded
                              ? "bg-purple-500/10 text-purple-700 border-purple-500/30"
                              : "bg-red-500/10 text-red-700 border-red-500/30"
                          }`}
                        >
                          {p.status}
                        </Badge>
                        {p.audit_note && (
                          <span
                            title={p.audit_note}
                            className="block text-[10px] text-muted-foreground italic truncate max-w-[120px] mt-0.5"
                          >
                            Note: {p.audit_note}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {isAdmin && isPaid && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenRefund(p)}
                            className="h-7 text-xs text-destructive hover:bg-destructive/10 rounded-full cursor-pointer font-medium"
                          >
                            Mark Refunded
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/60 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-4">
                <span>
                  Showing {displayStart}–{displayEnd} of {totalCount} transactions
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/80">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="py-1 px-2 rounded-xl border border-border bg-[#FAF6F0] text-espresso focus:bg-white focus:outline-none focus:ring-1 focus:ring-caramel transition-colors text-xs"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 rounded-full cursor-pointer text-xs gap-1 border-border/80 hover:bg-latte/40 text-espresso"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>

                <div className="flex items-center gap-1">
                  {getPageNumbers().map((pNum, idx) => {
                    if (pNum === "...") {
                      return (
                        <span key={`dots-${idx}`} className="px-1 text-muted-foreground select-none">
                          ...
                        </span>
                      );
                    }
                    const isActive = pNum === page;
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setPage(pNum)}
                        className={`h-8 min-w-[32px] px-2 rounded-full text-xs transition-colors cursor-pointer ${
                          isActive
                            ? "bg-caramel text-white shadow-xs font-semibold"
                            : "text-espresso hover:bg-latte/50 border border-border/60 font-medium"
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-2.5 rounded-full cursor-pointer text-xs gap-1 border-border/80 hover:bg-latte/40 text-espresso"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Admin Refund Confirmation Dialog */}
      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="font-heading text-xl text-espresso">
              Confirm Refund
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              You are about to refund transaction{" "}
              <strong className="text-espresso font-mono">
                {refundTarget?.reference_number}
              </strong>{" "}
              for{" "}
              <strong className="text-caramel font-semibold">
                {refundTarget && formatPHP(parseFloat(refundTarget.amount))}
              </strong>
              . This will deduct any awarded loyalty points and cancel associated orders/bookings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3">
            <label className="text-xs font-semibold text-espresso block">
              Audit Note <span className="text-muted-foreground font-normal">(Required for admin records)</span>
            </label>
            <textarea
              rows={3}
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
              placeholder="e.g. Customer canceled before preparation began; refund approved."
              className="w-full text-xs rounded-2xl border border-border p-3 focus:outline-none focus:ring-1 focus:ring-caramel resize-none bg-[#FAF6F0]"
            />
          </div>

          {refundError && (
            <div className="p-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-medium">
              {refundError}
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefundTarget(null)}
              className="rounded-full cursor-pointer"
              disabled={refunding}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmRefund}
              disabled={refunding}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90 cursor-pointer shadow-sm"
            >
              {refunding ? "Processing..." : "Confirm & Process Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
