import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type AuditLog = {
  id: number;
  adminId: number | null;
  actorType: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export default function AdminAuditLogs() {
  const { data, isLoading, error } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    refetchInterval: 10000,
  });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <p className="text-sm text-muted-foreground mt-1">The latest 200 administrative and scheduled ledger events. Records are read-only.</p>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        {isLoading ? <p className="p-6">Loading audit records…</p> : error ? <p className="p-6 text-destructive">Unable to load audit records.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
            <TableBody>
              {!data?.length && <TableRow><TableCell colSpan={5} className="text-center p-8">No audit events yet.</TableCell></TableRow>}
              {data?.map((entry) => <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{entry.actorType === "system" ? "System" : `Admin #${entry.adminId}`}</Badge></TableCell>
                <TableCell>{entry.action.replace(/_/g, " ")}</TableCell>
                <TableCell className="whitespace-nowrap">{entry.entityType} #{entry.entityId ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono max-w-xl break-words whitespace-normal">{JSON.stringify(entry.details)}</TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}
