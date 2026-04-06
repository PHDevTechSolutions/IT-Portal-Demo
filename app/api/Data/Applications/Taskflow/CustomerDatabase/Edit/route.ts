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

export async function PUT(req: NextRequest) {
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

        // Log audit after successful update
        if (Xchire_result.success) {
            const actor = getActorFromRequest(req);
            const { ipAddress, userAgent } = getRequestContext(req);
            await logSystemAudit({
                action: "update",
                module: "CustomerDatabase",
                page: "/taskflow/customer-database",
                resourceType: "customer",
                resourceId: referenceid,
                resourceName: company_name,
                actor,
                ipAddress,
                userAgent,
                source: "CustomerDatabaseEditAPI",
                metadata: {
                    manager,
                    tsm,
                    type_client,
                    status,
                },
            });
        }

        return NextResponse.json(Xchire_result);
    } catch (Xchire_error: any) {
        console.error("Error in PUT /api/edituser:", Xchire_error);
        return NextResponse.json(
            { success: false, error: Xchire_error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
