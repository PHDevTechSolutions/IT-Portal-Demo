import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export interface Contact {
  name:  string;
  phone: string;
  type:  string;
}

export interface Supplier {
  id:            string;
  company:       string;
  supplierBrand: string;
  address:       string;
  country:       string;
  website:       string;
  emails:        string[];
  contacts:      Contact[];
  products:      string[];
  forteProducts: string[];
  certificates:  string[];
  createdAt:     string | null;
  date_updated:  string | null;
}

function toISO(val: any): string | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val?.seconds)             return new Date(val.seconds * 1000).toISOString();
  if (typeof val === "string")  return val;
  return null;
}

function toStr(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val.replace(/^["'\s]+|["'\s]+$/g, "").trim();
  if (Array.isArray(val))      return val.length > 0 ? toStr(val[0]) : "";
  return String(val).trim();
}

function toArr(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") return [val];
  return [];
}

function toContacts(val: any): Contact[] {
  if (!Array.isArray(val)) return [];
  return val.map((c: any) => ({
    name:  c.name  ?? "",
    phone: c.phone ?? "",
    type:  c.type  ?? "",
  }));
}

// ── Get Firebase DB from Supabase credentials ─────────────────────────────────
async function getFirebaseDB() {
  const { data: creds } = await supabase
    .from("stock_firebase_credentials")
    .select("*").eq("is_active", true)
    .order("updated_at", { ascending: false }).limit(1).single();

  if (!creds) throw new Error("No Firebase credentials configured. Go to Stock → Firebase Credentials to set up.");

  const config = {
    apiKey:            creds.api_key,
    authDomain:        creds.auth_domain,
    projectId:         creds.project_id,
    storageBucket:     creds.storage_bucket     || "",
    messagingSenderId: creds.messaging_sender_id || "",
    appId:             creds.app_id              || "",
  };

  const appName = `stock-${config.projectId}`;
  const app     = getApps().find(a => a.name === appName) ?? initializeApp(config, appName);
  return { db: getFirestore(app), collectionName: creds.collection_name || "suppliers" };
}

// GET /api/stock/suppliers
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const search  = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const country = searchParams.get("country")?.trim() ?? "";

    const { db, collectionName } = await getFirebaseDB();
    const snap = await getDocs(query(collection(db, collectionName), orderBy("company", "asc")));

    let suppliers: Supplier[] = snap.docs.map(doc => {
      const d = doc.data();
      // website can be array ["url"] or string
      const websiteRaw = d.website ?? d.websites ?? "";
      // address: prefer addresses array first item, fallback to address string
      const addressRaw = d.address ?? (Array.isArray(d.addresses) && d.addresses.length > 0 ? d.addresses[0] : "");
      // country: prefer country string, fallback to countries array first item
      const countryRaw = d.country ?? (Array.isArray(d.countries) && d.countries.length > 0 ? d.countries[0] : "");

      return {
        id:            doc.id,
        company:       toStr(d.company),
        supplierBrand: toStr(d.supplierBrand ?? d.supplierbrandId ?? ""),
        address:       toStr(addressRaw),
        country:       toStr(countryRaw),
        website:       toStr(websiteRaw),
        emails:        toArr(d.emails),
        contacts:      toContacts(d.contacts),
        products:      toArr(d.products),
        forteProducts: toArr(d.forteProducts),
        certificates:  toArr(d.certificates),
        createdAt:     toISO(d.createdAt),
        date_updated:  toISO(d.date_updated ?? d.updatedAt),
      };
    });

    if (country) suppliers = suppliers.filter(s => s.country.toLowerCase().includes(country.toLowerCase()));
    if (search)  suppliers = suppliers.filter(s =>
      s.company.toLowerCase().includes(search) ||
      s.supplierBrand.toLowerCase().includes(search) ||
      s.country.toLowerCase().includes(search) ||
      s.address.toLowerCase().includes(search) ||
      s.products.some(p => p.toLowerCase().includes(search)) ||
      s.contacts.some(c => c.name.toLowerCase().includes(search))
    );

    return NextResponse.json({ success: true, data: suppliers, total: suppliers.length });
  } catch (err: any) {
    console.error("[Suppliers]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
