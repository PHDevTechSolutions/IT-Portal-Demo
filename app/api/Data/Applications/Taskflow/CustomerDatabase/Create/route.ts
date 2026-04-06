import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";
import type { NextRequest } from "next/server";

// Helper to get actor from request headers
function getActorFromRequest(req: NextRequest): AuditActor {
  return {
    uid: req.headers.get("x-user-id") || null,
    email: req.headers.get("x-user-email") || "system",
    role: req.headers.get("x-user-role") || "unknown",
    name: req.headers.get("x-user-name") || null,
  };
}

// Helper to extract IP and User Agent from request
function getRequestContext(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded 
    ? forwarded.split(",")[0].trim() 
    : "unknown"
  
  return {
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || null,
  }
}

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

export async function POST(req: NextRequest) {
    try {
        // Ensure request body is valid JSON
        const Xchire_body = await req.json();
        const { referenceid, manager, tsm, company_name, contact_person, contact_number, email_address, type_client, company_group, address, delivery_address, region, status } = Xchire_body;

        // Call the addUser function
        const Xchire_result = await create(referenceid, manager, tsm, company_name, contact_person, contact_number, email_address, type_client, company_group, address, delivery_address, region, status);

        // Log audit after successful creation
        if (Xchire_result.success) {
            const actor = getActorFromRequest(req);
            const { ipAddress, userAgent } = getRequestContext(req);
            await logSystemAudit({
                action: "create",
                module: "CustomerDatabase",
                page: "/taskflow/customer-database",
                resourceType: "customer",
                resourceId: referenceid,
                resourceName: company_name,
                actor,
                ipAddress,
                userAgent,
                source: "CustomerDatabaseCreateAPI",
                metadata: {
                    manager,
                    tsm,
                    type_client,
                    status,
                },
            });
        }

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
