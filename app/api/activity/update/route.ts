import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set");
}
const Xchire_sql = neon(Xchire_databaseUrl);

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log("Updating activity with data:", data);

    const { id, date_updated, ...fields } = data; // exclude date_updated explicitly

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing activity id" },
        { status: 400 }
      );
    }

    const allowedFields = [
      "activitynumber",
      "companyname",
      "contactperson",
      "contactnumber",
      "emailaddress",
      "address",
      "area",
      "typeclient",
      "projectname",
      "projectcategory",
      "projecttype",
      "source",
      "targetquota",
      "activityremarks",
      "ticketreferencenumber",
      "wrapup",
      "inquiries",
      "csragent",
      "activitystatus",
    ];

    const setClauses: string[] = [];
    const values: any[] = [];

    let paramIndex = 1;

    for (const key of allowedFields) {
      if (fields.hasOwnProperty(key)) {
        setClauses.push(`${key} = $${paramIndex++}`);
        values.push(fields[key] ?? null);
      }
    }

    // Always update date_updated to current time
    setClauses.push(`date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'`);

    if (setClauses.length === 1) {
      // Only date_updated present, no fields to update
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    const updateQuery = `
      UPDATE activity
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    values.push(id);

    let updateResult;
    try {
      updateResult = await Xchire_sql(updateQuery, values);
    } catch (dbError: any) {
      console.error("DB error:", dbError);
      return NextResponse.json(
        { success: false, error: dbError.message || "Database error" },
        { status: 500 }
      );
    }

    if (updateResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "No record updated" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, updatedActivity: updateResult[0] },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating activity:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update activity." },
      { status: 500 }
    );
  }
}
