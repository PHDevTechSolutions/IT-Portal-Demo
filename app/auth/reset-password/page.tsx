"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2, CheckCircle2, AlertCircle, ShieldCheck, Eye, EyeOff } from "lucide-react";

const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  dim:    "#4a6070",
  muted:  "#253040",
  text:   "#c8d8e8",
  accent: "#e8630a",
  font:   "'JetBrains Mono','Fira Code','Courier New',monospace",
};

function strengthOf(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: "", color: C.muted, width: "0%" };
  if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(pw))
    return { label: "Strong", color: "#34d399", width: "100%" };
  if (/^(?=.*[a-z])(?=.*\d).{6,}$/.test(pw))
    return { label: "Medium", color: "#fbbf24", width: "60%" };
  return { label: "Weak",   color: "#f87171", width: "30%" };
}

function ResetForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams?.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!token) setError("Invalid or missing reset link. Please request a new one.");
  }, [token]);

  const strength = strengthOf(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8)    { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)    { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Reset failed."); return; }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a0a08, #111109, #0d0d0a)", fontFamily: C.font }}>
      <div className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: `linear-gradient(${C.accent} 1px, transparent 1px), linear-gradient(90deg, ${C.accent} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />

      <div className="relative z-10 w-full max-w-[360px] px-4">
        <div className="overflow-hidden" style={{ border: `1px solid ${C.border}`, backgroundColor: C.panel }}>
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)` }} />

          <div className="px-6 py-7 space-y-5">

            {/* Icon + Title */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center border-2"
                style={{ borderColor: success ? "#34d399" : error && !token ? "#f87171" : C.accent, backgroundColor: success ? "#34d39910" : `${C.accent}10` }}>
                {success
                  ? <CheckCircle2 className="size-6" style={{ color: "#34d399" }} />
                  : error && !token
                  ? <AlertCircle  className="size-6" style={{ color: "#f87171" }} />
                  : <Lock         className="size-6" style={{ color: C.accent }} />}
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-widest" style={{ color: "#fff" }}>
                  {success ? "Password Reset!" : "Set New Password"}
                </h1>
                <p className="text-[11px] mt-1" style={{ color: C.dim }}>
                  {success
                    ? "Your password has been updated. Redirecting to login…"
                    : "Choose a strong password for your account."}
                </p>
              </div>
            </div>

            {/* Error state (bad/missing token) */}
            {error && !token && (
              <div className="px-4 py-3 border" style={{ borderColor: "#f8717130", backgroundColor: "#f8717108" }}>
                <p className="text-[11px] text-center" style={{ color: "#f87171" }}>{error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="space-y-3">
                <div className="px-4 py-3 border" style={{ borderColor: "#34d39930", backgroundColor: "#34d39908" }}>
                  <p className="text-[11px] text-center font-mono" style={{ color: "#34d399" }}>
                    ✓ Password updated successfully
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-[10px]" style={{ color: C.dim }}>
                  <Loader2 className="size-3 animate-spin" />
                  Redirecting to login…
                </div>
              </div>
            )}

            {/* Form */}
            {!success && token && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: "#3a3a28" }} />
                    <input type={showPw ? "text" : "password"} placeholder="Min. 8 characters"
                      value={password} onChange={e => setPassword(e.target.value)} required autoFocus
                      className="w-full pl-10 pr-10 h-11 text-sm focus:outline-none"
                      style={{ backgroundColor: "#0d0d0b", border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: "#3a3a28" }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                      onMouseLeave={e => (e.currentTarget.style.color = "#3a3a28")}>
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {password && (
                    <div className="space-y-1">
                      <div className="h-1 w-full" style={{ backgroundColor: C.muted }}>
                        <div className="h-1 transition-all" style={{ width: strength.width, backgroundColor: strength.color }} />
                      </div>
                      <p className="text-[9px] font-bold uppercase" style={{ color: strength.color }}>{strength.label}</p>
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: "#3a3a28" }} />
                    <input type={showPw ? "text" : "password"} placeholder="Repeat password"
                      value={confirm} onChange={e => setConfirm(e.target.value)} required
                      className="w-full pl-10 h-11 text-sm focus:outline-none"
                      style={{
                        backgroundColor: "#0d0d0b",
                        border: `1px solid ${confirm && password !== confirm ? "#f87171" : C.border}`,
                        color: C.text, fontFamily: C.font,
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = confirm && password !== confirm ? "#f87171" : C.border)} />
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-[10px]" style={{ color: "#f87171" }}>Passwords do not match</p>
                  )}
                </div>

                {/* API error */}
                {error && token && (
                  <div className="flex items-start gap-2 px-3 py-2 border" style={{ borderColor: "#f8717130", backgroundColor: "#f8717108" }}>
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" style={{ color: "#f87171" }} />
                    <p className="text-[10px]" style={{ color: "#f87171" }}>{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading || !password || !confirm || password !== confirm}
                  className="w-full h-11 text-sm font-black tracking-widest uppercase disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity"
                  style={{ background: "linear-gradient(135deg, #e8630a, #ff8c42)", color: "#fff" }}>
                  {loading ? <><Loader2 className="size-4 animate-spin" /> Resetting…</> : "Reset Password →"}
                </button>
              </form>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-t"
            style={{ borderColor: "#1a1a12", backgroundColor: "#0d0d0b" }}>
            <span className="text-[9px] uppercase tracking-wider" style={{ color: "#253040" }}>IT Portal</span>
            <div className="flex items-center gap-1">
              <ShieldCheck className="size-3" style={{ color: "#253040" }} />
              <span className="text-[9px]" style={{ color: "#253040" }}>Secured by JWT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
