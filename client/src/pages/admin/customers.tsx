import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Users, CheckCircle2, Loader2, ShieldBan, ShieldCheck, DollarSign, History } from "lucide-react";
import type { Customer } from "@shared/schema";

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Italy", "Spain",
  "Netherlands", "Belgium", "Switzerland", "Austria", "Sweden", "Norway", "Denmark", "Finland",
  "Ireland", "Portugal", "Greece", "Poland", "Czech Republic", "Romania", "Hungary", "Bulgaria",
  "Croatia", "Slovakia", "Slovenia", "Lithuania", "Latvia", "Estonia", "Luxembourg", "Malta",
  "Cyprus", "Iceland", "Japan", "South Korea", "China", "India", "Brazil", "Mexico", "Argentina",
  "Colombia", "Chile", "Peru", "Venezuela", "Ecuador", "Bolivia", "Paraguay", "Uruguay",
  "Costa Rica", "Panama", "Guatemala", "Honduras", "El Salvador", "Nicaragua", "Cuba",
  "Dominican Republic", "Puerto Rico", "Jamaica", "Trinidad and Tobago", "Bahamas", "Barbados",
  "South Africa", "Nigeria", "Kenya", "Ghana", "Tanzania", "Ethiopia", "Egypt", "Morocco",
  "Tunisia", "Algeria", "Senegal", "Cameroon", "Ivory Coast", "Uganda", "Mozambique", "Zimbabwe",
  "Saudi Arabia", "United Arab Emirates", "Qatar", "Kuwait", "Bahrain", "Oman", "Jordan", "Lebanon",
  "Israel", "Turkey", "Iraq", "Iran", "Pakistan", "Bangladesh", "Sri Lanka", "Nepal",
  "Thailand", "Vietnam", "Philippines", "Malaysia", "Singapore", "Indonesia", "Myanmar",
  "Cambodia", "Taiwan", "Hong Kong", "New Zealand", "Fiji", "Papua New Guinea",
  "Russia", "Ukraine", "Belarus", "Georgia", "Armenia", "Azerbaijan", "Kazakhstan",
  "Uzbekistan", "Mongolia",
].sort();

interface CustomerFormData {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  gender: string;
  dateOfBirth: string;
  accountType: string;
  balance: string;
  status: string;
  hasDebitCard: boolean;
  hasCreditCard: boolean;
}

const emptyForm: CustomerFormData = {
  firstName: "",
  lastName: "",
  username: "",
  password: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "United States",
  gender: "",
  dateOfBirth: "",
  accountType: "checking",
  balance: "0.00",
  status: "active",
  hasDebitCard: false,
  hasCreditCard: false,
};

