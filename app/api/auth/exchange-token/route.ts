import { NextRequest, NextResponse } from "next/server";

const IAM_URL = process.env.NEXT_PUBLIC_IAM_BASE_URL || "https://id.item.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${IAM_URL}/auth/exchange-token`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "cache-control": "no-cache",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch {
    return NextResponse.json({ error: "auth_proxy_failed" }, { status: 502 });
  }
}