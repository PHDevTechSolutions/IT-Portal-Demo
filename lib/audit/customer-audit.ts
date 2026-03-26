/**
 * lib/audit/customer-audit.ts
 */

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type CustomerAuditAction =
  | "transfer"
  | "create"
  | "update"
  | "delete"
  | "autoid"
  | "audit";

export interface AuditActor {
  uid?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  referenceId?: string | null;
}

/** One entry covers all three fields transferred in a single dialog confirm. */
export interface TransferDetail {
  tsa?: {
    fromId?: string | null;
    fromName?: string | null;
    toId?: string | null;
    toName?: string | null;
  } | null;
  tsm?: { fromName?: string | null; toName?: string | null } | null;
  manager?: { fromName?: string | null; toName?: string | null } | null;
}

export interface CustomerAuditPayload {
  action: CustomerAuditAction;
  affectedCount?: number;
  customerId?: string | number | null;
  customerName?: string | null;
  referenceId?: string | null;
  performedBy?: string | null;
  performedByRole?: string | null;
  auditStatus?: "pending" | "resolved" | "cancelled" | null;
  auditRemarks?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown> | null;
  transfer?: TransferDetail | null;
  changes?: Record<string, { before: unknown; after: unknown }> | null;
  actor: AuditActor;
  context?: { page?: string; source?: string; bulk?: boolean } | null;
}

export const CUSTOMER_AUDITS_COLLECTION = "customerAudits";

export async function logCustomerAudit(
  payload: CustomerAuditPayload,
): Promise<void> {
  try {
    await addDoc(collection(db, CUSTOMER_AUDITS_COLLECTION), {
      ...payload,
      customerId:
        payload.customerId !== undefined && payload.customerId !== null
          ? String(payload.customerId)
          : null,
      transfer: payload.transfer ?? null,
      changes: payload.changes ?? null,
      customerName: payload.customerName ?? null,
      referenceId: payload.referenceId ?? payload.actor.referenceId ?? null,
      performedBy: payload.performedBy ?? payload.actor.uid ?? null,
      performedByRole: payload.performedByRole ?? payload.actor.role ?? null,
      auditStatus: payload.auditStatus ?? "pending",
      auditRemarks: payload.auditRemarks ?? null,
      before: payload.before ?? null,
      after: payload.after ?? null,
      metadata: payload.metadata ?? null,
      affectedCount: payload.affectedCount ?? 1,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("[CustomerAudit] Failed to write log:", err);
  }
}
