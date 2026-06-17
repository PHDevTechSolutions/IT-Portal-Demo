import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.TASKFLOW_DB_URL;
if (!databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const sql = neon(databaseUrl);

// Valid columns from the accounts table
const VALID_COLUMNS = [
    'industry', 'status', 'type_client'
];

async function bulkUpdateByReference(updates: any[]) {
    try {
        if (!updates || updates.length === 0) {
            throw new Error("No updates provided.");
        }

        const results = [];
        const errors = [];

        for (const update of updates) {
            const { id, ...fieldsToUpdate } = update;

            if (!id) {
                errors.push({ error: "Missing id", data: update });
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
                errors.push({ error: "No valid columns to update", id });
                continue;
            }

            // Build dynamic SET clause
            const setClauses = Object.keys(validUpdates).map((key, index) => `${key} = $${index + 2}`).join(', ');
            const values = Object.values(validUpdates);
            
            const query = `
                UPDATE accounts
                SET ${setClauses}, date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
                WHERE id = $1
                RETURNING *
            `;

            try {
                const result = await sql(query, [id, ...values]);
                if (result && result.length > 0) {
                    results.push(result[0]);
                } else {
                    errors.push({ error: "Record not found", id });
                }
            } catch (err: any) {
                errors.push({ error: err.message, id });
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
