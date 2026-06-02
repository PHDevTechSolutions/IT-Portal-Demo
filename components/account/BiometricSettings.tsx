"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Fingerprint, Shield, Smartphone, Trash2,
  CheckCircle2, AlertCircle, Loader2, Scan, X,
} from "lucide-react";
import {
  isWebAuthnSupported,
  isBiometricAvailable,
  registerBiometric,
  getBiometricCredentials,
  removeBiometricCredential,
} from "@/lib/utils/biometric";

/* ─── Design tokens (same as account page) ──────────────────────── */
const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  green:  "#34d399",
  yellow: "#fbbf24",
  red:    "#f87171",
  font:   "'JetBrains Mono', 'Fira Code', monospace",
};

interface BiometricSettingsProps {
  userId:          string;
  userName:        string;
  userDisplayName: string;
}

interface Credential {
  id:          string;
  createdAt:   string;
  deviceInfo?: string;
}

export function BiometricSettings({ userId, userName, userDisplayName }: BiometricSettingsProps) {
  const [isSupported,    setIsSupported]    = useState(false);
  const [isAvailable,    setIsAvailable]    = useState(false);
  const [credentials,    setCredentials]    = useState<Credential[]>([]);
  const [isLoading,      setIsLoading]      = useState(false);
  const [isRegistering,  setIsRegistering]  = useState(false);
  const [showRegDialog,  setShowRegDialog]  = useState(false);
  const [showQRDialog,   setShowQRDialog]   = useState(false);
  const [qrData,         setQrData]         = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  useEffect(() => {
    const check = async () => {
      const supported = isWebAuthnSupported();
      setIsSupported(supported);
      if (supported) setIsAvailable(await isBiometricAvailable());
    };
    check();
    loadCredentials();
  }, [userId]);

  const loadCredentials = async () => {
    setIsLoading(true);
    try {
      const r = await getBiometricCredentials(userId);
      if (r.success && r.credentials) setCredentials(r.credentials);
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  };

  const handleRegister = async () => {
    setShowRegDialog(true);
    setIsRegistering(true);
    try {
      const r = await registerBiometric(userId, userName, userDisplayName);
      if (r.success) { toast.success("Biometric registered."); loadCredentials(); }
      else toast.error(r.error || "Registration failed.");
    } catch { toast.error("Registration error."); }
    finally { setIsRegistering(false); setShowRegDialog(false); }
  };

  const handleQRRegister = async () => {
    setIsGeneratingQR(true);
    setShowQRDialog(true);
    try {
      const res  = await fetch("/api/auth/qr/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName, userDisplayName }),
      });
      const data = await res.json();
      if (data.success) {
        setQrData(data.qrData);
        toast.success("Scan QR with your mobile app.");
        pollQR(data.sessionId);
      } else {
        toast.error(data.error || "Failed to generate QR.");
        setShowQRDialog(false);
      }
    } catch { toast.error("QR generation error."); setShowQRDialog(false); }
    finally { setIsGeneratingQR(false); }
  };

  const pollQR = (sessionId: string) => {
    let attempts = 0;
    const iv = setInterval(async () => {
      attempts++;
      if (attempts > 60) { clearInterval(iv); toast.error("QR expired."); setShowQRDialog(false); return; }
      try {
        const r = await fetch(`/api/auth/qr/register?sessionId=${sessionId}`);
        const d = await r.json();
        if (d.status === "completed") {
          clearInterval(iv);
          toast.success("Biometric registered via mobile.");
          setShowQRDialog(false);
          loadCredentials();
        }
      } catch { /* ignore */ }
    }, 5000);
  };

  const handleRemove = async (id: string) => {
    try {
      const r = await removeBiometricCredential(id);
      if (r.success) { toast.success("Credential removed."); loadCredentials(); }
      else toast.error(r.error || "Remove failed.");
    } catch { toast.error("Remove error."); }
  };

  /* ─── Not supported ── */
  if (!isSupported) {
    return (
      <div className="border" style={{ borderColor: C.border, backgroundColor: C.panel }}>
        <div className="px-4 py-3 border-b flex items-center gap-2"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <Fingerprint className="size-3.5" style={{ color: C.accent }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
            Biometric Authentication
          </span>
        </div>
        <div className="p-4 flex items-center gap-3">
          <AlertCircle className="size-4 shrink-0" style={{ color: C.yellow }} />
          <div>
            <p className="text-[11px] font-bold" style={{ color: C.text }}>Not Supported</p>
            <p className="text-[10px] mt-0.5" style={{ color: C.dim }}>
              WebAuthn is not supported on this browser. Use Chrome, Safari, or Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Main UI ── */
  return (
    <>
      <div className="border" style={{ borderColor: C.border, backgroundColor: C.panel, fontFamily: C.font }}>

        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center gap-2"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <Fingerprint className="size-3.5" style={{ color: C.accent }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
            Biometric Authentication
          </span>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border"
            style={{
              borderColor: isAvailable ? C.green + "40" : C.border,
              color:       isAvailable ? C.green : C.dim,
              backgroundColor: isAvailable ? C.green + "10" : "transparent",
            }}>
            {isAvailable ? "Available" : "Checking…"}
          </span>
        </div>

        <div className="p-4 space-y-4">

          {/* Status banner */}
          <div className="flex items-center gap-3 p-3 border"
            style={{ borderColor: credentials.length > 0 ? C.green + "30" : C.border,
              backgroundColor: credentials.length > 0 ? C.green + "08" : "transparent" }}>
            <div className="flex h-9 w-9 items-center justify-center border shrink-0"
              style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <Shield className="size-4" style={{ color: credentials.length > 0 ? C.green : C.dim }} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold" style={{ color: C.text }}>
                {credentials.length > 0 ? "Biometric authentication is active" : "No credentials registered"}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: C.dim }}>
                {credentials.length > 0
                  ? `${credentials.length} registered device${credentials.length > 1 ? "s" : ""}`
                  : "Register a device for quick and secure login"}
              </p>
            </div>
            {credentials.length > 0 && (
              <CheckCircle2 className="size-4 shrink-0" style={{ color: C.green }} />
            )}
          </div>

          {/* Registered devices */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
              Registered Devices
            </p>
            {isLoading ? (
              <div className="flex items-center gap-2 py-3" style={{ color: C.dim }}>
                <Loader2 className="size-3.5 animate-spin" />
                <span className="text-[10px]">Loading credentials…</span>
              </div>
            ) : credentials.length === 0 ? (
              <p className="text-[10px] py-2" style={{ color: C.dim }}>
                No biometric credentials registered yet.
              </p>
            ) : (
              credentials.map(cred => (
                <div key={cred.id} className="flex items-center justify-between p-3 border"
                  style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <div className="flex items-center gap-2.5">
                    {cred.deviceInfo?.toLowerCase().includes("mobile")
                      ? <Smartphone className="size-3.5 shrink-0" style={{ color: C.dim }} />
                      : <Fingerprint className="size-3.5 shrink-0" style={{ color: C.dim }} />}
                    <div>
                      <p className="text-[11px] font-bold" style={{ color: C.text }}>
                        {cred.deviceInfo || "Biometric Device"}
                      </p>
                      <p className="text-[10px]" style={{ color: C.dim }}>
                        Added {new Date(cred.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleRemove(cred.id)}
                    className="flex items-center justify-center h-7 w-7 border transition-colors"
                    style={{ borderColor: C.red + "40", color: C.red, backgroundColor: "transparent" }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.red + "10"; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Register buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {isAvailable && (
              <button onClick={handleRegister} disabled={isRegistering}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                style={{ backgroundColor: C.accent, borderColor: C.accent, color: "#fff" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#ff7a1a"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.accent; }}>
                {isRegistering ? <Loader2 className="size-3 animate-spin" /> : <Fingerprint className="size-3" />}
                {isRegistering ? "Registering…" : "Register This Device"}
              </button>
            )}
            <button onClick={handleQRRegister} disabled={isGeneratingQR}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
              style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              {isGeneratingQR ? <Loader2 className="size-3 animate-spin" /> : <Smartphone className="size-3" />}
              {isGeneratingQR ? "Generating QR…" : "Register via Mobile"}
            </button>
          </div>

          <p className="text-[9px] text-center" style={{ color: C.dim }}>
            Use device biometrics or scan QR with your mobile app
          </p>
        </div>
      </div>

      {/* ── WebAuthn dialog ── */}
      {showRegDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(8,13,18,0.85)", fontFamily: C.font }}>
          <div className="w-full max-w-sm border p-6 space-y-5 text-center"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Scan className="size-4" style={{ color: C.accent }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                  Register Biometric
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative flex items-center justify-center">
                <div className="absolute size-16 rounded-full animate-ping opacity-20"
                  style={{ backgroundColor: C.accent }} />
                <Fingerprint className="size-14 relative z-10" style={{ color: C.accent }} />
              </div>
              <p className="text-[11px]" style={{ color: C.dim }}>
                {isRegistering
                  ? "Touch your fingerprint sensor or look at your camera…"
                  : "Registration complete."}
              </p>
              {isRegistering && <Loader2 className="size-5 animate-spin" style={{ color: C.accent }} />}
            </div>
          </div>
        </div>
      )}

      {/* ── QR Code dialog ── */}
      {showQRDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(8,13,18,0.85)", fontFamily: C.font }}>
          <div className="w-full max-w-sm border space-y-0 overflow-hidden"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex items-center gap-2">
                <Smartphone className="size-4" style={{ color: C.accent }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                  Scan with Mobile App
                </span>
              </div>
              <button onClick={() => setShowQRDialog(false)}
                className="flex items-center justify-center h-5 w-5 transition-colors"
                style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = C.red)}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                <X className="size-3" />
              </button>
            </div>
            {/* Body */}
            <div className="flex flex-col items-center gap-4 px-5 py-6">
              {isGeneratingQR ? (
                <Loader2 className="size-12 animate-spin" style={{ color: C.accent }} />
              ) : qrData ? (
                <div className="p-3 border" style={{ borderColor: C.border, backgroundColor: "#fff" }}>
                  <QRCodeSVG value={qrData} size={180} level="H" includeMargin />
                </div>
              ) : (
                <AlertCircle className="size-12" style={{ color: C.yellow }} />
              )}
              <p className="text-[11px] text-center" style={{ color: C.dim }}>
                {isGeneratingQR ? "Generating QR code…" : "Waiting for mobile app to scan…"}
              </p>
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border"
                style={{ borderColor: C.yellow + "40", color: C.yellow, backgroundColor: C.yellow + "10" }}>
                Expires in 5 minutes
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
