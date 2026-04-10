import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { targetUrl, method = "POST", headers = {}, payload } = body;
    
    console.log("[Proxy] Request received:", { targetUrl, method, headers, payload });
    
    if (!targetUrl) {
      return NextResponse.json(
        { error: "targetUrl is required" },
        { status: 400 }
      );
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      }
    };

    if (method !== "GET" && method !== "HEAD" && payload) {
      fetchOptions.body = JSON.stringify(payload);
    }

    console.log("[Proxy] Fetching:", targetUrl, "with options:", fetchOptions);
    
    const response = await fetch(targetUrl, fetchOptions);
    
    console.log("[Proxy] Response received:", response.status, response.statusText);
    
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries())
    });

  } catch (error: any) {
    console.error("[Proxy] Error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Proxy request failed",
        message: error.message,
        stack: error.stack 
      },
      { status: 500 }
    );
  }
}
