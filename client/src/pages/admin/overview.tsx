import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Users,
  ArrowLeftRight,
  Lock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldBan,
  History,
  MessageSquare,
  Activity,
  Plus,
  Loader2,
  UserPlus,
  CheckCircle2,
} from "lucide-react";
import type { Customer, Transaction, AccessCode } from "@shared/schema";

const marketData = [
  { pair: "USD/EUR", price: "1.0847", change: "+0.12%", positive: true },
  { pair: "USD/GBP", price: "0.7891", change: "-0.05%", positive: false },
  { pair: "USD/JPY", price: "149.52", change: "+0.23%", positive: true },
  { pair: "BTC/USD", price: "$67,432.18", change: "+2.15%", positive: true },
  { pair: "ETH/USD", price: "$3,521.47", change: "+1.87%", positive: true },
  { pair: "Gold/oz", price: "$2,342.50", change: "-0.31%", positive: false },
];

const quickActions = [
  {
    title: "Fund Customer",
    description: "Allocate funds to customer accounts",
    icon: DollarSign,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/50",
  },
  {
    title: "Block/Unblock User",
    description: "Manage user account access",
    icon: ShieldBan,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/50",
  },
  {
    title: "Create History",
    description: "Generate transaction records",
    icon: History,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/50",
  },
  {
    title: "Live Chat",
    description: "Customer support messaging",
    icon: MessageSquare,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/50",
  },
];

interface CreateUserFormData {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  gender: string;
  accessCode: string;
}

const emptyCreateUserForm: CreateUserFormData = {
  firstName: "",
  lastName: "",
  username: "",
  password: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  gender: "",
  accessCode: "",
};

