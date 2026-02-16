import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Operations from "@/pages/operations";
import Company from "@/pages/company";
import Contact from "@/pages/contact";
import Careers from "@/pages/careers";
import Portal from "@/pages/portal";
import AdminLogin from "@/pages/admin/login";
import AdminOverview from "@/pages/admin/overview";
import AdminCustomers from "@/pages/admin/customers";
import AdminTransactions from "@/pages/admin/transactions";
import AdminAccessCodes from "@/pages/admin/access-codes";
import AdminPendingTransfers from "@/pages/admin/pending-transfers";
import AdminExternalTransfers from "@/pages/admin/external-transfers";
import AdminAccountApplications from "@/pages/admin/account-applications";
import AdminLayout from "@/components/admin-layout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/operations" component={Operations} />
      <Route path="/company" component={Company} />
      <Route path="/contact" component={Contact} />
      <Route path="/careers" component={Careers} />
      <Route path="/portal" component={Portal} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard">
        <AdminLayout><AdminOverview /></AdminLayout>
      </Route>
      <Route path="/admin/customers">
        <AdminLayout><AdminCustomers /></AdminLayout>
      </Route>
      <Route path="/admin/transactions">
        <AdminLayout><AdminTransactions /></AdminLayout>
      </Route>
      <Route path="/admin/access-codes">
        <AdminLayout><AdminAccessCodes /></AdminLayout>
      </Route>
      <Route path="/admin/pending-transfers">
        <AdminLayout><AdminPendingTransfers /></AdminLayout>
      </Route>
      <Route path="/admin/external-transfers">
        <AdminLayout><AdminExternalTransfers /></AdminLayout>
      </Route>
      <Route path="/admin/account-applications">
        <AdminLayout><AdminAccountApplications /></AdminLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
