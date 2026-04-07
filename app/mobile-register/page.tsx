"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Fingerprint, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

/**
 * Mobile Registration Landing Page
 * This page opens when user scans QR code from mobile device
 * It attempts to open the mobile app or shows instructions
 */

export default function MobileRegisterPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"checking" | "valid" | "expired" | "invalid">("checking");
  const [sessionData, setSessionData] = useState<{
    sessionId: string | null;
    userId: string | null;
    expires: number;
  }>({
    sessionId: null,
    userId: null,
    expires: 0,
  });

  useEffect(() => {
    const sessionId = searchParams?.get("sessionId");
    const userId = searchParams?.get("userId");
    const expires = searchParams?.get("expires");
    const action = searchParams?.get("action");

    if (!sessionId || !userId || !expires || action !== "biometric_register") {
      setStatus("invalid");
      return;
    }

    const expiryTime = parseInt(expires);
    if (Date.now() > expiryTime) {
      setStatus("expired");
      return;
    }

    setSessionData({
      sessionId,
      userId,
      expires: expiryTime,
    });
    setStatus("valid");

    // Try to open the mobile app automatically
    // This uses a custom URL scheme
    const mobileAppUrl = `itportal://register?sessionId=${sessionId}&userId=${userId}`;
    
    // Attempt to open the app
    window.location.href = mobileAppUrl;
  }, [searchParams]);

  const openMobileApp = () => {
    const { sessionId, userId } = sessionData;
    if (!sessionId || !userId) return;
    
    const mobileAppUrl = `itportal://register?sessionId=${sessionId}&userId=${userId}`;
    window.location.href = mobileAppUrl;
  };

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verifying QR code...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-xl text-red-600">QR Code Expired</CardTitle>
            <CardDescription>
              This QR code has expired. Please go back to the web dashboard and generate a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.close()} variant="outline">
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle className="text-xl text-yellow-600">Invalid QR Code</CardTitle>
            <CardDescription>
              This QR code is invalid or has been tampered with. Please try again with a valid QR code.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.close()} variant="outline">
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Smartphone className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-xl">Register Mobile Device</CardTitle>
          <CardDescription>
            Complete the registration on your mobile device using fingerprint authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <p className="text-sm">
                <strong>Step 1:</strong> Make sure you have the IT Portal Mobile app installed
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Fingerprint className="h-5 w-5 text-blue-500 mt-0.5" />
              <p className="text-sm">
                <strong>Step 2:</strong> Tap the button below to open the app
              </p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <p className="text-sm">
                <strong>Step 3:</strong> Follow the prompts to register your fingerprint
              </p>
            </div>
          </div>

          <Button 
            onClick={openMobileApp} 
            className="w-full"
            size="lg"
          >
            <Fingerprint className="mr-2 h-5 w-5" />
            Open IT Portal Mobile App
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">Don&apos;t have the app yet?</p>
            <p className="text-xs">
              The mobile app is currently in development. You can use the 
              &quot;Register with This Device&quot; option on the web dashboard instead.
            </p>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Session ID: {sessionData.sessionId?.slice(0, 8)}... • Expires in {" "}
              {Math.ceil((sessionData.expires - Date.now()) / 60000)} minutes
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
