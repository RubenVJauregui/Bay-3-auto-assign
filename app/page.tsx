"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const WMS_API = process.env.NEXT_PUBLIC_WMS_API_BASE_URL!;
const IAM_URL = process.env.NEXT_PUBLIC_IAM_BASE_URL!;
const FACILITY_ID = process.env.NEXT_PUBLIC_FACILITY_ID!;
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID!;
const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE!;

const INYARD_CUSTOMERS = [
  "TCL NORTH AMERICA",
  "LENNOX INDUSTRIES INC.",
  "AMIEE LYNN, LNC.",
  "KARAKA, LLC",
  "NZXT",
  "CMPC USA (Cut Paper and Rolls)",
  "WOODY FLAW CREST INC",
  "North Star",
  "CMPC USA",
  "La Jolla",
  "ESI",
  "TPV USA",
  "Gurunanda",
  "the only bean",
];

const PLANNED_ORDER_CUSTOMERS = [
  "TCL NORTH AMERICA",
  "LENNOX INDUSTRIES INC.",
  "AMIEE LYNN, LNC.",
  "NZXT",
  "CMPC USA (Cut Paper and Rolls)",
  "WOODY FLAW CREST INC",
  "North Star",
  "CMPC USA",
  "La Jolla",
  "ESI",
  "TPV USA",
];

const BAY3_ASSIGNEES = [
  "Daniel Beltran",
  "Arnulfo Munguia",
  "Lorenzo Rodriguez",
  "Julio Alvarado",
  "Ramon Sicairos",
  "Renato Rosales",
  "David Martinez",
  "Jose Rosas",
];

interface AssigneeRule {
  patterns: string[];
  assignees: string[];
}

const ASSIGNEE_RULES: AssigneeRule[] = [
  { patterns: ["gurunanda", "gurananda", "guru nanda"], assignees: ["Daniel Beltran", "Arnulfo Munguia", "Lorenzo Rodriguez"] },
  { patterns: ["cmpc usa", "cmpc rolls", "cmpc usa (cut paper and rolls)"], assignees: ["Daniel Beltran", "Julio Alvarado"] },
  { patterns: ["north star"], assignees: ["Daniel Beltran", "Julio Alvarado"] },
  { patterns: ["karaka"], assignees: ["Daniel Beltran", "Lorenzo Rodriguez"] },
  { patterns: ["lennox"], assignees: ["Ramon Sicairos", "Renato Rosales"] },
  { patterns: ["tcl"], assignees: ["David Martinez"] },
  { patterns: ["nzxt"], assignees: ["David Martinez", "Jose Rosas"] },
  { patterns: ["esi"], assignees: ["Jose Rosas"] },
];

const ASSIGNEE_USER_IDS: Record<string, string> = {
  "Daniel Beltran": "1932077596691410945",
  "Arnulfo Munguia": "89",
  "Lorenzo Rodriguez": "1944915385434632193",
  "Julio Alvarado": "4793",
  "Ramon Sicairos": "1015",
  "Renato Rosales": "1944915722677645314",
  "David Martinez": "1562",
  "Jose Rosas": "1912952560211685378",
};

function stableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash);
}

function resolveAssignee(customerName?: string, stableId?: string): string {
  if (!customerName) return "Unassigned";
  const normalized = customerName.toLowerCase().replace(/[.,]/g, "").trim();
  for (const rule of ASSIGNEE_RULES) {
    const matched = rule.patterns.some(
      (p) => normalized.includes(p) || p.includes(normalized)
    );
    if (matched) {
      if (rule.assignees.length === 1) return rule.assignees[0];
      if (stableId) {
        const idx = stableHash(stableId) % rule.assignees.length;
        return rule.assignees[idx];
      }
      return rule.assignees[0];
    }
  }
  return "Unassigned";
}

const REFRESH_INTERVAL_SEC = 300;

interface Receipt {
  id?: string;
  rnId?: string;
  linkedRns?: { id: string; status: string; customerName: string }[];
  containerNo?: string;
  trailerNo?: string;
  customerId?: string;
  customerName?: string;
  inYardTime?: string;
  status?: string;
  appointmentTime?: string;
  assignee?: string;
}

interface Order {
  id?: string;
  customerId?: string;
  customerName?: string;
  poNo?: string;
  referenceNo?: string;
  shipMethod?: string;
  carrierId?: string;
  carrierName?: string;
  scheduleDate?: string;
  mabd?: string;
  createdTime?: string;
  status?: string;
  assignee?: string;
}

interface Customer {
  id: string;
  name: string;
}

type SortDir = "asc" | "desc";

