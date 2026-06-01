import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export interface TechSpec {
  title:                    string;
  technicalSpecificationId: string;
  sortOrder:                number;
  specs:                    { value: string; specId: string }[];
}

export interface ProductFamily {
  productFamilyId:   string;
  productUsageId:    string;
  productFamilyName: string;
}

export interface SPFProduct {
  id:                      string;
  productName:             string;
  productReferenceID:      string;
  productClass:            string;
  pricePoint:              string;
  brandOrigin:             string;
  mainImageUrl:            string;
  categoryTypes:           string[];
  countries:               string[];
  productFamilies:         ProductFamily[];
  technicalSpecifications: TechSpec[];
  dimensionalDrawing:      string;
  illuminanceDrawing:      string;
  supplier:                { supplierId: string; supplierBrand: string; company: string } | null;
  commercialDetails:       any[];
  createdAt:               string | null;
  date_updated:            string | null;
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
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val))      return val.length > 0 ? toStr(val[0]) : "";
  return String(val).trim();
}

function toArr(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") return [val];
  return [];
}

function extractImageUrl(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val.url) return String(val.url);
  if (Array.isArray(val) && val.length > 0) return extractImageUrl(val[0]);
  return "";
}

function toProductFamilies(val: any): ProductFamily[] {
  if (!Array.isArray(val)) return [];
  return val.map((f: any) => ({
    productFamilyId:   f.productFamilyId   ?? "",
    productUsageId:    f.productUsageId    ?? "",
    productFamilyName: f.productFamilyName ?? "",
  }));
}

function toTechSpecs(val: any): TechSpec[] {
  if (!Array.isArray(val)) return [];
  return val.map((t: any) => ({
    title:                    t.title                    ?? "",
    technicalSpecificationId: t.technicalSpecificationId ?? "",
    sortOrder:                t.sortOrder                ?? 0,
    specs: Array.isArray(t.specs)
      ? t.specs.map((s: any) => ({ value: s.value ?? "", specId: s.specId ?? "" }))
      : [],
  })).sort((a, b) => a.sortOrder - b.sortOrder);
}

async function getFirebaseDB() {
  const { data: creds } = await supabase
    .from("stock_firebase_credentials")
    .select("*").eq("is_active", true)
    .order("updated_at", { ascending: false }).limit(1).single();
  if (!creds) throw new Error("No Firebase credentials configured. Go to Stock → Firebase Credentials.");
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
  return { db: getFirestore(app) };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const search      = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const classFilter = searchParams.get("class")?.trim() ?? "";
    const priceFilter = searchParams.get("price")?.trim() ?? "";

    const { db } = await getFirebaseDB();
    const snap = await getDocs(query(collection(db, "products"), orderBy("productName", "asc")));

    let products: SPFProduct[] = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id:                      doc.id,
        productName:             toStr(d.productName),
        productReferenceID:      toStr(d.productReferenceID),
        productClass:            toStr(d.productClass),
        pricePoint:              toStr(d.pricePoint),
        brandOrigin:             toStr(d.brandOrigin),
        mainImageUrl:            extractImageUrl(d.mainImage),
        categoryTypes:           toArr(d.categoryTypes),
        countries:               toArr(d.countries),
        productFamilies:         toProductFamilies(d.productFamilies),
        technicalSpecifications: toTechSpecs(d.technicalSpecifications),
        dimensionalDrawing:      extractImageUrl(d.dimensionalDrawing),
        illuminanceDrawing:      extractImageUrl(d.illuminanceDrawing),
        supplier:                d.supplier ? {
          supplierId:    d.supplier.supplierId    ?? "",
          supplierBrand: d.supplier.supplierBrand ?? "",
          company:       d.supplier.company       ?? "",
        } : null,
        commercialDetails: Array.isArray(d.commercialDetails) ? d.commercialDetails : [],
        createdAt:    toISO(d.createdAt),
        date_updated: toISO(d.date_updated ?? d.updatedAt),
      };
    });

    if (classFilter) products = products.filter(p => p.productClass.toLowerCase() === classFilter.toLowerCase());
    if (priceFilter) products = products.filter(p => p.pricePoint.toLowerCase() === priceFilter.toLowerCase());
    if (search)      products = products.filter(p =>
      p.productName.toLowerCase().includes(search) ||
      p.productReferenceID.toLowerCase().includes(search) ||
      p.productClass.toLowerCase().includes(search) ||
      p.brandOrigin.toLowerCase().includes(search) ||
      p.supplier?.company.toLowerCase().includes(search) ||
      p.productFamilies.some(f => f.productFamilyName.toLowerCase().includes(search))
    );

    return NextResponse.json({ success: true, data: products, total: products.length });
  } catch (err: any) {
    console.error("[SPF Products]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
