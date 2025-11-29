import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

type UpdatePayload = {
    id: string;
    account_reference_number: string;
};

async function bulkUpdateReferenceNumbers(updates: UpdatePayload[]) {
    try {
        if (!updates || updates.length === 0) {
            throw new Error("Updates array is required and cannot be empty.");
        }

        // Run updates sequentially or in parallel
        const results = [];
        for (const u of updates) {
            const res = await Xchire_sql`
        UPDATE accounts
        SET account_reference_number = ${u.account_reference_number},
            date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        WHERE id = ${u.id}
        RETURNING id, account_reference_number;
      `;
            results.push(res);
        }

        // Flatten results because neon returns array per query
        const flattened = results.flat();

        return { success: true, data: flattened };
    } catch (Xchire_error: any) {
        console.error("Error updating reference numbers:", Xchire_error);
        return { success: false, error: Xchire_error.message || "Failed to update reference numbers." };
    }
}

export async function PUT(req: Request) {
    try {
        const Xchire_body = await req.json();
        const { updates } = Xchire_body;

        if (!Array.isArray(updates)) {
            return NextResponse.json({ success: false, error: "Invalid updates payload" }, { status: 400 });
        }

        const Xchire_result = await bulkUpdateReferenceNumbers(updates);

        return NextResponse.json(Xchire_result);
    } catch (Xchire_error: any) {
        console.error(
            "Error in PUT /api/Data/Applications/Taskflow/CustomerDatabase/UpdateReferenceNumbers:",
            Xchire_error
        );
        return NextResponse.json(
            { success: false, error: Xchire_error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
