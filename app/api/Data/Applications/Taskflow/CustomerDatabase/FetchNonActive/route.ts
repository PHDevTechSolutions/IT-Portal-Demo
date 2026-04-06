import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

export async function GET() {
    try {
        // Fetch only non-Active accounts (case-insensitive)
        const Xchire_fetch = await Xchire_sql`
            SELECT * FROM accounts 
            WHERE LOWER(status) != 'active' 
            ORDER BY date_created DESC;
        `;

        console.log("Fetched non-active accounts:", Xchire_fetch.length);

        return NextResponse.json({ success: true, data: Xchire_fetch }, { status: 200 });
    } catch (Xchire_error: any) {
        console.error("Error fetching non-active accounts:", Xchire_error);
        return NextResponse.json(
            { success: false, error: Xchire_error.message || "Failed to fetch non-active accounts." },
            { status: 500 }
        );
    }
}

export const dynamic = "force-dynamic";
