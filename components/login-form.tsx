"use client";

/**
 * LoginForm - Terminal Edition
 * Step 1: Email + Password  →  /api/login
 * Step 2: If TOTP enabled   →  6-digit code  →  /api/auth/totp/verify
 * Step 3: Location dialog   →  /dashboard
 */

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck, Mail, Lock, Loader2,
  Fingerprint, ScanFace, Terminal, Circle, KeyRound,
} from "lucide-react";
import { authenticateWithBiometric, isBiometricAvailable } from "@/lib/utils/biometric";

const C = {
  bg:     "#0d0d0b",
  card:   "#111109",
  border: "#2a2a20",
  dim:    "#5a5a40",
  muted:  "#4a4a30",
  text:   "#c8c8b0",
  accent: "#e8630a",
  font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const router      = useRouter();
  const { setUserId } = useUser();

  /* ── Credentials step ── */
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  /* ── TOTP step ── */
  const [totpStep,      setTotpStep]      = useState(false);
  const [totpTempToken, setTotpTempToken] = useState("");
  const [totpCode,      setTotpCode]      = useState("");
  const [totpLoading,   setTotpLoading]   = useState(false);

  /* ── Post-login ── */
  const [showLocation,   setShowLocation]   = useState(false);
  const [loadingRedirect, setLoadingRedirect] = useState(false);

  /* ── Biometric ── */
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  useEffect(() => {
    isBiometricAvailable().then(v => setBiometricAvailable(v)).catch(() => {});
    setBiometricAvailable(true); // always show for testing
  }, []);

  const getLocation = async () => {
    if (!navigator.geolocation) return null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      );
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch { return null; }
  };

  const finishLogin = (result: any) => {
    if (result.userId) {
      setUserId(result.userId);
      localStorage.setItem("userId", result.userId);
    }
    setShowLocation(true);
  };

  const handlePostLogin = async () => {
    setShowLocation(false);
    setLoadingRedirect(true);
    router.push("/dashboard");
  };

  /* ── Step 1: Password login ── */
  const handleLoginSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Credentials required."); return; }
    setLoading(true);
    try {
      const deviceId = localStorage.getItem("deviceId") ?? (() => {
        const id = crypto.randomUUID();
        localStorage.setItem("deviceId", id);
        return id;
      })();

      const res    = await fetch("/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email: email, Password: password, deviceId }),
      });
      const result = await res.json();

      if (!res.ok) { toast.error(result.message || "Authentication failed."); return; }

      if (result.requiresTOTP) {
        setTotpTempToken(result.tempToken);
        setTotpCode("");
        setTotpStep(true);
        return;
      }

      finishLogin(result);
    } catch { toast.error("System authentication error."); }
    finally  { setLoading(false); }
  }, [email, password]);

  /* ── Step 2: TOTP verify ── */
  const handleTotpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!totpCode.trim()) { toast.error("Enter the 6-digit code."); return; }
    setTotpLoading(true);
    try {
      const res    = await fetch("/api/auth/totp/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken: totpTempToken, code: totpCode.trim() }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.message || "Invalid code."); return; }
      setTotpStep(false);
      finishLogin(result);
    } catch { toast.error("Verification error."); }
    finally  { setTotpLoading(false); }
  };

  /* ── Biometric login ── */
  const handleBiometricLogin = useCallback(async () => {
    if (!email) { toast.error("Enter your email first."); return; }
    setLoading(true);
    try {
      const lookupRes = await fetch("/api/auth/biometric/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!lookupRes.ok) { toast.error((await lookupRes.json()).message || "User not found"); return; }
      const { userId } = await lookupRes.json();
      const result = await authenticateWithBiometric(userId);
      if (result.success) {
        toast.success("Biometric authentication successful");
        finishLogin(result);
      } else {
        toast.error(result.error || "Biometric authentication failed");
      }
    } catch { toast.error("Biometric authentication error"); }
    finally  { setLoading(false); }
  }, [email]);

  /* ─── Render ── */
  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: C.bg, fontFamily: C.font }} {...props}>

        {/* Dot-grid */}
        <div className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: `radial-gradient(circle, #3a3a2e 1px, transparent 1px)`, backgroundSize: "24px 24px" }} />
        <div className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)" }} />

        <div className="relative z-10 w-full max-w-sm px-4">

          {/* Agent status */}
          <div className="mb-5 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: C.accent }}>AGENT STATUS</span>
            <div className="flex-1 h-px" style={{ backgroundColor: C.border }} />
          </div>
          <div className="mb-6 rounded-sm border px-4 py-3 space-y-2" style={{ borderColor: C.border, backgroundColor: C.card }}>
            {[["IT Portal","ONLINE"],["Auth Service","READY"],["E2E Encrypted","ACTIVE"]].map(([label, status]) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                  <span className="text-xs" style={{ color: C.text }}>{label}</span>
                </div>
                <span className="text-[10px] font-bold tracking-wider" style={{ color: C.accent }}>{status}</span>
              </div>
            ))}
          </div>

          {/* Main card */}
          <div className="rounded-sm border overflow-hidden" style={{ borderColor: C.border, backgroundColor: C.card }}>

            {/* Card header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-sm border" style={{ borderColor: "#3a3a20", backgroundColor: "#1a1a10" }}>
                {totpStep ? <KeyRound className="h-4 w-4" style={{ color: C.accent }} /> : <Terminal className="h-4 w-4" style={{ color: C.accent }} />}
              </div>
              <div>
                <p className="text-sm font-bold tracking-wider text-white uppercase">IT Portal</p>
                <p className="text-[10px] tracking-widest" style={{ color: C.dim }}>
                  {totpStep ? "2-Factor Authentication" : "Ecoshift ERP · v2.0.6"}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 rounded-sm px-2 py-0.5 border" style={{ borderColor: "#3a3a20", backgroundColor: "#1a1a10" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] tracking-wider" style={{ color: C.accent }}>SECURE</span>
              </div>
            </div>

            {/* ── TOTP step ── */}
            {totpStep ? (
              <form onSubmit={handleTotpSubmit} className="px-5 py-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] tracking-widest" style={{ color: C.accent }}>$</span>
                  <span className="text-[10px] tracking-widest" style={{ color: C.dim }}>verify --totp</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: C.dim }}>
                    // authenticator_code
                  </label>
                  <p className="text-[10px]" style={{ color: C.muted }}>
                    Open Google Authenticator and enter the 6-digit code for IT Portal.
                  </p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoFocus
                    required
                    className="h-12 text-center text-2xl tracking-[0.5em] rounded-sm border focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ backgroundColor: C.bg, borderColor: C.border, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                </div>
                <button type="submit" disabled={totpLoading || totpCode.length < 6}
                  className="w-full h-10 rounded-sm border text-sm font-bold tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ backgroundColor: C.accent, borderColor: C.accent, color: C.bg }}>
                  {totpLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…</> : <><ShieldCheck className="h-3.5 w-3.5" /> Verify Code →</>}
                </button>
                <button type="button" onClick={() => { setTotpStep(false); setTotpCode(""); }}
                  className="w-full text-[10px] tracking-wider transition-colors" style={{ color: C.dim }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                  ← Back to login
                </button>
              </form>
            ) : (
              /* ── Credentials step ── */
              <form onSubmit={handleLoginSubmit} className="px-5 py-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] tracking-widest" style={{ color: C.accent }}>$</span>
                  <span className="text-[10px] tracking-widest" style={{ color: C.dim }}>authenticate --user</span>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: C.dim }}>// identity</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: C.muted }} />
                    <Input type="email" placeholder="user@ecoshift.com" value={email} onChange={e => setEmail(e.target.value)} required
                      className="pl-9 h-10 rounded-sm border text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                      style={{ backgroundColor: C.bg, borderColor: C.border, color: C.text }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: C.dim }}>// access_code</label>
                    <a href="/auth/forgot-password" className="text-[10px] tracking-wider transition-colors" style={{ color: C.muted }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>reset?</a>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: C.muted }} />
                    <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required
                      className="pl-9 h-10 rounded-sm border text-sm tracking-widest focus-visible:ring-0 focus-visible:ring-offset-0"
                      style={{ backgroundColor: C.bg, borderColor: C.border, color: C.text }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading}
                  className="w-full h-10 rounded-sm border text-sm font-bold tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ backgroundColor: C.accent, borderColor: C.accent, color: C.bg }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.backgroundColor = "#ff7a1a"; e.currentTarget.style.borderColor = "#ff7a1a"; } }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.accent; e.currentTarget.style.borderColor = C.accent; }}>
                  {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Authenticating…</> : <><Fingerprint className="h-3.5 w-3.5" /> Initialize Access →</>}
                </button>

                {/* Biometric */}
                {biometricAvailable && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px" style={{ backgroundColor: C.border }} />
                      <span className="text-[10px] tracking-widest" style={{ color: "#3a3a28" }}>OR</span>
                      <div className="flex-1 h-px" style={{ backgroundColor: C.border }} />
                    </div>
                    <button type="button" disabled={loading} onClick={handleBiometricLogin}
                      className="w-full h-10 rounded-sm border text-sm font-bold tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                      style={{ backgroundColor: "transparent", borderColor: C.border, color: C.text }}
                      onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; }}>
                      {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…</> : <><ScanFace className="h-3.5 w-3.5" /> Biometric Login</>}
                    </button>
                  </>
                )}
              </form>
            )}

            {/* Card footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] tracking-wider rounded-sm border px-2 py-0.5" style={{ borderColor: C.border, color: C.dim }}>
                  <ShieldCheck className="h-3 w-3" /> E2E Encrypted
                </span>
                <span className="flex items-center gap-1.5 text-[10px] tracking-wider rounded-sm border px-2 py-0.5" style={{ borderColor: C.border, color: C.dim }}>
                  {totpStep ? "2FA Active" : "Multi-Agent"}
                </span>
              </div>
              <span className="text-[10px]" style={{ color: "#3a3a28" }}>Leroux & Xchire</span>
            </div>
          </div>
        </div>
      </div>

      {/* Location dialog */}
      <Dialog open={showLocation} onOpenChange={setShowLocation}>
        <DialogContent className="rounded-sm border overflow-hidden max-w-sm"
          style={{ backgroundColor: C.card, borderColor: C.border, fontFamily: C.font }}>
          <div className="absolute top-0 left-0 w-4 h-4 border-l border-t" style={{ borderColor: C.accent }} />
          <div className="absolute top-0 right-0 w-4 h-4 border-r border-t" style={{ borderColor: C.accent }} />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-l border-b" style={{ borderColor: C.accent }} />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-r border-b" style={{ borderColor: C.accent }} />
          <DialogHeader className="relative text-center pt-2">
            <div className="flex justify-center mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm border" style={{ borderColor: "#3a3a20", backgroundColor: "#1a1a10" }}>
                <ShieldCheck className="h-5 w-5" style={{ color: C.accent }} />
              </div>
            </div>
            <DialogTitle className="text-sm font-bold tracking-wider uppercase" style={{ color: C.text }}>
              Location <span style={{ color: C.accent }}>Protocol</span>
            </DialogTitle>
            <DialogDescription className="text-xs mt-1 tracking-wide" style={{ color: C.dim }}>
              Grant geolocation access for enhanced security tracking and session verification.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="relative mt-4 flex gap-3 px-2 pb-2">
            <button className="flex-1 h-9 rounded-sm border text-xs font-bold tracking-wider uppercase transition-all"
              style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
              onClick={handlePostLogin}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.dim; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              Decline
            </button>
            <button className="flex-1 h-9 rounded-sm border text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all"
              style={{ backgroundColor: C.accent, borderColor: C.accent, color: C.bg }}
              onClick={async () => { await getLocation(); await handlePostLogin(); }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#ff7a1a"; e.currentTarget.style.borderColor = "#ff7a1a"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.accent; e.currentTarget.style.borderColor = C.accent; }}>
              <ShieldCheck className="h-3.5 w-3.5" /> Authorize →
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading overlay */}
      {loadingRedirect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(13,13,11,0.95)", fontFamily: C.font }}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: C.accent }} />
            <p className="text-xs tracking-[0.3em] uppercase animate-pulse" style={{ color: C.dim }}>
              Establishing Secure Connection...
            </p>
          </div>
        </div>
      )}
    </>
  );
}
