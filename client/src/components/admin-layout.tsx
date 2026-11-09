import { type ReactNode, useEffect, useRef, useState } from "react";
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
  Settings2,
  Menu,
  X,
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
  { label: "Security", icon: Settings2, href: "/admin/security" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const wasMobileNavOpen = useRef(false);
  const { toast } = useToast();
  const { data: admin, isLoading, error } = useQuery({
    queryKey: ["/api/admin/me"], retry: false, staleTime: 0, refetchOnMount: "always",
  });
  useEffect(() => {
    if (error) setLocation("/admin/login");
  }, [error, setLocation]);

  useEffect(() => {
    if (!mobileNavOpen) {
      if (wasMobileNavOpen.current) mobileMenuButtonRef.current?.focus();
      wasMobileNavOpen.current = false;
      return;
    }
    wasMobileNavOpen.current = true;
    navigationRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = navigationRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen]);

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
    <div className="flex min-h-[100dvh] bg-muted/30 md:h-screen">
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[55] bg-slate-950/45 md:hidden"
          aria-label="Close administrator navigation"
          onClick={() => setMobileNavOpen(false)}
          data-testid="button-admin-nav-backdrop"
        />
      )}
      <aside
        id="admin-navigation"
        ref={navigationRef}
        aria-label="Administrator navigation"
        role={mobileNavOpen ? "dialog" : undefined}
        aria-modal={mobileNavOpen ? true : undefined}
        className={`fixed inset-y-0 left-0 z-[60] flex w-64 shrink-0 flex-col border-r bg-white transition-transform dark:bg-slate-900 md:static md:z-auto md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b">
          <div className="flex items-center justify-center" data-testid="text-sidebar-brand">
            <img src="/logo-finance.svg" alt="Alderbridge Private Wealth" className="h-auto max-h-28 max-w-full object-contain drop-shadow-md" />
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)}>
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
        <header className="h-14 bg-white dark:bg-slate-900 border-b flex items-center justify-between gap-3 px-4 md:gap-4 md:px-6 shrink-0 sticky top-0 z-50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={mobileNavOpen ? "Close administrator navigation" : "Open administrator navigation"}
              aria-expanded={mobileNavOpen}
              aria-controls="admin-navigation"
              onClick={() => setMobileNavOpen((open) => !open)}
              ref={mobileMenuButtonRef}
              data-testid="button-admin-mobile-menu"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <Shield className="w-4 h-4" />
            <span data-testid="text-admin-label">Admin Panel</span>
            <span className="hidden rounded bg-blue-50 px-2 py-1 text-xs text-blue-800 sm:inline">Internal ledger</span>
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

        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
