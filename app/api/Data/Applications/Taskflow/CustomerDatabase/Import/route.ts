import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

function getCompanyInitials(companyName: string): string {
  const words = companyName.trim().split(/\s+/);
  if (words.length === 0) return "XX";

  if (words.length === 1) {
    const first = words[0][0] || "X";
    const last = words[0].slice(-1) || first;
    return (first + last).toUpperCase();
  }

  const firstInitial = words[0][0] || "X";
  const lastInitial = words[words.length - 1][0] || "X";
  return (firstInitial + lastInitial).toUpperCase();
}

async function generateUniqueAccountReferenceNumber(
  sql: any,
  region: string,
  companyName: string
): Promise<string> {
  const initials = getCompanyInitials(companyName);
  const regionCode = region.toUpperCase();

  const result = await sql`
    SELECT MAX(
      CAST(SPLIT_PART(account_reference_number, '-', 3) AS INTEGER)
    ) AS max_number
    FROM accounts
    WHERE account_reference_number LIKE ${initials + "-" + regionCode + "-%"}
  `;

  const maxNumber = result[0]?.max_number || 0;
  const nextNumber = maxNumber + 1;
  const paddedNumber = nextNumber.toString().padStart(7, "0");

  return `${initials}-${regionCode}-${paddedNumber}`;
}

async function create(
  sql: any,
  referenceid: string,
  manager: string,
  tsm: string,
  company_name: string,
  contact_person: string,
  contact_number: string,
  email_address: string,
  type_client: string,
  address: string,
  delivery_address: string,
  region: string,
  status: string,
  industry?: string,
) {
  try {
    const account_reference_number = await generateUniqueAccountReferenceNumber(sql, region, company_name);

    const Xchire_insert = await sql`
      INSERT INTO accounts (
        account_reference_number,
        referenceid,
        manager,
        tsm,
        company_name,
        contact_person,
        contact_number,
        email_address,
        type_client,
        address,
        delivery_address,
        region,
        status,
        industry,
        date_created
      ) VALUES (
        ${account_reference_number},
        ${referenceid},
        ${manager},
        ${tsm},
        ${company_name},
        ${contact_person},
        ${contact_number},
        ${email_address},
        ${type_client},
        ${address},
        ${delivery_address},
        ${region},
        ${status},
        ${industry},
        NOW()
      )
      RETURNING *;
    `;

    return { success: true, data: Xchire_insert };
  } catch (Xchire_error: any) {
    console.error("Error inserting account:", Xchire_error);
    return { success: false, error: Xchire_error.message || "Failed to add account." };
  }
}

export async function POST(req: Request) {
  try {
    const Xchire_body = await req.json();
    const { referenceid, tsm, data } = Xchire_body;

    if (!referenceid || !tsm || !data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing referenceid, tsm, or data." },
        { status: 400 }
      );
    }

    let insertedCount = 0;
    for (const account of data) {
      const Xchire_result = await create(
        Xchire_sql,
        account.referenceid,
        account.manager,
        account.tsm,
        account.company_name,
        account.contact_person,
        account.contact_number,
        account.email_address,
        account.type_client,
        account.address,
        account.delivery_address,
        account.region,
        account.status,
        account.industry
      );

      if (Xchire_result.success) {
        insertedCount++;
      } else {
        console.error("Failed to insert account:", Xchire_result.error);
      }
    }

    return NextResponse.json({
      success: true,
      insertedCount,
      message: `${insertedCount} records imported successfully!`,
    });
  } catch (Xchire_error: any) {
    console.error("Error in POST /api/importAccounts:", Xchire_error);
    return NextResponse.json(
      { success: false, error: Xchire_error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
