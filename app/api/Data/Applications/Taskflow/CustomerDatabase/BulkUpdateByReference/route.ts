import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.TASKFLOW_DB_URL;
if (!databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const sql = neon(databaseUrl);

// Valid columns from the accounts table
const VALID_COLUMNS = [
    'manager', 'tsm', 'company_name', 'contact_person', 'contact_number',
    'email_address', 'address', 'delivery_address', 'region', 'industry',
    'remarks', 'status', 'next_available_date', 'gender', 'type', 'type_client',
    'company_group', 'date_transferred', 'province', 'city', 'date_approved',
    'date_removed', 'transfer_to', 'tin_number', 'reason'
];

async function bulkUpdateByReference(updates: any[]) {
    try {
        if (!updates || updates.length === 0) {
            throw new Error("No updates provided.");
        }

        const results = [];
        const errors = [];

        for (const update of updates) {
            const { account_reference_number, ...fieldsToUpdate } = update;

            if (!account_reference_number) {
                errors.push({ error: "Missing account_reference_number", data: update });
                continue;
            }

            // Filter only valid columns that are present in the update
            const validUpdates: any = {};
            for (const [key, value] of Object.entries(fieldsToUpdate)) {
                if (VALID_COLUMNS.includes(key) && value !== undefined && value !== null && value !== "") {
                    validUpdates[key] = value;
                }
            }

            if (Object.keys(validUpdates).length === 0) {
                errors.push({ error: "No valid columns to update", account_reference_number });
                continue;
            }

            // Build dynamic SET clause
            const setClauses = Object.keys(validUpdates).map((key, index) => `${key} = $${index + 2}`).join(', ');
            const values = Object.values(validUpdates);
            
            const query = `
                UPDATE accounts
                SET ${setClauses}, date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
                WHERE account_reference_number = $1
                RETURNING *
            `;

            try {
                const result = await sql(query, [account_reference_number, ...values]);
                if (result && result.length > 0) {
                    results.push(result[0]);
                } else {
                    errors.push({ error: "Record not found", account_reference_number });
                }
            } catch (err: any) {
                errors.push({ error: err.message, account_reference_number });
            }
        }

        return { 
            success: true, 
            updated: results.length, 
            failed: errors.length,
            results,
            errors
        };
    } catch (error: any) {
        console.error("Error in bulk update by reference:", error);
        return { success: false, error: error.message || "Failed to bulk update." };
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { updates } = body;

        const result = await bulkUpdateByReference(updates);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error in PUT /api/Data/Applications/Taskflow/CustomerDatabase/BulkUpdateByReference:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