function formatPDT(isoStr?: string): string {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleString("en-US", {
      timeZone: TIMEZONE,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

function timeInYard(isoStr?: string): string {
  if (!isoStr) return "—";
  const ms = Date.now() - new Date(isoStr).getTime();
  if (ms < 0) return "—";
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${mins}m`;
}

function formatDate(isoStr?: string): string {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleDateString("en-US", {
      timeZone: TIMEZONE,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

export default function Bay3Report() {
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SEC);
  const [receiptSort, setReceiptSort] = useState<{ col: string; dir: SortDir }>({ col: "inYardTime", dir: "asc" });
  const [orderSort, setOrderSort] = useState<{ col: string; dir: SortDir }>({ col: "createdTime", dir: "desc" });
  const [orderSearch, setOrderSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [assignStatusMsg, setAssignStatusMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const login = useCallback(async (user: string, pass: string) => {
    setLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch(`${IAM_URL}/auth/exchange-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "password", username: user, password: pass }),
      });
      const data = await res.json();
      if (String(data.code) === "0" && data.data?.access_token) {
        setToken(data.data.access_token);
        localStorage.setItem("bay3_token", data.data.access_token);
      } else {
        setAuthError("Invalid credentials. Please try again.");
      }
    } catch {
      setAuthError("Unable to connect to authentication service.");
    } finally {
      setLoggingIn(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("bay3_token");
    if (saved) {
      setToken(saved);
    } else {
      setLoading(false);
    }
  }, []);

  const apiFetch = useCallback(async (path: string, body: object) => {
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`${WMS_API}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": TENANT_ID,
        "X-Facility-ID": FACILITY_ID,
        "Item-Time-Zone": TIMEZONE,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) {
      setToken(null);
      localStorage.removeItem("bay3_token");
      throw new Error("Session expired");
    }
    if (!res.ok) throw new Error("Data temporarily unavailable");
    return res.json();
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setDataError(null);
    try {
      const nameMatchesScope = (name: string, scope: string[]) => {
        const n = name.toLowerCase().replace(/[.,]/g, "").trim();
        return scope.some((t) => {
          const tl = t.toLowerCase().replace(/[.,]/g, "").trim();
          return n === tl || n.includes(tl) || tl.includes(n);
        });
      };

      // Hardcoded Bay 3 customer org ID -> display name map (discovered from ET receipts)
      const CUSTOMER_ID_MAP: Record<string, string> = {
        "ORG-34818": "NZXT",
        "ORG-40858": "CMPC USA (Cut Paper and Rolls)",
        "ORG-614843": "CMPC USA INC",
        "ORG-754962": "LENNOX INDUSTRIES INC.",
        "ORG-436686": "NORTH STAR CONTAINER, LLC",
        "ORG-313396": "LA JOLLA GROUP",
        "ORG-639212": "WOODY FLAW CREST INC",
        "ORG-655875": "GURUNANDA, LLC",
        "ORG-585450": "KARAKA, LLC",
      };

      // Planned order customer IDs (the 11-customer scope, excludes KARAKA/Gurunanda/the only bean)
      const PLANNED_CUSTOMER_IDS = [
        "ORG-34818",   // NZXT
        "ORG-40858",   // CMPC USA (Cut Paper and Rolls)
        "ORG-614843",  // CMPC USA INC
        "ORG-754962",  // LENNOX INDUSTRIES INC.
        "ORG-436686",  // NORTH STAR CONTAINER, LLC
        "ORG-313396",  // LA JOLLA GROUP
        "ORG-639212",  // WOODY FLAW CREST INC
      ];

      const [etRes, orderRes] = await Promise.all([
        apiFetch("/wms-bam/entry-ticket/search-by-paging", {
          statuses: ["Gate Checked In", "Window Checked In", "Dock Checked In", "Waiting"],
          currentPage: 1,
          pageSize: 500,
        }).catch((err) => { console.warn("[Bay3] ET fetch failed:", err.message); return null; }),
        apiFetch("/wms/outbound/order/search-by-paging", {
          status: "PLANNED",
          customerIds: PLANNED_CUSTOMER_IDS,
          currentPage: 1,
          pageSize: 200,
        }).catch((err) => { console.warn("[Bay3] Order fetch failed:", err.message); return null; }),
      ]);

      let apiFailures = 0;
      if (!etRes) apiFailures++;
      if (!orderRes) apiFailures++;

      if (etRes) {
        const items = etRes?.data?.list || [];
        const closedStatuses = new Set(["CLOSED", "FORCE_CLOSED", "TASK_COMPLETED", "CANCELLED"]);

        const fullEts: Receipt[] = [];
        for (const et of (Array.isArray(items) ? items : [])) {
          const etId = (et.id as string) || "";
          const receipts: Array<Record<string, unknown>> = (et.receipts as Array<Record<string, unknown>>) || [];
          const chk = (et.entryTicketCheck as Record<string, unknown>) || {};
          const containers: string[] = (chk.containerNOs as string[]) || [];
          const trailers: string[] = (chk.trailers as string[]) || [];
          // Bay 3 Auto Assign / Section 1: Gurunanda trailer equipment only.
          // Do not show container equipment in these views.
          const trailerEquip = (trailers[0] || "") as string;
          const checkin = (et.checkInStartTime as string) || (et.createdWhen as string) || "";

          if (!trailerEquip) continue;

          const hasFullReceipt = receipts.some(
            (r) => !closedStatuses.has((r.status as string) || "")
          );
          if (!hasFullReceipt) continue;

          const firstFullReceipt = receipts.find(
            (r) => !closedStatuses.has((r.status as string) || "")
          );
          const importedReceipts = receipts.filter(
            (r) => String(r.status || "").trim().toUpperCase() === "IMPORTED"
          );
          const custName = (firstFullReceipt?.customerName as string) || "";
          const displayEquip = trailerEquip;

          if (!displayEquip) continue;
          if (!custName || !nameMatchesScope(custName, ["Gurunanda"])) continue;

          fullEts.push({
            id: etId,
            rnId: (importedReceipts[0]?.id as string) || (firstFullReceipt?.id as string) || "",
            linkedRns: importedReceipts.map((rn) => ({
              id: String(rn.id || ""),
              status: String(rn.status || ""),
              customerName: String(rn.customerName || custName),
            })).filter((rn) => rn.id),
            containerNo: displayEquip,
            customerId: (et.customerIds as string[])?.[0] || "",
            customerName: custName,
            inYardTime: checkin,
            status: (et.status as string) || "",
            assignee: resolveAssignee(custName, etId),
          });
        }
        setReceipts(fullEts);
      } else {
        setReceipts([]);
      }

      if (orderRes) {
        const items = orderRes?.data?.list || orderRes?.data?.content || orderRes?.data?.records || [];

        const scopedOrders: Order[] = (Array.isArray(items) ? items : []).map((o: Record<string, unknown>) => {
          const custId = (o.customerId as string) || "";
          const custName = (o.customerName as string) || CUSTOMER_ID_MAP[custId] || custId;
          return {
            id: (o.id as string) || "",
            customerId: custId,
            customerName: custName,
            poNo: (o.poNo as string) || "",
            referenceNo: (o.referenceNo as string) || "",
            shipMethod: (o.shipMethod as string) || "",
            carrierId: (o.carrierId as string) || "",
            carrierName: (o.carrierName as string) || "",
            scheduleDate: (o.scheduleDate as string) || "",
            mabd: (o.mabd as string) || "",
            createdTime: (o.createdTime as string) || "",
            status: (o.status as string) || "",
            assignee: resolveAssignee(custName, (o.id as string) || ""),
          };
        });

        setOrders(scopedOrders);
      } else {
        setOrders([]);
      }

      if (apiFailures === 2) {
        setDataError("Unable to reach warehouse systems. Please check your connection or sign in again.");
      } else if (apiFailures === 1) {
        setDataError("Some data sources are temporarily unavailable. Partial results shown.");
      }

      setGeneratedAt(new Date());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unable to load data at this time";
      if (msg !== "Session expired") {
        setDataError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [token, apiFetch]);

  useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

  useEffect(() => {
    if (!token) return;
    setCountdown(REFRESH_INTERVAL_SEC);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return REFRESH_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token, fetchData]);

  const sortedReceipts = [...receipts].sort((a, b) => {
    const col = receiptSort.col as keyof Receipt;
    const av = (a[col] || "") as string;
    const bv = (b[col] || "") as string;
    const cmp = av.localeCompare(bv);
    return receiptSort.dir === "asc" ? cmp : -cmp;
  });

  const filteredOrders = orders.filter((o) => {
    if (customerFilter && o.customerName !== customerFilter) return false;
    if (orderSearch) {
      const q = orderSearch.toLowerCase();
      return (
        o.id?.toLowerCase().includes(q) ||
        o.poNo?.toLowerCase().includes(q) ||
        o.referenceNo?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.carrierId?.toLowerCase().includes(q) ||
        o.assignee?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const col = orderSort.col as keyof Order;
    const av = (a[col] || "") as string;
    const bv = (b[col] || "") as string;
    const cmp = av.localeCompare(bv);
    return orderSort.dir === "asc" ? cmp : -cmp;
  });

  const toggleReceiptSort = (col: string) => {
    setReceiptSort((prev) =>
      prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }
    );
  };

  const toggleOrderSort = (col: string) => {
    setOrderSort((prev) =>
      prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }
    );
  };

  const SortArrow = ({ col, sort }: { col: string; sort: { col: string; dir: SortDir } }) => (
    <span className={`sort-arrow ${sort.col === col ? "active" : ""}`}>
      {sort.col === col ? (sort.dir === "asc" ? "▲" : "▼") : "▲"}
    </span>
  );

  const formatCountdown = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ position: "relative", zIndex: 1 }}>
        <div className="w-full max-w-sm p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)", borderRadius: "6px", boxShadow: "var(--shadow-card)", backdropFilter: "blur(12px)" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Bay 3 Dashboard</h1>
          <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "16px" }}>
            Valley View (LT_F1) &mdash; Sign in to view dashboard
          </p>
          {authError && <p style={{ fontSize: "12px", color: "var(--danger)", marginBottom: "12px" }}>{authError}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login(username, password);
            }}
          >
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: "100%", marginBottom: "8px", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px", background: "var(--bg-input)", color: "var(--fg)" }}
              autoComplete="username"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", marginBottom: "14px", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px", background: "var(--bg-input)", color: "var(--fg)" }}
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={loggingIn || !username || !password}
              className="btn-action primary"
              style={{ width: "100%", padding: "10px", fontSize: "13px", opacity: loggingIn || !username || !password ? 0.5 : 1 }}
            >
              {loggingIn ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const uniqueCustomerNames = [
    ...new Set(orders.map((o) => o.customerName).filter(Boolean)),
  ].sort() as string[];

  return (
    <div style={{ maxWidth: "1500px", margin: "0 auto", padding: "12px 20px 30px", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Top Action Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button className="btn-action primary" onClick={() => setAutoAssignOpen(true)}>Auto Suggest</button>
          <button className="btn-action" onClick={() => setAutoAssignOpen(true)}>Auto Assign All</button>
          <button className="btn-action" onClick={() => setAutoAssignOpen(true)}>Autonomous</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button className="btn-action" onClick={() => { setAutoAssignOpen(false); setAssignStatusMsg(null); fetchData(); }}>Refresh</button>
          <button className="btn-action">Download CSV</button>
        </div>
      </div>

      {/* Auto Assign Review Panel */}
      {autoAssignOpen && (() => {
        function getAssigneeOptions(customerName: string): string[] {
          const normalized = customerName.toLowerCase().replace(/[.,]/g, "").trim();
          for (const rule of ASSIGNEE_RULES) {
            const matched = rule.patterns.some((p) => normalized.includes(p) || p.includes(normalized));
            if (matched) return rule.assignees;
          }
          return [];
        }

        const isDropShip = (shipMethod: string) => {
          const s = shipMethod.toLowerCase();
          return s.includes("ds") || s.includes("drop") || s.includes("sp") || s.includes("parcel") || s.includes("small");
        };

        type TaskRow = { workType: string; orderId: string; displayId: string; etId: string; customer: string; status: string; orderType: string; assignee: string; options: string[]; isInyard: boolean; isLiveOutbound: boolean; };
        const taskRows: TaskRow[] = [
          ...receipts.flatMap((r) => {
            const importedRns = (r.linkedRns || []).filter((rn) => String(rn.status || "").trim().toUpperCase() === "IMPORTED");
            return importedRns.map((rn) => ({
              workType: "Inbound / RN",
              orderId: r.id || "—",
              displayId: rn.id || r.rnId || r.id || "—",
              etId: r.id || "",
              customer: rn.customerName || r.customerName || "—",
              status: rn.status || "IMPORTED",
              orderType: "Receipt",
              assignee: r.assignee || "Unassigned",
              options: getAssigneeOptions(rn.customerName || r.customerName || ""),
              isInyard: true,
              isLiveOutbound: false,
            }));
          }),
          ...orders.map((o) => ({
            workType: "Outbound",
            orderId: o.id || "—",
            displayId: o.id || "—",
            etId: "",
            customer: o.customerName || "—",
            status: o.status || "PLANNED",
            orderType: o.shipMethod || "FTL/LTL",
            assignee: o.assignee || "Unassigned",
            options: getAssigneeOptions(o.customerName || ""),
            isInyard: false,
            isLiveOutbound: isDropShip(o.shipMethod || ""),
          })),
        ];

        const liveRows = taskRows.filter(r => r.isInyard || r.isLiveOutbound);

        const apiHeaders = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": TENANT_ID,
          "X-Facility-ID": FACILITY_ID,
          "Item-Time-Zone": TIMEZONE,
        };

        async function assignInyard(etId: string, assigneeName: string): Promise<string> {
          const userId = ASSIGNEE_USER_IDS[assigneeName];
          if (!userId) return `No user ID for ${assigneeName}.`;
          try {
            const searchRes = await fetch(`${WMS_API}/wms/inbound/receive-task/search`, {
              method: "POST",
              headers: apiHeaders,
              body: JSON.stringify({ entryId: etId }),
            });
            if (!searchRes.ok) return `Could not look up receive task for ${etId}.`;
            const searchData = await searchRes.json();
            const tasks = searchData?.data || searchData?.content || searchData || [];
            const taskList = Array.isArray(tasks) ? tasks : (tasks?.list || []);
            if (taskList.length === 0) return `No receive task exists for ${etId} in WISE yet.`;
            const taskId = taskList[0].id || taskList[0].taskId;
            if (!taskId) return `Receive task found but has no ID for ${etId}.`;
            const putRes = await fetch(`${WMS_API}/wms/inbound/receive-task`, {
              method: "PUT",
              headers: apiHeaders,
              body: JSON.stringify({ id: taskId, assigneeUserId: userId }),
            });
            if (putRes.ok) return `OK`;
            if (putRes.status === 401 || putRes.status === 403) return "Session expired.";
            return `Assignment could not be completed for ${etId}. The receive task may not be in an assignable state.`;
          } catch {
            return "Unable to reach WISE.";
          }
        }

        async function assignOutbound(orderId: string, assigneeName: string): Promise<string> {
          const userId = ASSIGNEE_USER_IDS[assigneeName];
          if (!userId) return `No user ID for ${assigneeName}.`;
          try {
            const searchRes = await fetch(`${WMS_API}/wms-bam/outbound/pick-task/search-by-paging`, {
              method: "POST",
              headers: apiHeaders,
              body: JSON.stringify({ orderIds: [orderId], currentPage: 1, pageSize: 20 }),
            });
            if (!searchRes.ok) return `Could not look up pick task for ${orderId}.`;
            const searchData = await searchRes.json();
            const taskList = searchData?.data?.list || searchData?.data?.content || [];
            if (taskList.length === 0) return `No pick task exists for ${orderId} in WISE yet.`;
            const taskIds = taskList.map((t: Record<string, unknown>) => (t.id || t.taskId) as string).filter(Boolean);
            if (taskIds.length === 0) return `Pick task found but has no ID for ${orderId}.`;
            const assignRes = await fetch(`${WMS_API}/wms/outbound/pick-task/batch-assignment`, {
              method: "POST",
              headers: apiHeaders,
              body: JSON.stringify({ taskIds, assigneeUserId: userId, includesTaskSteps: true }),
            });
            if (assignRes.ok) return "OK";
            if (assignRes.status === 401 || assignRes.status === 403) return "Session expired.";
            return `Assignment could not be completed for ${orderId}. The pick task may not be in an assignable state.`;
          } catch {
            return "Unable to reach WISE.";
          }
        }

        async function performAssign(row: TaskRow, assigneeName: string) {
          setAssignStatusMsg(`Assigning ${row.displayId}...`);
          let result: string;
          if (row.isInyard) {
            result = await assignInyard(row.etId || row.orderId, assigneeName);
          } else if (row.isLiveOutbound) {
            result = await assignOutbound(row.orderId, assigneeName);
          } else {
            result = `Planned orders are review-only. ${row.displayId} was not changed.`;
          }
          if (result === "OK") {
            setAssignStatusMsg(`Assigned ${row.displayId} to ${assigneeName} in WISE.`);
          } else {
            setAssignStatusMsg(result);
          }
        }

        async function performAutoAssignAll() {
          if (liveRows.length === 0) {
            setAssignStatusMsg("No live-enabled Bay 3 tasks are available right now. Non-drop-ship planned orders are review-only.");
            return;
          }
          const ok = window.confirm(`Auto Assign All?\n\n${liveRows.length} task(s) will be assigned in WISE.\nNon-drop-ship planned orders are review-only.\n\nPress OK to proceed.`);
          if (!ok) { setAssignStatusMsg("Auto Assign cancelled."); return; }
          setAssignStatusMsg(`Processing ${liveRows.length} assignment(s)...`);
          let assigned = 0, skipped = 0, failed = 0;
          for (const row of liveRows) {
            const result = row.isInyard
              ? await assignInyard(row.etId || row.orderId, row.assignee)
              : await assignOutbound(row.orderId, row.assignee);
            if (result === "OK") assigned++;
            else if (result.includes("No ") || result.includes("no ")) skipped++;
            else failed++;
          }
          setAssignStatusMsg(`Done: ${assigned} assigned, ${skipped} skipped (no task), ${failed} failed.`);
          fetchData();
        }

        return (
          <div className="section-card" style={{ border: "1px solid var(--border-strong)" }}>
            {/* Panel Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border-table)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#f4f8ff" }}>Auto Suggest</span>
                <span style={{ padding: "3px 10px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, background: "rgba(0,230,138,0.1)", color: "var(--success)" }}>{taskRows.length} tasks</span>
              </div>
              <button onClick={() => { setAutoAssignOpen(false); setAssignStatusMsg(null); }} style={{ background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>

            {/* Explanatory Banner */}
            <div style={{ padding: "10px 16px", fontSize: "11px", color: "var(--fg-muted)", borderBottom: "1px solid var(--border-table)", lineHeight: 1.6 }}>
              Showing all assignable ETs and orders for Bay 3 customers. In-yard ETs assign via receive-task; drop-ship orders assign via pick-task. Non-drop-ship planned orders are review-only. Tasks remain here until Auto Assign is clicked.
            </div>

            {/* Auto Assign All button */}
            <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid var(--border-table)" }}>
              <button onClick={() => performAutoAssignAll()} style={{ padding: "8px 20px", borderRadius: "6px", border: "none", background: "var(--success)", color: "#fff", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>Auto Assign All</button>
              {assignStatusMsg && <span style={{ fontSize: "11px", color: "var(--fg-dim)" }}>{assignStatusMsg}</span>}
            </div>

            {/* Task Table */}
            {taskRows.length === 0 ? (
              <div className="empty-state">No Bay 3 records are available to suggest right now.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Work Type</th>
                      <th>Order / RN</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Order Type</th>
                      <th>Assignee</th>
                      <th>Action</th>
                      <th>History</th>
                      <th>Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskRows.map((row, i) => {
                      const canLiveAssign = row.isInyard || row.isLiveOutbound;
                      return (
                        <tr key={i}>
                          <td>{row.workType}</td>
                          <td className="font-mono">{row.displayId}</td>
                          <td>{row.customer}</td>
                          <td><span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", background: "rgba(77,105,255,0.1)", color: "var(--accent)" }}>{row.status}</span></td>
                          <td>{row.orderType}</td>
                          <td>
                            {row.options.length > 1 ? (
                              <select id={`assignee-select-${i}`} defaultValue={row.assignee} style={{ padding: "3px 6px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--fg)", fontSize: "10px" }}>
                                {row.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <span style={{ fontSize: "11px", color: "var(--accent)" }}>{row.assignee}</span>
                            )}
                          </td>
                          <td>
                            <button onClick={() => {
                              const selectEl = document.getElementById(`assignee-select-${i}`) as HTMLSelectElement | null;
                              const selectedAssignee = selectEl ? selectEl.value : row.assignee;
                              const confirmed = window.confirm(`Confirm assignment?\n\nTask: ${row.displayId}\nCustomer: ${row.customer}\nAssign to: ${selectedAssignee}\n\nPress OK to send this assignment to WISE.`);
                              if (confirmed) {
                                performAssign(row, selectedAssignee);
                              } else {
                                setAssignStatusMsg("Assignment cancelled.");
                              }
                            }} style={{ padding: "3px 10px", borderRadius: "4px", border: "none", background: canLiveAssign ? "var(--success)" : "var(--fg-muted)", color: "#fff", fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>Assign</button>
                          </td>
                          <td style={{ textAlign: "center", color: "var(--fg-muted)" }}>0</td>
                          <td style={{ fontSize: "10px", color: "var(--fg-muted)" }}>{canLiveAssign ? "Live" : "Review"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Header */}
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 900, color: "#fff", margin: 0 }}>Bay 3 Dashboard</h1>
          <p style={{ fontSize: "13px", color: "var(--fg-dim)", margin: "2px 0 0" }}>
            Valley View (LT_F1)
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          {generatedAt && (
            <span style={{ fontSize: "12px", color: "var(--fg-dim)" }}>
              Last refreshed {generatedAt.toLocaleString("en-US", { timeZone: TIMEZONE, month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span style={{ fontSize: "11px", color: "var(--fg-muted)", display: "block" }}>
            refreshing in {formatCountdown(countdown)}
          </span>
        </div>
      </header>

      {/* Info Banner */}
      <div className="info-banner">
        <span>Fresh WISE data every 5 minutes</span>
        <span>Auto Suggest holds RNs and orders until Auto Assign is confirmed</span>
        <span>Auto Assign assigns new tasks only after confirmation</span>
      </div>

      {dataError && (
        <div style={{ padding: "8px 14px", background: "rgba(255,76,106,0.08)", border: "1px solid rgba(255,76,106,0.25)", borderRadius: "6px", fontSize: "11px", color: "var(--warning)" }}>
          Data temporarily unavailable. The dashboard will retry automatically.
        </div>
      )}

      {/* KPI Metric Cards - Cotton style with click-to-expand */}
      {(() => {
        const olderThan48 = orders.filter(o => { if (!o.createdTime) return false; return (Date.now() - new Date(o.createdTime).getTime()) > 48 * 3600000; });
        const ecommOrders = orders.filter(o => o.shipMethod?.toLowerCase().includes("parcel") || o.shipMethod?.toLowerCase().includes("small"));

        type MetricDef = { key: string; icon: string; label: string; value: number | string; sublabel: string; getRows: () => Array<{ left: string; right: string }> };
        const metrics: MetricDef[] = [
          {
            key: "inyard", icon: "🚛", label: "In-Yard FULL Equipment",
            value: loading ? "—" : receipts.length, sublabel: "not yet devanned",
            getRows: () => receipts.map(r => ({ left: `${r.containerNo || "—"} · ${r.id || ""}`, right: `${r.customerName || "—"} · ${r.assignee || "Unassigned"}` })),
          },
          {
            key: "customers", icon: "🏢", label: "Customers",
            value: INYARD_CUSTOMERS.length, sublabel: "Valley View Bay 3",
            getRows: () => INYARD_CUSTOMERS.map(n => ({ left: n, right: "Bay 3" })),
          },
          {
            key: "planned", icon: "📦", label: "Planned FTL/LTL Orders",
            value: loading ? "—" : orders.length, sublabel: "All Bay 3 customers",
            getRows: () => orders.slice(0, 25).map(o => ({ left: `${o.id || "—"} · ${o.customerName || ""}`, right: o.shipMethod || "Pending" })),
          },
          {
            key: "older48", icon: "⏰", label: "Older than 48 hours",
            value: loading ? "—" : olderThan48.length, sublabel: "Pending non-Dropship",
            getRows: () => olderThan48.slice(0, 25).map(o => ({ left: `${o.id || "—"} · ${o.customerName || ""}`, right: formatPDT(o.createdTime) })),
          },
        ];

        return (
          <>
            <div className="cotton-metric-grid">
              {metrics.map(m => (
                <button
                  key={m.key}
                  className={`cotton-metric-card${selectedMetric === m.key ? " active" : ""}`}
                  onClick={() => setSelectedMetric(selectedMetric === m.key ? null : m.key)}
                  type="button"
                >
                  <div className="cmc-icon">{m.icon}</div>
                  <div className="cmc-body">
                    <div className="cmc-label">{m.label}</div>
                    <div className="cmc-value">{m.value}</div>
                    <div className="cmc-sublabel">{m.sublabel}</div>
                  </div>
                </button>
              ))}
            </div>

            {selectedMetric && (() => {
              const active = metrics.find(m => m.key === selectedMetric);
              if (!active) return null;
              const rows = active.getRows();
              return (
                <div className="cotton-detail-panel">
                  <div className="cdp-header">
                    <span className="cdp-icon">{active.icon}</span>
                    <span className="cdp-title">{active.label}</span>
                    <span className="cdp-count">{rows.length} items</span>
                  </div>
                  {rows.length === 0 ? (
                    <div className="empty-state">No items to display.</div>
                  ) : (
                    <div className="cdp-rows">
                      {rows.map((row, i) => (
                        <div key={i} className="cdp-row">
                          <span className="cdp-cell-left">{row.left}</span>
                          <span className="cdp-cell-right">{row.right}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        );
      })()}

      {/* Main Layout: Left (tables) + Right (assignees) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "14px", alignItems: "start" }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Section 1 - In-yard Equipment */}
          <section className="section-card">
            <div className="section-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 className="section-title">Section 1 &mdash; In-Yard FULL Equipment</h2>
                <span style={{ fontSize: "10px", color: "var(--fg-muted)" }}>{receipts.length} rows</span>
              </div>
            </div>
            {loading ? (
              <div className="empty-state">Loading...</div>
            ) : receipts.length === 0 ? (
              <div className="empty-state">No in-yard FULL equipment matched the Bay 3 scope.</div>
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th onClick={() => toggleReceiptSort("containerNo")}>Equipment # <SortArrow col="containerNo" sort={receiptSort} /></th>
                      <th onClick={() => toggleReceiptSort("id")}>Entry Ticket <SortArrow col="id" sort={receiptSort} /></th>
                      <th onClick={() => toggleReceiptSort("inYardTime")}>Check-in <SortArrow col="inYardTime" sort={receiptSort} /></th>
                      <th>Time in Yard</th>
                      <th onClick={() => toggleReceiptSort("customerName")}>Customer <SortArrow col="customerName" sort={receiptSort} /></th>
                      <th onClick={() => toggleReceiptSort("assignee")}>Assignee <SortArrow col="assignee" sort={receiptSort} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReceipts.map((r, i) => (
                      <tr key={r.id || i}>
                        <td className="font-mono">{r.containerNo || r.trailerNo || "—"}</td>
                        <td className="font-mono">{r.id || "—"}</td>
                        <td>{formatPDT(r.inYardTime)}</td>
                        <td>{timeInYard(r.inYardTime)}</td>
                        <td>{r.customerName || "—"}</td>
                        <td>{r.assignee || "Unassigned"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 2 - Planned Outbound Orders */}
          <section className="section-card">
            <div className="section-header" style={{ flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 className="section-title">Section 2 &mdash; PLANNED Outbound Orders</h2>
                <span style={{ fontSize: "10px", color: "var(--fg-muted)" }}>{filteredOrders.length} of {orders.length}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="search"
                  placeholder="Search orders..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  style={{ width: "160px" }}
                />
                {(customerFilter || orderSearch) && (
                  <button onClick={() => { setCustomerFilter(null); setOrderSearch(""); }} style={{ fontSize: "10px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
                )}
              </div>
            </div>

            {uniqueCustomerNames.length > 1 && (
              <div style={{ padding: "6px 14px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                <span className={`filter-chip ${!customerFilter ? "active" : ""}`} onClick={() => setCustomerFilter(null)}>All</span>
                {uniqueCustomerNames.map((name) => (
                  <span key={name} className={`filter-chip ${customerFilter === name ? "active" : ""}`} onClick={() => setCustomerFilter(customerFilter === name ? null : name)}>{name}</span>
                ))}
              </div>
            )}

            {loading ? (
              <div className="empty-state">Loading...</div>
            ) : sortedOrders.length === 0 ? (
              <div className="empty-state">No orders match the current filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th onClick={() => toggleOrderSort("id")}>Order # <SortArrow col="id" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("customerName")}>Customer <SortArrow col="customerName" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("assignee")}>Assignee <SortArrow col="assignee" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("poNo")}>PO # <SortArrow col="poNo" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("createdTime")}>Created <SortArrow col="createdTime" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("shipMethod")}>Ship Method <SortArrow col="shipMethod" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("carrierId")}>Carrier <SortArrow col="carrierId" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("scheduleDate")}>Schedule <SortArrow col="scheduleDate" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("mabd")}>MABD <SortArrow col="mabd" sort={orderSort} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map((o, i) => (
                      <tr key={o.id || i}>
                        <td className="font-mono">{o.id || "—"}</td>
                        <td>{o.customerName || "—"}</td>
                        <td>{o.assignee || "Unassigned"}</td>
                        <td>{o.poNo || o.referenceNo || "—"}</td>
                        <td>{formatPDT(o.createdTime)}</td>
                        <td>{o.shipMethod || "—"}</td>
                        <td>{o.carrierName || o.carrierId || "—"}</td>
                        <td>{formatDate(o.scheduleDate)}</td>
                        <td>{formatDate(o.mabd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right Column - Bay 3 Assignees */}
        <aside className="section-card" style={{ position: "sticky", top: "12px" }}>
          <div className="section-header">
            <h2 className="section-title">Bay 3 Assignees</h2>
            <span style={{ fontSize: "10px", color: "var(--fg-muted)" }}>{BAY3_ASSIGNEES.length} assignees</span>
          </div>
          <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {BAY3_ASSIGNEES.map((name) => {
              const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase();
              return (
                <div key={name} className="assignee-card">
                  <div className="assignee-avatar">{initials}</div>
                  <div className="assignee-name">{name}</div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "10px 0", fontSize: "10px", color: "var(--fg-muted)", borderTop: "1px solid var(--border-table)" }}>
        Bay 3 Dashboard &mdash; Valley View (LT_F1) &mdash; {TIMEZONE}
        {generatedAt && ` — ${generatedAt.toLocaleString("en-US", { timeZone: TIMEZONE })}`}
      </footer>
    </div>
  );
}