export default function AdminCustomers() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [fundingCustomer, setFundingCustomer] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm);
  const [fundAmount, setFundAmount] = useState("");
  const [fundDescription, setFundDescription] = useState("");
  const [historyForm, setHistoryForm] = useState({
    type: "credit",
    amount: "",
    description: "",
    date: "",
    status: "completed",
    reference: "",
    beneficiary: "",
    beneficiaryBank: "",
    beneficiaryAccount: "",
  });
  const [zipLookupStatus, setZipLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const zipLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createMutation = useMutation({
    mutationFn: (data: CustomerFormData) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer created successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create customer", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; values: Partial<CustomerFormData> }) =>
      apiRequest("PATCH", `/api/customers/${data.id}`, data.values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer updated successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update customer", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingCustomer(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete customer", description: error.message, variant: "destructive" });
    },
  });

  const blockMutation = useMutation({
    mutationFn: (data: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/customers/${data.id}/block`, { status: data.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer status updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update customer status", description: error.message, variant: "destructive" });
    },
  });

  const fundMutation = useMutation({
    mutationFn: (data: { id: number; amount: number; description: string }) =>
      apiRequest("POST", `/api/customers/${data.id}/fund`, { amount: data.amount, description: data.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Account funded successfully" });
      setFundDialogOpen(false);
      setFundingCustomer(null);
      setFundAmount("");
      setFundDescription("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to fund account", description: error.message, variant: "destructive" });
    },
  });

  const historyMutation = useMutation({
    mutationFn: (data: { id: number; values: Record<string, string> }) =>
      apiRequest("POST", `/api/customers/${data.id}/history`, data.values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transaction history created successfully" });
      setHistoryDialogOpen(false);
      setHistoryCustomer(null);
      setHistoryForm({
        type: "credit",
        amount: "",
        description: "",
        date: "",
        status: "completed",
        reference: "",
        beneficiary: "",
        beneficiaryBank: "",
        beneficiaryAccount: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create transaction", description: error.message, variant: "destructive" });
    },
  });

  const lookupZipCode = useCallback(async (zip: string) => {
    if (zip.length < 5) {
      setZipLookupStatus("idle");
      return;
    }
    setZipLookupStatus("loading");
    try {
      const response = await fetch(`/api/zipcode-lookup/${zip}`);
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          city: data.city || prev.city,
          state: data.state || prev.state,
        }));
        setZipLookupStatus("found");
      } else {
        setZipLookupStatus("not_found");
      }
    } catch {
      setZipLookupStatus("not_found");
    }
  }, []);

  const handleZipCodeChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9-]/g, "");
    setFormData(prev => ({ ...prev, zipCode: cleaned }));

    if (zipLookupTimer.current) {
      clearTimeout(zipLookupTimer.current);
    }

    if (cleaned.length >= 5 && formData.country === "United States") {
      zipLookupTimer.current = setTimeout(() => {
        lookupZipCode(cleaned);
      }, 400);
    } else {
      setZipLookupStatus("idle");
    }
  }, [lookupZipCode, formData.country]);

  function resetForm() {
    setFormData(emptyForm);
    setEditingCustomer(null);
    setZipLookupStatus("idle");
  }

  function openAddDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(customer: Customer) {
    setEditingCustomer(customer);
    setFormData({
      firstName: customer.firstName,
      lastName: customer.lastName,
      username: customer.username,
      password: "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      zipCode: customer.zipCode ?? "",
      country: customer.country ?? "United States",
      gender: customer.gender ?? "",
      dateOfBirth: customer.dateOfBirth ?? "",
      accountType: customer.accountType,
      balance: customer.balance,
      status: customer.status,
      hasDebitCard: customer.hasDebitCard ?? false,
      hasCreditCard: customer.hasCreditCard ?? false,
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, values: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-page-title">Customers</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage customer accounts</p>
        </div>
        <Button onClick={openAddDialog} data-testid="button-add-customer">
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !customers?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No customers yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Account #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                    <TableCell className="font-medium">
                      {customer.firstName} {customer.lastName}
                    </TableCell>
                    <TableCell className="text-sm">{customer.username}</TableCell>
                    <TableCell className="text-sm">{customer.email}</TableCell>
                    <TableCell className="text-sm">{customer.phone}</TableCell>
                    <TableCell className="text-sm font-mono">{customer.accountNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{customer.accountType}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${parseFloat(customer.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.status === "active" ? "default" : customer.status === "blocked" ? "destructive" : "secondary"} className="capitalize">
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(customer)}
                          data-testid={`button-edit-customer-${customer.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingCustomer(customer);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-customer-${customer.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => blockMutation.mutate({
                            id: customer.id,
                            status: customer.status === "blocked" ? "active" : "blocked",
                          })}
                          data-testid={`button-block-customer-${customer.id}`}
                        >
                          {customer.status === "blocked" ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : (
                            <ShieldBan className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setFundingCustomer(customer);
                            setFundAmount("");
                            setFundDescription("");
                            setFundDialogOpen(true);
                          }}
                          data-testid={`button-fund-customer-${customer.id}`}
                        >
                          <DollarSign className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setHistoryCustomer(customer);
                            setHistoryForm({
                              type: "credit",
                              amount: "",
                              description: "",
                              date: "",
                              status: "completed",
                              reference: "",
                              beneficiary: "",
                              beneficiaryBank: "",
                              beneficiaryAccount: "",
                            });
                            setHistoryDialogOpen(true);
                          }}
                          data-testid={`button-history-customer-${customer.id}`}
                        >
                          <History className="w-4 h-4" />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingCustomer ? "Edit Customer" : "Add Customer"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Login Credentials</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password {editingCustomer && <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingCustomer}
                    placeholder={editingCustomer ? "Leave blank to keep unchanged" : ""}
                    data-testid="input-password"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Personal Information</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      data-testid="input-phone"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    >
                      <SelectTrigger data-testid="select-gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      data-testid="input-date-of-birth"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Address</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select
                    value={formData.country}
                    onValueChange={(value) => {
                      setFormData({ ...formData, country: value, city: "", state: "", zipCode: "" });
                      setZipLookupStatus("idle");
                    }}
                  >
                    <SelectTrigger data-testid="select-country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main Street, Apt 4B"
                    data-testid="input-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">
                    Zip / Postal Code
                    {formData.country === "United States" && (
                      <span className="text-xs text-muted-foreground font-normal ml-2">
                        (auto-fills city & state)
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => handleZipCodeChange(e.target.value)}
                      placeholder={formData.country === "United States" ? "e.g. 10001" : "Enter postal code"}
                      data-testid="input-zip-code"
                      className={zipLookupStatus === "found" ? "border-green-400 pr-10" : zipLookupStatus === "not_found" ? "border-red-300 pr-10" : ""}
                    />
                    {zipLookupStatus === "loading" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      </div>
                    )}
                    {zipLookupStatus === "found" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                    )}
                  </div>
                  {zipLookupStatus === "not_found" && formData.zipCode.length >= 5 && (
                    <p className="text-xs text-red-500 mt-1">Zip code not found. Please enter city and state manually.</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City name"
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State / Province</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="State or province"
                      data-testid="input-state"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Account Settings</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select
                      value={formData.accountType}
                      onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                    >
                      <SelectTrigger data-testid="select-account-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Checking</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="ira">IRA Account</SelectItem>
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
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balance">Initial Balance</Label>
                  <Input
                    id="balance"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    required
                    data-testid="input-balance"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Card Options</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasDebitCard}
                    onChange={(e) => setFormData({ ...formData, hasDebitCard: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    data-testid="checkbox-debit-card"
                  />
                  <span className="text-sm font-medium">Issue Debit Card</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasCreditCard}
                    onChange={(e) => setFormData({ ...formData, hasCreditCard: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    data-testid="checkbox-credit-card"
                  />
                  <span className="text-sm font-medium">Issue Credit Card</span>
                </label>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-customer">
              {isPending ? "Saving..." : editingCustomer ? "Update Customer" : "Create Customer"}
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
            Are you sure you want to delete {deletingCustomer?.firstName} {deletingCustomer?.lastName}? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingCustomer && deleteMutation.mutate(deletingCustomer.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fundDialogOpen} onOpenChange={(open) => { setFundDialogOpen(open); if (!open) { setFundingCustomer(null); setFundAmount(""); setFundDescription(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-fund-dialog-title">Fund Account</DialogTitle>
          </DialogHeader>
          {fundingCustomer && (
            <div className="space-y-1 mb-4">
              <p className="text-sm font-medium" data-testid="text-fund-customer-name">{fundingCustomer.firstName} {fundingCustomer.lastName}</p>
              <p className="text-sm text-muted-foreground" data-testid="text-fund-customer-balance">
                Current Balance: ${parseFloat(fundingCustomer.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
          <form onSubmit={(e) => {
            e.preventDefault();
            if (fundingCustomer) {
              fundMutation.mutate({
                id: fundingCustomer.id,
                amount: parseFloat(fundAmount),
                description: fundDescription || "Account funding by admin",
              });
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fund-amount">Amount</Label>
              <Input
                id="fund-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                required
                data-testid="input-fund-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fund-description">Description</Label>
              <Input
                id="fund-description"
                value={fundDescription}
                onChange={(e) => setFundDescription(e.target.value)}
                placeholder="Account funding by admin"
                data-testid="input-fund-description"
              />
            </div>
            <Button type="submit" className="w-full" disabled={fundMutation.isPending} data-testid="button-submit-fund">
              {fundMutation.isPending ? "Funding..." : "Fund Account"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={(open) => { setHistoryDialogOpen(open); if (!open) { setHistoryCustomer(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-history-dialog-title">Create Transaction History</DialogTitle>
          </DialogHeader>
          {historyCustomer && (
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-history-customer-name">
              For: {historyCustomer.firstName} {historyCustomer.lastName}
            </p>
          )}
          <form onSubmit={(e) => {
            e.preventDefault();
            if (historyCustomer) {
              historyMutation.mutate({
                id: historyCustomer.id,
                values: historyForm,
              });
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={historyForm.type} onValueChange={(value) => setHistoryForm({ ...historyForm, type: value })}>
                <SelectTrigger data-testid="select-history-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                  <SelectItem value="external_transfer">External Transfer</SelectItem>
                  <SelectItem value="internal_transfer">Internal Transfer</SelectItem>
                  <SelectItem value="bill_pay">Bill Pay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-amount">Amount</Label>
              <Input
                id="history-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={historyForm.amount}
                onChange={(e) => setHistoryForm({ ...historyForm, amount: e.target.value })}
                required
                data-testid="input-history-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-description">Description</Label>
              <Input
                id="history-description"
                value={historyForm.description}
                onChange={(e) => setHistoryForm({ ...historyForm, description: e.target.value })}
                required
                data-testid="input-history-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-date">Date</Label>
              <Input
                id="history-date"
                type="datetime-local"
                value={historyForm.date}
                onChange={(e) => setHistoryForm({ ...historyForm, date: e.target.value })}
                required
                data-testid="input-history-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={historyForm.status} onValueChange={(value) => setHistoryForm({ ...historyForm, status: value })}>
                <SelectTrigger data-testid="select-history-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-reference">Reference</Label>
              <Input
                id="history-reference"
                value={historyForm.reference}
                onChange={(e) => setHistoryForm({ ...historyForm, reference: e.target.value })}
                placeholder="Auto-generates if empty"
                data-testid="input-history-reference"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-beneficiary">Beneficiary</Label>
              <Input
                id="history-beneficiary"
                value={historyForm.beneficiary}
                onChange={(e) => setHistoryForm({ ...historyForm, beneficiary: e.target.value })}
                data-testid="input-history-beneficiary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-beneficiary-bank">Beneficiary Bank</Label>
              <Input
                id="history-beneficiary-bank"
                value={historyForm.beneficiaryBank}
                onChange={(e) => setHistoryForm({ ...historyForm, beneficiaryBank: e.target.value })}
                data-testid="input-history-beneficiary-bank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-beneficiary-account">Beneficiary Account</Label>
              <Input
                id="history-beneficiary-account"
                value={historyForm.beneficiaryAccount}
                onChange={(e) => setHistoryForm({ ...historyForm, beneficiaryAccount: e.target.value })}
                data-testid="input-history-beneficiary-account"
              />
            </div>
            <Button type="submit" className="w-full" disabled={historyMutation.isPending} data-testid="button-submit-history">
              {historyMutation.isPending ? "Creating..." : "Create Transaction"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
