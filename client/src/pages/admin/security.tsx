import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Clipboard, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SecurityStatus = {
  question: string;
  recoveryConfigured: boolean;
  hasRecoveryCode: boolean;
};

export default function AdminSecurity() {
  const { data, isLoading, isError, refetch } = useQuery<SecurityStatus>({
    queryKey: ["/api/admin/security"],
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const recoveryCodeRef = useRef("");

  useEffect(() => {
    const clearOneTimeCode = () => {
      recoveryCodeRef.current = "";
      if (codeInput.current) codeInput.current.value = "";
      setRecoveryCode("");
      setAcknowledged(false);
      setCopied(false);
    };
    window.addEventListener("pagehide", clearOneTimeCode);
    return () => {
      window.removeEventListener("pagehide", clearOneTimeCode);
      recoveryCodeRef.current = "";
    };
  }, []);

  async function generateCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    recoveryCodeRef.current = "";
    setRecoveryCode("");
    setAcknowledged(false);
    setCopied(false);
    try {
      const response = await apiRequest("POST", "/api/admin/security/recovery-code", { currentPassword });
      const result: { recoveryCode: string } = await response.json();
      recoveryCodeRef.current = result.recoveryCode;
      setRecoveryCode(result.recoveryCode);
      setCurrentPassword("");
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/security"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A recovery code could not be generated. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
    } catch {
      codeInput.current?.focus();
      codeInput.current?.select();
      setError("Clipboard access is unavailable. The code is selected so you can copy it manually.");
    }
  }

  function closeCode() {
    recoveryCodeRef.current = "";
    setRecoveryCode("");
    setAcknowledged(false);
    setCopied(false);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5" aria-label="Loading security settings">
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6" role="alert">
        <h1 className="text-lg font-semibold text-red-950">Security settings could not be loaded</h1>
        <p className="mt-1 text-sm text-red-800">Check your connection and try again.</p>
        <Button className="mt-4" variant="outline" onClick={() => void refetch()}>Retry</Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Administrator access</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Security &amp; recovery</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Manage the private recovery code used alongside the recovery answer for password resets.
        </p>
      </header>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-900">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg">Recovery status</CardTitle>
            <CardDescription className="mt-1">Current availability of the administrator's recovery factors.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recovery question</p>
            <p className="mt-2 text-sm font-medium text-slate-900">{data.question}</p>
            <p className="mt-2 text-xs text-muted-foreground">{data.recoveryConfigured ? "Answer is configured" : "Answer is not configured"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Private recovery code</p>
            <p className="mt-2 text-sm font-medium text-slate-900">{data.hasRecoveryCode ? "A code is on file" : "No code is on file"}</p>
            <p className="mt-2 text-xs text-muted-foreground">The existing code itself is never displayed here.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-emerald-800" aria-hidden="true" />
            {data.hasRecoveryCode ? "Replace recovery code" : "Create recovery code"}
          </CardTitle>
          <CardDescription>
            Confirm your current password to generate a new private code. The code will be displayed only once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!recoveryCode ? (
            <form onSubmit={generateCode} className="space-y-4">
              {data.hasRecoveryCode && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                  Generating a replacement immediately invalidates the earlier recovery code. Store the new code before leaving this page.
                </div>
              )}
              <div className="max-w-md space-y-2">
                <Label htmlFor="security-current-password">Current password</Label>
                <Input
                  id="security-current-password"
                  data-testid="security-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => { setCurrentPassword(event.target.value); setError(""); }}
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <Button type="submit" disabled={busy} data-testid="generate-recovery-code">
                <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
                {busy ? "Generating code…" : data.hasRecoveryCode ? "Replace recovery code" : "Generate recovery code"}
              </Button>
            </form>
          ) : (
            <div className="space-y-5" aria-live="polite">
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950">
                <p className="font-semibold">Recovery code generated</p>
                <p className="mt-1">Save it in a secure place now. It cannot be viewed again after you leave this page.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-code-display">Your private recovery code</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    ref={codeInput}
                    id="recovery-code-display"
                    data-testid="recovery-code-display"
                    value={recoveryCode}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                    autoComplete="off"
                    className="h-12 min-w-0 flex-1 font-mono text-base tracking-wider"
                  />
                  <Button type="button" variant="outline" onClick={copyCode} className="shrink-0">
                    {copied ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Clipboard className="mr-2 h-4 w-4" aria-hidden="true" />}
                    {copied ? "Copied" : "Copy code"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">If copy is unavailable, focus the code and select it manually.</p>
              </div>
              {error && <p role="status" className="text-sm text-amber-800">{error}</p>}
              <label className="flex items-start gap-3 rounded-md border p-3 text-sm leading-relaxed">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-800"
                  data-testid="saved-acknowledgement"
                />
                <span>I have saved this code securely. I understand it will be hidden when I continue.</span>
              </label>
              <Button type="button" disabled={!acknowledged} onClick={closeCode}>
                I’ve saved the code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
