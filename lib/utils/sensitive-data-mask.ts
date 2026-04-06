/**
 * lib/utils/sensitive-data-mask.ts
 * 
 * Utility to mask sensitive data in audit logs
 */

export const SENSITIVE_FIELDS = [
  "password",
  "passwordHash",
  "apiKey",
  "apiSecret",
  "secretKey",
  "token",
  "accessToken",
  "refreshToken",
  "authToken",
  "jwt",
  "creditCard",
  "cvv",
  "ssn",
  "socialSecurity",
  "bankAccount",
  "accountNumber",
  "pin",
  "privateKey",
  "secret",
  "authorization",
  "cookie",
  "sessionId",
];

/**
 * Mask sensitive values in an object
 */
export function maskSensitiveData<T extends Record<string, unknown>>(
  data: T,
  fieldsToMask: string[] = SENSITIVE_FIELDS
): T {
  const masked: Record<string, unknown> = { ...data };

  for (const key of Object.keys(masked)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this field should be masked
    const shouldMask = fieldsToMask.some(
      (field) => lowerKey.includes(field.toLowerCase())
    );

    if (shouldMask) {
      const value = masked[key];
      if (typeof value === "string" && value.length > 0) {
        masked[key] = maskValue(value);
      } else if (value !== null && value !== undefined) {
        masked[key] = "***MASKED***";
      }
    } else if (typeof masked[key] === "object" && masked[key] !== null) {
      // Recursively mask nested objects
      masked[key] = maskSensitiveData(
        masked[key] as Record<string, unknown>,
        fieldsToMask
      );
    }
  }

  return masked as T;
}

/**
 * Mask a single value (show first and last 2 chars)
 */
function maskValue(value: string): string {
  if (value.length <= 4) {
    return "****";
  }
  const first = value.slice(0, 2);
  const last = value.slice(-2);
  return `${first}****${last}`;
}

/**
 * Mask sensitive data in metadata for audit logs
 */
export function maskMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!metadata) return null;
  return maskSensitiveData(metadata);
}

/**
 * Mask sensitive data in changes (before/after values)
 */
export function maskChanges(
  changes: Record<string, { before: unknown; after: unknown }> | null | undefined
): Record<string, { before: unknown; after: unknown }> | null {
  if (!changes) return null;

  const masked: Record<string, { before: unknown; after: unknown }> = {};

  for (const [key, value] of Object.entries(changes)) {
    const lowerKey = key.toLowerCase();
    const shouldMask = SENSITIVE_FIELDS.some((field) =>
      lowerKey.includes(field.toLowerCase())
    );

    if (shouldMask) {
      masked[key] = {
        before: typeof value.before === "string" ? maskValue(value.before) : "***MASKED***",
        after: typeof value.after === "string" ? maskValue(value.after) : "***MASKED***",
      };
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Redact sensitive headers from request/response logs
 */
export function redactSensitiveHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const redacted = { ...headers };
  const sensitiveHeaderPatterns = [
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth",
    "x-token",
  ];

  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveHeaderPatterns.some((pattern) => lowerKey.includes(pattern))) {
      redacted[key] = "***REDACTED***";
    }
  }

  return redacted;
}
