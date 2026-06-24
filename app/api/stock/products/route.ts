import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, Timestamp, doc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";

export const dynamic = "force-dynamic";

const firebaseConfig = {
  apiKey: "AIzaSyCNonSOohWCFdgL052XUFFZTH1orbP2dH4",
  authDomain: "taskflow-4605f.firebaseapp.com",
  projectId: "taskflow-4605f",
  storageBucket: "taskflow-4605f.firebasestorage.app",
  messagingSenderId: "558742255762",
  appId: "1:558742255762:web:5725b5c26f1c6fae9e8e4b",
};

function toSerializable(val: any): any {
  if (val === null || val === undefined) return null;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val?.seconds) return new Date(val.seconds * 1000).toISOString();
  if (typeof val === "object" && !Array.isArray(val)) {
    const obj: any = {};
    for (const key in val) {
      obj[key] = toSerializable(val[key]);
    }
    return obj;
  }
  if (Array.isArray(val)) {
    return val.map(toSerializable);
  }
  return val;
}

function fromSerializable(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === "object" && !Array.isArray(val)) {
    const obj: any = {};
    for (const key in val) {
      obj[key] = fromSerializable(val[key]);
    }
    return obj;
  }
  if (Array.isArray(val)) {
    return val.map(fromSerializable);
  }
  return val;
}

async function getFirebaseDB() {
  const appName = "stock-products-all";
  const app = getApps().find(a => a.name === appName) ?? initializeApp(firebaseConfig, appName);
  return { db: getFirestore(app) };
}

export async function GET(req: NextRequest) {
  try {
    const { db } = await getFirebaseDB();
    const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));

    const products = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...toSerializable(data),
      };
    });

    // Get all unique field names across all products
    const allFields = new Set<string>();
    products.forEach(product => {
      Object.keys(product).forEach(key => allFields.add(key));
    });

    return NextResponse.json({ 
      success: true, 
      data: products, 
      fields: Array.from(allFields).sort(),
      total: products.length 
    });
  } catch (err: any) {
    console.error("[Products]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, data } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Product ID is required" }, { status: 400 });

    const { db } = await getFirebaseDB();
    const productRef = doc(db, "products", id);

    // Parse data and add updatedAt
    const parsedData = fromSerializable(data);
    parsedData.updatedAt = Timestamp.now();

    await updateDoc(productRef, parsedData);

    return NextResponse.json({ success: true, message: "Product updated successfully" });
  } catch (err: any) {
    console.error("[Products PATCH]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Product ID is required" }, { status: 400 });

    const { db } = await getFirebaseDB();
    const productRef = doc(db, "products", id);
    await deleteDoc(productRef);

    return NextResponse.json({ success: true, message: "Product deleted successfully" });
  } catch (err: any) {
    console.error("[Products DELETE]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
