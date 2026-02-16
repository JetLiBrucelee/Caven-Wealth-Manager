import { useState } from "react";
import { Shield, LogOut, Eye, EyeOff } from "lucide-react";
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
  hasDebitCard: boolean;
  hasCreditCard: boolean;
  createdAt: string;
}

export default function Portal() {
  const [step, setStep] = useState<"login" | "code" | "dashboard">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800" />
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%),
                          radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%),
                          radial-gradient(circle at 50% 80%, rgba(255,255,255,0.05) 0%, transparent 60%)`
      }} />

      <div className="relative z-10 w-full max-w-md mx-4">
        <Card className="shadow-2xl border-0 bg-white rounded-2xl overflow-hidden">
          <CardHeader className="text-center space-y-4 pb-2 pt-8">
            <div className="flex justify-center">
              <div className="bg-blue-50 p-4 rounded-2xl">
                <Shield className="w-10 h-10 text-blue-500" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900" data-testid="text-portal-title">
                Caven Wealth Financial
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1.5">
                {step === "login" ? "Sign in to your account" : "Enter your access code"}
              </p>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-4">
            {step === "login" ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium text-gray-700">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    data-testid="input-username"
                    autoComplete="username"
                    className="h-12 border-gray-200 bg-gray-50 focus:bg-white transition-colors rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-password"
                      autoComplete="current-password"
                      className="h-12 border-gray-200 bg-gray-50 focus:bg-white transition-colors rounded-xl pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200"
                  disabled={loading}
                  data-testid="button-login-submit"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="accessCode" className="text-sm font-medium text-gray-700">6-Digit Access Code</Label>
                  <Input
                    id="accessCode"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                    data-testid="input-access-code"
                    className="text-center text-2xl font-bold tracking-widest h-14 border-gray-200 bg-gray-50 focus:bg-white transition-colors rounded-xl"
                  />
                  <p className="text-xs text-gray-400 text-center">
                    Contact your account manager for your access code
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200"
                  disabled={loading}
                  data-testid="button-verify-code"
                >
                  {loading ? "Verifying..." : "Verify & Access Account"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-500 hover:text-gray-700"
                  onClick={() => { setStep("login"); setCode(""); }}
                  data-testid="button-back-to-login"
                >
                  Back to Sign In
                </Button>
              </form>
            )}

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                Need help? Contact <a href="mailto:support@cavenwealthfinancial.com" className="text-blue-500 hover:text-blue-600">support@cavenwealthfinancial.com</a>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/60 mt-6">
          &copy; {new Date().getFullYear()} Caven Wealth Financial. All rights reserved.
        </p>
      </div>
    </div>
  );
}
