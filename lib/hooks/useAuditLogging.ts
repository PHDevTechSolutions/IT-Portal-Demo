"use client";

/**
 * Automated Audit Logging Hooks
 * 
 * Provides automatic audit logging for all CRUD operations.
 */

import { useCallback } from "react";
import { logCustomerAudit } from "@/lib/audit/customer-audit";
import { toast } from "sonner";

// Types
interface AuditActor {
  uid?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  referenceId?: string | null;
}

interface TransferDetail {
  toId?: string | null;
  toName?: string | null;
  fromId?: string | null;
  fromName?: string | null;
}

interface AuditContext {
  page: string;
  source: string;
  bulk?: boolean;
}

interface Customer {
  id: number;
  company_name: string;
  account_reference_number?: string;
  type_client?: string;
  status?: string;
  referenceid?: string;
  tsm?: string;
  manager?: string;
}

// Hook for automated audit logging
export function useAuditLogging(actor: AuditActor) {
  const AUDIT_PAGE = "Customer Database";

  // Log create operation
  const logCreate = useCallback(
    async (
      count: number,
      tsaId: string,
      tsaName: string,
      source: string = "ImportForm"
    ) => {
      try {
        await logCustomerAudit({
          action: "create",
          affectedCount: count,
          customerName: `${count} customers imported`,
          changes: { assigned_tsa: { before: null, after: tsaName } },
          actor,
          context: { page: AUDIT_PAGE, source, bulk: count > 1 },
        });
      } catch (error) {
        console.error("Audit log failed:", error);
      }
    },
    [actor, AUDIT_PAGE]
  );

  // Log delete operation
  const logDelete = useCallback(
    async (customers: Customer[], count: number) => {
      try {
        await Promise.all(
          customers.map((c) =>
            logCustomerAudit({
              action: "delete",
              affectedCount: count,
              customerId: String(c.id),
              customerName: c.company_name,
              actor,
              context: {
                page: AUDIT_PAGE,
                source: "BulkDelete",
                bulk: count > 1,
              },
            })
          )
        );
      } catch (error) {
        console.error("Audit log failed:", error);
      }
    },
    [actor, AUDIT_PAGE]
  );

  // Log transfer operation
  const logTransfer = useCallback(
    async (
      customers: Customer[],
      payload: {
        tsa?: TransferDetail | null;
        tsm?: TransferDetail | null;
        manager?: TransferDetail | null;
      }
    ) => {
      try {
        await Promise.all(
          customers.map((c) =>
            logCustomerAudit({
              action: "transfer",
              affectedCount: customers.length,
              customerId: String(c.id),
              customerName: c.company_name,
              transfer: {
                tsa: payload.tsa
                  ? {
                      toId: payload.tsa.toId,
                      toName: payload.tsa.toName,
                      fromId: payload.tsa.fromId ?? c.referenceid ?? null,
                      fromName: payload.tsa.fromName ?? c.referenceid ?? null,
                    }
                  : null,
                tsm: payload.tsm
                  ? {
                      toName: payload.tsm.toName,
                      fromName: payload.tsm.fromName ?? c.tsm ?? null,
                    }
                  : null,
                manager: payload.manager
                  ? {
                      toName: payload.manager.toName,
                      fromName: payload.manager.fromName ?? c.manager ?? null,
                    }
                  : null,
              },
              actor,
              context: {
                page: AUDIT_PAGE,
                source: "TransferDialog",
                bulk: customers.length > 1,
              },
            })
          )
        );
      } catch (error) {
        console.error("Audit log failed:", error);
      }
    },
    [actor, AUDIT_PAGE]
  );

  // Log auto-generate reference numbers
  const logAutoGenerate = useCallback(
    async (
      customers: Customer[],
      updates: { id: number; account_reference_number: string }[]
    ) => {
      try {
        await Promise.all(
          customers.map((c, i) =>
            logCustomerAudit({
              action: "autoid",
              affectedCount: customers.length,
              customerId: String(c.id),
              customerName: c.company_name,
              changes: {
                account_reference_number: {
                  before: c.account_reference_number || null,
                  after: updates[i]?.account_reference_number || null,
                },
              },
              actor,
              context: {
                page: AUDIT_PAGE,
                source: "AutoGenerateID",
                bulk: customers.length > 1,
              },
            })
          )
        );
      } catch (error) {
        console.error("Audit log failed:", error);
      }
    },
    [actor, AUDIT_PAGE]
  );

  // Log update operation
  const logUpdate = useCallback(
    async (
      customer: Customer,
      changes: Record<string, { before: unknown; after: unknown }>,
      source: string = "EditCustomerDialog"
    ) => {
      try {
        await logCustomerAudit({
          action: "update",
          customerId: String(customer.id),
          customerName: customer.company_name,
          changes,
          actor,
          context: { page: AUDIT_PAGE, source, bulk: false },
        });
      } catch (error) {
        console.error("Audit log failed:", error);
      }
    },
    [actor, AUDIT_PAGE]
  );

  return {
    logCreate,
    logDelete,
    logTransfer,
    logAutoGenerate,
    logUpdate,
  };
}
