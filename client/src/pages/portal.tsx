import { useState } from "react";
import { format } from "date-fns";
import { Shield, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  accountNumber: string;
  accountType: string;
  balance: string;
  status: string;
}

interface Transaction {
  id: number;
  customerId: number;
  type: string;
  amount: string;
  description: string;
  date: string;
  status: string;
  reference?: string;
  beneficiary?: string;
  beneficiaryBank?: string;
  beneficiaryAccount?: string;
}

interface PortalData {
  customer: Customer;
  transactions: Transaction[];
}

const formatAmount = (amount: string) => {
  const num = parseFloat(amount);
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getTransactionColor = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("credit") || lowerType.includes("deposit")) {
    return "text-green-600";
  }
  return "text-red-600";
};

const getStatusBadgeVariant = (status: string) => {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === "completed" || lowerStatus === "active") {
    return "default";
  }
  if (lowerStatus === "pending") {
    return "secondary";
  }
  return "outline";
};

export default function Portal() {
  const [portalState, setPortalState] = useState<"code_entry" | "authenticated">(
    "code_entry"
  );
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length !== 6) {
      toast({
        description: "Please enter a valid 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/access-codes/verify", { code });
      const data = await response.json();

      if (data.customer && data.transactions) {
        setPortalData(data);
        setPortalState("authenticated");
      } else {
        toast({
          description: "Invalid or expired access code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        description: "Invalid or expired access code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    setPortalState("code_entry");
    setCode("");
    setPortalData(null);
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowModal(true);
  };

  if (portalState === "code_entry") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4 pb-8">
            <div className="flex justify-center">
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              Caven Financial Wealth
            </CardTitle>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Customer Portal
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enter your 6-digit access code to view your account
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                  data-testid="input-access-code"
                  className="text-center text-2xl font-bold tracking-widest h-12"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                data-testid="button-submit-code"
              >
                {loading ? "Verifying..." : "Access Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!portalData) return null;

  const { customer, transactions } = portalData;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handleBackClick}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Caven Financial Wealth
            </h1>
            <p className="text-slate-600 dark:text-slate-400">Customer Portal</p>
          </div>
        </div>

        {/* Customer Info Card */}
        <Card data-testid="card-customer-info">
          <CardHeader>
            <CardTitle className="text-xl">Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Name
                </p>
                <p
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                  data-testid="text-customer-name"
                >
                  {customer.firstName} {customer.lastName}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Account Number
                </p>
                <p
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-mono"
                  data-testid="text-account-number"
                >
                  {customer.accountNumber}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Account Type
                </p>
                <p
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100 capitalize"
                  data-testid="text-account-type"
                >
                  {customer.accountType}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Balance
                </p>
                <p
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                  data-testid="text-balance"
                >
                  {formatAmount(customer.balance)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </p>
                <Badge
                  variant={getStatusBadgeVariant(customer.status)}
                  className="capitalize w-fit"
                  data-testid={`badge-status-${customer.status}`}
                >
                  {customer.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card data-testid="card-transactions">
          <CardHeader>
            <CardTitle className="text-xl">
              Transaction History ({transactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-date">Date</TableHead>
                    <TableHead data-testid="header-type">Type</TableHead>
                    <TableHead className="text-right" data-testid="header-amount">
                      Amount
                    </TableHead>
                    <TableHead data-testid="header-description">
                      Description
                    </TableHead>
                    <TableHead data-testid="header-status">Status</TableHead>
                    <TableHead data-testid="header-reference">Reference</TableHead>
                    <TableHead className="text-center" data-testid="header-action">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-slate-600 dark:text-slate-400">
                          No transactions found
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id} className="cursor-pointer">
                        <TableCell
                          data-testid={`cell-date-${transaction.id}`}
                          className="text-slate-900 dark:text-slate-100"
                        >
                          {format(new Date(transaction.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell
                          data-testid={`cell-type-${transaction.id}`}
                          className="text-slate-900 dark:text-slate-100 capitalize"
                        >
                          {transaction.type}
                        </TableCell>
                        <TableCell
                          data-testid={`cell-amount-${transaction.id}`}
                          className={`text-right font-semibold ${getTransactionColor(
                            transaction.type
                          )}`}
                        >
                          {formatAmount(transaction.amount)}
                        </TableCell>
                        <TableCell
                          data-testid={`cell-description-${transaction.id}`}
                          className="text-slate-900 dark:text-slate-100 max-w-xs truncate"
                        >
                          {transaction.description}
                        </TableCell>
                        <TableCell
                          data-testid={`cell-status-${transaction.id}`}
                        >
                          <Badge
                            variant={getStatusBadgeVariant(transaction.status)}
                            className="capitalize"
                          >
                            {transaction.status}
                          </Badge>
                        </TableCell>
                        <TableCell
                          data-testid={`cell-reference-${transaction.id}`}
                          className="text-slate-600 dark:text-slate-400 font-mono text-sm"
                        >
                          {transaction.reference || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTransactionClick(transaction)}
                            data-testid={`button-view-transaction-${transaction.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Detail Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          {selectedTransaction && (
            <>
              <DialogHeader>
                <DialogTitle>Transaction Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Receipt-style layout */}
                <div className="border-b pb-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Transaction ID
                      </p>
                      <p
                        className="text-sm font-mono text-slate-900 dark:text-slate-100"
                        data-testid="modal-transaction-id"
                      >
                        {selectedTransaction.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Date
                      </p>
                      <p
                        className="text-sm text-slate-900 dark:text-slate-100"
                        data-testid="modal-date"
                      >
                        {format(new Date(selectedTransaction.date), "MMMM dd, yyyy h:mm a")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Transaction Amount */}
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Amount
                  </p>
                  <p
                    className={`text-3xl font-bold ${getTransactionColor(
                      selectedTransaction.type
                    )}`}
                    data-testid="modal-amount"
                  >
                    {formatAmount(selectedTransaction.amount)}
                  </p>
                </div>

                {/* Transaction Details Grid */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Type
                      </p>
                      <p
                        className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize"
                        data-testid="modal-type"
                      >
                        {selectedTransaction.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Status
                      </p>
                      <Badge
                        variant={getStatusBadgeVariant(selectedTransaction.status)}
                        className="capitalize"
                        data-testid="modal-status"
                      >
                        {selectedTransaction.status}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Description
                    </p>
                    <p
                      className="text-sm text-slate-900 dark:text-slate-100"
                      data-testid="modal-description"
                    >
                      {selectedTransaction.description}
                    </p>
                  </div>

                  {selectedTransaction.reference && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Reference
                      </p>
                      <p
                        className="text-sm font-mono text-slate-900 dark:text-slate-100"
                        data-testid="modal-reference"
                      >
                        {selectedTransaction.reference}
                      </p>
                    </div>
                  )}
                </div>

                {/* Beneficiary Information */}
                {(selectedTransaction.beneficiary ||
                  selectedTransaction.beneficiaryBank ||
                  selectedTransaction.beneficiaryAccount) && (
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Beneficiary Information
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {selectedTransaction.beneficiary && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            Name
                          </p>
                          <p
                            className="text-sm text-slate-900 dark:text-slate-100"
                            data-testid="modal-beneficiary"
                          >
                            {selectedTransaction.beneficiary}
                          </p>
                        </div>
                      )}
                      {selectedTransaction.beneficiaryBank && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            Bank
                          </p>
                          <p
                            className="text-sm text-slate-900 dark:text-slate-100"
                            data-testid="modal-beneficiary-bank"
                          >
                            {selectedTransaction.beneficiaryBank}
                          </p>
                        </div>
                      )}
                      {selectedTransaction.beneficiaryAccount && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            Account Number
                          </p>
                          <p
                            className="text-sm font-mono text-slate-900 dark:text-slate-100"
                            data-testid="modal-beneficiary-account"
                          >
                            {selectedTransaction.beneficiaryAccount}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
