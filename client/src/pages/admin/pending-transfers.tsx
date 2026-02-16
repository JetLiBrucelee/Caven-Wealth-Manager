import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function AdminPendingTransfers() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-page-title">Pending Transfers</h2>
        <p className="text-muted-foreground text-sm mt-1">View and manage pending transfers</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground" data-testid="text-empty-message">
            No pending transfers at this time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
