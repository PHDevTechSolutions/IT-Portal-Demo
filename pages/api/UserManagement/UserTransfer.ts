import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function transferUsers(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const { ids, type, targetId } = req.body;

    // 🔹 Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No user IDs provided." });
    }

    if (!type || !["TSM", "Manager"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid transfer type." });
    }

    if (!targetId) {
      return res.status(400).json({ success: false, message: "No target ID provided." });
    }

    const numericIds = ids.filter((id: any) => !isNaN(Number(id))).map(Number);
    const stringIds = ids.filter((id: any) => isNaN(Number(id)));

    let updateQuery = supabase.from('users').update({
        [type]: targetId,
        updatedAt: new Date()
    });

    if (numericIds.length > 0 && stringIds.length > 0) {
      updateQuery = updateQuery.or(`id.in.(${numericIds.join(',')}),ReferenceID.in.(${stringIds.map(s => `"${s}"`).join(',')})`);
    } else if (numericIds.length > 0) {
      updateQuery = updateQuery.in('id', numericIds);
    } else {
      updateQuery = updateQuery.in('ReferenceID', stringIds);
    }

    const { error } = await updateQuery;

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: `Successfully transferred user(s) to ${type}.`,
      modifiedCount: ids.length,
    });
  } catch (error: any) {
    console.error("Error transferring users:", error.message);
    return res.status(500).json({ success: false, message: "Failed to transfer users." });
  }
}
