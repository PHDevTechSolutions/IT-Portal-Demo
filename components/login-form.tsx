"use client";

/**
 * LoginForm - Sci-Fi Edition
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

import { ShieldCheck, Mail, Lock, Loader2, Cpu, Fingerprint, ScanFace } from "lucide-react";
import { authenticateWithBiometric, isBiometricAvailable } from "@/lib/utils/biometric";

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
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  const router = useRouter();
  const { setUserId } = useUser();

  // Check if biometric is available on mount
  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const available = await isBiometricAvailable();
        console.log("Biometric available:", available); // Debug log
        setBiometricAvailable(available);
      } catch (error) {
        console.error("Error checking biometric availability:", error);
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
        // Provide a stable device ID so the existing login endpoint continues
        // to work without breaking changes.  We no longer store userId, but
        // the endpoint still expects a deviceId field.
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

        // Keep userId in context for compatibility with components that still
        // reference it during this transition — but do NOT put it in the URL.
        if (result.userId) {
          setUserId(result.userId);
          // Also save to localStorage for account page
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

  // Post-login redirect
  const handlePostLogin = async (_location: unknown) => {
    setShowLocationDialog(false);
    setLoadingRedirect(true);
    router.push("/dashboard");
  };

  // Biometric login handler
  const handleBiometricLogin = useCallback(async () => {
    if (!Email) {
      toast.error("Please enter your email first");
      return;
    }

    setLoading(true);
    try {
      // First, we need to get the userId from the email
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

      // Now authenticate with biometric
      const result = await authenticateWithBiometric(userId);

      if (result.success) {
        toast.success("Biometric authentication successful");
        if (result.userId) {
          setUserId(result.userId);
          // Also save to localStorage for account page
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
      <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#050a14]" {...props}>
        {/* Animated background grid - full screen coverage */}
        <div className="absolute inset-0 h-full w-full">
          <div 
            className="h-full w-full opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(rgba(6, 182, 212, 0.15) 1px, transparent 1px),
                linear-gradient(90deg, rgba(6, 182, 212, 0.15) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
              backgroundRepeat: 'repeat'
            }}
          />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400/60 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${5 + Math.random() * 10}s linear infinite`,
                animationDelay: `${Math.random() * 5}s`
              }}
            />
          ))}
        </div>

        {/* Main container */}
        <div className="relative z-10 flex w-full items-center justify-center px-6">
          {/* Login form - full width */}
          <div className="w-full max-w-lg">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-pulse" />
              
              <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-8 overflow-hidden">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-32 animate-[scan_4s_linear_infinite]" />
                </div>

                <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-cyan-500/50" />
                <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-cyan-500/50" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-cyan-500/50" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-cyan-500/50" />

                <form onSubmit={handleLoginSubmit} className="relative">
                  <div className="flex flex-col items-center gap-4 text-center mb-8">
                    <div className="relative">
                      <div className="absolute inset-0 bg-cyan-500/30 blur-xl rounded-full animate-pulse" />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                        <Cpu className="h-8 w-8 text-cyan-400" />
                      </div>
                    </div>
                    
                    <div>
                      <h1 className="text-3xl font-bold tracking-wider text-white uppercase">
                        <span className="text-cyan-400">IT</span> PORTAL
                      </h1>
                      <p className="text-cyan-400/60 text-xs tracking-[0.3em] uppercase mt-1">
                        Secure Access Terminal
                      </p>
                    </div>
                  </div>

                  <div className="relative h-px w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent mb-8">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                  </div>

                  <div className="space-y-2 mb-6">
                    <label className="text-xs text-cyan-400/80 uppercase tracking-wider font-medium">
                      Identity Verification
                    </label>
                    <div className="relative group/input">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400/60 group-focus-within/input:text-cyan-400 transition-colors" />
                      <Input
                        type="email"
                        placeholder="Enter credentials..."
                        value={Email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-12 h-12 bg-slate-800/50 border-cyan-500/30 text-cyan-50 placeholder:text-slate-500 rounded-lg focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 mb-8">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-cyan-400/80 uppercase tracking-wider font-medium">
                        Access Code
                      </label>
                      <a
                        href="/auth/forgot-password"
                        className="text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors"
                      >
                        Reset?
                      </a>
                    </div>
                    <div className="relative group/input">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400/60 group-focus-within/input:text-cyan-400 transition-colors" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={Password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-12 h-12 bg-slate-800/50 border-cyan-500/30 text-cyan-50 placeholder:text-slate-500 rounded-lg focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all duration-300 tracking-widest"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 relative group/btn overflow-hidden bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-semibold tracking-wider uppercase rounded-lg border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all duration-300"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                    <span className="relative flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Authenticating...
                        </>
                      ) : (
                        <>
                          <Fingerprint className="h-4 w-4" />
                          Initialize Access
                        </>
                      )}
                    </span>
                  </Button>

                  {/* Biometric Login Button */}
                  {biometricAvailable && (
                    <>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-cyan-500/30" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-slate-900 px-2 text-cyan-400/60">Or</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        disabled={loading}
                        onClick={handleBiometricLogin}
                        variant="outline"
                        className="w-full h-12 relative overflow-hidden bg-slate-800/50 hover:bg-slate-700/50 text-cyan-400 font-semibold tracking-wider uppercase rounded-lg border border-cyan-400/30 hover:border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all duration-300"
                      >
                        <span className="relative flex items-center justify-center gap-2">
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <ScanFace className="h-4 w-4" />
                              Biometric Login
                            </>
                          )}
                        </span>
                      </Button>
                      <p className="text-xs text-cyan-400/40 text-center mt-2">
                        Use fingerprint
                      </p>
                    </>
                  )}

                  <div className="mt-6 flex items-center justify-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-slate-500">SYSTEM ONLINE</span>
                    </div>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-500">V.2.0.6 (Leroux & Xchire)</span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs text-slate-600">
          <span className="font-mono">ENCRYPTION: AES-256</span>
          <span className="w-px h-4 bg-slate-700" />
          <span className="font-mono">PROTOCOL: HTTPS/TLS</span>
          <span className="w-px h-4 bg-slate-700" />
          <span className="font-mono">STATUS: SECURE</span>
        </div>
      </div>

      {/* Location permission dialog - Sci-fi styled */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden max-w-md">
          <div className="absolute top-0 left-0 w-6 h-6 border-l border-t border-cyan-500/50" />
          <div className="absolute top-0 right-0 w-6 h-6 border-r border-t border-cyan-500/50" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-l border-b border-cyan-500/50" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-r border-b border-cyan-500/50" />

          <DialogHeader className="relative text-center pt-4">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative p-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/40">
                  <ShieldCheck className="h-8 w-8 text-cyan-400" />
                </div>
              </div>
            </div>
            <DialogTitle className="text-xl font-bold text-white tracking-wider uppercase">
              Location <span className="text-cyan-400">Protocol</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm mt-2">
              Grant geolocation access for enhanced security tracking and session verification.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="relative mt-6 flex gap-3 px-4 pb-4">
            <Button
              variant="outline"
              className="flex-1 h-11 bg-slate-800/50 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-all"
              onClick={() => handlePostLogin(null)}
            >
              Decline
            </Button>
            <Button
              className="flex-1 h-11 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white border border-cyan-400/50 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
              onClick={async () => {
                const location = await getLocation();
                await handlePostLogin(location);
              }}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Authorize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading overlay */}
      {loadingRedirect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
              <div className="absolute inset-0 blur-xl bg-cyan-500/30 rounded-full" />
            </div>
            <p className="text-cyan-400 text-sm tracking-widest uppercase animate-pulse">
              Establishing Secure Connection...
            </p>
          </div>
        </div>
      )}
    </>
  );
}
