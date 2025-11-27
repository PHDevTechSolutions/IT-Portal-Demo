import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

async function update(
    id: string, 
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
    status: string
) {
    try {
        if (!id || !company_name) {
            throw new Error("ID and company name are required.");
        }

        const Xchire_update = await Xchire_sql`
            UPDATE accounts 
            SET 
                referenceid = ${referenceid},
                manager = ${manager},
                tsm = ${tsm},
                company_name = ${company_name},
                contact_person = ${contact_person},
                contact_number = ${contact_number},
                email_address = ${email_address},
                type_client = ${type_client},
                company_group = ${company_group},
                address = ${address},
                delivery_address = ${delivery_address},
                region = ${region},
                status = ${status}
            WHERE id = ${id} 
            RETURNING *;
        `;

        return { success: true, data: Xchire_update };
    } catch (Xchire_error: any) {
        console.error("Error updating user:", Xchire_error);
        return { success: false, error: Xchire_error.message || "Failed to update user." };
    }
}

export async function PUT(req: Request) {
    try {
        const Xchire_body = await req.json();
        const { 
            id, 
            referenceid, 
            manager, 
            tsm, 
            company_name, 
            contact_person, 
            contact_number, 
            email_address, 
            type_client, 
            company_group,
            address, 
            delivery_address,
            region, 
            status 
        } = Xchire_body;

        const Xchire_result = await update(
            id, referenceid, manager, tsm, company_name, contact_person, 
            contact_number, email_address, type_client, company_group, address, delivery_address, region, status
        );

        return NextResponse.json(Xchire_result);
    } catch (Xchire_error: any) {
        console.error("Error in PUT /api/edituser:", Xchire_error);
        return NextResponse.json(
            { success: false, error: Xchire_error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
