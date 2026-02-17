import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Key, Copy, Loader2, RotateCw } from "lucide-react";

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
  declineReason: string | null;
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
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeCustomerId, setCodeCustomerId] = useState<number | null>(null);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineTransferId, setDeclineTransferId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const { data: transfers, isLoading: transfersLoading } = useQuery<Transfer[]>({
    queryKey: ["/api/transfers"],
    refetchInterval: 3000,
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, declineReason }: { id: number; status: string; declineReason?: string }) =>
      apiRequest("PATCH", `/api/transfers/${id}/status`, { status, declineReason }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      const label = variables.status === "approved" ? "approved" : variables.status === "declined" ? "declined" : "set to processing";
      toast({
        title: `Transfer ${label}`,
        description: `Transfer has been ${label} successfully.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    },
  });

  const generateCodeMutation = useMutation({
    mutationFn: async ({ customerId, transferId }: { customerId: number; transferId?: number }) => {
      const res = await apiRequest("POST", "/api/admin/transfer-codes/generate", { customerId, transferId });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      setCodeDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfer-codes"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to generate code", description: error.message, variant: "destructive" });
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

  const pendingConfirmation = transfers?.filter(t => t.status === "pending_confirmation") || [];
  const processingTransfers = transfers?.filter(t => t.status === "processing") || [];
  const actionableTransfers = [...pendingConfirmation, ...processingTransfers];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Code copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_confirmation":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Awaiting OTP</Badge>;
      case "processing":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Processing</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Approved</Badge>;
      case "declined":
        return <Badge variant="destructive" className="capitalize">Declined</Badge>;
      default:
        return <Badge variant="secondary" className="capitalize">{status}</Badge>;
    }
  };

  const handleDeclineClick = (transferId: number) => {
    setDeclineTransferId(transferId);
    setDeclineReason("");
    setDeclineDialogOpen(true);
  };

  const handleDeclineConfirm = () => {
    if (!declineTransferId || !declineReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for declining the transfer.", variant: "destructive" });
      return;
    }
    statusMutation.mutate(
      { id: declineTransferId, status: "declined", declineReason: declineReason.trim() },
      {
        onSuccess: () => {
          setDeclineDialogOpen(false);
          setDeclineTransferId(null);
          setDeclineReason("");
        },
      }
    );
  };

  const renderActionButtons = (t: Transfer) => {
    if (t.status === "approved" || t.status === "declined") {
      return <span className="text-xs text-muted-foreground text-center block">Processed</span>;
    }

    return (
      <div className="flex items-center justify-center gap-1">
        {t.status === "pending_confirmation" && (
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => {
              setCodeCustomerId(t.customerId);
              generateCodeMutation.mutate({ customerId: t.customerId, transferId: t.id });
            }}
            disabled={generateCodeMutation.isPending}
            data-testid={`button-generate-code-${t.id}`}
          >
            {generateCodeMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Key className="w-4 h-4 mr-1" />}
            Generate OTP
          </Button>
        )}
        {t.status === "processing" && (
          <>
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
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => statusMutation.mutate({ id: t.id, status: "processing" })}
              disabled={statusMutation.isPending}
              data-testid={`button-processing-${t.id}`}
            >
              <RotateCw className="w-4 h-4 mr-1" />
              Processing
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleDeclineClick(t.id)}
          disabled={statusMutation.isPending}
          data-testid={`button-decline-${t.id}`}
        >
          <XCircle className="w-4 h-4 mr-1" />
          Decline
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-page-title">Transfer Management</h2>
        <p className="text-muted-foreground text-sm mt-1">Review and manage customer transfer requests</p>
      </div>

      {actionableTransfers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Pending Transfers ({actionableTransfers.length})
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionableTransfers.map((t) => (
                  <TableRow key={t.id} data-testid={`row-pending-transfer-${t.id}`}>
                    <TableCell className="text-sm">{format(new Date(t.createdAt), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell className="text-sm font-medium">{getCustomerName(t.customerId)}</TableCell>
                    <TableCell className="text-sm capitalize">{t.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">{getRecipientInfo(t)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatAmount(t.amount)}</TableCell>
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell>{renderActionButtons(t)}</TableCell>
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
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell>{renderActionButtons(t)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-transfer-code">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-orange-600" />
              Transfer Confirmation Code
            </DialogTitle>
            <DialogDescription>
              Share this code with the customer to confirm their transfer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {generatedCode && (
              <div className="flex items-center justify-center gap-3 p-6 bg-muted/50 rounded-lg border">
                <span className="text-3xl font-mono font-bold tracking-[0.3em]" data-testid="text-generated-code">{generatedCode}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(generatedCode)}
                  data-testid="button-copy-code"
                >
                  <Copy className="w-5 h-5" />
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Customer: <span className="font-medium">{codeCustomerId ? getCustomerName(codeCustomerId) : ""}</span>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              This code expires in 30 minutes and can only be used once.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-decline-reason">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Decline Transfer
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for declining this transfer. This reason will be visible to the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter the reason for declining this transfer..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={4}
              data-testid="input-decline-reason"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeclineDialogOpen(false)}
              data-testid="button-cancel-decline"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeclineConfirm}
              disabled={!declineReason.trim() || statusMutation.isPending}
              data-testid="button-confirm-decline"
            >
              {statusMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
              Decline Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
