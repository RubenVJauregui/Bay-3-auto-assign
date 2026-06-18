import { NextRequest, NextResponse } from "next/server";

const DASHBOARD_API = "https://wms-valley-view-dashboard-68cacf.coolify.item.pub";

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get("authorization") || "";
    const tenantId = req.headers.get("x-tenant-id") || "";
    const body = await req.json();

    const res = await fetch(`${DASHBOARD_API}/api/dashboard/bay5`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "cache-control": "no-cache",
        authorization,
        "x-tenant-id": tenantId,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "upstream_unavailable" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "proxy_failed" }, { status: 502 });
  }
}