export default function AdminOverview() {
  const { toast } = useToast();
  const [topupDialogOpen, setTopupDialogOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState<CreateUserFormData>(emptyCreateUserForm);
  const [createdUserResult, setCreatedUserResult] = useState<any>(null);

  const { data: customers, isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: accessCodes, isLoading: codesLoading } = useQuery<AccessCode[]>({
    queryKey: ["/api/access-codes"],
  });

  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ balance: string }>({
    queryKey: ["/api/admin/balance"],
    refetchInterval: 5000,
  });

  const topupMutation = useMutation({
    mutationFn: async (amount: string) => {
      const res = await apiRequest("POST", "/api/admin/topup", { amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/balance"] });
      toast({ title: "Balance topped up successfully" });
      setTopupDialogOpen(false);
      setTopupAmount("");
    },
    onError: (error: any) => {
      toast({ title: "Top up failed", description: error.message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      const res = await apiRequest("POST", "/api/admin/create-full-user", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/access-codes"] });
      setCreatedUserResult(data);
      toast({ title: "User created successfully with full account history" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create user", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUserForm.firstName || !createUserForm.lastName || !createUserForm.username || !createUserForm.password || !createUserForm.address || !createUserForm.city || !createUserForm.state || !createUserForm.zipCode || !createUserForm.gender || !createUserForm.accessCode) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    createUserMutation.mutate(createUserForm);
  };

  const isLoading = customersLoading || transactionsLoading || codesLoading;

  const totalRevenue = transactions?.reduce((sum, t) => {
    if (t.type === "credit" || t.type === "deposit") {
      return sum + parseFloat(t.amount);
    }
    return sum;
  }, 0) ?? 0;

  const recentTransactions = transactions?.slice(0, 10) ?? [];

  const adminBalance = balanceData ? (parseFloat(balanceData.balance) || 0) : 0;

  const stats = [
    {
      title: "Total Customers",
      value: customers?.length ?? 0,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/50",
    },
    {
      title: "Total Transactions",
      value: transactions?.length ?? 0,
      icon: ArrowLeftRight,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-100 dark:bg-purple-900/50",
    },
    {
      title: "Active Access Codes",
      value: accessCodes?.length ?? 0,
      icon: Lock,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/50",
    },
    {
      title: "Revenue",
      value: `$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/50",
    },
  ];

  const handleTopup = () => {
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    topupMutation.mutate(topupAmount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-page-title">Dashboard Overview</h2>
          <p className="text-muted-foreground text-sm mt-1">Welcome to the admin dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setCreateUserForm(emptyCreateUserForm);
              setCreatedUserResult(null);
              setCreateUserDialogOpen(true);
            }}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0 shadow-md"
            data-testid="button-create-full-user"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Create User
          </Button>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-sm text-muted-foreground" data-testid="text-system-status">System Online</span>
          </div>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-[#0f1a3e] to-[#1a2a5e] text-white border-0 shadow-xl">
        <CardContent className="py-8 px-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white/60 text-sm font-medium uppercase tracking-wider mb-2">Admin Account Balance</p>
              {balanceLoading ? (
                <Skeleton className="h-12 w-64 bg-white/10" />
              ) : (
                <p className="text-4xl sm:text-5xl font-bold tracking-tight" data-testid="text-admin-balance" style={{ fontVariantNumeric: "tabular-nums" }}>
                  ${adminBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-white/40 text-xs mt-2">Available for customer fund allocation</p>
            </div>
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              onClick={() => { setTopupAmount(""); setTopupDialogOpen(true); }}
              data-testid="button-topup-balance"
            >
              <Plus className="w-4 h-4 mr-2" />
              Top Up Balance
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-3" data-testid="text-market-heading">Market Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {marketData.map((item) => (
            <Card key={item.pair} data-testid={`card-market-${item.pair.toLowerCase().replace(/\//g, "-")}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium mb-1">{item.pair}</p>
                <p className="text-sm font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{item.price}</p>
                <div className="flex items-center gap-1 mt-1">
                  {item.positive ? (
                    <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      item.positive
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {item.change}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`w-8 h-8 rounded-md ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold" data-testid={`text-stat-${stat.title.toLowerCase().replace(/\s+/g, "-")}`}>
                  {stat.value}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3" data-testid="text-quick-actions-heading">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer hover-elevate active-elevate-2 transition-colors"
              data-testid={`card-action-${action.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                <div className={`w-12 h-12 rounded-md ${action.bg} flex items-center justify-center`}>
                  <action.icon className={`w-6 h-6 ${action.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No transactions yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map((tx) => (
                  <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                    <TableCell className="text-sm">
                      {new Date(tx.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{tx.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">${parseFloat(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={topupDialogOpen} onOpenChange={setTopupDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-topup-balance">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Top Up Admin Balance
            </DialogTitle>
            <DialogDescription>
              Add funds to the admin account balance for customer allocation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter amount to add"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                data-testid="input-topup-amount"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Current balance: <span className="font-semibold">${adminBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTopupDialogOpen(false)} data-testid="button-cancel-topup">
              Cancel
            </Button>
            <Button
              onClick={handleTopup}
              disabled={!topupAmount || parseFloat(topupAmount) <= 0 || topupMutation.isPending}
              data-testid="button-confirm-topup"
            >
              {topupMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Add Funds
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createUserDialogOpen} onOpenChange={(open) => {
        setCreateUserDialogOpen(open);
        if (!open) {
          setCreateUserForm(emptyCreateUserForm);
          setCreatedUserResult(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-full-user">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              {createdUserResult ? "User Created Successfully" : "Create User with Full History"}
            </DialogTitle>
            <DialogDescription>
              {createdUserResult
                ? "The new user account has been set up with complete transaction history, transfers, and access code."
                : "Create a new customer account pre-loaded with $18,276,999.30 balance, 22 oil & gas equipment transactions, 19 transfers, and a login access code."
              }
            </DialogDescription>
          </DialogHeader>

          {createdUserResult ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  Account Created
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{createdUserResult.customer?.firstName} {createdUserResult.customer?.lastName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Username</p>
                    <p className="font-medium">{createdUserResult.customer?.username}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Account Number</p>
                    <p className="font-medium font-mono">{createdUserResult.customer?.accountNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Access Code</p>
                    <p className="font-medium font-mono">{createdUserResult.accessCode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Balance</p>
                    <p className="font-medium">${parseFloat(createdUserResult.customer?.balance || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gender</p>
                    <p className="font-medium capitalize">{createdUserResult.customer?.gender}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30">
                    {createdUserResult.transactionsCreated} Transactions
                  </Badge>
                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30">
                    {createdUserResult.transfersCreated} Transfers
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30">
                    Access Code Active
                  </Badge>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setCreateUserDialogOpen(false);
                    setCreatedUserResult(null);
                    setCreateUserForm(emptyCreateUserForm);
                  }}
                  data-testid="button-close-create-user-success"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Personal Information</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cu-firstName">First Name</Label>
                      <Input
                        id="cu-firstName"
                        value={createUserForm.firstName}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, firstName: e.target.value })}
                        required
                        placeholder="e.g. John"
                        data-testid="input-cu-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cu-lastName">Last Name</Label>
                      <Input
                        id="cu-lastName"
                        value={createUserForm.lastName}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, lastName: e.target.value })}
                        required
                        placeholder="e.g. Smith"
                        data-testid="input-cu-last-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={createUserForm.gender}
                      onValueChange={(value) => setCreateUserForm({ ...createUserForm, gender: value })}
                    >
                      <SelectTrigger data-testid="select-cu-gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Login Credentials</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cu-username">Username</Label>
                      <Input
                        id="cu-username"
                        value={createUserForm.username}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, username: e.target.value })}
                        required
                        placeholder="e.g. JohnSmith01"
                        data-testid="input-cu-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cu-password">Password</Label>
                      <Input
                        id="cu-password"
                        type="password"
                        value={createUserForm.password}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                        required
                        placeholder="Enter password"
                        data-testid="input-cu-password"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cu-accessCode">Access Code (6-digit login code)</Label>
                    <Input
                      id="cu-accessCode"
                      value={createUserForm.accessCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                        setCreateUserForm({ ...createUserForm, accessCode: val });
                      }}
                      required
                      maxLength={6}
                      placeholder="e.g. 123456"
                      data-testid="input-cu-access-code"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Address</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cu-address">Street Address</Label>
                    <Input
                      id="cu-address"
                      value={createUserForm.address}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, address: e.target.value })}
                      required
                      placeholder="e.g. 123 Main Street"
                      data-testid="input-cu-address"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cu-city">City</Label>
                      <Input
                        id="cu-city"
                        value={createUserForm.city}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, city: e.target.value })}
                        required
                        placeholder="e.g. Houston"
                        data-testid="input-cu-city"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cu-state">State</Label>
                      <Input
                        id="cu-state"
                        value={createUserForm.state}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, state: e.target.value })}
                        required
                        placeholder="e.g. TX"
                        data-testid="input-cu-state"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cu-zipCode">Zip Code</Label>
                      <Input
                        id="cu-zipCode"
                        value={createUserForm.zipCode}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, zipCode: e.target.value })}
                        required
                        placeholder="e.g. 77001"
                        data-testid="input-cu-zip-code"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This will create a Business account with a balance of <span className="font-semibold">$18,276,999.30</span>, 22 oil & gas equipment transactions, 19 wire/external transfers, and the specified access code. The user will appear immediately in the Customers list.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateUserDialogOpen(false);
                    setCreateUserForm(emptyCreateUserForm);
                  }}
                  data-testid="button-cancel-create-user"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0"
                  data-testid="button-submit-create-user"
                >
                  {createUserMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
