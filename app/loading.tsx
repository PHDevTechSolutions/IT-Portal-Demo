"use client";
import { Terminal } from "lucide-react";

const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  accent: "#e8630a",
  font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

export default function Loading() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ backgroundColor: C.bg, fontFamily: C.font }}
    >
      {/* Dot-grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
          opacity: 0.2,
        }}
      />

      {/* Corner accents */}
      <div className="absolute top-6 left-6 w-6 h-6 border-l-2 border-t-2" style={{ borderColor: C.accent + "60" }} />
      <div className="absolute top-6 right-6 w-6 h-6 border-r-2 border-t-2" style={{ borderColor: C.accent + "60" }} />
      <div className="absolute bottom-6 left-6 w-6 h-6 border-l-2 border-b-2" style={{ borderColor: C.accent + "60" }} />
      <div className="absolute bottom-6 right-6 w-6 h-6 border-r-2 border-b-2" style={{ borderColor: C.accent + "60" }} />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-6">

        {/* Icon box */}
        <div
          className="flex h-16 w-16 items-center justify-center border"
          style={{ borderColor: C.accent + "50", backgroundColor: "rgba(232,99,10,0.08)" }}
        >
          <Terminal className="size-7" style={{ color: C.accent }} />
        </div>

        {/* Spinner ring */}
        <div className="relative flex items-center justify-center">
          <div
            className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: C.accent, borderTopColor: "transparent" }}
          />
          <div
            className="absolute h-6 w-6 rounded-full border border-t-transparent animate-spin"
            style={{
              borderColor: C.dim,
              borderTopColor: "transparent",
              animationDirection: "reverse",
              animationDuration: "0.8s",
            }}
          />
        </div>

        {/* Label */}
        <div className="text-center space-y-1">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.3em] animate-pulse"
            style={{ color: C.accent }}
          >
            Initializing…
          </p>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: C.dim }}>
            Loading modules
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="w-48 h-px overflow-hidden"
          style={{ backgroundColor: C.muted }}
        >
          <div
            className="h-full"
            style={{
              backgroundColor: C.accent,
              animation: "progress-sweep 1.6s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Bottom status strip */}
      <div
        className="absolute bottom-8 flex items-center gap-4 text-[10px] uppercase tracking-widest"
        style={{ color: C.dim }}
      >
        <span>System: Online</span>
        <span className="w-px h-3" style={{ backgroundColor: C.muted }} />
        <span>Status: Loading</span>
      </div>

      <style>{`
        @keyframes progress-sweep {
          0%   { width: 0%;   margin-left: 0%;    }
          50%  { width: 60%;  margin-left: 0%;    }
          100% { width: 0%;   margin-left: 100%;  }
        }
      `}</style>
    </div>
  );
}
