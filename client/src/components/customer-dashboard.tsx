import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  LayoutDashboard,
  Send,
  ArrowRightLeft,
  ArrowLeftRight,
  Receipt,
  User,
  History,
  LogOut,
  DollarSign,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface CustomerData {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  accountNumber: string;
  routingNumber: string;
  accountType: string;
  balance: string;
  status: string;
  createdAt: string;
}

interface Transfer {
  id: number;
  customerId: number;
  type: string;
  amount: string;
  description: string | null;
  status: string;
  recipientName: string | null;
  recipientBank: string | null;
  recipientAccount: string | null;
  recipientRoutingNumber: string | null;
  swiftCode: string | null;
  bankAddress: string | null;
  memo: string | null;
  billPayee: string | null;
  billAccountNumber: string | null;
  internalToAccount: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Transaction {
  id: number;
  type: string;
  amount: string;
  description: string;
  date: string;
  status: string;
  reference: string | null;
  beneficiary: string | null;
  beneficiaryBank: string | null;
  beneficiaryAccount: string | null;
}

type Page = "dashboard" | "wire" | "external" | "internal" | "billpay" | "profile" | "history" | "transfers";

const menuItems: { label: string; icon: any; page: Page }[] = [
  { label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
  { label: "Wire Transfer", icon: Send, page: "wire" },
  { label: "External Transfer", icon: ArrowRightLeft, page: "external" },
  { label: "Internal Transfer", icon: ArrowLeftRight, page: "internal" },
  { label: "Bill Pay", icon: Receipt, page: "billpay" },
  { label: "Transfer Status", icon: Clock, page: "transfers" },
  { label: "Transaction History", icon: History, page: "history" },
  { label: "My Profile", icon: User, page: "profile" },
];

const formatAmount = (amount: string) => {
  const num = parseFloat(amount);
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function CustomerDashboard({ customer: initialCustomer, onLogout }: { customer: CustomerData; onLogout: () => void }) {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const { toast } = useToast();

  const { data: freshCustomer } = useQuery<CustomerData>({
    queryKey: ["/api/customer/me"],
    refetchInterval: 5000,
  });

  const customer = freshCustomer || initialCustomer;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="w-64 bg-white dark:bg-slate-900 border-r flex flex-col shrink-0">
        <div className="p-5 border-b">
          <h1 className="text-lg font-bold text-blue-800 dark:text-blue-400" data-testid="text-dashboard-brand">
            Caven Wealth Financial
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Welcome, {customer.firstName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <div
                key={item.page}
                onClick={() => setCurrentPage(item.page)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                data-testid={`link-customer-${item.page}`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <Button variant="ghost" className="w-full justify-start text-red-600" onClick={onLogout} data-testid="button-customer-logout">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white dark:bg-slate-900 border-b flex items-center justify-between gap-4 px-6 shrink-0">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {menuItems.find(m => m.page === currentPage)?.label || "Dashboard"}
          </div>
          <div className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {currentPage === "dashboard" && <DashboardView customer={customer} onNavigate={setCurrentPage} />}
          {currentPage === "wire" && <TransferForm type="wire_transfer" customer={customer} />}
          {currentPage === "external" && <TransferForm type="external_transfer" customer={customer} />}
          {currentPage === "internal" && <TransferForm type="internal_transfer" customer={customer} />}
          {currentPage === "billpay" && <TransferForm type="bill_pay" customer={customer} />}
          {currentPage === "transfers" && <TransferStatusView />}
          {currentPage === "history" && <TransactionHistoryView />}
          {currentPage === "profile" && <ProfileView customer={customer} />}
        </main>
      </div>
    </div>
  );
}

function DashboardView({ customer, onNavigate }: { customer: CustomerData; onNavigate: (p: Page) => void }) {
  const [showAccount, setShowAccount] = useState(false);

  const { data: transfers } = useQuery<Transfer[]>({
    queryKey: ["/api/customer/transfers"],
    refetchInterval: 5000,
  });

  const pendingCount = transfers?.filter(t => t.status === "pending").length || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <p className="text-blue-200 text-sm font-medium">Available Balance</p>
            <p className="text-4xl font-bold mt-2" data-testid="text-dashboard-balance">{formatAmount(customer.balance)}</p>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div>
                <p className="text-blue-200">Account</p>
                <p className="font-mono flex items-center gap-2" data-testid="text-dashboard-account">
                  {showAccount ? customer.accountNumber : "****" + customer.accountNumber.slice(-4)}
                  <button onClick={() => setShowAccount(!showAccount)} className="opacity-70 hover:opacity-100">
                    {showAccount ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </p>
              </div>
              <div>
                <p className="text-blue-200">Routing</p>
                <p className="font-mono" data-testid="text-dashboard-routing">{customer.routingNumber}</p>
              </div>
              <div>
                <p className="text-blue-200">Type</p>
                <p className="capitalize" data-testid="text-dashboard-type">{customer.accountType}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
            <Clock className="w-8 h-8 text-amber-500 mb-2" />
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Pending Transfers</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Wire Transfer", icon: Send, page: "wire" as Page, color: "text-blue-600 bg-blue-50" },
            { label: "External Transfer", icon: ArrowRightLeft, page: "external" as Page, color: "text-green-600 bg-green-50" },
            { label: "Internal Transfer", icon: ArrowLeftRight, page: "internal" as Page, color: "text-purple-600 bg-purple-50" },
            { label: "Bill Pay", icon: Receipt, page: "billpay" as Page, color: "text-orange-600 bg-orange-50" },
          ].map((action) => (
            <Card
              key={action.page}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onNavigate(action.page)}
              data-testid={`card-action-${action.page}`}
            >
              <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                <div className={`p-3 rounded-xl ${action.color}`}>
                  <action.icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {transfers && transfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transfers.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={t.status} />
                    <div>
                      <p className="text-sm font-medium">{t.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(t.createdAt), "MMM d, yyyy h:mm a")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">-{formatAmount(t.amount)}</p>
                    <Badge variant={t.status === "approved" ? "default" : t.status === "rejected" ? "destructive" : "secondary"} className="capitalize text-xs">
                      {t.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (status === "rejected") return <XCircle className="w-5 h-5 text-red-500" />;
  return <Clock className="w-5 h-5 text-amber-500" />;
}

function TransferForm({ type, customer }: { type: string; customer: CustomerData }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/customer/transfers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/me"] });
      toast({ title: "Transfer submitted successfully", description: "Your transfer is pending approval." });
      setFormData({});
    },
    onError: (error: any) => {
      toast({ title: "Transfer failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({ description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    mutation.mutate({ ...formData, type, status: "pending" });
  };

  const update = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }));

  const titles: Record<string, string> = {
    wire_transfer: "Wire Transfer",
    external_transfer: "External Transfer",
    internal_transfer: "Internal Transfer",
    bill_pay: "Bill Pay",
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-transfer-title">
            <DollarSign className="w-5 h-5" />
            {titles[type]}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Available Balance: <span className="font-semibold text-foreground">{formatAmount(customer.balance)}</span>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount || ""}
                onChange={(e) => update("amount", e.target.value)}
                required
                data-testid="input-transfer-amount"
              />
            </div>

            {type === "wire_transfer" && (
              <>
                <div className="space-y-2">
                  <Label>Recipient Name</Label>
                  <Input value={formData.recipientName || ""} onChange={(e) => update("recipientName", e.target.value)} required data-testid="input-recipient-name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Recipient Bank</Label>
                    <Input value={formData.recipientBank || ""} onChange={(e) => update("recipientBank", e.target.value)} required data-testid="input-recipient-bank" />
                  </div>
                  <div className="space-y-2">
                    <Label>Recipient Account #</Label>
                    <Input value={formData.recipientAccount || ""} onChange={(e) => update("recipientAccount", e.target.value)} required data-testid="input-recipient-account" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Routing Number</Label>
                    <Input value={formData.recipientRoutingNumber || ""} onChange={(e) => update("recipientRoutingNumber", e.target.value)} required data-testid="input-recipient-routing" />
                  </div>
                  <div className="space-y-2">
                    <Label>SWIFT Code (optional)</Label>
                    <Input value={formData.swiftCode || ""} onChange={(e) => update("swiftCode", e.target.value)} data-testid="input-swift-code" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Bank Address (optional)</Label>
                  <Input value={formData.bankAddress || ""} onChange={(e) => update("bankAddress", e.target.value)} data-testid="input-bank-address" />
                </div>
              </>
            )}

            {type === "external_transfer" && (
              <>
                <div className="space-y-2">
                  <Label>Recipient Name</Label>
                  <Input value={formData.recipientName || ""} onChange={(e) => update("recipientName", e.target.value)} required data-testid="input-recipient-name" />
                </div>
                <div className="space-y-2">
                  <Label>Recipient Bank</Label>
                  <Input value={formData.recipientBank || ""} onChange={(e) => update("recipientBank", e.target.value)} required data-testid="input-recipient-bank" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input value={formData.recipientAccount || ""} onChange={(e) => update("recipientAccount", e.target.value)} required data-testid="input-recipient-account" />
                  </div>
                  <div className="space-y-2">
                    <Label>Routing Number</Label>
                    <Input value={formData.recipientRoutingNumber || ""} onChange={(e) => update("recipientRoutingNumber", e.target.value)} required data-testid="input-recipient-routing" />
                  </div>
                </div>
              </>
            )}

            {type === "internal_transfer" && (
              <div className="space-y-2">
                <Label>Transfer To (Account Number)</Label>
                <Input value={formData.internalToAccount || ""} onChange={(e) => update("internalToAccount", e.target.value)} required data-testid="input-internal-account" placeholder="Enter recipient account number" />
              </div>
            )}

            {type === "bill_pay" && (
              <>
                <div className="space-y-2">
                  <Label>Payee Name</Label>
                  <Input value={formData.billPayee || ""} onChange={(e) => update("billPayee", e.target.value)} required data-testid="input-bill-payee" />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input value={formData.billAccountNumber || ""} onChange={(e) => update("billAccountNumber", e.target.value)} required data-testid="input-bill-account" />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Description / Memo</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Add a note for this transfer"
                data-testid="input-transfer-description"
              />
            </div>

            <Separator />

            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-transfer">
              {mutation.isPending ? "Processing..." : `Submit ${titles[type]}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function TransferStatusView() {
  const { data: transfers, isLoading } = useQuery<Transfer[]>({
    queryKey: ["/api/customer/transfers"],
    refetchInterval: 3000,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" data-testid="text-transfers-title">Transfer Status</h2>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : !transfers?.length ? (
            <div className="p-8 text-center text-muted-foreground">No transfers yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id} data-testid={`row-transfer-${t.id}`}>
                    <TableCell className="text-sm">{format(new Date(t.createdAt), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell className="text-sm capitalize">{t.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">{t.recipientName || t.billPayee || t.internalToAccount || "-"}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">-{formatAmount(t.amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={t.status === "approved" ? "default" : t.status === "rejected" ? "destructive" : "secondary"}
                        className="capitalize"
                        data-testid={`badge-transfer-status-${t.id}`}
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionHistoryView() {
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/customer/transactions"],
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" data-testid="text-history-title">Transaction History</h2>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : !transactions?.length ? (
            <div className="p-8 text-center text-muted-foreground">No transactions yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id} data-testid={`row-transaction-${t.id}`}>
                    <TableCell className="text-sm">{format(new Date(t.date), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell className="text-sm capitalize">{t.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{t.description}</TableCell>
                    <TableCell className={`text-right font-semibold ${t.type.includes("credit") || t.type.includes("deposit") ? "text-green-600" : "text-red-600"}`}>
                      {t.type.includes("credit") || t.type.includes("deposit") ? "+" : "-"}{formatAmount(t.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === "completed" ? "default" : "secondary"} className="capitalize">{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{t.reference || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileView({ customer }: { customer: CustomerData }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const InfoRow = ({ label, value, copyable }: { label: string; value: string | null; copyable?: boolean }) => (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-right" data-testid={`text-profile-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          {value || "—"}
        </span>
        {copyable && value && (
          <button onClick={() => copyToClipboard(value, label)} className="text-muted-foreground hover:text-foreground">
            {copied === label ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Full Name" value={`${customer.firstName} ${customer.lastName}`} />
          <InfoRow label="Username" value={customer.username} />
          <InfoRow label="Email" value={customer.email} />
          <InfoRow label="Phone" value={customer.phone} />
          <InfoRow label="Gender" value={customer.gender ? customer.gender.charAt(0).toUpperCase() + customer.gender.slice(1) : null} />
          <InfoRow label="Date of Birth" value={customer.dateOfBirth} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Street Address" value={customer.address} />
          <InfoRow label="City" value={customer.city} />
          <InfoRow label="State" value={customer.state} />
          <InfoRow label="ZIP Code" value={customer.zipCode} />
          <InfoRow label="Country" value={customer.country} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Account Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Account Number" value={customer.accountNumber} copyable />
          <InfoRow label="Routing Number" value={customer.routingNumber} copyable />
          <InfoRow label="Account Type" value={customer.accountType.charAt(0).toUpperCase() + customer.accountType.slice(1)} />
          <InfoRow label="Account Status" value={customer.status.charAt(0).toUpperCase() + customer.status.slice(1)} />
          <InfoRow label="Current Balance" value={formatAmount(customer.balance)} />
          <InfoRow label="Member Since" value={customer.createdAt ? format(new Date(customer.createdAt), "MMMM d, yyyy") : null} />
        </CardContent>
      </Card>
    </div>
  );
}
