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

// 🔍 CHECK IF REFERENCE NUMBER EXISTS IN OTHER ACCOUNTS
async function referenceExists(ref: string, id: string) {
  const result = await Xchire_sql`
    SELECT id 
    FROM accounts 
    WHERE account_reference_number = ${ref}
      AND id <> ${id}
    LIMIT 1;
  `;
  return result.length > 0;
}

// 🔧 AUTO-GENERATE UNIQUE REFERENCE NUMBER
function generateReferenceNumber() {
  return "REF-" + Math.floor(100000 + Math.random() * 900000).toString();
}

// 🔍 CHECK CURRENT ACCOUNT IF MAY EXISTING NA REF
async function hasExistingRef(id: string) {
  const result = await Xchire_sql`
    SELECT account_reference_number 
    FROM accounts 
    WHERE id = ${id}
    LIMIT 1;
  `;

  if (result.length === 0) return false;

  const currentRef = result[0].account_reference_number;

  return currentRef !== null && currentRef !== "" && currentRef.trim() !== "";
}

async function bulkUpdateReferenceNumbers(updates: UpdatePayload[]) {
  try {
    if (!updates || updates.length === 0) {
      throw new Error("Updates array is required and cannot be empty.");
    }

    const results = [];

    for (const u of updates) {
      // ❗ SKIP IF ACCOUNT ALREADY HAS A REFERENCE NUMBER
      const alreadyHasRef = await hasExistingRef(u.id);
      if (alreadyHasRef) {
        // do not update, just return the existing value
        const existing = await Xchire_sql`
          SELECT id, account_reference_number 
          FROM accounts
          WHERE id = ${u.id}
        `;
        results.push(existing);
        continue;
      }

      // ✔ ACCOUNT DOES NOT HAVE REF → GENERATE UNIQUE
      let finalRef = u.account_reference_number;

      // IF REQUESTED REF IS EMPTY → AUTO-GENERATE
      if (!finalRef || finalRef.trim() === "") {
        finalRef = generateReferenceNumber();
      }

      // 🔁 CHECK DUPLICATE → GENERATE UNTIL UNIQUE
      while (await referenceExists(finalRef, u.id)) {
        finalRef = generateReferenceNumber();
      }

      // ✔ UPDATE USING FINAL UNIQUE REFERENCE
      const res = await Xchire_sql`
        UPDATE accounts
        SET account_reference_number = ${finalRef},
            date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        WHERE id = ${u.id}
        RETURNING id, account_reference_number;
      `;

      results.push(res);
    }

    return { success: true, data: results.flat() };
  } catch (err: any) {
    console.error("Error updating reference numbers:", err);
    return {
      success: false,
      error: err.message || "Failed to update reference numbers.",
    };
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { updates } = body;

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { success: false, error: "Invalid updates payload" },
        { status: 400 }
      );
    }

    const result = await bulkUpdateReferenceNumbers(updates);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(
      "Error in PUT /api/Data/Applications/Taskflow/CustomerDatabase/UpdateReferenceNumbers:",
      err
    );

    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
