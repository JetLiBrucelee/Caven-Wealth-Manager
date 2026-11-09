import { type ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Clock,
  ArrowRightLeft,
  Plus,
  Lock,
  LogOut,
  Shield,
  MessageSquare,
} from "lucide-react";

const menuItems = [
  { label: "Overview", icon: LayoutDashboard, href: "/admin/dashboard" },
  { label: "Customers", icon: Users, href: "/admin/customers" },
  { label: "Transactions", icon: ArrowLeftRight, href: "/admin/transactions" },
  { label: "Pending Transfers", icon: Clock, href: "/admin/pending-transfers" },
  { label: "External Transfers", icon: ArrowRightLeft, href: "/admin/external-transfers" },
  { label: "Account Applications", icon: Plus, href: "/admin/account-applications" },
  { label: "Access Codes", icon: Lock, href: "/admin/access-codes" },
  { label: "Live Chat", icon: MessageSquare, href: "/admin/chat" },
  { label: "Audit Log", icon: Shield, href: "/admin/audit-logs" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: admin, isLoading, error } = useQuery({
    queryKey: ["/api/admin/me"], retry: false, staleTime: 0, refetchOnMount: "always",
  });
  useEffect(() => {
    if (error) setLocation("/admin/login");
  }, [error, setLocation]);

  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/admin/logout");
      queryClient.clear();
      toast({ title: "Logged out successfully" });
      setLocation("/admin/login");
    } catch (error: any) {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  if (isLoading || error || !admin) return <div className="p-6">Checking admin access…</div>;

  return (
    <div className="flex h-screen bg-muted/30">
      <aside className="w-64 bg-white dark:bg-slate-900 border-r flex flex-col shrink-0">
        <div className="p-6 border-b">
          <div className="flex items-center justify-center" data-testid="text-sidebar-brand">
            <img src="/logo-finance.svg" alt="Caven Wealth & Finance" className="h-auto max-h-28 max-w-full object-contain drop-shadow-md" />
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-slate-700 dark:text-slate-300 hover-elevate"
                  }`}
                  data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white dark:bg-slate-900 border-b flex items-center justify-between gap-4 px-6 shrink-0 sticky top-0 z-50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span data-testid="text-admin-label">Admin Panel</span>
            <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-800">Internal ledger</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
