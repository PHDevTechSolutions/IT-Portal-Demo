import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabaseDemo } from '@/lib/Demo';

export default async function fetchAccounts(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const db = await connectToDatabaseDemo();
    const Collection = db.collection("inventory");
    const data = await Collection.find({}).toArray();

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch data" });
  }
}
