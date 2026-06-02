"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowLeft, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";

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

export default function ForgotPasswordPage() {
  const router  = useRouter();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true); // always show success (prevents enumeration)
    } catch {
      setError("Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a0a08, #111109, #0d0d0a)", fontFamily: C.font }}>

      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: `linear-gradient(${C.accent} 1px, transparent 1px), linear-gradient(90deg, ${C.accent} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />

      <div className="relative z-10 w-full max-w-[360px] px-4">

        {/* Back */}
        <button onClick={() => router.push("/login")}
          className="flex items-center gap-1.5 mb-6 text-[11px] uppercase tracking-wider transition-colors"
          style={{ color: C.dim }}
          onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
          onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
          <ArrowLeft className="size-3.5" /> Back to Login
        </button>

        <div className="overflow-hidden" style={{ border: `1px solid ${C.border}`, backgroundColor: C.panel }}>
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)` }} />

          <div className="px-6 py-7 space-y-5">

            {/* Icon + Title */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center border-2"
                style={{ borderColor: C.accent, backgroundColor: `${C.accent}10` }}>
                {sent
                  ? <CheckCircle2 className="size-6" style={{ color: "#34d399" }} />
                  : <Mail className="size-6" style={{ color: C.accent }} />}
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-widest" style={{ color: "#fff" }}>
                  {sent ? "Check Your Email" : "Forgot Password"}
                </h1>
                <p className="text-[11px] mt-1" style={{ color: C.dim }}>
                  {sent
                    ? "We sent a reset link to your email. It expires in 30 minutes."
                    : "Enter your registered email to receive a reset link."}
                </p>
              </div>
            </div>

            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: "#3a3a28" }} />
                    <input type="email" placeholder="you@ecoshift.com" value={email}
                      onChange={e => setEmail(e.target.value)} required autoFocus
                      className="w-full pl-10 h-11 text-sm focus:outline-none"
                      style={{ backgroundColor: "#0d0d0b", border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                  </div>
                  {error && (
                    <p className="text-[10px]" style={{ color: "#f87171" }}>{error}</p>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="w-full h-11 text-sm font-black tracking-widest uppercase disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                  style={{ background: "linear-gradient(135deg, #e8630a, #ff8c42)", color: "#fff" }}>
                  {loading
                    ? <><Loader2 className="size-4 animate-spin" /> Sending…</>
                    : "Send Reset Link →"}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="px-4 py-3 border" style={{ borderColor: "#34d39930", backgroundColor: "#34d39908" }}>
                  <p className="text-[11px] text-center font-mono" style={{ color: "#34d399" }}>
                    Sent to: <span className="font-bold">{email}</span>
                  </p>
                </div>
                <p className="text-[10px] text-center" style={{ color: C.muted }}>
                  Didn&apos;t receive it? Check your spam folder or{" "}
                  <button onClick={() => setSent(false)}
                    className="transition-colors underline" style={{ color: C.dim }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                    try again
                  </button>.
                </p>
                <button onClick={() => router.push("/login")}
                  className="w-full h-10 text-xs font-bold uppercase tracking-wider border transition-all"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  ← Back to Login
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-t"
            style={{ borderColor: "#1a1a12", backgroundColor: "#0d0d0b" }}>
            <span className="text-[9px] uppercase tracking-wider" style={{ color: "#253040" }}>IT Portal</span>
            <div className="flex items-center gap-1">
              <ShieldCheck className="size-3" style={{ color: "#253040" }} />
              <span className="text-[9px]" style={{ color: "#253040" }}>Secure Reset</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
