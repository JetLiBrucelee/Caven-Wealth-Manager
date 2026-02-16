import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, RefreshCw, UserPlus } from "lucide-react";
import type { AccessCode, Customer } from "@shared/schema";

export default function AdminAccessCodes() {
  const { toast } = useToast();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningCode, setAssigningCode] = useState<AccessCode | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const { data: accessCodes, isLoading } = useQuery<AccessCode[]>({
    queryKey: ["/api/access-codes"],
    refetchInterval: 10000,
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/access-codes/generate", { count: 30 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-codes"] });
      toast({ title: "New access codes generated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to generate codes", description: error.message, variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (data: { id: number; customerId: number }) =>
      apiRequest("POST", `/api/access-codes/${data.id}/assign`, { customerId: data.customerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-codes"] });
      toast({ title: "Code assigned to customer" });
      setAssignDialogOpen(false);
      setAssigningCode(null);
      setSelectedCustomerId("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign code", description: error.message, variant: "destructive" });
    },
  });

  function handleAssign() {
    if (assigningCode && selectedCustomerId) {
      assignMutation.mutate({ id: assigningCode.id, customerId: parseInt(selectedCustomerId) });
    }
  }

  const activeCount = accessCodes?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
        <h2 className="text-3xl font-bold" data-testid="text-page-title">Access Codes</h2>
        <p className="mt-2 text-indigo-100">
          Auto-generated codes for user authentication - Refreshes every 10 seconds
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold" data-testid="text-active-count">
              Active Access Codes ({activeCount})
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            These codes can be used by users to login. Codes expire after 10 minutes.
          </p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-codes"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${generateMutation.isPending ? "animate-spin" : ""}`} />
          Generate New Codes
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !accessCodes?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No active access codes</p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-codes-empty"
            >
              Generate Codes
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {accessCodes.map((code) => (
            <Card key={code.id} data-testid={`card-code-${code.id}`}>
              <CardContent className="p-4 text-center space-y-3">
                <p className="text-2xl font-mono font-bold text-green-600 dark:text-green-400 tracking-widest" data-testid={`text-code-${code.id}`}>
                  {code.code}
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Active</span>
                </div>
                {code.customerId ? (
                  <Badge variant="secondary" className="text-xs">
                    Assigned
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAssigningCode(code);
                      setSelectedCustomerId("");
                      setAssignDialogOpen(true);
                    }}
                    data-testid={`button-assign-${code.id}`}
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    Assign
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Code to Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Assigning code</p>
              <p className="text-2xl font-mono font-bold text-green-600 dark:text-green-400 tracking-widest mt-1">
                {assigningCode?.code}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Select Customer</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger data-testid="select-assign-customer">
                  <SelectValue placeholder="Choose a customer" />
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
            <Button
              className="w-full"
              onClick={handleAssign}
              disabled={!selectedCustomerId || assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
