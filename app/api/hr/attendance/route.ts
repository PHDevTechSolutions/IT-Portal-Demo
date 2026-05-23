import { NextRequest, NextResponse } from "next/server";
import { getTaskLogCollection } from "@/lib/mongo/Collections/PantsIn";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const dateFrom = searchParams.get("dateFrom");
    const dateTo   = searchParams.get("dateTo");
    const status   = searchParams.get("status");
    const type     = searchParams.get("type");
    const search   = searchParams.get("search");

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    const collection = await getTaskLogCollection();

    // Build filter
    const filter: Record<string, any> = { archived: { $ne: true } };

    if (dateFrom || dateTo) {
      filter.date_created = {};
      if (dateFrom) filter.date_created.$gte = new Date(dateFrom);
      if (dateTo)   filter.date_created.$lte = new Date(dateTo);
    }
    if (status && status !== "all") filter.Status = { $regex: new RegExp(`^${status}$`, "i") };
    if (type   && type   !== "all") filter.Type   = { $regex: new RegExp(`^${type}$`,   "i") };
    if (search) {
      const re = new RegExp(search, "i");
      filter.$or = [
        { ReferenceID: re },
        { Email:       re },
        { Type:        re },
        { Status:      re },
        { Location:    re },
      ];
    }

    const [data, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ date_created: -1 })
        .skip(from)
        .limit(pageSize)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: data.map(d => ({ ...d, _id: d._id?.toString() })),
      total,
      page,
      pageSize,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
