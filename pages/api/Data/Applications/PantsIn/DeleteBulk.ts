import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export default async function DeleteBulkOrders(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  const { ids } = req.body as { ids?: string[] };

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: "Missing or invalid ids array",
      received: req.body
    });
  }

  try {
    const db = await connectToDatabase();

    let objectIds: ObjectId[] = [];
    try {
      objectIds = ids.map((id) => new ObjectId(id));
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: "Invalid ObjectId format",
        details: err.message,
        ids
      });
    }

    const result = await db
      .collection("TaskLog")
      .deleteMany({ _id: { $in: objectIds } });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "No documents found for deletion",
        attemptedIds: ids
      });
    }

    return res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      deletedIds: ids
    });

  } catch (err: any) {
    console.error("Bulk delete failed:", err);

    return res.status(500).json({
      success: false,
      error: "Bulk delete failed",
      message: err.message,
      stack: err.stack
    });
  }
}
