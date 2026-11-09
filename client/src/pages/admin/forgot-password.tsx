import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResetValues = {
  username: string;
  answer: string;
  recoveryCode: string;
  newPassword: string;
  confirmPassword: string;
};

function passwordBytes(value: string) {
  return new TextEncoder().encode(value).length;
}

export default function AdminForgotPassword() {
  const [, setLocation] = useLocation();
  const [values, setValues] = useState<ResetValues>({
    username: "",
    answer: "",
    recoveryCode: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replacementCode, setReplacementCode] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const replacementCodeRef = useRef("");
  const replacementCodeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const clearOneTimeCode = () => {
      replacementCodeRef.current = "";
      if (replacementCodeInput.current) replacementCodeInput.current.value = "";
      setReplacementCode("");
      setAcknowledged(false);
    };
    window.addEventListener("pagehide", clearOneTimeCode);
    return () => {
      window.removeEventListener("pagehide", clearOneTimeCode);
      replacementCodeRef.current = "";
    };
  }, []);

  function update(field: keyof ResetValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordBytes(values.newPassword) < 12) {
      setError("Choose a new password of at least 12 characters.");
      return;
    }
    if (passwordBytes(values.newPassword) > 72) {
      setError("The new password must be no more than 72 UTF-8 bytes.");
      return;
    }
    if (values.newPassword !== values.confirmPassword) {
      setError("The password confirmation does not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest("POST", "/api/admin/password-reset", values);
      const result: { message: string; recoveryCode: string } = await response.json();
      setValues({ username: "", answer: "", recoveryCode: "", newPassword: "", confirmPassword: "" });
      replacementCodeRef.current = result.recoveryCode;
      setReplacementCode(result.recoveryCode);
      setAcknowledged(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password reset could not be completed. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    replacementCodeRef.current = "";
    setReplacementCode("");
    setAcknowledged(false);
    setLocation("/admin/login");
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-[linear-gradient(145deg,#0f1a3e_0%,#162252_34%,#1a2a5e_58%,#0d1633_100%)]">
      <div className="absolute inset-0 opacity-[0.12] bg-[url('/images/banking-bg.jpg')] bg-cover bg-center" aria-hidden="true" />
      <Card className="relative z-10 w-full max-w-lg border-slate-200/80 shadow-2xl shadow-slate-950/25">
        {replacementCode ? (
          <section data-testid="reset-success" aria-labelledby="reset-success-heading">
            <CardHeader className="space-y-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle id="reset-success-heading" className="text-2xl">Password updated</CardTitle>
              <CardDescription>
                Your password has been reset and existing admin sessions have been signed out. Sign in again with your new password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Save your replacement recovery code securely</p>
                <p className="mt-1">This code is shown once. Keep it somewhere private and accessible to you.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="replacement-recovery-code">Replacement recovery code</Label>
                <Input
                  ref={replacementCodeInput}
                  id="replacement-recovery-code"
                  data-testid="replacement-code"
                  value={replacementCode}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                  autoComplete="off"
                  className="h-12 font-mono text-base tracking-wider"
                  aria-describedby="replacement-code-note"
                />
                <p id="replacement-code-note" className="text-xs text-muted-foreground">Select the code to copy it manually.</p>
              </div>
              <label className="flex items-start gap-3 rounded-md border p-3 text-sm leading-relaxed">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-800"
                  data-testid="saved-acknowledgement"
                />
                <span>I have saved this replacement code in a secure place.</span>
              </label>
              <Button className="w-full" disabled={!acknowledged} onClick={finish} data-testid="button-reset-return-login">
                Continue to sign in
              </Button>
            </CardContent>
          </section>
        ) : (
          <>
            <CardHeader className="space-y-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-900">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Alderbridge Private Wealth</p>
                <CardTitle className="mt-2 text-2xl">Reset admin password</CardTitle>
                <CardDescription className="mt-2">
                  Verify the recovery answer and your private recovery code to set a new password.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-username">Admin username</Label>
                  <Input id="recovery-username" data-testid="recovery-username" value={values.username} onChange={(event) => update("username", event.target.value)} autoComplete="username" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recovery-answer">Recovery answer</Label>
                  <p className="text-sm text-muted-foreground">What is your favorite hobby?</p>
                  <Input id="recovery-answer" data-testid="recovery-answer" value={values.answer} onChange={(event) => update("answer", event.target.value)} autoComplete="off" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recovery-code">Private recovery code</Label>
                  <Input id="recovery-code" data-testid="recovery-code" value={values.recoveryCode} onChange={(event) => update("recoveryCode", event.target.value)} autoComplete="off" required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input id="new-password" data-testid="new-password" type="password" value={values.newPassword} onChange={(event) => update("newPassword", event.target.value)} autoComplete="new-password" minLength={12} required />
                    <p className="text-xs text-muted-foreground">At least 12 characters; maximum 72 UTF-8 bytes.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input id="confirm-password" data-testid="confirm-password" type="password" value={values.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} autoComplete="new-password" required />
                  </div>
                </div>
                {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy} data-testid="reset-submit">
                  {busy ? "Verifying recovery details…" : "Reset password"}
                </Button>
              </form>
              <div className="mt-5 border-t pt-4">
                <Link href="/admin/login" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Return to admin sign in
                </Link>
              </div>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" aria-hidden="true" />
                Recovery details are used only to verify this reset. You will not be signed in automatically.
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
