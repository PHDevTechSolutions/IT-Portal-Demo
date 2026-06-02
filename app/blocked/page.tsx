"use client";

import { ShieldOff, ArrowLeft } from "lucide-react";

export default function BlockedPage() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #0a0a08, #111109, #0d0d0a)",
        fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace",
      }}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(#e8630a 1px, transparent 1px), linear-gradient(90deg, #e8630a 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-4 text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className="flex h-16 w-16 items-center justify-center border-2"
            style={{ borderColor: "#f8717160", backgroundColor: "rgba(248,113,113,0.08)" }}
          >
            <ShieldOff className="size-8" style={{ color: "#f87171" }} />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1
            className="text-base font-black uppercase tracking-widest"
            style={{ color: "#fff" }}
          >
            Access Denied
          </h1>
          <p className="text-[12px]" style={{ color: "#4a6070" }}>
            Your IP address or device is not authorized to access this application.
          </p>
          <p className="text-[11px]" style={{ color: "#253040" }}>
            Contact your IT administrator to request access.
          </p>
        </div>

        {/* Divider */}
        <div
          className="h-px w-full"
          style={{ background: "linear-gradient(90deg, transparent, #1a2535, transparent)" }}
        />

        {/* Info box */}
        <div
          className="px-4 py-3 border text-left space-y-1"
          style={{ borderColor: "#1a2535", backgroundColor: "#0d1117" }}
        >
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "#253040" }}>
            Error Code
          </p>
          <p className="text-[11px] font-mono" style={{ color: "#f87171" }}>
            403 — IP_NOT_WHITELISTED
          </p>
        </div>

        <a
          href="/login"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider transition-colors"
          style={{ color: "#4a6070" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#e8630a")}
          onMouseLeave={e => (e.currentTarget.style.color = "#4a6070")}
        >
          <ArrowLeft className="size-3.5" />
          Back to Login
        </a>
      </div>
    </div>
  );
}
