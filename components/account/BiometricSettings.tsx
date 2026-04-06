"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Fingerprint,
  Shield,
  Smartphone,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  isWebAuthnSupported,
  isBiometricAvailable,
  registerBiometric,
  getBiometricCredentials,
  removeBiometricCredential,
} from "@/lib/utils/biometric";

interface BiometricSettingsProps {
  userId: string;
  userName: string;
  userDisplayName: string;
}

export function BiometricSettings({ userId, userName, userDisplayName }: BiometricSettingsProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [credentials, setCredentials] = useState<Array<{ id: string; createdAt: string; deviceInfo?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
    loadCredentials();
  }, [userId]);

  const checkBiometricSupport = async () => {
    const supported = isWebAuthnSupported();
    setIsSupported(supported);
    
    if (supported) {
      const available = await isBiometricAvailable();
      setIsAvailable(available);
    }
  };

  const loadCredentials = async () => {
    setIsLoading(true);
    try {
      const result = await getBiometricCredentials(userId);
      if (result.success && result.credentials) {
        setCredentials(result.credentials);
      }
    } catch (error) {
      console.error("Failed to load biometric credentials:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      const result = await registerBiometric(userId, userName, userDisplayName);
      
      if (result.success) {
        toast.success("Biometric authentication registered successfully!");
        loadCredentials();
      } else {
        toast.error(result.error || "Failed to register biometric authentication");
      }
    } catch (error) {
      toast.error("An error occurred during registration");
      console.error(error);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRemove = async (credentialId: string) => {
    try {
      const result = await removeBiometricCredential(credentialId);
      
      if (result.success) {
        toast.success("Biometric credential removed");
        loadCredentials();
      } else {
        toast.error(result.error || "Failed to remove credential");
      }
    } catch (error) {
      toast.error("An error occurred while removing the credential");
      console.error(error);
    }
  };

  const getDeviceIcon = (deviceInfo?: string) => {
    if (deviceInfo?.toLowerCase().includes("mobile") || deviceInfo?.toLowerCase().includes("phone")) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Fingerprint className="h-4 w-4" />;
  };

  if (!isSupported) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Biometric Authentication
          </CardTitle>
          <CardDescription>
            WebAuthn is not supported on this browser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">Not Supported</p>
              <p className="text-xs text-muted-foreground">
                Your browser does not support biometric authentication. Please use a modern browser like Chrome, Safari, or Edge.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-muted">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5" />
              Biometric Authentication
            </CardTitle>
            <CardDescription>
              Use your fingerprint or face recognition to log in
            </CardDescription>
          </div>
          <Badge variant={isAvailable ? "default" : "secondary"}>
            {isAvailable ? "Available" : "Checking..."}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {credentials.length > 0 ? "Biometric authentication is active" : "No biometric credentials registered"}
            </p>
            <p className="text-sm text-muted-foreground">
              {credentials.length > 0
                ? `You have ${credentials.length} registered device(s)`
                : "Register your biometric to enable quick and secure login"}
            </p>
          </div>
          {credentials.length > 0 && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
        </div>

        <Separator />

        {/* Registered Devices */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Registered Devices</h4>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No biometric credentials registered yet.
            </p>
          ) : (
            <div className="space-y-2">
              {credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getDeviceIcon(cred.deviceInfo)}
                    <div>
                      <p className="text-sm font-medium">
                        {cred.deviceInfo || "Biometric Device"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(cred.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemove(cred.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Register Button */}
        {isAvailable && (
          <>
            <Separator />
            <Button
              onClick={handleRegister}
              disabled={isRegistering}
              className="w-full"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Register New Biometric
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              You&apos;ll be prompted to verify with your fingerprint or face recognition
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
