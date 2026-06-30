import { NextRequest, NextResponse } from "next/server";

const WMS_API = process.env.NEXT_PUBLIC_WMS_API_BASE_URL || "https://unis.item.com/api";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  try {
    const params = await ctx.params;
    const path = (params.path || []).join("/");
    const upstreamUrl = new URL(`${WMS_API.replace(/\/$/, "")}/${path}`);
    req.nextUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));

    const headers = new Headers();
    for (const key of ["authorization", "content-type", "x-tenant-id", "x-facility-id", "item-time-zone"]) {
      const value = req.headers.get(key);
      if (value) headers.set(key, value);
    }

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
    return NextResponse.json({ error: "wms_proxy_failed", message: error instanceof Error ? error.message : "Unknown WMS proxy error" }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> | { path: string[] } }) { return proxy(req, ctx); }
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> | { path: string[] } }) { return proxy(req, ctx); }
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> | { path: string[] } }) { return proxy(req, ctx); }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> | { path: string[] } }) { return proxy(req, ctx); }
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> | { path: string[] } }) { return proxy(req, ctx); }
