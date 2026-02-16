import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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

function PhoneMockup() {
  return (
    <div className="relative" style={{ width: 280 }}>
      <div className="relative rounded-[36px] border-[6px] border-gray-800 bg-gray-900 shadow-2xl overflow-hidden" style={{ width: 280, height: 560 }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-gray-800 rounded-b-2xl z-10" />
        <div className="h-full bg-gradient-to-b from-[#1a1f3a] to-[#0d1025] p-4 pt-10 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white/80 text-xs font-medium">CWF</span>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-[10px]">Mastercard</span>
              <span className="text-white/50 text-[10px]">...2074</span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[#2a3a7c] to-[#1e2d6a] rounded-xl p-4 mb-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-white/50 text-[9px] uppercase tracking-wider">Available Balance</p>
                <p className="text-white text-xl font-bold">$24,370.00</p>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-[9px] uppercase tracking-wider">Current Balance</p>
                <p className="text-white text-sm font-semibold">$130.00</p>
              </div>
            </div>
            <div className="bg-emerald-500/20 rounded-lg px-2 py-1 inline-block">
              <p className="text-emerald-400 text-[9px]">Your next payment is due in 5 days</p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <div className="flex-1 bg-white/5 rounded-lg p-2 text-center">
              <div className="w-5 h-5 bg-blue-500/20 rounded mx-auto mb-1 flex items-center justify-center">
                <span className="text-[8px] text-blue-400">$</span>
              </div>
              <p className="text-white/70 text-[8px]">Card Details</p>
            </div>
            <div className="flex-1 bg-white/5 rounded-lg p-2 text-center">
              <div className="w-5 h-5 bg-blue-500/20 rounded mx-auto mb-1 flex items-center justify-center">
                <span className="text-[8px] text-blue-400">@</span>
              </div>
              <p className="text-white/70 text-[8px]">Make Payment</p>
            </div>
          </div>

          <div className="space-y-0">
            <div className="flex items-center justify-between py-2.5 border-b border-white/5">
              <div>
                <p className="text-white/40 text-[9px]">April 4, 2026</p>
                <p className="text-white text-xs font-medium mt-0.5">Whole Foods</p>
              </div>
              <p className="text-white text-xs font-semibold">$84.94 <span className="text-white/30 text-[8px]">v</span></p>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-white/5">
              <div>
                <p className="text-white text-xs font-medium">Starbucks</p>
              </div>
              <p className="text-white text-xs font-semibold">$5.02</p>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-white/5">
              <div>
                <p className="text-white text-xs font-medium">Amazon Prime</p>
              </div>
              <p className="text-white text-xs font-semibold">$14.99</p>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-white text-xs font-medium">Target</p>
              </div>
              <p className="text-white text-xs font-semibold">$13.84 <span className="text-white/30 text-[8px]">v</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Portal() {
  const [step, setStep] = useState<"login" | "code" | "dashboard">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(false);
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
      let msg = "Invalid username or password";
      try {
        const jsonStr = error.message?.replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(jsonStr);
        if (parsed.message) msg = parsed.message;
      } catch {}
      toast({ description: msg, variant: "destructive" });
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
      let msg = "Invalid or expired access code";
      try {
        const jsonStr = error.message?.replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(jsonStr);
        if (parsed.message) msg = parsed.message;
      } catch {}
      toast({ description: msg, variant: "destructive" });
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
    <div className="min-h-screen flex flex-col relative" style={{
      background: "linear-gradient(145deg, #0f1a3e 0%, #162252 30%, #1a2a5e 50%, #14204a 75%, #0d1633 100%)"
    }}>
      <div className="absolute inset-0 opacity-15" style={{
        backgroundImage: "url('/images/banking-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }} />
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center px-4 sm:px-8 lg:px-16 py-8 lg:py-0 gap-8 lg:gap-16 xl:gap-24 max-w-[1400px] mx-auto w-full">
        <div className="hidden lg:flex flex-col items-center lg:items-start gap-8 flex-1 max-w-[550px]">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <PhoneMockup />

            <div className="flex flex-col items-center lg:items-start gap-6">
              <h2 className="text-white text-2xl xl:text-3xl font-bold leading-tight text-center lg:text-left">
                Secure Banking<br />
                at Your Fingertips<br />
                <span className="text-blue-300">Since 2010</span>
              </h2>

              <a
                href="#"
                className="inline-block border-2 border-[#c9b97a] text-[#c9b97a] hover:bg-[#c9b97a] hover:text-[#0f1a3e] font-semibold text-sm px-8 py-3 rounded-full transition-all duration-200"
                data-testid="link-learn-more"
              >
                Learn more
              </a>

              <div className="flex items-center gap-3 mt-2">
                <img
                  src="/images/app-store-badge.png"
                  alt="Download on the App Store"
                  className="h-10 cursor-pointer hover:opacity-80 transition-opacity"
                  data-testid="img-app-store"
                />
                <img
                  src="/images/google-play-badge.png"
                  alt="Get it on Google Play"
                  className="h-10 cursor-pointer hover:opacity-80 transition-opacity"
                  data-testid="img-google-play"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[380px] lg:max-w-[360px]">
          <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
            {step === "login" ? (
              <div className="p-7 sm:p-8">
                <h1 className="text-[22px] font-bold text-gray-900 mb-6" data-testid="text-portal-title">
                  Log In
                </h1>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      data-testid="input-username"
                      autoComplete="username"
                      className="w-full h-[42px] px-3 bg-white border border-gray-300 rounded text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        data-testid="input-password"
                        autoComplete="current-password"
                        className="w-full h-[42px] px-3 pr-10 bg-white border border-gray-300 rounded text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="rememberUsername"
                      checked={rememberUsername}
                      onChange={(e) => setRememberUsername(e.target.checked)}
                      className="w-3.5 h-3.5 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                      data-testid="checkbox-remember-username"
                    />
                    <label htmlFor="rememberUsername" className="text-sm text-gray-600 cursor-pointer select-none">
                      Remember Username
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[44px] rounded-full font-semibold text-sm transition-all duration-200 disabled:opacity-60 mt-2"
                    style={{
                      background: "linear-gradient(135deg, #d4c47a 0%, #c9b97a 50%, #b8a862 100%)",
                      color: "#3a3520",
                    }}
                    data-testid="button-login-submit"
                  >
                    {loading ? "Logging in..." : "Log In"}
                  </button>
                </form>

                <div className="mt-5 space-y-2">
                  <a href="#" className="block text-sm text-blue-600 hover:text-blue-700 font-medium" data-testid="link-forgot-username">
                    Forgot Username?
                  </a>
                  <a href="#" className="block text-sm text-blue-600 hover:text-blue-700 font-medium" data-testid="link-forgot-password">
                    Forgot Password?
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-7 sm:p-8">
                <h1 className="text-[22px] font-bold text-gray-900 mb-2" data-testid="text-portal-title">
                  Access Code
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                  Enter your 6-digit code
                </p>

                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
                      6-Digit Code
                    </label>
                    <input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                      data-testid="input-access-code"
                      className="w-full h-[48px] px-3 bg-white border border-gray-300 rounded text-center text-xl font-bold tracking-[0.25em] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[44px] rounded-full font-semibold text-sm transition-all duration-200 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, #d4c47a 0%, #c9b97a 50%, #b8a862 100%)",
                      color: "#3a3520",
                    }}
                    data-testid="button-verify-code"
                  >
                    {loading ? "Verifying..." : "Verify & Access Account"}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep("login"); setCode(""); }}
                    className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-1"
                    data-testid="button-back-to-login"
                  >
                    Back to Log In
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 lg:hidden flex flex-col items-center gap-4 pb-6 px-4">
        <div className="flex items-center gap-3">
          <img src="/images/app-store-badge.png" alt="App Store" className="h-9" />
          <img src="/images/google-play-badge.png" alt="Google Play" className="h-9" />
        </div>
      </div>

      <footer className="relative z-10 border-t border-white/10 py-4 px-6 lg:px-16">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-6 flex-wrap justify-center">
            <a href="/contact" className="text-white/70 hover:text-white text-xs font-medium transition-colors" data-testid="link-contact-us">
              Contact Us
            </a>
            <a href="#" className="text-white/70 hover:text-white text-xs font-medium transition-colors" data-testid="link-faq">
              FAQ
            </a>
            <a href="#" className="text-white/70 hover:text-white text-xs font-medium transition-colors" data-testid="link-activate-card">
              Activate Your Card Today!
            </a>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="text-white/90 text-xs font-bold leading-none">Member</span>
                <span className="text-white text-lg font-black leading-none tracking-tight">FDIC</span>
              </div>
            </div>
            <span className="text-white/40 text-[10px]">
              &copy; {new Date().getFullYear()} Caven Wealth Financial
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
