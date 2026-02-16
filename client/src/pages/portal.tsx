import { useState } from "react";
import { Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import CustomerDashboard from "@/components/customer-dashboard";

interface CustomerData {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  accountNumber: string;
  routingNumber: string;
  accountType: string;
  balance: string;
  status: string;
  createdAt: string;
}

export default function Portal() {
  const [step, setStep] = useState<"login" | "code" | "dashboard">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ description: "Please enter your username and password", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/customer/login", { username, password });
      const data = await response.json();
      if (data.step === "needs_code") {
        setStep("code");
        toast({ description: "Credentials verified. Please enter your access code." });
      }
    } catch (error: any) {
      toast({ description: "Invalid username or password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast({ description: "Please enter a valid 6-digit access code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/customer/verify-code", { code });
      const data = await response.json();
      if (data.authenticated && data.customer) {
        setCustomer(data.customer);
        setStep("dashboard");
      }
    } catch (error: any) {
      toast({ description: "Invalid or expired access code", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/customer/logout");
    } catch (e) {}
    setStep("login");
    setUsername("");
    setPassword("");
    setCode("");
    setCustomer(null);
  };

  if (step === "dashboard" && customer) {
    return <CustomerDashboard customer={customer} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center">
            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-xl shadow-inner">
              <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold" data-testid="text-portal-title">
              Caven Wealth Financial
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {step === "login" ? "Sign in to your account" : "Enter your access code"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {step === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  data-testid="input-username"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-password"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-login-submit">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessCode">6-Digit Access Code</Label>
                <Input
                  id="accessCode"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                  data-testid="input-access-code"
                  className="text-center text-2xl font-bold tracking-widest h-12"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Contact your account manager for your access code
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-verify-code">
                {loading ? "Verifying..." : "Verify & Access Account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setStep("login"); setCode(""); }}
                data-testid="button-back-to-login"
              >
                Back to Sign In
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
