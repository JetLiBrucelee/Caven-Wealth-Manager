import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, ArrowLeftRight, Receipt, Search, Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import type { Transaction, Customer } from "@shared/schema";

interface TransactionFormData {
  customerId: string;
  type: string;
  amount: string;
  description: string;
  date: string;
  status: string;
  reference: string;
  beneficiary: string;
  beneficiaryBank: string;
  beneficiaryAccount: string;
}

const emptyForm: TransactionFormData = {
  customerId: "",
  type: "credit",
  amount: "",
  description: "",
  date: new Date().toISOString().slice(0, 16),
  status: "completed",
  reference: "",
  beneficiary: "",
  beneficiaryBank: "",
  beneficiaryAccount: "",
};

export default function AdminTransactions() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState<TransactionFormData>(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterCustomerId, setFilterCustomerId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const hasActiveFilters = filterCustomerId || filterType || filterStatus || filterDateFrom || filterDateTo || filterAmountMin || filterAmountMax;

  function clearFilters() {
    setSearchQuery("");
    setFilterCustomerId("");
    setFilterType("");
    setFilterStatus("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterAmountMin("");
    setFilterAmountMax("");
  }

  const filteredTransactions = transactions?.filter((tx) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const customerName = getCustomerName(tx.customerId).toLowerCase();
      const matchesSearch =
        tx.description.toLowerCase().includes(q) ||
        (tx.reference ?? "").toLowerCase().includes(q) ||
        (tx.beneficiary ?? "").toLowerCase().includes(q) ||
        customerName.includes(q) ||
        tx.amount.includes(q);
      if (!matchesSearch) return false;
    }
    if (filterCustomerId && tx.customerId !== parseInt(filterCustomerId)) return false;
    if (filterType && tx.type !== filterType) return false;
    if (filterStatus && tx.status !== filterStatus) return false;
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      if (new Date(tx.date) < from) return false;
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(tx.date) > to) return false;
    }
    if (filterAmountMin && parseFloat(tx.amount) < parseFloat(filterAmountMin)) return false;
    if (filterAmountMax && parseFloat(tx.amount) > parseFloat(filterAmountMax)) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: (data: TransactionFormData) =>
      apiRequest("POST", "/api/transactions", {
        ...data,
        customerId: parseInt(data.customerId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transaction created successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create transaction", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; values: any }) =>
      apiRequest("PATCH", `/api/transactions/${data.id}`, {
        ...data.values,
        customerId: parseInt(data.values.customerId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transaction updated successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update transaction", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transaction deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingTransaction(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete transaction", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormData(emptyForm);
    setEditingTransaction(null);
  }

  function openAddDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(tx: Transaction) {
    setEditingTransaction(tx);
    setFormData({
      customerId: String(tx.customerId),
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      date: new Date(tx.date).toISOString().slice(0, 16),
      status: tx.status,
      reference: tx.reference ?? "",
      beneficiary: tx.beneficiary ?? "",
      beneficiaryBank: tx.beneficiaryBank ?? "",
      beneficiaryAccount: tx.beneficiaryAccount ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, values: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  function getCustomerName(customerId: number) {
    const customer = customers?.find((c) => c.id === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : `Customer #${customerId}`;
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-page-title">Transactions</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage all transactions</p>
        </div>
        <Button onClick={openAddDialog} data-testid="button-add-transaction">
          <Plus className="w-4 h-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer, description, reference, or amount..."
                className="pl-9"
                data-testid="input-search-transactions"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="shrink-0"
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                  Active
                </Badge>
              )}
              {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </Button>
          </div>

          {showFilters && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Customer</Label>
                  <Select value={filterCustomerId || "all"} onValueChange={(v) => setFilterCustomerId(v === "all" ? "" : v)}>
                    <SelectTrigger data-testid="filter-customer">
                      <SelectValue placeholder="All customers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All customers</SelectItem>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.firstName} {c.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Type</Label>
                  <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
                    <SelectTrigger data-testid="filter-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="withdrawal">Withdrawal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
                    <SelectTrigger data-testid="filter-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Amount Range</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filterAmountMin}
                      onChange={(e) => setFilterAmountMin(e.target.value)}
                      data-testid="filter-amount-min"
                      className="text-sm"
                    />
                    <span className="text-muted-foreground text-xs">to</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filterAmountMax}
                      onChange={(e) => setFilterAmountMax(e.target.value)}
                      data-testid="filter-amount-max"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date From</Label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    data-testid="filter-date-from"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date To</Label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    data-testid="filter-date-to"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end">
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                      <X className="w-4 h-4 mr-1" />
                      Clear all filters
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(searchQuery || hasActiveFilters) && filteredTransactions && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span data-testid="text-filter-results">
            Showing {filteredTransactions.length} of {transactions?.length ?? 0} transactions
          </span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !filteredTransactions?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ArrowLeftRight className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {transactions?.length ? "No transactions match your filters" : "No transactions yet"}
              </p>
              {(searchQuery || hasActiveFilters) && transactions?.length ? (
                <Button variant="ghost" onClick={clearFilters} className="mt-2" data-testid="button-clear-filters-empty">
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow
                    key={tx.id}
                    className="cursor-pointer"
                    data-testid={`row-transaction-${tx.id}`}
                    onClick={() => {
                      setViewingTransaction(tx);
                      setDetailDialogOpen(true);
                    }}
                  >
                    <TableCell className="text-sm">
                      {new Date(tx.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {getCustomerName(tx.customerId)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{tx.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${parseFloat(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {tx.description}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={tx.status === "completed" ? "default" : tx.status === "pending" ? "secondary" : "destructive"}
                        className="capitalize"
                      >
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{tx.reference}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(tx);
                          }}
                          data-testid={`button-edit-transaction-${tx.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingTransaction(tx);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-transaction-${tx.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingTransaction ? "Edit Transaction" : "Add Transaction"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select
                value={formData.customerId}
                onValueChange={(value) => setFormData({ ...formData, customerId: value })}
              >
                <SelectTrigger data-testid="select-customer">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.firstName} {c.lastName} - {c.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
                data-testid="input-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                data-testid="input-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                data-testid="input-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                data-testid="input-reference"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="beneficiary">Beneficiary</Label>
              <Input
                id="beneficiary"
                value={formData.beneficiary}
                onChange={(e) => setFormData({ ...formData, beneficiary: e.target.value })}
                data-testid="input-beneficiary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="beneficiaryBank">Beneficiary Bank</Label>
                <Input
                  id="beneficiaryBank"
                  value={formData.beneficiaryBank}
                  onChange={(e) => setFormData({ ...formData, beneficiaryBank: e.target.value })}
                  data-testid="input-beneficiary-bank"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiaryAccount">Beneficiary Account</Label>
                <Input
                  id="beneficiaryAccount"
                  value={formData.beneficiaryAccount}
                  onChange={(e) => setFormData({ ...formData, beneficiaryAccount: e.target.value })}
                  data-testid="input-beneficiary-account"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-transaction">
              {isPending ? "Saving..." : editingTransaction ? "Update Transaction" : "Create Transaction"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this transaction? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingTransaction && deleteMutation.mutate(deletingTransaction.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Transaction Details
            </DialogTitle>
          </DialogHeader>
          {viewingTransaction && (
            <div className="space-y-4">
              <div className="border-b pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount</p>
                <p className="text-3xl font-bold mt-1" data-testid="text-detail-amount">
                  ${parseFloat(viewingTransaction.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <Badge
                  variant={viewingTransaction.status === "completed" ? "default" : viewingTransaction.status === "pending" ? "secondary" : "destructive"}
                  className="capitalize mt-2"
                >
                  {viewingTransaction.status}
                </Badge>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{getCustomerName(viewingTransaction.customerId)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{viewingTransaction.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{new Date(viewingTransaction.date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium text-right max-w-[200px]">{viewingTransaction.description}</span>
                </div>
                {viewingTransaction.reference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-medium font-mono">{viewingTransaction.reference}</span>
                  </div>
                )}
                {viewingTransaction.beneficiary && (
                  <>
                    <div className="border-t pt-3 mt-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Beneficiary Info</p>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{viewingTransaction.beneficiary}</span>
                    </div>
                    {viewingTransaction.beneficiaryBank && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bank</span>
                        <span className="font-medium">{viewingTransaction.beneficiaryBank}</span>
                      </div>
                    )}
                    {viewingTransaction.beneficiaryAccount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account</span>
                        <span className="font-medium font-mono">{viewingTransaction.beneficiaryAccount}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
