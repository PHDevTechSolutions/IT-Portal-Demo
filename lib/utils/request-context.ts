/**
 * lib/utils/request-context.ts
 * 
 * Helper to extract request context (IP, User Agent) for audit logging
 */

import { NextRequest } from "next/server";
import { headers } from "next/headers";

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

/**
 * Extract IP address from Next.js request
 * Handles various header formats and proxy scenarios
 */
export function extractIPAddress(req: NextRequest): string | null {
  // Try various headers that might contain the client IP
  const headers = req.headers;
  
  // Common proxy headers (in order of preference)
  const ipHeaders = [
    "x-forwarded-for",
    "x-real-ip",
    "x-client-ip",
    "cf-connecting-ip", // Cloudflare
    "x-forwarded",
    "forwarded-for",
    "forwarded",
    "x-cluster-client-ip",
    "x-originating-ip",
    "x-remote-ip",
    "x-remote-addr",
  ];

  for (const header of ipHeaders) {
    const value = headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2, ...)
      // We want the first one (the actual client)
      const ips = value.split(",").map(ip => ip.trim());
      const clientIP = ips[0];
      
      // Validate IP format (basic check)
      if (clientIP && clientIP !== "unknown" && clientIP !== "::1" && clientIP !== "127.0.0.1") {
        // Remove IPv6 prefix if present
        if (clientIP.startsWith("::ffff:")) {
          return clientIP.substring(7);
        }
        return clientIP;
      }
    }
  }

  // Fallback to socket remote address if available
  // Note: In Next.js, this might not be directly accessible
  return null;
}

/**
 * Extract User Agent from request
 */
export function extractUserAgent(req: NextRequest): string | null {
  return req.headers.get("user-agent") || null;
}

/**
 * Get complete request context for audit logging
 */
export function getRequestContext(req: NextRequest): RequestContext {
  return {
    ipAddress: extractIPAddress(req),
    userAgent: extractUserAgent(req),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Extract headers for passing to API routes
 * Use this when calling APIs from client components
 */
export function getAuditHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    "x-audit-user-agent": navigator.userAgent,
    "x-audit-timestamp": new Date().toISOString(),
  };
}

export async function extractUserAgentFromHeaders(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("user-agent") || null;
}

export async function extractIPAddressFromHeaders(): Promise<string | null> {
  const headersList = await headers();
  
  const ipHeaders = [
    "x-forwarded-for",
    "x-real-ip",
    "x-client-ip",
    "cf-connecting-ip",
    "x-forwarded",
    "forwarded-for",
    "forwarded",
    "x-cluster-client-ip",
    "x-originating-ip",
    "x-remote-ip",
    "x-remote-addr",
  ];

  for (const header of ipHeaders) {
    const value = headersList.get(header);
    if (value) {
      const ips = value.split(",").map(ip => ip.trim());
      const clientIP = ips[0];
      
      if (clientIP && clientIP !== "unknown" && clientIP !== "::1" && clientIP !== "127.0.0.1") {
        if (clientIP.startsWith("::ffff:")) {
          return clientIP.substring(7);
        }
        return clientIP;
      }
    }
  }

  return null;
}
