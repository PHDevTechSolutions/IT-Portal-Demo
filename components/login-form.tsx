"use client";

/**
 * LoginForm - Terminal Edition (Blackbox-inspired)
 * Authenticates the user via /api/login (sets HTTP-only cookie).
 * After login, redirects to /dashboard without any userId in the URL.
 */

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  ShieldCheck,
  Mail,
  Lock,
  Loader2,
  Fingerprint,
  ScanFace,
  Terminal,
  Circle,
} from "lucide-react";
import {
  authenticateWithBiometric,
  isBiometricAvailable,
} from "@/lib/utils/biometric";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [Email, setEmail] = useState("");
  const [Password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [loadingRedirect, setLoadingRedirect] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const router = useRouter();
  const { setUserId } = useUser();

  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const available = await isBiometricAvailable();
        setBiometricAvailable(available);
      } catch {
        setBiometricAvailable(false);
      }
    };
    checkBiometric();
    // Always show biometric button for testing (remove this line later)
    setBiometricAvailable(true);
  }, []);

  const getLocation = async () => {
    if (!navigator.geolocation) return null;
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject),
      );
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch {
      return null;
    }
  };

  // ── Login ────────────────────────────────────────────────────────────────────
  const handleLoginSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!Email || !Password) {
        toast.error("Authentication credentials required!");
        return;
      }

      setLoading(true);
      try {
        const deviceId =
          localStorage.getItem("deviceId") ??
          (() => {
            const id = crypto.randomUUID();
            localStorage.setItem("deviceId", id);
            return id;
          })();

        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Email, Password, deviceId }),
        });

        const result = await response.json();

        if (!response.ok) {
          toast.error(result.message || "Authentication failed.");
          setLoading(false);
          return;
        }

        if (result.userId) {
          setUserId(result.userId);
          localStorage.setItem("userId", result.userId);
        }

        setShowLocationDialog(true);
      } catch {
        toast.error("System authentication error.");
      } finally {
        setLoading(false);
      }
    },
    [Email, Password, setUserId],
  );

  const handlePostLogin = async (_location: unknown) => {
    setShowLocationDialog(false);
    setLoadingRedirect(true);
    router.push("/dashboard");
  };

  const handleBiometricLogin = useCallback(async () => {
    if (!Email) {
      toast.error("Please enter your email first");
      return;
    }

    setLoading(true);
    try {
      const userLookupResponse = await fetch("/api/auth/biometric/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: Email }),
      });

      if (!userLookupResponse.ok) {
        const error = await userLookupResponse.json();
        toast.error(error.message || "User not found");
        return;
      }

      const userData = await userLookupResponse.json();
      const userId = userData.userId;

      const result = await authenticateWithBiometric(userId);

      if (result.success) {
        toast.success("Biometric authentication successful");
        if (result.userId) {
          setUserId(result.userId);
          localStorage.setItem("userId", result.userId);
        }
        setShowLocationDialog(true);
      } else {
        toast.error(result.error || "Biometric authentication failed");
      }
    } catch (error) {
      console.error("Biometric login error:", error);
      toast.error("Biometric authentication error");
    } finally {
      setLoading(false);
    }
  }, [Email, setUserId]);

  return (
    <>
      {/* ── Full-screen background ── */}
      <div
        className="fixed inset-0 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: "#0d0d0b", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" }}
        {...props}
      >
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: `radial-gradient(circle, #3a3a2e 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Subtle vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
          }}
        />

        {/* ── Center card ── */}
        <div className="relative z-10 w-full max-w-sm px-4">

          {/* Agent status pill */}
          <div className="mb-5 flex items-center gap-2">
            <span
              className="text-[10px] uppercase tracking-[0.2em] font-bold"
              style={{ color: "#e8630a" }}
            >
              AGENT STATUS
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: "#2a2a20" }} />
          </div>

          {/* Status rows */}
          <div
            className="mb-6 rounded-sm border px-4 py-3 space-y-2"
            style={{ borderColor: "#2a2a20", backgroundColor: "#111109" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                <span className="text-xs" style={{ color: "#c8c8b0" }}>
                  IT Portal
                </span>
              </div>
              <span className="text-[10px] font-bold tracking-wider" style={{ color: "#e8630a" }}>
                ONLINE
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                <span className="text-xs" style={{ color: "#c8c8b0" }}>
                  Auth Service
                </span>
              </div>
              <span className="text-[10px] font-bold tracking-wider" style={{ color: "#e8630a" }}>
                READY
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                <span className="text-xs" style={{ color: "#c8c8b0" }}>
                  E2E Encrypted
                </span>
              </div>
              <span className="text-[10px] font-bold tracking-wider" style={{ color: "#e8630a" }}>
                ACTIVE
              </span>
            </div>
          </div>

          {/* Main login card */}
          <div
            className="rounded-sm border overflow-hidden"
            style={{ borderColor: "#2a2a20", backgroundColor: "#111109" }}
          >
            {/* Card header */}
            <div
              className="flex items-center gap-3 px-5 py-4 border-b"
              style={{ borderColor: "#2a2a20", backgroundColor: "#0d0d0b" }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-sm border"
                style={{ borderColor: "#3a3a20", backgroundColor: "#1a1a10" }}
              >
                <Terminal className="h-4 w-4" style={{ color: "#e8630a" }} />
              </div>
              <div>
                <p className="text-sm font-bold tracking-wider text-white uppercase">
                  IT Portal
                </p>
                <p className="text-[10px] tracking-widest" style={{ color: "#5a5a40" }}>
                  Ecoshift ERP · v2.0.6
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 rounded-sm px-2 py-0.5 border" style={{ borderColor: "#3a3a20", backgroundColor: "#1a1a10" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] tracking-wider" style={{ color: "#e8630a" }}>
                  SECURE
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="px-5 py-5 space-y-4">

              {/* Prompt line */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] tracking-widest" style={{ color: "#e8630a" }}>
                  $
                </span>
                <span className="text-[10px] tracking-widest" style={{ color: "#5a5a40" }}>
                  authenticate --user
                </span>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  className="text-[10px] uppercase tracking-[0.15em] font-bold"
                  style={{ color: "#5a5a40" }}
                >
                  // identity
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                    style={{ color: "#4a4a30" }}
                  />
                  <Input
                    type="email"
                    placeholder="user@ecoshift.com"
                    value={Email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-9 h-10 rounded-sm border text-sm focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-200"
                    style={{
                      backgroundColor: "#0d0d0b",
                      borderColor: "#2a2a20",
                      color: "#c8c8b0",
                      outline: "none",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a20")}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className="text-[10px] uppercase tracking-[0.15em] font-bold"
                    style={{ color: "#5a5a40" }}
                  >
                    // access_code
                  </label>
                  <a
                    href="/auth/forgot-password"
                    className="text-[10px] tracking-wider transition-colors"
                    style={{ color: "#4a4a30" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#e8630a")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#4a4a30")}
                  >
                    reset?
                  </a>
                </div>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                    style={{ color: "#4a4a30" }}
                  />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={Password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-9 h-10 rounded-sm border text-sm tracking-widest focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-200"
                    style={{
                      backgroundColor: "#0d0d0b",
                      borderColor: "#2a2a20",
                      color: "#c8c8b0",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a20")}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-sm border text-sm font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  backgroundColor: "#e8630a",
                  borderColor: "#e8630a",
                  color: "#0d0d0b",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = "#ff7a1a";
                    e.currentTarget.style.borderColor = "#ff7a1a";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#e8630a";
                  e.currentTarget.style.borderColor = "#e8630a";
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Fingerprint className="h-3.5 w-3.5" />
                    Initialize Access →
                  </>
                )}
              </button>

              {/* Biometric */}
              {biometricAvailable && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ backgroundColor: "#2a2a20" }} />
                    <span className="text-[10px] tracking-widest" style={{ color: "#3a3a28" }}>
                      OR
                    </span>
                    <div className="flex-1 h-px" style={{ backgroundColor: "#2a2a20" }} />
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleBiometricLogin}
                    className="w-full h-10 rounded-sm border text-sm font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{
                      backgroundColor: "transparent",
                      borderColor: "#2a2a20",
                      color: "#c8c8b0",
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.borderColor = "#e8630a";
                        e.currentTarget.style.color = "#e8630a";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#2a2a20";
                      e.currentTarget.style.color = "#c8c8b0";
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ScanFace className="h-3.5 w-3.5" />
                        Biometric Login
                      </>
                    )}
                  </button>
                </>
              )}
            </form>

            {/* Card footer */}
            <div
              className="flex items-center justify-between px-5 py-3 border-t"
              style={{ borderColor: "#2a2a20", backgroundColor: "#0d0d0b" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1.5 text-[10px] tracking-wider rounded-sm border px-2 py-0.5"
                  style={{ borderColor: "#2a2a20", color: "#5a5a40" }}
                >
                  <ShieldCheck className="h-3 w-3" />
                  E2E Encrypted
                </span>
                <span
                  className="flex items-center gap-1.5 text-[10px] tracking-wider rounded-sm border px-2 py-0.5"
                  style={{ borderColor: "#2a2a20", color: "#5a5a40" }}
                >
                  Multi-Agent
                </span>
              </div>
              <span className="text-[10px]" style={{ color: "#3a3a28" }}>
                Leroux & Xchire
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Location dialog ── */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent
          className="rounded-sm border overflow-hidden max-w-sm"
          style={{
            backgroundColor: "#111109",
            borderColor: "#2a2a20",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          }}
        >
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-4 h-4 border-l border-t" style={{ borderColor: "#e8630a" }} />
          <div className="absolute top-0 right-0 w-4 h-4 border-r border-t" style={{ borderColor: "#e8630a" }} />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-l border-b" style={{ borderColor: "#e8630a" }} />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-r border-b" style={{ borderColor: "#e8630a" }} />

          <DialogHeader className="relative text-center pt-2">
            <div className="flex justify-center mb-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-sm border"
                style={{ borderColor: "#3a3a20", backgroundColor: "#1a1a10" }}
              >
                <ShieldCheck className="h-5 w-5" style={{ color: "#e8630a" }} />
              </div>
            </div>
            <DialogTitle
              className="text-sm font-bold tracking-wider uppercase"
              style={{ color: "#c8c8b0" }}
            >
              Location{" "}
              <span style={{ color: "#e8630a" }}>Protocol</span>
            </DialogTitle>
            <DialogDescription
              className="text-xs mt-1 tracking-wide"
              style={{ color: "#5a5a40" }}
            >
              Grant geolocation access for enhanced security tracking and session verification.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="relative mt-4 flex gap-3 px-2 pb-2">
            <button
              className="flex-1 h-9 rounded-sm border text-xs font-bold tracking-wider uppercase transition-all duration-200"
              style={{ borderColor: "#2a2a20", color: "#5a5a40", backgroundColor: "transparent" }}
              onClick={() => handlePostLogin(null)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#5a5a40";
                e.currentTarget.style.color = "#c8c8b0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#2a2a20";
                e.currentTarget.style.color = "#5a5a40";
              }}
            >
              Decline
            </button>
            <button
              className="flex-1 h-9 rounded-sm border text-xs font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: "#e8630a", borderColor: "#e8630a", color: "#0d0d0b" }}
              onClick={async () => {
                const location = await getLocation();
                await handlePostLogin(location);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#ff7a1a";
                e.currentTarget.style.borderColor = "#ff7a1a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#e8630a";
                e.currentTarget.style.borderColor = "#e8630a";
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Authorize →
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Loading overlay ── */}
      {loadingRedirect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: "rgba(13,13,11,0.95)",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#e8630a" }} />
            <p
              className="text-xs tracking-[0.3em] uppercase animate-pulse"
              style={{ color: "#5a5a40" }}
            >
              Establishing Secure Connection...
            </p>
          </div>
        </div>
      )}
    </>
  );
}
