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

interface SciFiLoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export default function SciFiLoading({ message = "Initializing…", fullScreen = true }: SciFiLoadingProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center ${fullScreen ? "fixed inset-0" : "w-full h-full min-h-[200px]"}`}
      style={{ backgroundColor: fullScreen ? C.bg : "transparent", fontFamily: C.font }}
    >
      {/* Dot-grid (only on full screen) */}
      {fullScreen && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
            opacity: 0.2,
          }}
        />
      )}

      {/* Corner accents (only on full screen) */}
      {fullScreen && (
        <>
          <div className="absolute top-6 left-6 w-6 h-6 border-l-2 border-t-2" style={{ borderColor: C.accent + "60" }} />
          <div className="absolute top-6 right-6 w-6 h-6 border-r-2 border-t-2" style={{ borderColor: C.accent + "60" }} />
          <div className="absolute bottom-6 left-6 w-6 h-6 border-l-2 border-b-2" style={{ borderColor: C.accent + "60" }} />
          <div className="absolute bottom-6 right-6 w-6 h-6 border-r-2 border-b-2" style={{ borderColor: C.accent + "60" }} />
        </>
      )}

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-5">

        {/* Icon box */}
        <div
          className="flex h-14 w-14 items-center justify-center border"
          style={{ borderColor: C.accent + "50", backgroundColor: "rgba(232,99,10,0.08)" }}
        >
          <Terminal className="size-6" style={{ color: C.accent }} />
        </div>

        {/* Spinner */}
        <div className="relative flex items-center justify-center">
          <div
            className="h-9 w-9 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: C.accent, borderTopColor: "transparent" }}
          />
          <div
            className="absolute h-5 w-5 rounded-full border border-t-transparent animate-spin"
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
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] animate-pulse" style={{ color: C.accent }}>
            {message}
          </p>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: C.dim }}>Loading modules</p>
        </div>

        {/* Progress bar */}
        <div className="w-40 h-px overflow-hidden" style={{ backgroundColor: C.muted }}>
          <div
            className="h-full"
            style={{ backgroundColor: C.accent, animation: "progress-sweep 1.6s ease-in-out infinite" }}
          />
        </div>
      </div>

      {/* Bottom strip (full screen only) */}
      {fullScreen && (
        <div
          className="absolute bottom-8 flex items-center gap-4 text-[10px] uppercase tracking-widest"
          style={{ color: C.dim }}
        >
          <span>System: Online</span>
          <span className="w-px h-3" style={{ backgroundColor: C.muted }} />
          <span>Status: Loading</span>
        </div>
      )}

      <style>{`
        @keyframes progress-sweep {
          0%   { width: 0%;   margin-left: 0%;   }
          50%  { width: 60%;  margin-left: 0%;   }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
