"use client";

/**
 * LoginForm
 *
 * Authenticates the user via /api/login (sets HTTP-only cookie).
 * After login, redirects to /dashboard without any userId in the URL.
 * No userId is stored in localStorage — identity comes from the session cookie.
 */

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { ShieldCheck, Mail, LogIn, Loader2 } from "lucide-react";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [Email, setEmail] = useState("");
  const [Password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [loadingRedirect, setLoadingRedirect] = useState(false);

  const router = useRouter();
  const { setUserId } = useUser();

  // ── Location helper ──────────────────────────────────────────────────────────
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
        toast.error("All fields are required!");
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
          toast.error(result.message || "Login failed.");
          setLoading(false);
          return;
        }

        // Keep userId in context for compatibility with components that still
        // reference it during this transition — but do NOT put it in the URL.
        if (result.userId) {
          setUserId(result.userId);
        }

        setShowLocationDialog(true);
      } catch {
        toast.error("Login error occurred.");
      } finally {
        setLoading(false);
      }
    },
    [Email, Password, setUserId],
  );

  // ── Post-login redirect (after location prompt) ──────────────────────────────
  const handlePostLogin = async (_location: unknown) => {
    setShowLocationDialog(false);
    setLoadingRedirect(true);

    // Redirect to dashboard — no userId in the URL
    router.push("/dashboard");
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div {...props}>
        <div className="relative z-10 flex w-full max-w-6xl items-center justify-between gap-12 px-6">
          <Card className="relative w-full max-w-md rounded-3xl border border-white/10 bg-background/70 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-cyan-400/10 pointer-events-none" />
            <CardContent className="relative p-6 md:p-8">
              <form onSubmit={handleLoginSubmit}>
                <FieldGroup>
                  {/* Header */}
                  <div className="flex flex-col items-center gap-3 text-center mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">
                      Secure Login
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      Login to your IT-Portal account
                    </p>
                  </div>

                  {/* Email */}
                  <Field>
                    <FieldLabel>Email</FieldLabel>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="m@itportal.com"
                        value={Email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10 rounded-xl"
                      />
                    </div>
                  </Field>

                  {/* Password */}
                  <Field>
                    <div className="flex items-center">
                      <FieldLabel>Password</FieldLabel>
                      <a
                        href="/auth/forgot-password"
                        className="ml-auto text-sm text-muted-foreground hover:underline"
                      >
                        Forgot?
                      </a>
                    </div>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={Password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="rounded-xl"
                    />
                  </Field>

                  {/* Login Button */}
                  <Field>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 rounded-xl gap-2"
                    >
                      <LogIn className="h-4 w-4" />
                      {loading ? "Signing in..." : "Login"}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          {/* Right: Lottie animation */}
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <iframe
              src="https://lottie.host/embed/14d0ac58-5074-4de2-963e-d30344b286b4/Vof8jxBJol.lottie"
              className="w-full max-w-xl h-[420px] border-none"
            />
          </div>
        </div>
      </div>

      {/* Location permission dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader className="relative text-center">
            <DialogTitle className="text-xl font-semibold">
              Allow Location Access?
            </DialogTitle>
            <div className="flex justify-center my-4">
              <iframe src="https://lottie.host/embed/c0102a6d-479e-40fe-a4db-bc3c5e335d5e/MD9RcmnlT1.lottie" />
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              Your location helps us secure your login and track activity
              safely.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="relative mt-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => handlePostLogin(null)}
            >
              Deny
            </Button>
            <Button
              className="flex-1 rounded-xl gap-2"
              onClick={async () => {
                const location = await getLocation();
                await handlePostLogin(location);
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              Allow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loadingRedirect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Securing your session...
            </p>
          </div>
        </div>
      )}
    </>
  );
}
