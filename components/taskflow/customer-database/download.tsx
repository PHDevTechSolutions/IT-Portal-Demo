"use client";

import React, { useState } from "react";
import { Download as DownloadIcon, Loader2, X, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface DownloadProps {
  data:      any[];
  filename?: string;
}

export const Download: React.FC<DownloadProps> = ({
  data,
  filename = "CustomerDatabase",
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [byteInfo,      setByteInfo]      = useState({ current: 0, total: 0 });
  const [canceled,      setCanceled]      = useState(false);
  const cancelRef = React.useRef(false);

  const fmt = (b: number) =>
    b < 1024      ? `${b} B` :
    b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB` :
                    `${(b / 1024 ** 2).toFixed(2)} MB`;

  const handleDownload = async () => {
    if (!data.length) { toast.error("No data to export."); return; }

    cancelRef.current = false;
    setCanceled(false);
    setProgress(0);
    setIsDownloading(true);

    const headers = [
      "account_reference_number","company_name","contact_person","contact_number",
      "email_address","type_client","address","region","status",
      "company_group","delivery_address","industry",
    ];

    const rows = data.map(c => [
      c.account_reference_number, c.company_name, c.contact_person,
      c.contact_number, c.email_address, c.type_client, c.address,
      c.region, c.status, c.company_group, c.delivery_address, c.industry,
    ]);

    const csvLines = [headers, ...rows].map(row =>
      row.map(cell => `"${cell || ""}"`).join(",")
    );

    const totalBytes = csvLines.reduce((a, r) => a + r.length, 0);
    setByteInfo({ current: 0, total: totalBytes });

    try {
      const built: string[] = [];

      for (let i = 0; i < csvLines.length; i++) {
        if (cancelRef.current) throw new Error("canceled");
        built.push(csvLines[i]);
        const currentBytes = built.join("\n").length;
        setByteInfo({ current: currentBytes, total: totalBytes });
        setProgress(Math.round((currentBytes / totalBytes) * 100));
        if (i % 30 === 0) await new Promise(r => setTimeout(r, 1));
      }

      const blob = new Blob([built.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement("a"), {
        href: url,
        download: `${filename}_${new Date().toISOString().slice(0, 10)}.csv`,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.length} records.`);
    } catch (err: any) {
      if (err.message !== "canceled") toast.error("Export failed.");
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setCanceled(true);
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="flex items-center gap-1.5 h-9 px-3 text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-60"
        style={{
          backgroundColor: "transparent",
          borderColor:     "#1e293b",
          color:           isDownloading ? "#e8630a" : "#94a3b8",
          fontFamily:      "'JetBrains Mono','Fira Code',monospace",
        }}
        onMouseEnter={e => {
          if (!isDownloading) {
            e.currentTarget.style.borderColor     = "rgba(232,99,10,0.4)";
            e.currentTarget.style.color           = "#fb923c";
            e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)";
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor     = "#1e293b";
          e.currentTarget.style.color           = isDownloading ? "#e8630a" : "#94a3b8";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        {isDownloading
          ? <Loader2 className="size-3.5 animate-spin" />
          : <DownloadIcon className="size-3.5" />}
        {isDownloading ? "Exporting…" : "Export"}
      </button>

      {/* ── Progress overlay (bottom-right) ── */}
      {isDownloading && (
        <div
          className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5"
          style={{
            width:           320,
            padding:         "14px 16px",
            backgroundColor: "#0d1117",
            border:          "1px solid #1a2535",
            boxShadow:       "0 8px 32px rgba(0,0,0,0.7)",
            fontFamily:      "'JetBrains Mono','Fira Code',monospace",
          }}
        >
          {/* Top row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center"
                style={{ border: "1px solid #e8630a40", backgroundColor: "rgba(232,99,10,0.1)" }}
              >
                <FileText className="size-4" style={{ color: "#e8630a" }} />
              </div>
              <div>
                <p className="text-[11px] font-bold leading-tight" style={{ color: "#c8d8e8" }}>
                  Exporting {data.length.toLocaleString()} records
                </p>
                <p className="text-[10px] mt-0.5 font-mono" style={{ color: "#4a6070" }}>
                  {fmt(byteInfo.current)} / {fmt(byteInfo.total)}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="flex items-center justify-center h-6 w-6 shrink-0 border transition-colors"
              style={{ borderColor: "#1a2535", color: "#4a6070" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a2535"; e.currentTarget.style.color = "#4a6070"; }}
            >
              <X className="size-3" />
            </button>
          </div>

          {/* Track */}
          <div className="w-full overflow-hidden" style={{ height: 6, backgroundColor: "#1a2535" }}>
            <div
              className="h-full transition-all duration-100"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg,#e8630a,#ff8c42)" }}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono" style={{ color: "#4a6070" }}>
              {progress}% complete
            </span>
            <div className="flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" style={{ color: "#e8630a" }} />
              <span className="text-[10px]" style={{ color: "#4a6070" }}>Processing…</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
