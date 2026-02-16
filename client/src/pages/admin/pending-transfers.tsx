import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

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

interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  accountNumber: string;
  balance: string;
}

const formatAmount = (amount: string) => {
  const num = parseFloat(amount);
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function AdminPendingTransfers() {
  const { toast } = useToast();

  const { data: transfers, isLoading: transfersLoading } = useQuery<Transfer[]>({
    queryKey: ["/api/transfers"],
    refetchInterval: 3000,
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/transfers/${id}/status`, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: `Transfer ${variables.status}`,
        description: `Transfer has been ${variables.status} successfully.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    },
  });

  const getCustomerName = (customerId: number) => {
    const customer = customers?.find((c) => c.id === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : `Customer #${customerId}`;
  };

  const getRecipientInfo = (transfer: Transfer) => {
    if (transfer.recipientName) return transfer.recipientName;
    if (transfer.billPayee) return transfer.billPayee;
    if (transfer.internalToAccount) return `Account: ${transfer.internalToAccount}`;
    return "—";
  };

  const pendingTransfers = transfers?.filter(t => t.status === "pending") || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-page-title">Transfer Management</h2>
        <p className="text-muted-foreground text-sm mt-1">Review and manage customer transfer requests</p>
      </div>

      {pendingTransfers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Pending Transfers ({pendingTransfers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTransfers.map((t) => (
                  <TableRow key={t.id} data-testid={`row-pending-transfer-${t.id}`}>
                    <TableCell className="text-sm">{format(new Date(t.createdAt), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell className="text-sm font-medium">{getCustomerName(t.customerId)}</TableCell>
                    <TableCell className="text-sm capitalize">{t.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">{getRecipientInfo(t)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatAmount(t.amount)}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{t.description || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => statusMutation.mutate({ id: t.id, status: "approved" })}
                          disabled={statusMutation.isPending}
                          data-testid={`button-approve-${t.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => statusMutation.mutate({ id: t.id, status: "rejected" })}
                          disabled={statusMutation.isPending}
                          data-testid={`button-reject-${t.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Transfers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transfersLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !transfers?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transfers yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id} data-testid={`row-transfer-${t.id}`}>
                    <TableCell className="text-sm">{format(new Date(t.createdAt), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell className="text-sm font-medium">{getCustomerName(t.customerId)}</TableCell>
                    <TableCell className="text-sm capitalize">{t.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">{getRecipientInfo(t)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatAmount(t.amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={t.status === "approved" ? "default" : t.status === "rejected" ? "destructive" : "secondary"}
                        className="capitalize"
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.status === "pending" ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => statusMutation.mutate({ id: t.id, status: "approved" })}
                            disabled={statusMutation.isPending}
                            data-testid={`button-approve-all-${t.id}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => statusMutation.mutate({ id: t.id, status: "rejected" })}
                            disabled={statusMutation.isPending}
                            data-testid={`button-reject-all-${t.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground text-center block">Processed</span>
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
