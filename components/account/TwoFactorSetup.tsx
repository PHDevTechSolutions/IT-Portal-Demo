"use client";

/**
 * TwoFactorSetup
 *
 * Lets the user enable or disable Google Authenticator 2FA on their account.
 *
 * Enable flow:
 *   1. Click "Enable 2FA" → POST /api/auth/totp/setup → get QR code + secret
 *   2. Scan QR with Google Authenticator
 *   3. Enter the 6-digit code → POST /api/auth/totp/confirm → 2FA active
 *
 * Disable flow:
 *   1. Click "Disable 2FA"
 *   2. Enter current 6-digit code → POST /api/auth/totp/disable → 2FA removed
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, KeyRound, Copy, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  green:  "#34d399",
  red:    "#f87171",
  font:   "'JetBrains Mono', 'Fira Code', monospace",
};

type Step = "idle" | "qr" | "confirm" | "disable";

export function TwoFactorSetup() {
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [step,        setStep]        = useState<Step>("idle");
  const [qrCode,      setQrCode]      = useState("");
  const [secret,      setSecret]      = useState("");
  const [code,        setCode]        = useState("");
  const [loading,     setLoading]     = useState(false);
  const [copied,      setCopied]      = useState(false);

  /* ── Load current 2FA status ── */
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setTotpEnabled(!!d.totpEnabled))
      .catch(() => setTotpEnabled(false));
  }, []);

  /* ── Step 1: Generate QR ── */
  const handleSetup = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/totp/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setCode("");
      setStep("qr");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start 2FA setup.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: Confirm code ── */
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) { toast.error("Enter the 6-digit code."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/totp/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("2FA enabled. Your account is now protected.");
      setTotpEnabled(true);
      setStep("idle");
      setQrCode(""); setSecret(""); setCode("");
    } catch (e: any) {
      toast.error(e.message ?? "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Disable: verify then remove ── */
  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) { toast.error("Enter the 6-digit code."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/totp/disable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("2FA disabled.");
      setTotpEnabled(false);
      setStep("idle");
      setCode("");
    } catch (e: any) {
      toast.error(e.message ?? "Invalid code.");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (totpEnabled === null) {
    return (
      <div className="flex items-center gap-2 py-4" style={{ color: C.dim, fontFamily: C.font }}>
        <Loader2 className="size-4 animate-spin" />
        <span className="text-[11px] uppercase tracking-widest">Loading 2FA status…</span>
      </div>
    );
  }

  return (
    <div className="border rounded-none space-y-0" style={{ borderColor: C.border, backgroundColor: C.panel, fontFamily: C.font }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
        <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border }}>
          {totpEnabled
            ? <ShieldCheck className="size-4" style={{ color: C.green }} />
            : <KeyRound    className="size-4" style={{ color: C.accent }} />}
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
            Two-Factor Authentication
          </p>
          <p className="text-[9px] mt-0.5" style={{ color: C.dim }}>
            {totpEnabled ? "2FA is active — Google Authenticator required at login" : "Add an extra layer of security to your account"}
          </p>
        </div>
        <div className="ml-auto">
          <span
            className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 border"
            style={{
              borderColor: totpEnabled ? C.green + "40" : C.border,
              color:       totpEnabled ? C.green : C.dim,
              backgroundColor: totpEnabled ? C.green + "10" : "transparent",
            }}
          >
            {totpEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ── IDLE: show enable/disable button ── */}
        {step === "idle" && (
          <div className="flex items-center justify-between">
            <p className="text-[11px]" style={{ color: C.dim }}>
              {totpEnabled
                ? "Scan a new QR code or disable 2FA below."
                : "Use Google Authenticator to generate login codes."}
            </p>
            <div className="flex gap-2">
              {totpEnabled && (
                <button
                  onClick={() => { setStep("disable"); setCode(""); }}
                  className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor: C.red + "40", color: C.red, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.red + "10"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <ShieldOff className="size-3" /> Disable 2FA
                </button>
              )}
              <button
                onClick={handleSetup}
                disabled={loading}
                className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#ff7a1a"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.accent; }}
              >
                {loading ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                {totpEnabled ? "Re-setup 2FA" : "Enable 2FA"}
              </button>
            </div>
          </div>
        )}

        {/* ── QR step ── */}
        {step === "qr" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* QR Code */}
              <div className="shrink-0 border p-2" style={{ borderColor: C.border, backgroundColor: "#fff" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="TOTP QR Code" width={160} height={160} />
              </div>
              {/* Instructions */}
              <div className="space-y-3 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                  Scan with Google Authenticator
                </p>
                <ol className="space-y-1.5 text-[11px]" style={{ color: C.dim }}>
                  <li>1. Open <span style={{ color: C.text }}>Google Authenticator</span> on your phone</li>
                  <li>2. Tap <span style={{ color: C.text }}>+</span> → <span style={{ color: C.text }}>Scan a QR code</span></li>
                  <li>3. Point your camera at the QR code</li>
                  <li>4. Enter the 6-digit code below to confirm</li>
                </ol>
                {/* Manual secret */}
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: C.dim }}>
                    Or enter manually:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] px-2 py-1 border flex-1 break-all" style={{ borderColor: C.border, backgroundColor: C.bg, color: C.text }}>
                      {secret}
                    </code>
                    <button onClick={copySecret} className="flex items-center gap-1 h-7 px-2 text-[9px] border transition-colors"
                      style={{ borderColor: C.border, color: copied ? C.green : C.dim, backgroundColor: "transparent" }}>
                      {copied ? <CheckCircle2 className="size-3" /> : <Copy className="size-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirm code form */}
            <form onSubmit={handleConfirm} className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
                  Enter the 6-digit code from the app
                </label>
                <Input
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  placeholder="000000" value={code} autoFocus
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-10 text-center text-xl tracking-[0.4em] rounded-none border focus-visible:ring-0"
                  style={{ backgroundColor: C.bg, borderColor: C.border, color: C.text, fontFamily: C.font }}
                  onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>
              <button type="submit" disabled={loading || code.length < 6}
                className="h-10 px-5 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                style={{ borderColor: C.green, color: "#fff", backgroundColor: C.green }}>
                {loading ? <Loader2 className="size-3 animate-spin" /> : "Confirm →"}
              </button>
              <button type="button" onClick={() => { setStep("idle"); setCode(""); setQrCode(""); setSecret(""); }}
                className="h-10 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* ── Disable step ── */}
        {step === "disable" && (
          <form onSubmit={handleDisable} className="space-y-3">
            <p className="text-[11px]" style={{ color: C.dim }}>
              Enter your current Google Authenticator code to confirm disabling 2FA.
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
                  6-digit code
                </label>
                <Input
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  placeholder="000000" value={code} autoFocus
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-10 text-center text-xl tracking-[0.4em] rounded-none border focus-visible:ring-0"
                  style={{ backgroundColor: C.bg, borderColor: C.border, color: C.text, fontFamily: C.font }}
                  onFocus={e => (e.currentTarget.style.borderColor = C.red)}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>
              <button type="submit" disabled={loading || code.length < 6}
                className="h-10 px-5 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                style={{ borderColor: C.red, color: "#fff", backgroundColor: C.red }}>
                {loading ? <Loader2 className="size-3 animate-spin" /> : "Disable 2FA"}
              </button>
              <button type="button" onClick={() => { setStep("idle"); setCode(""); }}
                className="h-10 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
