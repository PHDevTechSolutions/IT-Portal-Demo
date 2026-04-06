/**
 * lib/audit/system-audit.ts
 * 
 * Generic audit logging for all system operations (non-customer)
 */

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type SystemAuditAction =
  | "create"
  | "update"
  | "delete"
  | "transfer"
  | "assign"
  | "unassign"
  | "login"
  | "logout"
  | "view"
  | "export"
  | "import"
  | "approve"
  | "reject"
  | "lock"
  | "unlock"
  | "reset_password"
  | "change_role"
  | "change_status"
  | "bulk_create"
  | "bulk_update"
  | "bulk_delete";

export interface AuditActor {
  uid?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  referenceId?: string | null;
  department?: string | null;
}

export interface SystemAuditPayload {
  action: SystemAuditAction;
  module: string;           // e.g., "UserManagement", "ITAssets", "Settings"
  page: string;             // e.g., "/admin/roles", "/stash/inventory"
  resourceType: string;     // e.g., "user", "asset", "role", "permission"
  resourceId?: string | number | null;
  resourceName?: string | null;
  affectedCount?: number;
  
  // For tracking changes (before/after values)
  changes?: Record<string, { before: unknown; after: unknown }> | null;
  
  // For transfers (from/to)
  transfer?: {
    from?: string | null;
    to?: string | null;
    fromId?: string | null;
    toId?: string | null;
  } | null;
  
  // Actor info
  actor: AuditActor;
  
  // Context
  source?: string;          // Component/dialog that triggered action
  ipAddress?: string | null;
  userAgent?: string | null;
  
  // Additional metadata
  metadata?: Record<string, unknown> | null;
  
  // Status for approvals/etc
  status?: "pending" | "approved" | "rejected" | "completed" | "failed" | null;
  remarks?: string | null;
}

export const SYSTEM_AUDITS_COLLECTION = "systemAudits";

/**
 * Log a system audit entry
 */
export async function logSystemAudit(payload: SystemAuditPayload): Promise<void> {
  try {
    await addDoc(collection(db, SYSTEM_AUDITS_COLLECTION), {
      action: payload.action,
      module: payload.module,
      page: payload.page,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId !== undefined && payload.resourceId !== null
        ? String(payload.resourceId)
        : null,
      resourceName: payload.resourceName ?? null,
      affectedCount: payload.affectedCount ?? 1,
      changes: payload.changes ?? null,
      transfer: payload.transfer ?? null,
      
      // Actor info
      actorUid: payload.actor.uid ?? null,
      actorName: payload.actor.name ?? null,
      actorEmail: payload.actor.email ?? null,
      actorRole: payload.actor.role ?? null,
      actorReferenceId: payload.actor.referenceId ?? null,
      actorDepartment: payload.actor.department ?? null,
      
      // Context
      source: payload.source ?? null,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
      
      // Metadata
      metadata: payload.metadata ?? null,
      status: payload.status ?? "completed",
      remarks: payload.remarks ?? null,
      
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("[SystemAudit] Failed to write log:", err);
  }
}

/**
 * Helper to get current user info for audit
 */
export function getCurrentActor(req?: { headers?: { [key: string]: string | string[] | undefined } }): AuditActor {
  // If request object provided, extract from session/headers
  if (req?.headers) {
    const userId = req.headers["x-user-id"] as string | undefined;
    const userEmail = req.headers["x-user-email"] as string | undefined;
    const userRole = req.headers["x-user-role"] as string | undefined;
    
    return {
      uid: userId ?? null,
      email: userEmail ?? null,
      role: userRole ?? null,
    };
  }
  
  // Default empty actor (to be filled by caller)
  return {
    uid: null,
    name: null,
    email: null,
    role: null,
    referenceId: null,
    department: null,
  };
}

/**
 * Build changes object from before/after data
 */
export function buildChanges<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fieldsToTrack: (keyof T)[]
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  
  for (const field of fieldsToTrack) {
    const beforeValue = before[field];
    const afterValue = after[field];
    
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[String(field)] = { before: beforeValue, after: afterValue };
    }
  }
  
  return changes;
}

/**
 * Log user management actions
 */
export async function logUserManagement(
  action: SystemAuditAction,
  userData: { id?: string; email?: string; name?: string; role?: string },
  actor: AuditActor,
  changes?: Record<string, { before: unknown; after: unknown }>,
  source?: string
): Promise<void> {
  await logSystemAudit({
    action,
    module: "UserManagement",
    page: "/admin/roles",
    resourceType: "user",
    resourceId: userData.id ?? null,
    resourceName: userData.name ?? userData.email ?? "Unknown",
    changes,
    actor,
    source: source ?? "UserManagementPage",
    metadata: {
      userEmail: userData.email,
      userRole: userData.role,
    },
  });
}

/**
 * Log IT asset actions
 */
export async function logITAsset(
  action: SystemAuditAction,
  assetData: { id?: string; name?: string; type?: string; serial?: string },
  actor: AuditActor,
  changes?: Record<string, { before: unknown; after: unknown }>,
  transfer?: { from?: string | null; to?: string | null },
  source?: string
): Promise<void> {
  await logSystemAudit({
    action,
    module: "ITAssets",
    page: "/stash/inventory",
    resourceType: "asset",
    resourceId: assetData.id ?? null,
    resourceName: assetData.name ?? assetData.serial ?? "Unknown",
    changes,
    transfer: transfer ? { from: transfer.from, to: transfer.to } : null,
    actor,
    source: source ?? "ITAssetsPage",
    metadata: {
      assetType: assetData.type,
      serialNumber: assetData.serial,
    },
  });
}

/**
 * Log session actions (login/logout)
 */
export async function logSession(
  action: "login" | "logout",
  actor: AuditActor,
  metadata?: { ipAddress?: string; userAgent?: string; success?: boolean; reason?: string }
): Promise<void> {
  await logSystemAudit({
    action,
    module: "Authentication",
    page: "/login",
    resourceType: "session",
    resourceId: actor.uid ?? null,
    resourceName: actor.email ?? null,
    actor,
    ipAddress: metadata?.ipAddress ?? null,
    userAgent: metadata?.userAgent ?? null,
    metadata: {
      success: metadata?.success ?? true,
      reason: metadata?.reason ?? null,
    },
  });
}
