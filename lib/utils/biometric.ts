"use client";

/**
 * WebAuthn / Biometric Authentication Utility
 * Handles fingerprint/face recognition login using the Web Authentication API
 */

// Check if WebAuthn is supported
export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && 
    window.PublicKeyCredential !== undefined;
}

// Check if biometric authentication is available
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  
  try {
    // Add timeout to prevent infinite loading
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), 3000);
    });
    
    const checkPromise = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    
    const available = await Promise.race([checkPromise, timeoutPromise]);
    return available;
  } catch {
    return false;
  }
}

// Generate a random challenge
function generateChallenge(): Uint8Array {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array;
}

// Convert string to Uint8Array
function stringToBuffer(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to base64url string
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Convert base64url string to Uint8Array
function base64urlToBuffer(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Register biometric credential
export async function registerBiometric(
  userId: string,
  userName: string,
  userDisplayName: string
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  try {
    if (!isWebAuthnSupported()) {
      return { success: false, error: "WebAuthn not supported on this device" };
    }

    const isAvailable = await isBiometricAvailable();
    if (!isAvailable) {
      return { success: false, error: "Biometric authentication not available" };
    }

    // Get registration options from server
    const response = await fetch("/api/auth/biometric/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        userName,
        userDisplayName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || "Failed to get registration options" };
    }

    const options = await response.json();

    // Create credential
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge: base64urlToBuffer(options.challenge) as BufferSource,
      rp: options.rp,
      user: {
        id: base64urlToBuffer(options.user.id) as BufferSource,
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as PublicKeyCredential;

    if (!credential) {
      return { success: false, error: "Failed to create credential" };
    }

    // Send credential to server for verification and storage
    const credentialId = bufferToBase64url(credential.rawId);
    const attestationResponse = credential.response as AuthenticatorAttestationResponse;

    const verifyResponse = await fetch("/api/auth/biometric/verify-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        credentialId,
        clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
        attestationObject: bufferToBase64url(attestationResponse.attestationObject),
      }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return { success: false, error: error.message || "Failed to verify registration" };
    }

    return { success: true, credentialId };
  } catch (error: any) {
    console.error("[Biometric] Registration error:", error);
    return { success: false, error: error.message || "Registration failed" };
  }
}

// Authenticate with biometric
export async function authenticateWithBiometric(
  userId?: string
): Promise<{ success: boolean; userId?: string; token?: string; error?: string }> {
  try {
    if (!isWebAuthnSupported()) {
      return { success: false, error: "WebAuthn not supported on this device" };
    }

    // Get authentication options from server
    const response = await fetch("/api/auth/biometric/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || "Failed to get authentication options" };
    }

    const options = await response.json();

    // If no credentials found
    if (!options.allowCredentials || options.allowCredentials.length === 0) {
      return { success: false, error: "No biometric credentials found. Please register first." };
    }

    // Get credential
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64urlToBuffer(options.challenge) as BufferSource,
      allowCredentials: options.allowCredentials.map((cred: any) => ({
        id: base64urlToBuffer(cred.id) as BufferSource,
        type: "public-key",
      })),
      userVerification: "required",
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }) as PublicKeyCredential;

    if (!assertion) {
      return { success: false, error: "Authentication cancelled or failed" };
    }

    // Send assertion to server for verification
    const assertionResponse = assertion.response as AuthenticatorAssertionResponse;
    const credentialId = bufferToBase64url(assertion.rawId);

    const verifyResponse = await fetch("/api/auth/biometric/verify-authentication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentialId,
        clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
        authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
        signature: bufferToBase64url(assertionResponse.signature),
        userHandle: assertionResponse.userHandle 
          ? bufferToBase64url(assertionResponse.userHandle) 
          : null,
      }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return { success: false, error: error.message || "Authentication failed" };
    }

    const result = await verifyResponse.json();
    return { 
      success: true, 
      userId: result.userId,
      token: result.token,
    };
  } catch (error: any) {
    console.error("[Biometric] Authentication error:", error);
    return { success: false, error: error.message || "Authentication failed" };
  }
}

// Remove biometric credential
export async function removeBiometricCredential(
  credentialId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/auth/biometric/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentialId }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || "Failed to remove credential" };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[Biometric] Remove credential error:", error);
    return { success: false, error: error.message || "Failed to remove credential" };
  }
}

// Get user's biometric credentials
export async function getBiometricCredentials(
  userId: string
): Promise<{ success: boolean; credentials?: Array<{ id: string; createdAt: string; deviceInfo?: string }>; error?: string }> {
  try {
    const response = await fetch(`/api/auth/biometric/credentials?userId=${encodeURIComponent(userId)}`, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || "Failed to get credentials" };
    }

    const data = await response.json();
    return { success: true, credentials: data.credentials };
  } catch (error: any) {
    console.error("[Biometric] Get credentials error:", error);
    return { success: false, error: error.message || "Failed to get credentials" };
  }
}
