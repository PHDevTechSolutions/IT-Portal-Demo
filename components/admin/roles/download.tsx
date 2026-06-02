"use client";

import React from "react";
import { Loader2, X, FileText } from "lucide-react";

/* ─── SpinnerItem ────────────────────────────────────────────────── */

interface SpinnerItemProps {
  currentBytes: number;
  totalBytes:   number;
  fileCount:    number;
  onCancel?:    () => void;
}

export function SpinnerItem({
  currentBytes, totalBytes, fileCount, onCancel,
}: SpinnerItemProps) {
  const fmt = (b: number) =>
    b < 1024       ? `${b} B` :
    b < 1024 ** 2  ? `${(b / 1024).toFixed(1)} KB` :
                     `${(b / 1024 ** 2).toFixed(2)} MB`;

  const pct = totalBytes > 0
    ? Math.min(100, Math.round((currentBytes / totalBytes) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-2 w-full"
      style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>

      {/* Top row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center border"
            style={{ borderColor: "#1a2535", backgroundColor: "#0d1117" }}>
            <FileText className="size-3.5" style={{ color: "#e8630a" }} />
          </div>
          <div>
            <p className="text-[11px] font-bold" style={{ color: "#c8d8e8" }}>
              Exporting {fileCount} record{fileCount !== 1 ? "s" : ""}
            </p>
            <p className="text-[9px]" style={{ color: "#4a6070" }}>
              {fmt(currentBytes)} / {fmt(totalBytes)}
            </p>
          </div>
        </div>

        {onCancel && (
          <button onClick={onCancel}
            className="flex items-center justify-center h-5 w-5 shrink-0 border transition-colors"
            style={{ borderColor: "#1a2535", color: "#4a6070" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a2535"; e.currentTarget.style.color = "#4a6070"; }}>
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden" style={{ backgroundColor: "#1a2535" }}>
        <div className="h-full transition-all duration-150"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #e8630a, #ff8c42)" }} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[9px]" style={{ color: "#4a6070" }}>{pct}% complete</span>
        <div className="flex items-center gap-1">
          <Loader2 className="size-2.5 animate-spin" style={{ color: "#e8630a" }} />
          <span className="text-[9px]" style={{ color: "#4a6070" }}>Processing…</span>
        </div>
      </div>
    </div>
  );
}
