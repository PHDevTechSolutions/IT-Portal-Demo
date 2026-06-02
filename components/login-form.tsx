"use client";

/**
 * LoginForm - Revised Edition
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
  Fingerprint, ScanFace, KeyRound, AlertCircle,
} from "lucide-react";
import { authenticateWithBiometric, isBiometricAvailable } from "@/lib/utils/biometric";

export function LoginForm({ ...props }: React.ComponentProps<"div">) {
  const router       = useRouter();
  const { setUserId } = useUser();

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [loading,       setLoading]       = useState(false);
  const [totpStep,      setTotpStep]      = useState(false);
  const [totpTempToken, setTotpTempToken] = useState("");
  const [totpCode,      setTotpCode]      = useState("");
  const [totpLoading,   setTotpLoading]   = useState(false);
  const [showLocation,  setShowLocation]  = useState(false);
  const [redirecting,   setRedirecting]   = useState(false);
  const [biometric,     setBiometric]     = useState(false);
  const [showPass,      setShowPass]      = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(v => setBiometric(v)).catch(() => {});
    setBiometric(true);
  }, []);

  const getLocation = async () => {
    if (!navigator.geolocation) return null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej));
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
    setRedirecting(true);
    router.push("/dashboard");
  };

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

  return (
    <>
      {/* ── Full-screen background ── */}
      <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0a0a08 0%, #111109 50%, #0d0d0a 100%)" }}
        {...props}>

        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: `linear-gradient(#e8630a 1px, transparent 1px), linear-gradient(90deg, #e8630a 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />

        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-[0.04] blur-3xl pointer-events-none"
          style={{ background: "#e8630a" }} />

        <div className="relative z-10 w-full max-w-[360px] px-4">

          {/* Logo / Brand */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="relative">
              <div className="w-10 h-10 rounded-none flex items-center justify-center border-2"
                style={{ borderColor: "#e8630a", backgroundColor: "rgba(232,99,10,0.1)" }}>
                <span className="text-lg font-black" style={{ color: "#e8630a" }}>IT</span>
              </div>
              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 border border-[#0a0a08]" />
            </div>
            <div>
              <p className="text-base font-black tracking-widest uppercase" style={{ color: "#fff", fontFamily: "monospace" }}>
                IT Portal
              </p>
              <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#5a5a40", fontFamily: "monospace" }}>
                Ecoshift ERP · v2.0.6
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-none overflow-hidden"
            style={{ border: "1px solid #2a2a20", backgroundColor: "#111109", boxShadow: "0 0 40px rgba(232,99,10,0.06)" }}>

            {/* Card top accent bar */}
            <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, transparent, #e8630a, transparent)" }} />

            <div className="px-6 py-7 space-y-5">

              {/* Step indicator */}
              <div className="flex items-center gap-2">
                <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black border transition-colors ${!totpStep ? "border-orange-500 text-orange-500 bg-orange-500/10" : "border-slate-700 text-slate-600"}`}>1</div>
                <div className="flex-1 h-px" style={{ backgroundColor: totpStep ? "#e8630a" : "#2a2a20" }} />
                <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black border transition-colors ${totpStep ? "border-orange-500 text-orange-500 bg-orange-500/10" : "border-slate-700 text-slate-600"}`}>2</div>
              </div>

              {/* Title */}
              <div>
                <h1 className="text-sm font-black uppercase tracking-widest" style={{ color: "#fff", fontFamily: "monospace" }}>
                  {totpStep ? "Two-Factor Auth" : "Welcome back"}
                </h1>
                <p className="text-[11px] mt-0.5" style={{ color: "#5a5a40", fontFamily: "monospace" }}>
                  {totpStep ? "Enter your authenticator code to continue." : "Sign in to access your workspace."}
                </p>
              </div>

              {/* ── TOTP step ── */}
              {totpStep ? (
                <form onSubmit={handleTotpSubmit} className="space-y-4">
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-none border-2" style={{ borderColor: "#e8630a", backgroundColor: "rgba(232,99,10,0.08)" }}>
                      <KeyRound className="size-6" style={{ color: "#e8630a" }} />
                    </div>
                    <p className="text-[10px] text-center" style={{ color: "#5a5a40", fontFamily: "monospace" }}>
                      Open Google Authenticator and enter the 6-digit code.
                    </p>
                  </div>
                  <Input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                    placeholder="000 000" value={totpCode} autoFocus
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-12 text-center text-2xl tracking-[0.6em] rounded-none border-0 focus-visible:ring-0"
                    style={{ backgroundColor: "#0d0d0b", border: "1px solid #2a2a20", color: "#fff", fontFamily: "monospace", letterSpacing: "0.5em" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#e8630a")}
                    onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a20")} />
                  <button type="submit" disabled={totpLoading || totpCode.length < 6}
                    className="w-full h-11 text-sm font-black tracking-widest uppercase transition-all disabled:opacity-40"
                    style={{ background: totpLoading || totpCode.length < 6 ? "rgba(232,99,10,0.3)" : "linear-gradient(135deg, #e8630a, #ff8c42)", color: "#fff", fontFamily: "monospace" }}>
                    {totpLoading ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Verifying…</span> : "Verify Code →"}
                  </button>
                  <button type="button" onClick={() => { setTotpStep(false); setTotpCode(""); }}
                    className="w-full text-[11px] py-1 transition-colors" style={{ color: "#5a5a40", fontFamily: "monospace" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#c8c8b0")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#5a5a40")}>
                    ← Back to login
                  </button>
                </form>
              ) : (
                /* ── Credentials step ── */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#5a5a40", fontFamily: "monospace" }}>
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: "#3a3a28" }} />
                      <Input type="email" placeholder="you@ecoshift.com" value={email}
                        onChange={e => setEmail(e.target.value)} required
                        className="pl-10 h-11 rounded-none border-0 focus-visible:ring-0 text-sm"
                        style={{ backgroundColor: "#0d0d0b", border: "1px solid #2a2a20", color: "#c8c8b0", fontFamily: "monospace" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#e8630a")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a20")} />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#5a5a40", fontFamily: "monospace" }}>Password</label>
                      <a href="/auth/forgot-password" className="text-[10px] transition-colors" style={{ color: "#3a3a28", fontFamily: "monospace" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#e8630a")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#3a3a28")}>Forgot?</a>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: "#3a3a28" }} />
                      <Input type={showPass ? "text" : "password"} placeholder="••••••••"
                        value={password} onChange={e => setPassword(e.target.value)} required
                        className="pl-10 pr-10 h-11 rounded-none border-0 focus-visible:ring-0 text-sm"
                        style={{ backgroundColor: "#0d0d0b", border: "1px solid #2a2a20", color: "#c8c8b0", fontFamily: "monospace" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#e8630a")}
                        onBlur={e  => (e.currentTarget.style.borderColor = "#2a2a20")} />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] transition-colors" style={{ color: "#3a3a28" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#e8630a")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#3a3a28")}>
                        {showPass ? "HIDE" : "SHOW"}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={loading}
                    className="w-full h-11 text-sm font-black tracking-widest uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #e8630a, #ff8c42)", color: "#fff", fontFamily: "monospace" }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
                    {loading
                      ? <><Loader2 className="size-4 animate-spin" /> Authenticating…</>
                      : <><Fingerprint className="size-4" /> Sign In</>}
                  </button>

                  {/* Divider */}
                  {biometric && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px" style={{ backgroundColor: "#2a2a20" }} />
                        <span className="text-[9px] uppercase tracking-widest" style={{ color: "#3a3a28", fontFamily: "monospace" }}>or</span>
                        <div className="flex-1 h-px" style={{ backgroundColor: "#2a2a20" }} />
                      </div>
                      <button type="button" disabled={loading} onClick={handleBiometricLogin}
                        className="w-full h-11 text-sm font-bold tracking-wider uppercase transition-all disabled:opacity-40 flex items-center justify-center gap-2 border"
                        style={{ backgroundColor: "transparent", borderColor: "#2a2a20", color: "#5a5a40", fontFamily: "monospace" }}
                        onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = "#e8630a"; e.currentTarget.style.color = "#e8630a"; } }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a20"; e.currentTarget.style.color = "#5a5a40"; }}>
                        <ScanFace className="size-4" />
                        {loading ? "Verifying…" : "Use Biometrics"}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t"
              style={{ borderColor: "#1a1a12", backgroundColor: "#0d0d0b" }}>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] uppercase tracking-wider" style={{ color: "#3a3a28", fontFamily: "monospace" }}>Secure Connection</span>
              </div>
              <div className="flex items-center gap-1">
                <ShieldCheck className="size-3" style={{ color: "#3a3a28" }} />
                <span className="text-[9px]" style={{ color: "#3a3a28", fontFamily: "monospace" }}>E2E Encrypted</span>
              </div>
            </div>
          </div>

          {/* Leroux credit */}
          <p className="text-center mt-5 text-[9px] uppercase tracking-widest" style={{ color: "#2a2a18", fontFamily: "monospace" }}>
            Powered by Leroux & Xchire
          </p>
        </div>
      </div>

      {/* ── Location dialog ── */}
      <Dialog open={showLocation} onOpenChange={setShowLocation}>
        <DialogContent className="max-w-sm rounded-none p-0 overflow-hidden border-0"
          style={{ backgroundColor: "#111109", border: "1px solid #2a2a20", fontFamily: "monospace" }}>
          <div className="h-0.5" style={{ background: "linear-gradient(90deg, transparent, #e8630a, transparent)" }} />
          <DialogHeader className="px-6 pt-6 pb-4 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center border-2" style={{ borderColor: "#e8630a", backgroundColor: "rgba(232,99,10,0.1)" }}>
                <ShieldCheck className="size-6" style={{ color: "#e8630a" }} />
              </div>
            </div>
            <DialogTitle className="text-sm font-black uppercase tracking-widest" style={{ color: "#fff" }}>
              Location Access
            </DialogTitle>
            <DialogDescription className="text-[11px] mt-1" style={{ color: "#5a5a40" }}>
              Allow location access for enhanced session security and activity tracking.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 px-6 pb-6">
            <button className="flex-1 h-10 text-xs font-bold uppercase tracking-wider border transition-all"
              style={{ borderColor: "#2a2a20", color: "#5a5a40", backgroundColor: "transparent" }}
              onClick={handlePostLogin}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#5a5a40"; e.currentTarget.style.color = "#c8c8b0"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a20"; e.currentTarget.style.color = "#5a5a40"; }}>
              Skip
            </button>
            <button className="flex-1 h-10 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              style={{ background: "linear-gradient(135deg, #e8630a, #ff8c42)", color: "#fff" }}
              onClick={async () => { await getLocation(); await handlePostLogin(); }}>
              <ShieldCheck className="size-3.5" /> Allow →
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Redirect overlay ── */}
      {redirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(10,10,8,0.97)", fontFamily: "monospace" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-2 border-orange-500/20" />
              <div className="absolute inset-0 rounded-full border-t-2 border-orange-500 animate-spin" />
              <Fingerprint className="absolute inset-0 m-auto size-5" style={{ color: "#e8630a" }} />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest animate-pulse" style={{ color: "#e8630a" }}>
                Entering Workspace
              </p>
              <p className="text-[10px] mt-1" style={{ color: "#3a3a28" }}>
                Establishing secure session…
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
