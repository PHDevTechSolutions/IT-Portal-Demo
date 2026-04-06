// ─────────────────────────────────────────────────────────────────────────────
// DEPLOY THIS FILE TO:
//   app/api/Data/Applications/Taskflow/CustomerDatabase/ParkByReferenceId/route.ts
//
// The folder name must be:  ParkByReferenceId
// The file name must be:    route.ts
//
// This is a Next.js App Router route handler.
// The pages/api directory will NOT pick this up — it must live under app/api.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

/**
 * PUT /api/Data/Applications/Taskflow/CustomerDatabase/ParkByReferenceId
 *
 * Bidirectional cascade between /admin/roles and /taskflow/customer-database.
 *
 *   TSA set to Inactive | Terminated | Resigned  →  their customers become "park"
 *   TSA set back to Active                        →  their customers become "Active"
 *
 * Body: { referenceId: string, targetStatus: "park" | "Active" }
 *
 * Guard rule:
 *   - Parking   only touches rows currently status = 'Active'
 *   - Restoring only touches rows currently status = 'park'
 *
 * Rows in any other status (Inactive, Non-Buying, etc.) are never touched.
 */
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { referenceId, targetStatus } = body;

        if (!referenceId || typeof referenceId !== "string" || !referenceId.trim()) {
            return NextResponse.json(
                { success: false, error: "referenceId is required." },
                { status: 400 }
            );
        }

        const allowed = ["park", "Active"];
        if (!targetStatus || !allowed.includes(targetStatus)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `targetStatus must be one of: ${allowed.join(", ")}`,
                },
                { status: 400 }
            );
        }

        /**
         * Only update rows whose CURRENT status is the logical opposite:
         *   parking   → only rows with status = 'Active'
         *   restoring → only rows with status = 'park'
         *
         * This prevents accidentally overwriting Inactive / Non-Buying /
         * Transferred etc. records that belong to the same TSA.
         */
        const requiredCurrentStatus = targetStatus === "park" ? "Active" : "park";

        const updated = await Xchire_sql`
            UPDATE accounts
            SET
                status       = ${targetStatus},
                date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
            WHERE referenceid = ${referenceId.trim()}
              AND status      = ${requiredCurrentStatus}
            RETURNING id, company_name, referenceid, status;
        `;

        const verb = targetStatus === "park" ? "parked" : "restored to Active";

        return NextResponse.json(
            {
                success: true,
                message: `${updated.length} customer(s) ${verb}.`,
                data: updated,
            },
            { status: 200 }
        );
    } catch (err: any) {
        console.error("[ParkByReferenceId] Error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to update customers." },
            { status: 500 }
        );
    }
}