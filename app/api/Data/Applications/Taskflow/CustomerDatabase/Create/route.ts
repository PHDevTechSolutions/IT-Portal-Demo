import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

// Ensure TASKFLOW_DB_URL is defined
const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

// Create a reusable Neon database connection function
const Xchire_sql = neon(Xchire_databaseUrl);

async function create(
    referenceid: string,
    manager: string,
    tsm: string,
    company_name: string, 
    contact_person: string,
    contact_number: string,
    email_address: string,
    type_client: string,
    company_group: string,
    address: string,
    delivery_address: string,
    region: string,
    status: string,
) {
    try {
        if (!company_name || !type_client) {
            throw new Error("Company Name and Type of Client are required.");
        }

        const Xchire_insert = await Xchire_sql`
            INSERT INTO accounts (referenceid, manager, tsm, company_name, contact_person, contact_number, email_address, type_client, company_group, address, delivery_address, region, status, date_created) 
            VALUES (${referenceid}, ${manager}, ${tsm}, ${company_name}, ${contact_person}, ${contact_number}, ${email_address}, ${type_client}, ${company_group}, ${address}, ${delivery_address}, ${region}, ${status}, NOW()) 
            RETURNING *;
        `;

        return { success: true, data: Xchire_insert };
    } catch (error: any) {
        console.error("Error inserting task:", error);
        return { success: false, error: error.message || "Failed to add task." };
    }
}

export async function POST(req: Request) {
    try {
        // Ensure request body is valid JSON
        const Xchire_body = await req.json();
        const { referenceid, manager, tsm, company_name, contact_person, contact_number, email_address, type_client, company_group, address, delivery_address, region, status } = Xchire_body;

        // Call the addUser function
        const Xchire_result = await create(referenceid, manager, tsm, company_name, contact_person, contact_number, email_address, type_client, company_group, address, delivery_address, region, status);

        // Return response
        return NextResponse.json(Xchire_result);
    } catch (Xchire_error: any) {
        console.error("Error in POST /api/addTask:", Xchire_error);
        return NextResponse.json(
            { success: false, error: Xchire_error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
