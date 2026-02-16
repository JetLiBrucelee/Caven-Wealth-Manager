import { useState } from "react";
import { Shield, Eye, EyeOff } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center" style={{
      background: "linear-gradient(135deg, #3b5cb8 0%, #4a69c9 25%, #3b5cb8 50%, #2d4a9e 75%, #3b5cb8 100%)"
    }}>
      <div className="w-full max-w-[440px] mx-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {step === "login" ? (
            <div className="px-10 py-10">
              <div className="flex flex-col items-center mb-8">
                <div className="bg-blue-50 p-3.5 rounded-xl mb-5">
                  <Shield className="w-8 h-8 text-blue-500 stroke-[1.5]" />
                </div>
                <h1 className="text-[22px] font-bold text-gray-900 tracking-tight" data-testid="text-portal-title">
                  Caven Wealth Financial
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Sign in to your account
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-900">Username</label>
                  <input
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    data-testid="input-username"
                    autoComplete="username"
                    className="w-full h-[46px] px-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-900">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-password"
                      autoComplete="current-password"
                      className="w-full h-[46px] px-4 pr-12 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[46px] bg-[#4a69c9] hover:bg-[#3b5cb8] text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-60"
                  data-testid="button-login-submit"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            </div>
          ) : (
            <div className="px-10 py-10">
              <div className="flex flex-col items-center mb-8">
                <div className="bg-blue-50 p-3.5 rounded-xl mb-5">
                  <Shield className="w-8 h-8 text-blue-500 stroke-[1.5]" />
                </div>
                <h1 className="text-[22px] font-bold text-gray-900 tracking-tight" data-testid="text-portal-title">
                  Caven Wealth Financial
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Enter your access code
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-900">6-Digit Access Code</label>
                  <input
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                    data-testid="input-access-code"
                    className="w-full h-[52px] px-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-2xl font-bold tracking-[0.3em] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Contact your account manager for your access code
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[46px] bg-[#4a69c9] hover:bg-[#3b5cb8] text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-60"
                  data-testid="button-verify-code"
                >
                  {loading ? "Verifying..." : "Verify & Access Account"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("login"); setCode(""); }}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
                  data-testid="button-back-to-login"
                >
                  Back to Sign In
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
