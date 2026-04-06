import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";

/**
 * PUT /api/UserManagement/UserUpdate
 *
 * Bug fix: only $set fields that are explicitly included in the request body.
 * Previously, undefined/missing fields like Manager, TSM, TargetQuota were
 * being passed as `undefined` inside $set, which overwrites existing values
 * in MongoDB with null/undefined.
 *
 * Fix: build the $set payload selectively — only include keys that are
 * present in the request body.
 */
export default async function updateAccount(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const {
      id,
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
      ManagerName,
      TSM,
      TSMName,
      TargetQuota,
      LoginAttempts,
      LockUntil,
      Directories,
    } = req.body;

    if (!id || !ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing user ID." });
    }

    if (Directories && !Array.isArray(Directories)) {
      return res
        .status(400)
        .json({ success: false, message: "Directories must be an array." });
    }

    const db = await connectToDatabase();
    const userCollection = db.collection("users");

    // Build $set payload selectively — only include fields present in the body.
    // This prevents overwriting existing DB values with undefined/null.
    const setPayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (Firstname !== undefined) setPayload.Firstname = Firstname;
    if (Lastname !== undefined) setPayload.Lastname = Lastname;
    if (Email !== undefined) setPayload.Email = Email;
    if (Department !== undefined) setPayload.Department = Department;
    if (Company !== undefined) setPayload.Company = Company;
    if (Position !== undefined) setPayload.Position = Position;
    if (Role !== undefined) setPayload.Role = Role;
    if (Status !== undefined) setPayload.Status = Status;
    if (Manager !== undefined) setPayload.Manager = Manager;
    if (ManagerName !== undefined) setPayload.ManagerName = ManagerName;
    if (TSM !== undefined) setPayload.TSM = TSM;
    if (TSMName !== undefined) setPayload.TSMName = TSMName;
    if (TargetQuota !== undefined) setPayload.TargetQuota = TargetQuota;
    if (LoginAttempts !== undefined) setPayload.LoginAttempts = LoginAttempts;
    if (LockUntil !== undefined) setPayload.LockUntil = LockUntil;
    if (Directories !== undefined) setPayload.Directories = Directories;

    // Only hash and include password if a non-empty value was sent
    if (Password?.trim()) {
      setPayload.Password = await bcrypt.hash(Password, 10);
    }

    const result = await userCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: setPayload },
    );

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: `User not found for ID: ${id}` });
    }

    return res.status(200).json({
      success: true,
      message: "User account updated successfully.",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update user." });
  }
}
