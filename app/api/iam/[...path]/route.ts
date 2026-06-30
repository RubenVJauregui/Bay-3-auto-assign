import { NextRequest, NextResponse } from "next/server";

const IAM_URL = process.env.NEXT_PUBLIC_IAM_BASE_URL || "https://id.item.com";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  try {
    const params = await ctx.params;
    const path = (params.path || []).join("/");
    const upstreamUrl = new URL(`${IAM_URL.replace(/\/$/, "")}/${path}`);
    req.nextUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));

    const headers = new Headers();
    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);

    const method = req.method.toUpperCase();
    const body = method === "GET" || method === "HEAD" ? undefined : await req.text();
    const res = await fetch(upstreamUrl.toString(), { method, headers, body, cache: "no-store" });
    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "iam_proxy_failed", message: error instanceof Error ? error.message : "Unknown IAM proxy error" }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> | { path: string[] } }) { return proxy(req, ctx); }
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> | { path: string[] } }) { return proxy(req, ctx); }
