"use client";

/**
 * lib/hooks/useSystemAudit.ts
 * 
 * React hook for system-wide audit logging in components
 */

import { useCallback } from "react";
import { 
  logSystemAudit, 
  logUserManagement, 
  logITAsset, 
  type SystemAuditAction,
  type AuditActor 
} from "@/lib/audit/system-audit";

interface TransferDetail {
  from?: string | null;
  to?: string | null;
  fromId?: string | null;
  toId?: string | null;
}

interface UseSystemAuditOptions {
  actor: AuditActor;
  defaultModule?: string;
  defaultPage?: string;
}

export function useSystemAudit(options: UseSystemAuditOptions) {
  const { actor, defaultModule = "System", defaultPage = "" } = options;

  /**
   * Generic log function for any system action
   */
  const logAction = useCallback(
    async (
      action: SystemAuditAction,
      resourceType: string,
      resourceData: { id?: string | number; name?: string },
      details?: {
        changes?: Record<string, { before: unknown; after: unknown }>;
        transfer?: { from?: string | null; to?: string | null };
        metadata?: Record<string, unknown>;
        source?: string;
        status?: "pending" | "approved" | "rejected" | "completed" | "failed";
        remarks?: string;
      }
    ) => {
      try {
        await logSystemAudit({
          action,
          module: defaultModule,
          page: defaultPage,
          resourceType,
          resourceId: resourceData.id ?? null,
          resourceName: resourceData.name ?? null,
          actor,
          changes: details?.changes ?? null,
          transfer: details?.transfer ?? null,
          metadata: details?.metadata ?? null,
          source: details?.source ?? null,
          status: details?.status ?? "completed",
          remarks: details?.remarks ?? null,
        });
      } catch (error) {
        console.error("[useSystemAudit] Failed to log action:", error);
      }
    },
    [actor, defaultModule, defaultPage]
  );

  /**
   * Log create action
   */
  const logCreate = useCallback(
    async (
      resourceType: string,
      resourceData: { id?: string | number; name?: string },
      metadata?: Record<string, unknown>,
      source?: string
    ) => {
      await logAction(
        "create",
        resourceType,
        resourceData,
        { metadata, source: source ?? "CreateDialog" }
      );
    },
    [logAction]
  );

  /**
   * Log update action with changes
   */
  const logUpdate = useCallback(
    async (
      resourceType: string,
      resourceData: { id?: string | number; name?: string },
      changes: Record<string, { before: unknown; after: unknown }>,
      metadata?: Record<string, unknown>,
      source?: string
    ) => {
      await logAction(
        "update",
        resourceType,
        resourceData,
        { changes, metadata, source: source ?? "EditDialog" }
      );
    },
    [logAction]
  );

  /**
   * Log delete action
   */
  const logDelete = useCallback(
    async (
      resourceType: string,
      resourceData: { id?: string | number; name?: string },
      metadata?: Record<string, unknown>,
      source?: string
    ) => {
      await logAction(
        "delete",
        resourceType,
        resourceData,
        { metadata, source: source ?? "DeleteDialog" }
      );
    },
    [logAction]
  );

  /**
   * Log bulk delete action
   */
  const logBulkDelete = useCallback(
    async (
      resourceType: string,
      count: number,
      metadata?: Record<string, unknown>,
      source?: string
    ) => {
      try {
        await logSystemAudit({
          action: "bulk_delete",
          module: defaultModule,
          page: defaultPage,
          resourceType,
          resourceName: `${count} ${resourceType}s deleted`,
          affectedCount: count,
          actor,
          metadata: metadata ?? null,
          source: source ?? "BulkDeleteDialog",
        });
      } catch (error) {
        console.error("[useSystemAudit] Failed to log bulk delete:", error);
      }
    },
    [actor, defaultModule, defaultPage]
  );

  /**
   * Log transfer action
   */
  const logTransfer = useCallback(
    async (
      resourceType: string,
      resourceData: { id?: string | number; name?: string },
      transfer: TransferDetail,
      metadata?: Record<string, unknown>,
      source?: string
    ) => {
      await logAction(
        "transfer",
        resourceType,
        resourceData,
        { 
          transfer,
          metadata, 
          source: source ?? "TransferDialog" 
        }
      );
    },
    [logAction]
  );

  /**
   * Log assign action (for assets/permissions)
   */
  const logAssign = useCallback(
    async (
      resourceType: string,
      resourceData: { id?: string | number; name?: string },
      assignedTo: { id?: string; name?: string },
      metadata?: Record<string, unknown>,
      source?: string
    ) => {
      await logAction(
        "assign",
        resourceType,
        resourceData,
        { 
          transfer: { to: assignedTo.name, toId: assignedTo.id } as TransferDetail,
          metadata, 
          source: source ?? "AssignDialog" 
        }
      );
    },
    [logAction]
  );

  /**
   * Log role change
   */
  const logRoleChange = useCallback(
    async (
      userData: { id?: string; name?: string; email?: string },
      changes: { before: string; after: string },
      source?: string
    ) => {
      try {
        await logUserManagement(
          "change_role",
          userData,
          actor,
          { role: changes },
          source ?? "RoleChange"
        );
      } catch (error) {
        console.error("[useSystemAudit] Failed to log role change:", error);
      }
    },
    [actor]
  );

  /**
   * Log status change
   */
  const logStatusChange = useCallback(
    async (
      resourceType: string,
      resourceData: { id?: string | number; name?: string },
      changes: { before: string; after: string },
      metadata?: Record<string, unknown>,
      source?: string
    ) => {
      await logAction(
        "change_status",
        resourceType,
        resourceData,
        { 
          changes: { status: changes },
          metadata, 
          source: source ?? "StatusChange" 
        }
      );
    },
    [logAction]
  );

  /**
   * Log import action
   */
  const logImport = useCallback(
    async (
      resourceType: string,
      count: number,
      metadata?: Record<string, unknown>,
      source?: string
    ) => {
      try {
        await logSystemAudit({
          action: "import",
          module: defaultModule,
          page: defaultPage,
          resourceType,
          resourceName: `${count} ${resourceType}s imported`,
          affectedCount: count,
          actor,
          metadata: metadata ?? null,
          source: source ?? "ImportDialog",
        });
      } catch (error) {
        console.error("[useSystemAudit] Failed to log import:", error);
      }
    },
    [actor, defaultModule, defaultPage]
  );

  /**
   * Log export action
   */
  const logExport = useCallback(
    async (
      resourceType: string,
      count: number,
      metadata?: Record<string, unknown>,
      source?: string
    ) => {
      try {
        await logSystemAudit({
          action: "export",
          module: defaultModule,
          page: defaultPage,
          resourceType,
          resourceName: `${count} ${resourceType}s exported`,
          affectedCount: count,
          actor,
          metadata: metadata ?? null,
          source: source ?? "ExportAction",
        });
      } catch (error) {
        console.error("[useSystemAudit] Failed to log export:", error);
      }
    },
    [actor, defaultModule, defaultPage]
  );

  return {
    logAction,
    logCreate,
    logUpdate,
    logDelete,
    logBulkDelete,
    logTransfer,
    logAssign,
    logRoleChange,
    logStatusChange,
    logImport,
    logExport,
  };
}
