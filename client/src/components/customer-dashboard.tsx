import { useState, useRef, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  MessageSquare,
  TrendingUp,
  TrendingDown,
  ArrowUp,
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
  hasDebitCard: boolean;
  hasCreditCard: boolean;
  memberSince: string | null;
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

type Page = "dashboard" | "wire" | "external" | "internal" | "billpay" | "profile" | "history" | "transfers" | "cards" | "support";

const menuItems: { label: string; icon: any; page: Page }[] = [
  { label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
  { label: "My Cards", icon: CreditCard, page: "cards" },
  { label: "Wire Transfer", icon: Send, page: "wire" },
  { label: "External Transfer", icon: ArrowRightLeft, page: "external" },
  { label: "Internal Transfer", icon: ArrowLeftRight, page: "internal" },
  { label: "Bill Pay", icon: Receipt, page: "billpay" },
  { label: "Transfer Status", icon: Clock, page: "transfers" },
  { label: "Transaction History", icon: History, page: "history" },
  { label: "My Profile", icon: User, page: "profile" },
  { label: "Support", icon: MessageSquare, page: "support" },
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
        <div className="p-6 border-b">
          <div className="flex items-center justify-center" data-testid="text-dashboard-brand">
            <img src="/logo.png" alt="Caven Wealth Financial" className="h-28 w-auto object-contain drop-shadow-md" />
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">Welcome, {customer.firstName}</p>
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
          {currentPage === "cards" && <CardsView customer={customer} />}
          {currentPage === "profile" && <ProfileView customer={customer} />}
          {currentPage === "support" && <SupportView />}
        </main>
      </div>

      <FloatingChatButton currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}

function useSimulatedStocks() {
  const basePrices = [
    { symbol: "VOO", base: 498.23, label: "S&P 500" },
    { symbol: "BRK.B", base: 412.56, label: "Berkshire" },
    { symbol: "JPM", base: 201.16, label: "JPMorgan" },
    { symbol: "AAPL", base: 237.84, label: "Apple" },
    { symbol: "MSFT", base: 415.67, label: "Microsoft" },
  ];

  const baseMarket = [
    { name: "DJI", base: 0.6 },
    { name: "NASDAQ", base: 1.1 },
    { name: "Gold", base: -0.2 },
    { name: "S&P 500", base: 0.9 },
  ];

  const [stocks, setStocks] = useState(() =>
    basePrices.map((s) => {
      const pctChange = (Math.random() - 0.4) * 1.5;
      const price = s.base + s.base * (pctChange / 100);
      return {
        symbol: s.symbol,
        price: price.toFixed(2),
        change: `${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}%`,
        label: s.label,
        positive: pctChange >= 0,
      };
    })
  );

  const [market, setMarket] = useState(() =>
    baseMarket.map((m) => {
      const val = m.base + (Math.random() - 0.5) * 0.4;
      return {
        name: m.name,
        change: `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`,
        positive: val >= 0,
      };
    })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setStocks((prev) =>
        prev.map((s, i) => {
          const drift = (Math.random() - 0.48) * 0.3;
          const oldPct = parseFloat(s.change);
          const newPct = oldPct + drift;
          const price = basePrices[i].base + basePrices[i].base * (newPct / 100);
          return {
            ...s,
            price: price.toFixed(2),
            change: `${newPct >= 0 ? "+" : ""}${newPct.toFixed(1)}%`,
            positive: newPct >= 0,
          };
        })
      );
      setMarket((prev) =>
        prev.map((m) => {
          const drift = (Math.random() - 0.5) * 0.15;
          const oldVal = parseFloat(m.change);
          const newVal = oldVal + drift;
          return {
            ...m,
            change: `${newVal >= 0 ? "+" : ""}${newVal.toFixed(1)}%`,
            positive: newVal >= 0,
          };
        })
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return { stocks, market };
}

function DashboardView({ customer, onNavigate }: { customer: CustomerData; onNavigate: (p: Page) => void }) {
  const [showAccount, setShowAccount] = useState(false);
  const { stocks: stockData, market: marketSummary } = useSimulatedStocks();

  const { data: transfers } = useQuery<Transfer[]>({
    queryKey: ["/api/customer/transfers"],
    refetchInterval: 5000,
  });

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ["/api/customer/transactions"],
    refetchInterval: 10000,
  });

  const pendingCount = transfers?.filter(t => ["pending", "pending_confirmation", "processing"].includes(t.status)).length || 0;
  const balance = parseFloat(customer.balance);
  const liquidAssets = balance * 0.43;
  const ytdReturn = ((balance * 0.032) / balance) * 100;

  const advisorNotes = [
    "Your portfolio allocation remains balanced. Consider tax-loss harvesting in tech.",
    "Equity markets show continued momentum. Maintain current diversification strategy.",
    "Bond yields stabilizing — review fixed income allocation for rebalancing opportunity.",
  ];

  const todayNote = advisorNotes[new Date().getDate() % advisorNotes.length];

  const portfolioAllocation = [
    { label: "Equities", pct: 45, color: "bg-blue-500" },
    { label: "Fixed Income", pct: 25, color: "bg-emerald-500" },
    { label: "Real Estate", pct: 15, color: "bg-amber-500" },
    { label: "Cash & Equiv.", pct: 10, color: "bg-slate-400" },
    { label: "Alternatives", pct: 5, color: "bg-purple-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" data-testid="text-dashboard-title">Dashboard overview</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="w-4 h-4" />
          <span>{format(new Date(), "MMMM yyyy")}</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current U.S. Stocks</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">market open</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {stockData.map((stock) => (
              <div
                key={stock.symbol}
                className="border rounded-xl p-4 bg-white dark:bg-slate-800 hover:shadow-md transition-shadow"
                data-testid={`card-stock-${stock.symbol}`}
              >
                <p className="font-bold text-base text-slate-800 dark:text-white">{stock.symbol}</p>
                <p className="text-xl font-bold mt-1">${stock.price}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className={`text-xs font-semibold ${stock.positive ? "text-green-600" : "text-red-500"}`}>
                    {stock.change}
                  </span>
                  <span className="text-xs text-muted-foreground">{stock.label}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total balance</h3>
            </div>
            <p className="text-4xl font-bold mt-2" data-testid="text-dashboard-balance">{formatAmount(customer.balance)}</p>
            <p className="text-green-600 text-sm font-medium mt-1 flex items-center gap-1" data-testid="text-ytd-return">
              <ArrowUp className="w-3.5 h-3.5" /> {ytdReturn.toFixed(1)}% YTD
            </p>
            <Separator className="my-4" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Liquid assets</span>
              <span className="font-bold" data-testid="text-liquid-assets">
                ${liquidAssets >= 1000000 ? (liquidAssets / 1000000).toFixed(1) + "M" : liquidAssets.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Account</span>
              <span className="font-mono flex items-center gap-2" data-testid="text-dashboard-account">
                {showAccount ? customer.accountNumber : "••••" + customer.accountNumber.slice(-4)}
                <button
                  type="button"
                  onClick={() => setShowAccount(!showAccount)}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-account"
                >
                  {showAccount ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Account type</span>
              <span className="capitalize font-medium" data-testid="text-dashboard-type">{customer.accountType}</span>
            </div>
            {pendingCount > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700 dark:text-amber-300">{pendingCount} pending transfer{pendingCount > 1 ? "s" : ""}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-4">Market summary</h3>
            <div className="space-y-3">
              {marketSummary.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`market-${item.name.toLowerCase().replace(/[^a-z]/g, "")}`}>
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className={`text-sm font-bold flex items-center gap-1 ${item.positive ? "text-green-600" : "text-red-500"}`}>
                    {item.positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {item.change.replace("+", "").replace("-", "")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm bg-blue-50/50 dark:bg-blue-950/30">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Today's advisor note</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 italic" data-testid="text-advisor-note">
            "{todayNote}"
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-4">Investment Analytics — Portfolio Allocation</h3>
          <div className="flex h-4 rounded-full overflow-hidden mb-4">
            {portfolioAllocation.map((item) => (
              <div
                key={item.label}
                className={`${item.color} transition-all`}
                style={{ width: `${item.pct}%` }}
                title={`${item.label}: ${item.pct}%`}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {portfolioAllocation.map((item) => (
              <div key={item.label} className="flex items-center gap-2" data-testid={`allocation-${item.label.toLowerCase().replace(/[^a-z]/g, "")}`}>
                <span className={`w-3 h-3 rounded-full ${item.color} shrink-0`} />
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-bold">{item.pct}%</p>
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Return</p>
              <p className="text-lg font-bold text-green-600" data-testid="text-total-return">+{ytdReturn.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Risk Score</p>
              <p className="text-lg font-bold" data-testid="text-risk-score">Moderate</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Dividend Yield</p>
              <p className="text-lg font-bold text-blue-600" data-testid="text-dividend-yield">2.4%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Asset Classes</p>
              <p className="text-lg font-bold" data-testid="text-asset-classes">{portfolioAllocation.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Wire Transfer", icon: Send, page: "wire" as Page, color: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
          { label: "External Transfer", icon: ArrowRightLeft, page: "external" as Page, color: "text-green-600 bg-green-50 dark:bg-green-950" },
          { label: "Internal Transfer", icon: ArrowLeftRight, page: "internal" as Page, color: "text-purple-600 bg-purple-50 dark:bg-purple-950" },
          { label: "Bill Pay", icon: Receipt, page: "billpay" as Page, color: "text-orange-600 bg-orange-50 dark:bg-orange-950" },
        ].map((action) => (
          <Card
            key={action.page}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate(action.page)}
            data-testid={`card-action-${action.page}`}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${action.color}`}>
                <action.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">{action.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400">Recent Transaction History</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("history")} data-testid="button-view-all-transactions" className="text-xs">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!transactions?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No transactions yet
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b last:border-0" data-testid={`dashboard-tx-${t.id}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      t.type === "credit" || t.type === "deposit"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    }`}>
                      {t.type === "credit" || t.type === "deposit" ? "+" : "-"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(t.date), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      t.type === "credit" || t.type === "deposit" ? "text-green-600" : "text-red-600"
                    }`}>
                      {t.type === "credit" || t.type === "deposit" ? "+" : "-"}{formatAmount(t.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{t.reference || ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {transfers && transfers.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400">Recent Transfers</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("transfers")} data-testid="button-view-all-transfers" className="text-xs">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {transfers.slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
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
      toast({ title: "Transfer submitted successfully", description: "Please enter your confirmation code to proceed." });
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
                  <Label>Transfer Type</Label>
                  <Select value={formData.wireType || ""} onValueChange={(val) => update("wireType", val)}>
                    <SelectTrigger data-testid="select-wire-type">
                      <SelectValue placeholder="Select wire transfer type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domestic">Domestic Wire (USA)</SelectItem>
                      <SelectItem value="international">International Wire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Beneficiary Information</p>

                <div className="space-y-2">
                  <Label>Beneficiary Name (Full Legal Name)</Label>
                  <Input value={formData.recipientName || ""} onChange={(e) => update("recipientName", e.target.value)} required placeholder="Enter full legal name of recipient" data-testid="input-recipient-name" />
                </div>
                <div className="space-y-2">
                  <Label>Beneficiary Address</Label>
                  <Input value={formData.beneficiaryAddress || ""} onChange={(e) => update("beneficiaryAddress", e.target.value)} required placeholder="Street address, city, state, zip code" data-testid="input-beneficiary-address" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Beneficiary Zip Code</Label>
                    <Input value={formData.beneficiaryZipCode || ""} onChange={async (e) => {
                      const zip = e.target.value.replace(/[^0-9-]/g, "");
                      update("beneficiaryZipCode", zip);
                      if (zip.length >= 5) {
                        try {
                          const res = await fetch(`/api/zipcode-lookup/${zip}`);
                          if (res.ok) {
                            const data = await res.json();
                            setFormData(prev => ({ ...prev, beneficiaryCity: data.city || prev.beneficiaryCity, beneficiaryState: data.state || prev.beneficiaryState }));
                          }
                        } catch {}
                      }
                    }} placeholder="Zip / Postal code" data-testid="input-beneficiary-zip" />
                  </div>
                  <div className="space-y-2">
                    <Label>Beneficiary Country</Label>
                    <Input value={formData.beneficiaryCountry || ""} onChange={(e) => update("beneficiaryCountry", e.target.value)} required placeholder="Country" data-testid="input-beneficiary-country" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Beneficiary City</Label>
                    <Input value={formData.beneficiaryCity || ""} onChange={(e) => update("beneficiaryCity", e.target.value)} required placeholder="City" data-testid="input-beneficiary-city" />
                  </div>
                  <div className="space-y-2">
                    <Label>Beneficiary State</Label>
                    <Input value={formData.beneficiaryState || ""} onChange={(e) => update("beneficiaryState", e.target.value)} placeholder="State / Province" data-testid="input-beneficiary-state" />
                  </div>
                </div>

                <Separator />
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Beneficiary Bank Details</p>

                <div className="space-y-2">
                  <Label>Beneficiary Bank Name</Label>
                  <Input value={formData.recipientBank || ""} onChange={(e) => update("recipientBank", e.target.value)} required placeholder="Name of receiving bank" data-testid="input-recipient-bank" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Number / IBAN</Label>
                    <Input value={formData.recipientAccount || ""} onChange={(e) => update("recipientAccount", e.target.value)} required placeholder="Account number or IBAN" data-testid="input-recipient-account" />
                  </div>
                  <div className="space-y-2">
                    <Label>Routing / ABA Number</Label>
                    <Input value={formData.recipientRoutingNumber || ""} onChange={(e) => update("recipientRoutingNumber", e.target.value)} required placeholder="9-digit routing number" data-testid="input-recipient-routing" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SWIFT / BIC Code</Label>
                    <Input value={formData.swiftCode || ""} onChange={(e) => update("swiftCode", e.target.value)} placeholder="e.g. CHASUS33" data-testid="input-swift-code" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Address</Label>
                    <Input value={formData.bankAddress || ""} onChange={(e) => update("bankAddress", e.target.value)} placeholder="Bank branch address" data-testid="input-bank-address" />
                  </div>
                </div>

                <Separator />
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Intermediary / Correspondent Bank (if applicable)</p>

                <div className="space-y-2">
                  <Label>Intermediary Bank Name (optional)</Label>
                  <Input value={formData.intermediaryBank || ""} onChange={(e) => update("intermediaryBank", e.target.value)} placeholder="Intermediary or correspondent bank name" data-testid="input-intermediary-bank" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Intermediary SWIFT / BIC (optional)</Label>
                    <Input value={formData.intermediarySwift || ""} onChange={(e) => update("intermediarySwift", e.target.value)} placeholder="SWIFT code" data-testid="input-intermediary-swift" />
                  </div>
                  <div className="space-y-2">
                    <Label>Intermediary Routing # (optional)</Label>
                    <Input value={formData.intermediaryRouting || ""} onChange={(e) => update("intermediaryRouting", e.target.value)} placeholder="Routing number" data-testid="input-intermediary-routing" />
                  </div>
                </div>

                <Separator />
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional Details</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Purpose of Transfer</Label>
                    <Select value={formData.purpose || ""} onValueChange={(val) => update("purpose", val)}>
                      <SelectTrigger data-testid="select-purpose">
                        <SelectValue placeholder="Select purpose" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Personal / Family Support</SelectItem>
                        <SelectItem value="business">Business Payment</SelectItem>
                        <SelectItem value="investment">Investment</SelectItem>
                        <SelectItem value="real_estate">Real Estate Purchase</SelectItem>
                        <SelectItem value="education">Education / Tuition</SelectItem>
                        <SelectItem value="medical">Medical Expenses</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference / Invoice # (optional)</Label>
                    <Input value={formData.referenceNumber || ""} onChange={(e) => update("referenceNumber", e.target.value)} placeholder="Reference or invoice number" data-testid="input-reference-number" />
                  </div>
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
  const { toast } = useToast();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const { data: transfers, isLoading } = useQuery<Transfer[]>({
    queryKey: ["/api/customer/transfers"],
    refetchInterval: 3000,
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ transferId, code }: { transferId: number; code: string }) => {
      const res = await apiRequest("POST", `/api/customer/transfers/${transferId}/confirm`, { code });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/transfers"] });
      setConfirmingId(null);
      setConfirmCode("");
      toast({ title: "Transfer confirmed", description: "Your transfer is now being processed for approval." });
    },
    onError: (error: any) => {
      toast({ title: "Confirmation failed", description: error.message, variant: "destructive" });
    },
  });

  const getTransferStatusBadge = (status: string) => {
    switch (status) {
      case "pending_confirmation":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Awaiting Confirmation</Badge>;
      case "processing":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Processing</Badge>;
      case "approved":
        return <Badge variant="default" className="capitalize">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="capitalize">Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="capitalize">{status}</Badge>;
    }
  };

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
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id} data-testid={`row-transfer-${t.id}`}>
                    <TableCell className="text-sm">{format(new Date(t.createdAt), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell className="text-sm capitalize">{t.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">{t.recipientName || t.billPayee || t.internalToAccount || "-"}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">-{formatAmount(t.amount)}</TableCell>
                    <TableCell data-testid={`badge-transfer-status-${t.id}`}>
                      {getTransferStatusBadge(t.status)}
                    </TableCell>
                    <TableCell>
                      {t.status === "pending_confirmation" ? (
                        confirmingId === t.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Enter code"
                              value={confirmCode}
                              onChange={(e) => setConfirmCode(e.target.value)}
                              className="w-32 h-8 text-sm"
                              data-testid={`input-confirm-code-${t.id}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => confirmMutation.mutate({ transferId: t.id, code: confirmCode })}
                              disabled={!confirmCode || confirmMutation.isPending}
                              data-testid={`button-submit-code-${t.id}`}
                            >
                              {confirmMutation.isPending ? "..." : "Confirm"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setConfirmingId(null); setConfirmCode(""); }}
                              data-testid={`button-cancel-confirm-${t.id}`}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-orange-700 border-orange-300 hover:bg-orange-50"
                            onClick={() => setConfirmingId(t.id)}
                            data-testid={`button-enter-code-${t.id}`}
                          >
                            Enter Code
                          </Button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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

function CardsView({ customer }: { customer: CustomerData }) {
  const cardNumber = customer.accountNumber.replace(/(.{4})/g, "$1 ").trim();
  const lastFour = customer.accountNumber.slice(-4);
  const expMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const expYear = String(new Date().getFullYear() + 4).slice(-2);

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold" data-testid="text-cards-title">My Cards</h2>

      {customer.hasDebitCard && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Debit Card</h3>
          <div
            className="relative w-full max-w-md h-56 rounded-2xl overflow-hidden shadow-2xl cursor-default select-none"
            style={{
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #1a1a2e 100%)",
            }}
            data-testid="card-debit"
          >
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `radial-gradient(circle at 70% 30%, rgba(255,255,255,0.15) 0%, transparent 50%),
                                radial-gradient(circle at 30% 80%, rgba(255,255,255,0.08) 0%, transparent 40%)`
            }} />

            <div className="relative h-full flex flex-col justify-between p-6">
              <div className="flex items-center justify-between">
                <div className="text-white font-bold text-lg tracking-wide" data-testid="text-card-bank-name">
                  CAVEN WEALTH
                </div>
                <div className="text-white/60 text-xs font-medium uppercase tracking-widest">Debit</div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-9 rounded-md overflow-hidden" style={{
                  background: "linear-gradient(135deg, #f0c040 0%, #d4a030 50%, #c09020 100%)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                }}>
                  <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-px p-1">
                    {Array.from({length: 9}).map((_, i) => (
                      <div key={i} className="rounded-sm" style={{
                        background: i % 2 === 0 ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)"
                      }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-5 h-4 rounded-sm bg-gray-400/20" />
                </div>
              </div>

              <div className="text-white text-xl md:text-2xl font-mono tracking-[0.2em] drop-shadow-md" data-testid="text-card-number">
                {cardNumber || "**** **** **** ****"}
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Card Holder</div>
                  <div className="text-white text-sm font-semibold tracking-wide" data-testid="text-card-holder">
                    {customer.firstName.toUpperCase()} {customer.lastName.toUpperCase()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Expires</div>
                  <div className="text-white text-sm font-semibold font-mono" data-testid="text-card-expiry">
                    {expMonth}/{expYear}
                  </div>
                </div>
                <div className="flex gap-1">
                  <div className="w-8 h-8 rounded-full bg-red-500 opacity-80" />
                  <div className="w-8 h-8 rounded-full bg-amber-400 opacity-80 -ml-4" />
                </div>
              </div>
            </div>
          </div>

          <Card className="max-w-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Card Number</span>
                <span className="font-mono">**** **** **** {lastFour}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Card Type</span>
                <Badge variant="outline">Debit</Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge className="bg-green-500">Active</Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Linked Account</span>
                <span className="font-mono text-xs">{customer.accountNumber}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {customer.hasCreditCard && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Credit Card</h3>
          <div
            className="relative w-full max-w-md h-56 rounded-2xl overflow-hidden shadow-2xl cursor-default select-none"
            style={{
              background: "linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 50%, #2d2d2d 100%)",
            }}
            data-testid="card-credit"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <CreditCard className="w-16 h-16 text-white/20 mx-auto mb-3" />
                <p className="text-white/70 text-lg font-bold tracking-wider">COMING SOON</p>
                <p className="text-white/40 text-xs mt-1">Your credit card is being prepared</p>
              </div>
            </div>
            <div className="absolute top-6 left-6 text-white/30 font-bold text-lg tracking-wide">
              CAVEN WEALTH
            </div>
            <div className="absolute bottom-6 right-6 flex gap-1">
              <div className="w-8 h-8 rounded-full bg-white/10" />
              <div className="w-8 h-8 rounded-full bg-white/10 -ml-4" />
            </div>
          </div>
        </div>
      )}

      {!customer.hasDebitCard && !customer.hasCreditCard && (
        <Card>
          <CardContent className="p-12 text-center">
            <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No Cards Issued</p>
            <p className="text-sm text-muted-foreground mt-1">
              Contact your account manager to request a debit or credit card.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ChatMessage {
  id: number;
  customerId: number;
  senderType: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function FloatingChatButton({ currentPage, onNavigate }: { currentPage: Page; onNavigate: (p: Page) => void }) {
  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/customer/chat/unread"],
    refetchInterval: 3000,
  });

  const hasUnread = (unreadData?.unreadCount ?? 0) > 0;

  if (currentPage === "support") return null;

  return (
    <button
      onClick={() => onNavigate("support")}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg z-50 transition-transform hover:scale-105"
      data-testid="button-floating-chat"
    >
      <MessageSquare className="w-6 h-6" />
      {hasUnread && (
        <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" data-testid="indicator-unread-chat" />
      )}
    </button>
  );
}

function SupportView() {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/customer/chat"],
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => apiRequest("POST", "/api/customer/chat", { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/chat"] });
      setNewMessage("");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" data-testid="text-support-title">
          <MessageSquare className="w-5 h-5" />
          Customer Support
        </h2>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-support-email">
          Email us: support@cavenwealthfinancial.com
        </p>
      </div>

      <Card className="flex flex-col" style={{ height: "calc(100vh - 260px)" }}>
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="container-chat-messages">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">Loading messages...</div>
            ) : !messages?.length ? (
              <div className="text-center text-muted-foreground py-8">
                No messages yet. Start a conversation with our support team.
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === "customer" ? "justify-end" : "justify-start"}`}
                  data-testid={`chat-message-${msg.id}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
                      msg.senderType === "customer"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-foreground"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${msg.senderType === "customer" ? "text-blue-200" : "text-muted-foreground"}`}>
                      {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-3">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={sendMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button type="submit" size="icon" disabled={sendMutation.isPending || !newMessage.trim()} data-testid="button-send-chat">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
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
          <InfoRow label="Member Since" value={customer.memberSince ? format(new Date(customer.memberSince), "MMMM d, yyyy") : (customer.createdAt ? format(new Date(customer.createdAt), "MMMM d, yyyy") : null)} />
        </CardContent>
      </Card>
    </div>
  );
}
