import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, ArrowLeftRight, Lock, DollarSign } from "lucide-react";
import type { Customer, Transaction, AccessCode } from "@shared/schema";

export default function AdminOverview() {
  const { data: customers, isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: accessCodes, isLoading: codesLoading } = useQuery<AccessCode[]>({
    queryKey: ["/api/access-codes"],
  });

  const isLoading = customersLoading || transactionsLoading || codesLoading;

  const totalRevenue = transactions?.reduce((sum, t) => {
    if (t.type === "credit" || t.type === "deposit") {
      return sum + parseFloat(t.amount);
    }
    return sum;
  }, 0) ?? 0;

  const recentTransactions = transactions?.slice(0, 10) ?? [];

  const adminBalance = 500000000000;

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-page-title">Dashboard Overview</h2>
        <p className="text-muted-foreground text-sm mt-1">Welcome to the admin dashboard</p>
      </div>

      <Card className="bg-gradient-to-r from-[#0f1a3e] to-[#1a2a5e] text-white border-0 shadow-xl">
        <CardContent className="py-8 px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm font-medium uppercase tracking-wider mb-2">Admin Account Balance</p>
              <p className="text-4xl sm:text-5xl font-bold tracking-tight" data-testid="text-admin-balance" style={{ fontVariantNumeric: "tabular-nums" }}>
                ${adminBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-white/40 text-xs mt-2">Available for customer fund allocation</p>
            </div>
            <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-white/10 items-center justify-center shrink-0">
              <DollarSign className="w-8 h-8 text-white/80" />
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
