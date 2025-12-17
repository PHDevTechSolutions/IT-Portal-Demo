import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

interface BulkUpdateParams {
    userIds: string[];
    status: string;
    updateReferenceIdFromTransferTo?: boolean;
}

async function bulkupdate({
    userIds,
    status,
    updateReferenceIdFromTransferTo = false,
}: BulkUpdateParams) {
    try {
        if (!userIds || userIds.length === 0 || !status) {
            throw new Error("User IDs and status are required.");
        }

        let query;
        if (updateReferenceIdFromTransferTo) {
            // Update status and also set referenceid = transfer_to
            query = await Xchire_sql`
                UPDATE accounts
                SET
                    status = ${status},
                    referenceid = transfer_to,
                    date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
                WHERE id = ANY(${userIds})
                RETURNING *;
            `;
        } else {
            // Only update status
            query = await Xchire_sql`
                UPDATE accounts
                SET
                    status = ${status},
                    date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
                WHERE id = ANY(${userIds})
                RETURNING *;
            `;
        }

        return { success: true, data: query };
    } catch (Xchire_error: any) {
        console.error("Error updating users:", Xchire_error);
        return { success: false, error: Xchire_error.message || "Failed to update users." };
    }
}

export async function PUT(req: Request) {
    try {
        const Xchire_body = await req.json();
        const { userIds, status, updateReferenceIdFromTransferTo } = Xchire_body;

        const Xchire_result = await bulkupdate({
            userIds,
            status,
            updateReferenceIdFromTransferTo,
        });

        return NextResponse.json(Xchire_result);
    } catch (Xchire_error: any) {
        console.error("Error in PUT /api/ModuleSales/UserManagement/CompanyAccounts/Bulk-Edit:", Xchire_error);
        return NextResponse.json(
            { success: false, error: Xchire_error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
