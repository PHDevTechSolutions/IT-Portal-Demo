import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";

export default async function updateAccount(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const {
      id,                // ✅ The document _id
      Firstname,
      Lastname,
      Email,
      Department,
      Company,
      Position,
      Role,
      Password,
      Status,
      Manager,
      TSM,
      LoginAttempts,
      TargetQuota,
      LockUntil,
    } = req.body;

    // 🔹 Validate ID
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid or missing user ID." });
    }

    const db = await connectToDatabase();
    const userCollection = db.collection("users");

    // 🔹 Prepare update object
    const updatedUser: any = {
      Firstname,
      Lastname,
      Email,
      Department,
      Company,
      Position,
      Role,
      Status,
      Manager,
      TSM,
      LoginAttempts,
      LockUntil,
      updatedAt: new Date(),
    };

    // 🔹 Only hash new password if provided
    if (Password?.trim()) {
      const hashed = await bcrypt.hash(Password, 10);
      updatedUser.Password = hashed;
    }

    // 🔹 Update document
    const result = await userCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedUser }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: `User not found for ID: ${id}` });
    }

    return res.status(200).json({
      success: true,
      message: "User account updated successfully.",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ success: false, message: "Failed to update user." });
  }
}
