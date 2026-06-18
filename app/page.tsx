"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const WMS_API = process.env.NEXT_PUBLIC_WMS_API_BASE_URL!;
const FACILITY_ID = process.env.NEXT_PUBLIC_FACILITY_ID!;
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID!;
const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE!;

const INYARD_CUSTOMERS = [
  "ALL MARKET INC / VITA COCO",
  "COME READY FOODS",
  "HINT INC",
  "SOURCE86",
  "KACE TEA LLC",
  "PLEASS GLOBAL LIMITED",
  "PREFERRED BRANDS",
  "RITUAL BEVERAGE COMPANY",
  "ROAR BEVERAGES INC",
  "SOUTHERN GLAZER'S WINE AND SPIRITS, LLC",
  "SPLENDOR WATER LLC",
  "WISMETTAC ASIAN FOODS",
];

function matchesInYardCustomerScope(name?: string): boolean {
  return matchesCustomerScope(name, INYARD_CUSTOMERS);
}

function matchesCustomerScope(name: string | undefined, scope: string[]): boolean {
  const normalized = String(name || "").toLowerCase().replace(/[.,]/g, "").trim();
  if (!normalized) return false;
  return scope.some((target) => {
    const t = target.toLowerCase().replace(/[.,]/g, "").trim();
    return normalized === t || normalized.includes(t) || t.includes(normalized);
  });
}

function getList(data: unknown): Record<string, unknown>[] {
  const obj = data as Record<string, unknown> | null | undefined;
  const inner = obj?.data as Record<string, unknown> | unknown[] | null | undefined;
  const candidates = [
    Array.isArray(inner) ? inner : null,
    Array.isArray((inner as Record<string, unknown> | null | undefined)?.list) ? (inner as Record<string, unknown>).list : null,
    Array.isArray((inner as Record<string, unknown> | null | undefined)?.rows) ? (inner as Record<string, unknown>).rows : null,
    Array.isArray((inner as Record<string, unknown> | null | undefined)?.content) ? (inner as Record<string, unknown>).content : null,
    Array.isArray((inner as Record<string, unknown> | null | undefined)?.records) ? (inner as Record<string, unknown>).records : null,
    Array.isArray(obj?.list) ? obj?.list : null,
    Array.isArray(obj?.rows) ? obj?.rows : null,
    Array.isArray(obj?.content) ? obj?.content : null,
    Array.isArray(obj?.records) ? obj?.records : null,
  ];
  return (candidates.find(Boolean) || []) as Record<string, unknown>[];
}

function isFullInboundWithoutEt(row: Record<string, unknown>): boolean {
  const equipmentNo = String(row.containerNo || row.equipmentNumber || row.equipmentNo || "").trim();
  const equipmentType = String(row.equipmentType || row.type || "").toUpperCase();
  const status = String(row.status || row.equipmentStatus || "").toUpperCase();
  const operationStatus = String(row.equipmentOperationStatus || row.operationStatus || row.details || "").toUpperCase();
  const entryId = String(row.entryId || row.entryTicket || row.checkInEntry || "").trim();
  const customer = String(row.customerName || row.customer || "");
  const devanned = Boolean(row.devannedTime || row.devanTime || row.devannedWhen || row.isDevanned === true);

  if (!equipmentNo || equipmentNo.length < 6) return false;
  if (entryId) return false;
  if (devanned) return false;
  if (!matchesInYardCustomerScope(customer)) return false;
  if (equipmentType && !equipmentType.includes("CONTAINER")) return false;
  return status.includes("FULL") || operationStatus.includes("FULL") || String(row.loaded || "").toLowerCase() === "true";
}


const PLANNED_ORDER_CUSTOMERS = [
  "ALL MARKET INC / VITA COCO",
  "COME READY FOODS",
  "HINT INC",
  "SOURCE86",
  "KACE TEA LLC",
  "PLEASS GLOBAL LIMITED",
  "PREFERRED BRANDS",
  "RITUAL BEVERAGE COMPANY",
  "ROAR BEVERAGES INC",
  "SOUTHERN GLAZER'S WINE AND SPIRITS, LLC",
  "SPLENDOR WATER LLC",
  "WISMETTAC ASIAN FOODS",
];

const OUTBOUND_SHIPPING_CUSTOMERS = [
  "ALL MARKET INC / VITA COCO",
  "HINT INC",
  "INGREDIENT BROTHERS",
  "PLEASS GLOBAL LIMITED",
  "PREFERRED BRANDS",
  "ROAR BEVERAGES INC",
  "SOUTHERN GLAZER'S WINE AND SPIRITS, LLC",
  "WISMETTAC ASIAN FOODS",
];

const BAY5_ASSIGNEES = [
  { displayName: "Daniel Beltran", username: "Angel84daniel@icloud.com", userId: "1932077596691410945" },
  { displayName: "Arnulfo Munguia", username: "amunguia", userId: "89" },
  { displayName: "Lorenzo Rodriguez", username: "employee23RK", userId: "1944915385434632193" },
  { displayName: "Julio Alvarado", username: "wilevans", userId: "4793" },
  { displayName: "Ramon Sicairos", username: "rmorales", userId: "1015" },
  { displayName: "Renato Rosales", username: "employee251G", userId: "1944915722677645314" },
  { displayName: "David Martinez", username: "dmartinez", userId: "1562" },
  { displayName: "Jose Rosas", username: "employee13VF", userId: "1912952560211685378" },
  { displayName: "Sebastian Munguia", username: "semunguia", userId: "1853651235951436835" },
  { displayName: "RUBI MANUEL SANDOVAL", username: "mramirez", userId: "9233" },
  { displayName: "SEBASTIAN GONZALEZ", username: "rojiblancogonzalez@gmail.com", userId: "1932554036460883969" },
];

interface Assignee {
  displayName: string;
  username: string;
  userId: string;
}

interface AssigneeRule {
  patterns: string[];
  assignees: Assignee[];
}

const ASSIGNEE_RULES: AssigneeRule[] = [
  { patterns: ["gurunanda", "guru nanda"], assignees: [BAY5_ASSIGNEES[0], BAY5_ASSIGNEES[1], BAY5_ASSIGNEES[2]] },
  { patterns: ["cmpc usa", "cmpc rolls", "cmpc usa (cut paper and rolls)"], assignees: [BAY5_ASSIGNEES[0], BAY5_ASSIGNEES[3]] },
  { patterns: ["north star"], assignees: [BAY5_ASSIGNEES[0], BAY5_ASSIGNEES[3]] },
  { patterns: ["karaka"], assignees: [BAY5_ASSIGNEES[0], BAY5_ASSIGNEES[2]] },
  { patterns: ["lennox"], assignees: [BAY5_ASSIGNEES[4], BAY5_ASSIGNEES[5]] },
  { patterns: ["tcl"], assignees: [BAY5_ASSIGNEES[6]] },
  { patterns: ["nzxt"], assignees: [BAY5_ASSIGNEES[6], BAY5_ASSIGNEES[7]] },
  { patterns: ["esi"], assignees: [BAY5_ASSIGNEES[7]] },
];

function stableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash);
}

function resolveAssignee(customerName?: string, stableId?: string): Assignee | null {
  if (!customerName) return null;
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
  return null;
}

function resolveAssigneeFromHistory(historyMap: Map<string, string>, customerId?: string, customerName?: string, stableId?: string): Assignee | null {
  if (customerId && historyMap.has(customerId)) {
    const userId = historyMap.get(customerId)!;
    const found = BAY5_ASSIGNEES.find((a) => a.userId === userId);
    if (found) return found;
  }
  return resolveAssignee(customerName, stableId);
}

const DASHBOARD_API = "https://wms-valley-view-dashboard-68cacf.coolify.item.pub";

const REFRESH_INTERVAL_SEC = 300;
interface Receipt {
  id?: string;
  equipmentNumber?: string;
  equipmentType?: string;
  entryTicket?: string;
  receiptId?: string;
  dockId?: string;
  checkIn?: string;
  timeInYard?: string;
  customer?: string;
  location?: string;
  status?: string;
  details?: string;
  containerNo?: string;
  trailerNo?: string;
  customerId?: string;
  customerName?: string;
  inYardTime?: string;
  appointmentTime?: string;
  assignee?: string;
  assigneeUserId?: string;
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
  assigneeUserId?: string;
  isLiveOutbound?: boolean;
  dockId?: string;
  location?: string;
  loadTaskId?: string;
  loadStatus?: string;
  entryId?: string;
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

const ASSIGNED_STORAGE_KEY = `bay5_assigned_${TENANT_ID}_${FACILITY_ID}`;
const ASSIGNED_TODAY_KEY = `bay5_assigned_today_${TENANT_ID}_${FACILITY_ID}`;

interface AssignedRecord {
  key: string;
  assignee: string;
  customer: string;
  time: string;
  date: string;
}

function getTodayPT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

function getAssignedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(ASSIGNED_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function addToAssigned(key: string) {
  const s = getAssignedSet();
  s.add(key);
  localStorage.setItem(ASSIGNED_STORAGE_KEY, JSON.stringify([...s]));
}

function clearAssignedHistory() {
  localStorage.removeItem(ASSIGNED_STORAGE_KEY);
}

function getAssignedToday(): AssignedRecord[] {
  try {
    const raw = localStorage.getItem(ASSIGNED_TODAY_KEY);
    if (raw) {
      const records: AssignedRecord[] = JSON.parse(raw);
      const today = getTodayPT();
      return records.filter((r) => r.date === today);
    }
  } catch { /* ignore */ }
  return [];
}

function addAssignedToday(record: AssignedRecord) {
  const existing = getAssignedToday();
  existing.push(record);
  localStorage.setItem(ASSIGNED_TODAY_KEY, JSON.stringify(existing));
  return fetch("/api/assigned-today", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  }).then((res) => res.ok ? res.json() : null).catch(() => null);
}

async function fetchSharedAssignedToday(): Promise<AssignedRecord[]> {
  try {
    const res = await fetch("/api/assigned-today", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return data.records || [];
    }
  } catch { /* fallback to localStorage */ }
  return getAssignedToday();
}

export default function Bay5Report() {
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [allInboundCount, setAllInboundCount] = useState(0);
  const [allInboundRows, setAllInboundRows] = useState<Receipt[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shippingLoads, setShippingLoads] = useState<Order[]>([]);
  const [inYardCustomers, setInYardCustomers] = useState<Customer[]>([]);
  const [orderCustomers, setOrderCustomers] = useState<Customer[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SEC);
  const [receiptSort, setReceiptSort] = useState<{ col: string; dir: SortDir }>({ col: "inYardTime", dir: "asc" });
  const [orderSort, setOrderSort] = useState<{ col: string; dir: SortDir }>({ col: "createdTime", dir: "desc" });
  const [orderSearch, setOrderSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);
  const [receiptCustomerFilter, setReceiptCustomerFilter] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [wiseDebug, setWiseDebug] = useState<string | null>(null);
  const [showAutoSuggest, setShowAutoSuggest] = useState(false);
  const [showAssignedHistory, setShowAssignedHistory] = useState(false);
  const [showOlderThan48h, setShowOlderThan48h] = useState(false);
  const [assignedByDashboard, setAssignedByDashboard] = useState<Set<string>>(new Set());
  const [assignedTodayList, setAssignedTodayList] = useState<AssignedRecord[]>([]);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setAssignedByDashboard(getAssignedSet());
    fetchSharedAssignedToday().then((records) => setAssignedTodayList(records));
    const interval = setInterval(() => {
      fetchSharedAssignedToday().then((records) => setAssignedTodayList(records));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const [assignConfirm, setAssignConfirm] = useState<{ row: Receipt | Order; type: "inyard" | "order" } | null>(null);
  const [assignStatus, setAssignStatus] = useState<string | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<Record<string, string>>({});
  const [selectedDocks, setSelectedDocks] = useState<Record<string, string>>({});
  const [dockList, setDockList] = useState<{ id: string; name: string }[]>([]);
  const [dockConfirm, setDockConfirm] = useState<{ row: Receipt; newDockId: string; newDockName: string } | null>(null);
  const [orderDockConfirm, setOrderDockConfirm] = useState<{ row: Order; newDockId: string; newDockName: string } | null>(null);

  const [assigning, setAssigning] = useState(false);

  const wmsPost = useCallback(async (path: string, body: object) => {
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
    if (!res.ok) return null;
    return res.json();
  }, [token]);

  const wmsPut = useCallback(async (path: string, body: object) => {
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`${WMS_API}${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": TENANT_ID,
        "X-Facility-ID": FACILITY_ID,
        "Item-Time-Zone": TIMEZONE,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  }, [token]);

  const assignInYardRow = useCallback(async (row: Receipt): Promise<{ ok: boolean; msg: string }> => {
    const etId = row.entryTicket || row.id || "";
    const containerNo = row.equipmentNumber || row.containerNo || "";
    let rnId = row.receiptId || "";
    const userId = row.assigneeUserId || "";
    const dockId = row.dockId || "";
    const displayLabel = rnId ? `${containerNo} | ${rnId}` : (containerNo || etId);

    if (!userId) return { ok: false, msg: `No assignee selected for ${displayLabel}.` };
    if (!containerNo && !etId && !rnId) return { ok: false, msg: `Missing container/RN/ET identifier.` };

    // Step 1: Resolve RN from container number (Receive Now workflow)
    if (containerNo && !rnId) {
      const receiptRes = await wmsPost("/wms/inbound/receipt/search-by-paging", { eqContainerNo: containerNo, currentPage: 1, pageSize: 10 });
      const receiptList = receiptRes?.data?.list || [];
      if (Array.isArray(receiptList) && receiptList.length > 0) {
        const active = receiptList.find((x: Record<string, unknown>) =>
          String(x.status || "").toUpperCase() === "IMPORTED" &&
          String(x.referenceNo || "") !== "CANCELLED" &&
          String(x.containerNo || "") === containerNo
        ) || receiptList.find((x: Record<string, unknown>) =>
          String(x.referenceNo || "") !== "CANCELLED"
        ) || receiptList[0];
        rnId = String(active.id || "");
      }
    }

    if (!rnId) return { ok: false, msg: `Could not resolve RN for ${containerNo || etId}. Receipt not found.` };

    // Step 2: Search for existing receive task by receiptIds
    let taskId: string | null = null;
    const taskSearchRes = await wmsPost("/wms/inbound/receive-task/search", { receiptIds: [rnId] });
    const tasks = taskSearchRes?.data?.list || taskSearchRes?.data || [];
    const taskList = Array.isArray(tasks) ? tasks : [];
    if (taskList.length > 0 && taskList[0].id) {
      taskId = taskList[0].id;
    }

    // Step 3: If no task exists, create one
    if (!taskId) {
      if (!dockId) return { ok: false, msg: `Cannot create receive task for ${rnId}. Dock information is missing.` };

      const createBody: Record<string, unknown> = { receiptIds: [rnId], assigneeUserId: userId };
      if (etId) createBody.entryId = etId;
      createBody.dockId = dockId;

      const createRes = await wmsPost("/wms/inbound/receive-task/create", createBody);
      if (!createRes || (createRes.code !== undefined && String(createRes.code) !== "0")) {
        return { ok: false, msg: `Could not create a receive task for ${rnId}. Please confirm the RN/ET is eligible in WISE.` };
      }
      const createdTask = createRes?.data;
      if (createdTask?.id) {
        taskId = createdTask.id;
      } else if (Array.isArray(createdTask) && createdTask[0]?.id) {
        taskId = createdTask[0].id;
      } else {
        const retry = await wmsPost("/wms/inbound/receive-task/search", { receiptIds: [rnId] });
        const retryList = retry?.data?.list || retry?.data || [];
        if (Array.isArray(retryList) && retryList.length > 0) taskId = retryList[0].id;
      }
      if (!taskId) return { ok: false, msg: `Could not create a receive task for ${rnId}. Please confirm the RN/ET is eligible in WISE.` };
    }

    // Step 4: Assign the task
    const assignRes = await wmsPut("/wms/inbound/receive-task", { id: taskId, assigneeUserId: userId });
    if (!assignRes || (assignRes.code !== undefined && String(assignRes.code) !== "0" && assignRes.success !== true)) {
      return { ok: false, msg: `Task found but assignment failed for ${rnId}. The task may already be assigned or closed.` };
    }
    return { ok: true, msg: `${displayLabel} assigned successfully.` };
  }, [wmsPost, wmsPut]);

  const assignOutboundRow = useCallback(async (row: Order): Promise<{ ok: boolean; msg: string }> => {
    const orderId = row.id || "";
    const assigneeUserId = row.assigneeUserId || "";
    if (!orderId) return { ok: false, msg: "Missing DN/order number." };
    if (!assigneeUserId) return { ok: false, msg: `No assignee selected for ${orderId}.` };

    const assignPickTasks = async (taskIds: string[]) => {
      if (taskIds.length === 0) return { ok: false, msg: `Assignment could not be completed for ${orderId}. The pick task may not exist in WISE yet.` };
      const assignRes = await wmsPost("/wms/outbound/pick-task/batch-assignment", {
        taskIds,
        assigneeUserId,
        priority: "MIDDLE",
        includesTaskSteps: true,
      });
      if (!assignRes || (assignRes.code !== undefined && String(assignRes.code) !== "0" && assignRes.success !== true)) {
        return { ok: false, msg: `Assignment could not be completed for ${orderId}.` };
      }
      return { ok: true, msg: `${orderId} assigned successfully.` };
    };

    const findPickTasks = async (): Promise<string[]> => {
      const searchRes = await wmsPost("/wms/outbound/pick-task/search-by-paging", {
        orderIds: [orderId],
        currentPage: 1,
        pageSize: 20,
      });
      const taskList = searchRes?.data?.list || searchRes?.data?.content || searchRes?.data || [];
      const tasks = Array.isArray(taskList) ? taskList : [];
      return tasks
        .filter((t: Record<string, unknown>) => !["CLOSED", "FORCE_CLOSED", "CANCELLED"].includes(String(t.status || "").toUpperCase()))
        .map((t: Record<string, unknown>) => String(t.id || t.taskId || ""))
        .filter(Boolean);
    };

    // If an operational pick task already exists, assign it.
    let taskIds = await findPickTasks();
    if (taskIds.length > 0) return assignPickTasks(taskIds);

    // Locate or create the outbound order plan for this DN.
    let planId = "";
    const planRes = await wmsPost("/wms-bam/outbound/order-plan/search-by-paging", {
      orderIds: [orderId],
      currentPage: 1,
      pageSize: 10,
    });
    const planList = planRes?.data?.list || planRes?.data?.content || planRes?.data || [];
    const plans = Array.isArray(planList) ? planList : [];
    if (plans.length > 0) planId = String(plans[0].id || plans[0].orderPlanId || "");

    if (!planId) {
      const createPlan = await wmsPost("/wms/outbound/order-plan/create", {
        orderIds: [orderId],
        pickMethod: "ORDER_PICK",
        pickType: "CASE_PICK",
        defaultAssigneeUserId: assigneeUserId,
        taskPriority: "MIDDLE",
      });
      const created = createPlan?.data || createPlan;
      planId = String(created?.id || created?.orderPlanId || (Array.isArray(created) ? (created[0]?.id || created[0]?.orderPlanId) : "") || "");
      if (!planId) {
        const retryPlan = await wmsPost("/wms-bam/outbound/order-plan/search-by-paging", { orderIds: [orderId], currentPage: 1, pageSize: 10 });
        const retryList = retryPlan?.data?.list || retryPlan?.data?.content || retryPlan?.data || [];
        if (Array.isArray(retryList) && retryList.length > 0) planId = String(retryList[0].id || retryList[0].orderPlanId || "");
      }
    }

    if (!planId) return { ok: false, msg: `Could not create or locate an order plan for ${orderId}.` };

    // Create the pick task from the order plan, release it, then assign the resulting pick task.
    await wmsPut(`/wms/outbound/order-plan/${encodeURIComponent(planId)}/doCreatePickTask`, {});
    await wmsPut(`/wms/outbound/order-plan/${encodeURIComponent(planId)}/release`, {});

    taskIds = await findPickTasks();
    if (taskIds.length === 0) return { ok: false, msg: `Pick task was not available yet for ${orderId}. Please try again after WISE finishes creating it.` };
    return assignPickTasks(taskIds);
  }, [wmsPost, wmsPut]);

  const loadDocks = useCallback(async () => {
    if (!token || dockList.length > 0) return;
    try {
      const res = await fetch(`${WMS_API}/wms-bam/location/dock/search-by-paging`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": TENANT_ID,
          "X-Facility-ID": FACILITY_ID,
          "Item-Time-Zone": TIMEZONE,
        },
        body: JSON.stringify({ currentPage: 1, pageSize: 200 }),
      });
      if (res.ok) {
        const data = await res.json();
        const list = data?.data?.list || data?.data?.content || data?.data || [];
        if (Array.isArray(list)) {
          setDockList(list.map((d: Record<string, unknown>) => ({
            id: String(d.id || d.dockId || ""),
            name: String(d.name || d.dockName || d.locationName || d.id || ""),
          })).filter((d: { id: string }) => d.id));
        }
      }
    } catch { /* dock list unavailable */ }
  }, [token, dockList.length]);

  const handleDockChange = useCallback(async () => {
    if (!dockConfirm || !token) return;
    const { row, newDockId } = dockConfirm;
    const etId = row.entryTicket || row.id || "";
    const rnId = row.receiptId || "";
    const displayRn = rnId || etId;

    if (!etId) {
      setAssignStatus(`Cannot change dock for ${displayRn}. Entry ticket not available.`);
      setDockConfirm(null);
      setTimeout(() => setAssignStatus(null), 5000);
      return;
    }

    setAssigning(true);

    // Search for existing receive task
    let taskId: string | null = null;
    const searchRes = await wmsPost("/wms/inbound/receive-task/search", { entryId: etId });
    const tasks = searchRes?.data?.list || searchRes?.data || [];
    const taskList = Array.isArray(tasks) ? tasks : [];
    if (taskList.length > 0 && taskList[0].id) {
      taskId = taskList[0].id;
    }

    // Build window-checkin body
    const body: Record<string, unknown> = {
      entryId: etId,
      dockId: newDockId,
    };
    if (taskId || rnId) {
      body.inboundTask = {
        ...(taskId ? { taskId, isUpdateTask: true } : {}),
        dockId: newDockId,
        receiptIds: rnId ? [rnId] : [],
        ...(row.assigneeUserId ? { assigneeUserId: row.assigneeUserId } : {}),
      };
    }

    const res = await wmsPost(`/wms-bam/entry-ticket/window-checkin/${etId}`, body);
    setAssigning(false);
    setDockConfirm(null);

    if (res && (res.code === undefined || String(res.code) === "0" || res.success === true)) {
      setAssignStatus(`Dock changed to ${dockConfirm.newDockName} for ${displayRn}.`);
      // Update local row
      setReceipts((prev) => prev.map((r) =>
        (r.entryTicket || r.id) === etId ? { ...r, location: dockConfirm.newDockName, dockId: newDockId } : r
      ));
    } else {
      setAssignStatus(`Could not change dock for ${displayRn}. Please verify the RN/ET is eligible.`);
    }
    setTimeout(() => setAssignStatus(null), 6000);
  }, [dockConfirm, token, wmsPost]);

  const handleOrderDockChange = useCallback(async () => {
    if (!orderDockConfirm || !token) return;
    const { row, newDockId, newDockName } = orderDockConfirm;
    const orderId = row.id || "";
    if (!orderId) {
      setAssignStatus("Cannot change dock. DN is missing.");
      setOrderDockConfirm(null);
      setTimeout(() => setAssignStatus(null), 5000);
      return;
    }
    setAssigning(true);
    let loadTaskId = row.loadTaskId || "";
    if (!loadTaskId) {
      const searchRes = await wmsPost("/wms-bam/outbound/load-task/search-by-paging", {
        orderIds: [orderId],
        excludeStatuses: ["CANCELLED", "CLOSED", "FORCE_CLOSED"],
        currentPage: 1,
        pageSize: 10,
      });
      const loads = searchRes?.data?.list || searchRes?.data?.content || searchRes?.data || [];
      if (Array.isArray(loads) && loads.length > 0) loadTaskId = String(loads[0].id || loads[0].taskId || "");
    }
    if (!loadTaskId) {
      setAssigning(false);
      setOrderDockConfirm(null);
      setAssignStatus(`Cannot change dock for ${orderId}. No outbound load task exists yet.`);
      setTimeout(() => setAssignStatus(null), 6000);
      return;
    }
    const res = await wmsPut("/wms/outbound/load-task/batch-update", [{ id: loadTaskId, dockId: newDockId }]);
    setAssigning(false);
    setOrderDockConfirm(null);
    if (res && (res.code === undefined || String(res.code) === "0" || res.success === true)) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, dockId: newDockId, location: newDockName, loadTaskId } : o)));
      setAssignStatus(`Dock changed to ${newDockName} for ${orderId}.`);
    } else {
      setAssignStatus(`Could not change dock for ${orderId}. Please verify the load task is eligible.`);
    }
    setTimeout(() => setAssignStatus(null), 6000);
  }, [orderDockConfirm, token, wmsPost, wmsPut]);

  const handleAssignConfirm = useCallback(async () => {
    if (!assignConfirm) return;
    const { row, type } = assignConfirm;
    if (type === "order") {
      setAssigning(true);
      const order = row as Order;
      const result = await assignOutboundRow(order);
      setAssigning(false);
      setAssignConfirm(null);
      setAssignStatus(result.msg);
      if (result.ok) {
        const key = order.id || "";
        if (key) {
          addToAssigned(key);
          setAssignedByDashboard((prev) => new Set([...prev, key]));
          const record: AssignedRecord = {
            key,
            assignee: order.assignee || "Unassigned",
            customer: order.customerName || "",
            time: new Date().toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" }),
            date: getTodayPT(),
          };
          addAssignedToday(record).then(() => fetchSharedAssignedToday().then((recs) => setAssignedTodayList(recs)));
        }
      }
      setTimeout(() => setAssignStatus(null), 6000);
      return;
    }
    setAssigning(true);
    const receipt = row as Receipt;
    const result = await assignInYardRow(receipt);
    setAssigning(false);
    setAssignConfirm(null);
    setAssignStatus(result.msg);
    if (result.ok) {
      const key = receipt.receiptId || receipt.entryTicket || receipt.id || "";
      if (key) {
        addToAssigned(key);
        setAssignedByDashboard((prev) => new Set([...prev, key]));
        const record: AssignedRecord = {
          key,
          assignee: receipt.assignee || "Unassigned",
          customer: receipt.customerName || receipt.customer || "",
          time: new Date().toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" }),
          date: getTodayPT(),
        };
        addAssignedToday(record).then(() => fetchSharedAssignedToday().then((recs) => setAssignedTodayList(recs)));
      }
    }
    setTimeout(() => setAssignStatus(null), 6000);
  }, [assignConfirm, assignInYardRow, assignOutboundRow]);

  const handleAutoAssignAll = useCallback(async () => {
    const inyardRows = receipts.filter((r) => r.assigneeUserId);
    if (inyardRows.length === 0) {
      setAssignStatus("No in-yard rows with assignees to process.");
      setTimeout(() => setAssignStatus(null), 4000);
      return;
    }
    const confirmed = window.confirm(
      `Auto Assign All will send ${inyardRows.length} in-yard assignment(s) to WISE.\n\nPlanned orders will be skipped (review-only).\n\nProceed?`
    );
    if (!confirmed) return;
    setAssigning(true);
    let assigned = 0;
    let failed = 0;
    const errors: string[] = [];
    const assignedKeys: string[] = [];
    for (const r of inyardRows) {
      const result = await assignInYardRow(r);
      if (result.ok) {
        assigned++;
        const key = r.receiptId || r.entryTicket || r.id || "";
        if (key) assignedKeys.push(key);
      } else {
        failed++;
        errors.push(result.msg);
      }
    }
    setAssigning(false);
    if (assignedKeys.length > 0) {
      for (const k of assignedKeys) addToAssigned(k);
      setAssignedByDashboard((prev) => new Set([...prev, ...assignedKeys]));
      const newRecords: AssignedRecord[] = [];
      for (const r of inyardRows) {
        const key = r.receiptId || r.entryTicket || r.id || "";
        if (assignedKeys.includes(key)) {
          const record: AssignedRecord = {
            key,
            assignee: r.assignee || "Unassigned",
            customer: r.customerName || r.customer || "",
            time: new Date().toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" }),
            date: getTodayPT(),
          };
          addAssignedToday(record);
          newRecords.push(record);
        }
      }
      if (newRecords.length > 0) {
        setAssignedTodayList((prev) => [...prev, ...newRecords]);
      }
      fetchSharedAssignedToday().then((records) => setAssignedTodayList(records));
    }
    const summary = `Auto Assign complete: ${assigned} assigned, ${failed} failed, ${orders.length} planned orders skipped.`;
    setAssignStatus(errors.length > 0 ? `${summary}\n${errors[0]}` : summary);
    setTimeout(() => setAssignStatus(null), 8000);
  }, [receipts, orders.length, assignInYardRow]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const login = useCallback(async (user: string, pass: string) => {
    setLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "password", username: user, password: pass }),
      });
      const data = await res.json();
      if (String(data.code) === "0" && data.data?.access_token) {
        setToken(data.data.access_token);
        localStorage.setItem("bay5_token", data.data.access_token);
      } else {
        setAuthError("Invalid credentials. Please try again.");
      }
    } catch {
      setAuthError("Unable to connect to authentication service.");
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("bay5_token");
    setToken(null);
    setReceipts([]);
    setAllInboundCount(0);
    setAllInboundRows([]);
    setOrders([]);
    setShippingLoads([]);
    setInYardCustomers([]);
    setOrderCustomers([]);
    setDataError(null);
    setWiseDebug(null);
    setLoading(false);
    setCountdown(REFRESH_INTERVAL_SEC);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("bay5_token");
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
      localStorage.removeItem("bay5_token");
      throw new Error("Session expired");
    }
    if (!res.ok) throw new Error("Data temporarily unavailable");
    return res.json();
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setDataError(null);
    setWiseDebug("Checking WISE...");
    const debugParts: string[] = [];
    try {
      // --- Section 1: fetch fresh non-closed in-yard receipts directly from WISE ---
      setReceipts([]);
      // --- Section 1: follow Valley View Team 5 backend logic exactly ---
      try {
        const bay5Res = await fetch("/api/dashboard-bay5", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": TENANT_ID,
          },
          body: JSON.stringify({
            facilityId: FACILITY_ID,
            facilityName: "Valley View",
            timeZone: TIMEZONE,
          }),
        });
        if (bay5Res.ok) {
          const bay5Data = await bay5Res.json();
          const inboundSection = bay5Data?.inYardFullEquipment || {};
          const rows = getList(inboundSection);
          const mappedRows: Receipt[] = rows.map((r) => {
            const equipmentNumber = String(r.equipmentNumber || "");
            const entryTicket = String(r.entryTicket || "");
            const customer = String(r.customer || r.customerName || "");
            const stableId = entryTicket || equipmentNumber;
            const resolved = resolveAssignee(customer, stableId);
            return {
              equipmentNumber,
              entryTicket,
              checkIn: String(r.checkIn || ""),
              timeInYard: String(r.timeInYard || ""),
              customer,
              customerName: customer,
              id: stableId,
              containerNo: equipmentNumber,
              assignee: resolved?.displayName || "Unassigned",
              assigneeUserId: resolved?.userId || "",
            };
          });
          setReceipts(mappedRows);
          const vitaRows = mappedRows.filter((row) => matchesCustomerScope(row.customerName || row.customer, ["ALL MARKET INC / VITA COCO", "VITA COCO"]));
          debugParts.push(`Section 1 Team 5 backend ${rows.length}, Vita Coco ${vitaRows.length}`);
        } else {
          setAllInboundCount(0);
          setAllInboundRows([]);
          debugParts.push(`Section 1 Team 5 backend error ${bay5Res.status}`);
        }
      } catch { setAllInboundCount(0); setAllInboundRows([]); debugParts.push("Section 1 Team 5 backend failed"); }

      try {
        const inboundRes = await apiFetch("/wms-bam/inbound/receipt/search-by-paging", {
          excludeStatuses: ["CLOSED", "FORCE_CLOSED", "TASK_COMPLETED", "CANCELLED"],
          currentPage: 1,
          pageSize: 500,
        });
        const inboundItems = getList(inboundRes);
        const allInbound = inboundItems
          .filter(isFullInboundWithoutEt)
          .map((r) => {
            const equipmentNumber = String(r.containerNo || r.equipmentNumber || r.equipmentNo || "");
            const customer = String(r.customerName || r.customer || "");
            return {
              equipmentNumber,
              containerNo: equipmentNumber,
              receiptId: String(r.id || ""),
              id: String(r.id || equipmentNumber),
              customer,
              customerName: customer,
              status: String(r.status || "FULL"),
              location: String(r.dockName || r.locationName || r.location || r.dockId || ""),
            } as Receipt;
          });
        setAllInboundRows(allInbound);
        setAllInboundCount(allInbound.length);
        debugParts.push(`All Inbounds full no ET ${allInbound.length}`);
      } catch {
        setAllInboundRows([]);
        setAllInboundCount(0);
        debugParts.push("All Inbounds failed");
      }

      // --- Planned Orders: resolve customer IDs then fetch orders ---
      const allCustomers: Customer[] = [];
      for (const name of [...new Set(PLANNED_ORDER_CUSTOMERS)]) {
        try {
          const res = await apiFetch("/mdm/customer/search", { keyword: name, currentPage: 1, pageSize: 10 });
          const items = getList(res);
          if (Array.isArray(items)) {
            for (const c of items) {
              allCustomers.push({
                id: (c.orgId || c.id || "") as string,
                name: (c.name || c.fullName || "") as string,
              });
            }
          }
        } catch { /* skip */ }
      }

      const uniqueCustomers = allCustomers.filter((c, i, arr) => c.id && arr.findIndex((x) => x.id === c.id) === i);

      const orderMatched = uniqueCustomers.filter((c) =>
        PLANNED_ORDER_CUSTOMERS.some(
          (t) =>
            c.name.toLowerCase().trim() === t.toLowerCase().trim() ||
            c.name.toLowerCase().includes(t.toLowerCase()) ||
            t.toLowerCase().includes(c.name.toLowerCase())
        )
      );
      setOrderCustomers(orderMatched);
      setInYardCustomers([]);

      const orderIds = orderMatched.map((c) => c.id);
      debugParts.push(`Section 2 customers ${orderMatched.length}`);

      let orderRes = null;
      if (orderIds.length > 0) {
        try {
          orderRes = await apiFetch("/wms/outbound/order/search-by-paging", {
            status: "PLANNED",
            customerIds: orderIds,
            currentPage: 1,
            pageSize: 200,
          });
        } catch { /* order fetch failed */ }
      }

      if (orderRes) {
        const items = getList(orderRes);
        debugParts.push(`Section 2 orders ${Array.isArray(items) ? items.length : 0}`);
        const enriched = await Promise.all((Array.isArray(items) ? items : []).map(async (o: Record<string, unknown>) => {
          const custName =
            (o.customerName as string) ||
            orderMatched.find((c) => c.id === o.customerId)?.name ||
            (o.customerId as string) ||
            "—";
          const orderId = (o.id as string) || "";
          const stableId = orderId || (o.poNo as string) || "";
          const resolved = resolveAssignee(custName, stableId);
          let dockId = "";
          let location = "";
          let loadTaskId = "";
          if (orderId) {
            try {
              const loadRes = await apiFetch("/wms-bam/outbound/load-task/search-by-paging", {
                orderIds: [orderId],
                excludeStatuses: ["CANCELLED", "CLOSED", "FORCE_CLOSED"],
                currentPage: 1,
                pageSize: 10,
              });
              const loads = getList(loadRes);
              if (Array.isArray(loads) && loads.length > 0) {
                const load = loads[0] as Record<string, unknown>;
                loadTaskId = String(load.id || load.taskId || "");
                dockId = String(load.dockId || "");
                location = String(load.dockName || load.locationName || load.dockId || "");
              }
            } catch { /* load task may not exist for planned DN yet */ }
          }
          return { ...o, customerName: custName, assignee: resolved?.displayName || "Unassigned", assigneeUserId: resolved?.userId || "", isLiveOutbound: true, dockId, location, loadTaskId };
        }));
        setOrders(enriched);
      } else {
        setOrders([]);
        debugParts.push("Section 2 orders 0");
      }

      // --- Outbound Shipping: NEW load tasks with PICKED DN orders ---
      const shippingCustomers: Customer[] = [];
      for (const name of [...new Set(OUTBOUND_SHIPPING_CUSTOMERS)]) {
        try {
          const res = await apiFetch("/mdm/customer/search", { keyword: name, currentPage: 1, pageSize: 10 });
          const items = getList(res);
          if (Array.isArray(items)) {
            for (const c of items) {
              shippingCustomers.push({
                id: (c.orgId || c.id || "") as string,
                name: (c.name || c.fullName || "") as string,
              });
            }
          }
        } catch { /* skip */ }
      }
      const shippingMatched = shippingCustomers
        .filter((c, i, arr) => c.id && arr.findIndex((x) => x.id === c.id) === i)
        .filter((c) => matchesCustomerScope(c.name, OUTBOUND_SHIPPING_CUSTOMERS));
      const shippingCustomerIds = new Set(shippingMatched.map((c) => c.id));
      debugParts.push(`Section 3 customers ${shippingMatched.length}`);

      try {
        const loadTaskRes = await wmsPost("/wms-bam/outbound/load-task/search-by-paging", {
          statuses: ["NEW"],
          customerIds: [...shippingCustomerIds],
          currentPage: 1,
          pageSize: 50,
        });
        const loadTasks: Record<string, unknown>[] = getList(loadTaskRes);
        const shippingRows: Order[] = [];

        for (const lt of loadTasks) {
          const custId = (lt.customerId as string) || "";
          const loadIds: string[] = (lt.loadIds as string[]) || [];
          const entryId = (lt.entryId as string) || "";
          const taskId = (lt.id as string) || "";
          const dockId = (lt.dockId as string) || "";
          const assigneeUid = (lt.assigneeUserId as string) || "";
          const assigneeName = (lt.assigneeUserName as string) || "";

          if (!custId || !loadIds.length) continue;

          // Check if customer is in the Section 3 shipping scope
          const custName = shippingMatched.find((c) => c.id === custId)?.name || "";
          const nameForScope = custName || custId;
          if (!shippingCustomerIds.has(custId) && !matchesCustomerScope(nameForScope, OUTBOUND_SHIPPING_CUSTOMERS)) continue;

          // Get load detail to find orderIds
          let dnIds: string[] = [];
          for (const loadId of loadIds.slice(0, 3)) {
            try {
              const loadDetailRes = await fetch(`${WMS_API}/wms-bam/outbound/load/${encodeURIComponent(loadId)}`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}`, "X-Tenant-ID": TENANT_ID, "X-Facility-ID": FACILITY_ID, "Item-Time-Zone": TIMEZONE },
              });
              if (loadDetailRes.ok) {
                const ld = await loadDetailRes.json();
                const detail = ld?.data || ld || {};
                const oids: string[] = (detail.orderIds as string[]) || [];
                dnIds.push(...oids);
              }
            } catch { /* skip */ }
          }

          if (dnIds.length === 0) continue;

          // Check if at least one DN is PICKED
          let hasPicked = false;
          try {
            for (const dnId of dnIds.slice(0, 5)) {
              const orderDetailRes = await fetch(`${WMS_API}/wms/outbound/order/${encodeURIComponent(dnId)}`, {
                method: "GET",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Tenant-ID": TENANT_ID, "X-Facility-ID": FACILITY_ID, "Item-Time-Zone": TIMEZONE },
              });
              if (orderDetailRes.ok) {
                const od = await orderDetailRes.json();
                const orderDetail = od?.data || od || {};
                if (String(orderDetail.status || "").toUpperCase() === "PICKED") {
                  hasPicked = true;
                  break;
                }
              }
            }
          } catch { /* skip */ }

          if (!hasPicked) continue;

          const stableId = taskId || dnIds[0] || "";
          const resolved = resolveAssigneeFromHistory(new Map<string, string>(), custId, nameForScope, stableId);
          const bay5Assignee = BAY5_ASSIGNEES.find((a) => a.userId === assigneeUid);

          shippingRows.push({
            id: dnIds[0] || taskId,
            customerId: custId,
            customerName: nameForScope,
            status: "PICKED",
            loadStatus: "NEW",
            shipMethod: "Load",
            loadTaskId: taskId,
            dockId,
            location: dockId,
            entryId,
            assignee: bay5Assignee?.displayName || resolved?.displayName || assigneeName || "Unassigned",
            assigneeUserId: bay5Assignee?.userId || resolved?.userId || assigneeUid || "",
            isLiveOutbound: !!entryId,
          });
        }
        setShippingLoads(shippingRows);
        debugParts.push(`Section 3 WISE ${loadTasks.length}, picked ${shippingRows.length}`);
      } catch { setShippingLoads([]); debugParts.push("Section 3 WISE failed"); }

      setWiseDebug(debugParts.join(" | ") || "WISE responded, but no count details were returned.");
      setGeneratedAt(new Date());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unable to load data at this time";
      setWiseDebug(debugParts.length > 0 ? `${debugParts.join(" | ")} | stopped: ${msg}` : `WISE check stopped: ${msg}`);
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

  const visibleReceipts = showAssignedHistory
    ? receipts
    : receipts.filter((r) => !assignedByDashboard.has(r.receiptId || r.entryTicket || r.id || ""));

  const receiptCustomerNames = INYARD_CUSTOMERS;
  const receiptCustomerCounts = new Map(
    receiptCustomerNames.map((name) => [
      name,
      visibleReceipts.filter((r) => matchesCustomerScope(r.customerName || r.customer, [name])).length,
    ])
  );

  const filteredReceipts = visibleReceipts.filter((r) => {
    if (!receiptCustomerFilter) return true;
    return matchesCustomerScope(r.customerName || r.customer, [receiptCustomerFilter]);
  });

  const visibleOrders = showAssignedHistory
    ? orders
    : orders.filter((o) => !assignedByDashboard.has(o.id || ""));

  const sortedReceipts = [...filteredReceipts].sort((a, b) => {
    const col = receiptSort.col as keyof Receipt;
    const av = (a[col] || "") as string;
    const bv = (b[col] || "") as string;
    const cmp = av.localeCompare(bv);
    return receiptSort.dir === "asc" ? cmp : -cmp;
  });

  const filteredOrders = visibleOrders.filter((o) => {
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
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>Bay 5 Dashboard</h1>
          <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "16px" }}>
            Valley View (LT_F1) &mdash; Sign in to view dashboard
          </p>
          <button
            type="button"
            className="btn-action"
            onClick={signOut}
            style={{ width: "100%", padding: "8px", fontSize: "12px", marginBottom: "12px" }}
          >
            Clear saved login
          </button>
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

  const totalSuggestCount = visibleReceipts.length + visibleOrders.length;

  const uniqueCustomerNames = [
    ...new Set(orders.map((o) => o.customerName).filter(Boolean)),
  ].sort() as string[];
  const orderCustomerCounts = new Map(
    uniqueCustomerNames.map((name) => [
      name,
      visibleOrders.filter((o) => o.customerName === name).length,
    ])
  );

  return (
    <div style={{ maxWidth: "1500px", margin: "0 auto", padding: "12px 20px 30px", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Top Action Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button className={showAutoSuggest ? "btn-action primary" : "btn-action"} onClick={() => setShowAutoSuggest((v) => !v)}>{showAutoSuggest ? "▼ Auto Suggest" : "Auto Suggest"}</button>
          <button className="btn-action primary" onClick={handleAutoAssignAll}>Auto Assign All</button>
          <button className="btn-action">Autonomous</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button className="btn-action" onClick={() => fetchData()}>Refresh</button>
          <button className="btn-action">Download CSV</button>
          <button className="btn-action" onClick={signOut}>Sign out</button>
        </div>
      </div>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 900, color: "#fff", margin: 0 }}>Bay 5 Dashboard</h1>
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
          <button
            className="btn-action"
            onClick={signOut}
            style={{ marginTop: "6px", padding: "6px 12px", fontSize: "11px", borderColor: "var(--danger)", color: "var(--danger)" }}
          >
            Log out
          </button>
        </div>
      </header>

      {assignStatus && (
        <div style={{ position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)", zIndex: 10000, padding: "10px 20px", background: "var(--bg-section)", border: "1px solid var(--border-strong)", borderRadius: "6px", fontSize: "12px", color: "var(--fg-dim)", boxShadow: "var(--shadow-card)" }}>
          {assignStatus}
        </div>
      )}

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

      {/* Auto Suggest Panel */}
      {showAutoSuggest && (
        <section style={{ background: "rgba(4, 14, 28, 0.92)", border: "1px solid var(--border-strong)", borderRadius: "6px", backdropFilter: "blur(8px)", overflow: "hidden" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border-table)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>Auto Suggest</h2>
              <span style={{ background: "rgba(0,186,124,0.15)", color: "var(--success)", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "9999px" }}>
                {totalSuggestCount} task{totalSuggestCount !== 1 ? "s" : ""}
              </span>
            </div>
            <button onClick={() => setShowAutoSuggest(false)} style={{ background: "none", border: "none", color: "var(--fg-muted)", fontSize: "18px", cursor: "pointer", lineHeight: 1, padding: "2px 6px" }} aria-label="Close">&times;</button>
          </div>
          {/* Explanation banner */}
          <div style={{ padding: "8px 16px", background: "rgba(14, 36, 61, 0.5)", borderBottom: "1px solid var(--border-table)", fontSize: "11px", color: "var(--fg-muted)" }}>
            Suggested assignments for inbound RN and outbound DN tasks. Review below, then press Auto Assign All to send confirmed assignments to WISE.
          </div>
          {/* Auto Assign All button + history toggle */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-table)", display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={handleAutoAssignAll} style={{ background: "var(--success)", color: "#fff", border: "none", borderRadius: "5px", padding: "7px 18px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              Auto Assign All
            </button>
            <label style={{ fontSize: "10px", color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
              <input type="checkbox" checked={showAssignedHistory} onChange={(e) => setShowAssignedHistory(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
              Show assigned by this dashboard
            </label>
            {assignedByDashboard.size > 0 && (
              <button onClick={() => { clearAssignedHistory(); setAssignedByDashboard(new Set()); }} style={{ background: "none", border: "none", color: "var(--fg-muted)", fontSize: "10px", cursor: "pointer", textDecoration: "underline" }}>
                Clear history ({assignedByDashboard.size})
              </button>
            )}
          </div>
          {/* Table */}
          {loading ? (
            <div className="empty-state">Loading suggestions...</div>
          ) : totalSuggestCount === 0 ? (
            <div className="empty-state">No tasks are available right now.</div>
          ) : (
            <div className="overflow-x-auto" style={{ padding: "0" }}>
              <table>
                <thead>
                  <tr>
                    <th>Work Type</th>
                    <th>Order / RN</th>
                    <th>Customer</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Order Type</th>
                    <th>Assignee</th>
                    <th>Action</th>
                    <th>Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReceipts.map((r, i) => (
                    <tr key={`rn-${r.id || i}`}>
                      <td>Inbound</td>
                      <td className="font-mono">{r.equipmentNumber ? `${r.equipmentNumber} | ${r.receiptId || r.entryTicket || "—"}` : (r.receiptId || r.entryTicket || r.id || "—")}</td>
                      <td>{r.customerName || r.customer || "—"}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <select
                            value={selectedDocks[r.entryTicket || r.id || String(i)] || r.dockId || ""}
                            onChange={(e) => setSelectedDocks((prev) => ({ ...prev, [r.entryTicket || r.id || String(i)]: e.target.value }))}
                            onFocus={() => loadDocks()}
                            style={{ minWidth: "90px", background: "rgba(7, 20, 40, 0.92)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--fg-dim)", padding: "3px 6px", fontSize: "10px" }}
                          >
                            <option value={r.dockId || ""}>{r.location || r.dockId || "—"}</option>
                            {dockList.filter((d) => d.id !== (r.dockId || "")).map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          {(selectedDocks[r.entryTicket || r.id || String(i)] && selectedDocks[r.entryTicket || r.id || String(i)] !== (r.dockId || "")) && (
                            <button
                              className="btn-action"
                              style={{ padding: "1px 5px", fontSize: "8px", borderColor: "var(--warning)", color: "var(--warning)" }}
                              onClick={() => {
                                const newId = selectedDocks[r.entryTicket || r.id || String(i)];
                                const dock = dockList.find((d) => d.id === newId);
                                setDockConfirm({ row: r, newDockId: newId, newDockName: dock?.name || newId });
                              }}
                            >
                              Move
                            </button>
                          )}
                        </div>
                      </td>
                      <td><span style={{ background: "rgba(77,105,255,0.12)", color: "var(--accent)", padding: "1px 6px", borderRadius: "3px", fontSize: "10px" }}>{r.status || "FULL"}</span></td>
                      <td>Container</td>
                      <td>
                        <select
                          value={selectedAssignees[r.entryTicket || r.id || String(i)] || r.assignee || ""}
                          onChange={(e) => setSelectedAssignees((prev) => ({ ...prev, [r.entryTicket || r.id || String(i)]: e.target.value }))}
                          style={{ minWidth: "170px", background: "rgba(7, 20, 40, 0.92)", border: "1px solid var(--border-strong)", borderRadius: "5px", color: "#fff", padding: "5px 8px", fontSize: "11px", fontWeight: 600 }}
                        >
                          {BAY5_ASSIGNEES.map((a) => (
                            <option key={a.userId} value={a.displayName}>{a.displayName}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className="btn-action"
                          style={{ padding: "2px 8px", fontSize: "9px", background: r.assigneeUserId ? "rgba(0,186,124,0.12)" : "rgba(255,255,255,0.05)", color: r.assigneeUserId ? "var(--success)" : "var(--fg-muted)", borderColor: r.assigneeUserId ? "var(--success)" : "var(--border)" }}
                          onClick={() => {
                            const selectedName = selectedAssignees[r.entryTicket || r.id || String(i)] || r.assignee || "";
                            const selected = BAY5_ASSIGNEES.find((a) => a.displayName === selectedName);
                            setAssignConfirm({ row: { ...r, assignee: selected?.displayName || selectedName || r.assignee, assigneeUserId: selected?.userId || r.assigneeUserId }, type: "inyard" });
                          }}
                        >
                          Assign
                        </button>
                      </td>
                      <td style={{ fontSize: "10px", color: "var(--fg-muted)" }}>Customer match</td>
                    </tr>
                  ))}
                  {visibleOrders.map((o, i) => (
                    <tr key={`dn-${o.id || i}`}>
                      <td>Outbound</td>
                      <td className="font-mono">{o.id || "—"}</td>
                      <td>{o.customerName || "—"}</td>
                      <td style={{ fontSize: "10px", color: "var(--fg-muted)" }}>—</td>
                      <td><span style={{ background: "rgba(77,105,255,0.12)", color: "var(--accent)", padding: "1px 6px", borderRadius: "3px", fontSize: "10px" }}>{o.status || "PLANNED"}</span></td>
                      <td>{o.shipMethod || "—"}</td>
                      <td>
                        <select
                          value={selectedAssignees[o.id || String(i + 10000)] || o.assignee || ""}
                          onChange={(e) => setSelectedAssignees((prev) => ({ ...prev, [o.id || String(i + 10000)]: e.target.value }))}
                          style={{ minWidth: "170px", background: "rgba(7, 20, 40, 0.92)", border: "1px solid var(--border-strong)", borderRadius: "5px", color: "#fff", padding: "5px 8px", fontSize: "11px", fontWeight: 600 }}
                        >
                          {BAY5_ASSIGNEES.map((a) => (
                            <option key={a.userId} value={a.displayName}>{a.displayName}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className="btn-action"
                          style={{ padding: "2px 8px", fontSize: "9px", opacity: 0.4 }}
                          disabled
                          title="Live assignment not enabled for planned orders"
                        >
                          Review only
                        </button>
                      </td>
                      <td style={{ fontSize: "10px", color: "var(--fg-muted)" }}>Customer match</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        <button type="button" onClick={() => setActiveKpi(activeKpi === "inyard" ? null : "inyard")} style={{ all: "unset", cursor: "pointer", background: "var(--bg-card)", border: activeKpi === "inyard" ? "1px solid var(--accent)" : "1px solid var(--border-strong)", borderRadius: "6px", padding: "16px 18px", boxShadow: "var(--shadow-card)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center" }}>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--fg-bright)" }}>{loading ? "—" : visibleReceipts.length}</span>
          <span style={{ fontSize: "10px", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>In-Yard FULL</span>
        </button>
        <button type="button" onClick={() => setActiveKpi(activeKpi === "allinbounds" ? null : "allinbounds")} style={{ all: "unset", cursor: "pointer", background: "var(--bg-card)", border: activeKpi === "allinbounds" ? "1px solid var(--accent)" : "1px solid var(--border-strong)", borderRadius: "6px", padding: "16px 18px", boxShadow: "var(--shadow-card)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center" }}>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--fg-bright)" }}>{loading ? "—" : allInboundCount}</span>
          <span style={{ fontSize: "10px", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>All Inbounds</span>
        </button>
        <button type="button" onClick={() => setActiveKpi(activeKpi === "planned" ? null : "planned")} style={{ all: "unset", cursor: "pointer", background: "var(--bg-card)", border: activeKpi === "planned" ? "1px solid var(--accent)" : "1px solid var(--border-strong)", borderRadius: "6px", padding: "16px 18px", boxShadow: "var(--shadow-card)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center" }}>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--fg-bright)" }}>{loading ? "—" : orders.length}</span>
          <span style={{ fontSize: "10px", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Planned Orders</span>
        </button>
        <button type="button" onClick={() => setActiveKpi(activeKpi === "older48" ? null : "older48")} style={{ all: "unset", cursor: "pointer", background: "var(--bg-card)", border: activeKpi === "older48" ? "1px solid var(--accent)" : "1px solid var(--border-strong)", borderRadius: "6px", padding: "16px 18px", boxShadow: "var(--shadow-card)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center" }}>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--fg-bright)" }}>{loading ? "—" : orders.filter(o => { if (!o.createdTime) return false; return (Date.now() - new Date(o.createdTime).getTime()) > 48 * 3600000; }).length}</span>
          <span style={{ fontSize: "10px", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Older than 48h</span>
        </button>
      </div>

      {/* KPI Detail Panel */}
      {activeKpi && (() => {
        const olderThan48 = orders.filter(o => { if (!o.createdTime) return false; return (Date.now() - new Date(o.createdTime).getTime()) > 48 * 3600000; });
        const panelData: { title: string; rows: Array<{ left: string; right: string }> } =
          activeKpi === "inyard" ? { title: `In-Yard FULL — ${visibleReceipts.length} containers`, rows: visibleReceipts.map(r => ({ left: `${r.equipmentNumber || r.containerNo || "—"} · ${r.receiptId || r.entryTicket || ""}`, right: r.customerName || r.customer || "—" })) } :
          activeKpi === "allinbounds" ? { title: `All Inbounds — ${allInboundCount} total`, rows: allInboundRows.map(r => ({ left: `${r.equipmentNumber || r.containerNo || "—"} · ${r.receiptId || r.entryTicket || ""}`, right: r.customerName || r.customer || "—" })) } :
          activeKpi === "planned" ? { title: `Planned Orders — ${orders.length} total`, rows: orders.slice(0, 30).map(o => ({ left: `${o.id || "—"} · ${o.customerName || ""}`, right: o.shipMethod || "Pending" })) } :
          { title: `Older than 48h — ${olderThan48.length} orders`, rows: olderThan48.slice(0, 30).map(o => ({ left: `${o.id || "—"} · ${o.customerName || ""}`, right: formatPDT(o.createdTime) })) };
        return (
          <div className="section-card" style={{ border: "1px solid var(--accent)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border-table)" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#f4f8ff" }}>{panelData.title}</span>
              <button onClick={() => setActiveKpi(null)} style={{ background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", fontSize: "14px" }}>✕</button>
            </div>
            {panelData.rows.length === 0 ? (
              <div className="empty-state">No items.</div>
            ) : (
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                {panelData.rows.map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 14px", borderBottom: "1px solid var(--border-table)", fontSize: "11px" }}>
                    <span style={{ color: "var(--fg)" }}>{row.left}</span>
                    <span style={{ color: "var(--fg-muted)" }}>{row.right}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                <span style={{ fontSize: "10px", color: "var(--fg-muted)" }}>{filteredReceipts.length} of {visibleReceipts.length}</span>
              </div>
            </div>
            <div style={{ padding: "6px 14px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
              <span className={`filter-chip ${!receiptCustomerFilter ? "active" : ""}`} onClick={() => setReceiptCustomerFilter(null)}>All</span>
              {receiptCustomerNames.map((name) => (
                <span
                  key={name}
                  className={`filter-chip ${receiptCustomerFilter === name ? "active" : ""}`}
                  onClick={() => setReceiptCustomerFilter(receiptCustomerFilter === name ? null : name)}
                >
                  {name} <span style={{ opacity: 0.75 }}>{receiptCustomerCounts.get(name) || 0}</span>
                </span>
              ))}
            </div>
            {loading ? (
              <div className="empty-state">Loading...</div>
            ) : filteredReceipts.length === 0 ? (
              <div className="empty-state">No in-yard FULL equipment matched the Bay 5 scope.</div>
            ) : (
              <div className="overflow-x-auto section-scroll-10 section-1-scroll">
                <table>
                  <thead>
                    <tr>
                      <th onClick={() => toggleReceiptSort("containerNo")}>Equipment # <SortArrow col="containerNo" sort={receiptSort} /></th>
                      <th onClick={() => toggleReceiptSort("id")}>RN # <SortArrow col="id" sort={receiptSort} /></th>
                      <th onClick={() => toggleReceiptSort("checkIn")}>Check-in (PT) <SortArrow col="checkIn" sort={receiptSort} /></th>
                      <th onClick={() => toggleReceiptSort("timeInYard")}>Time in Yard <SortArrow col="timeInYard" sort={receiptSort} /></th>
                      <th onClick={() => toggleReceiptSort("customerName")}>Customer <SortArrow col="customerName" sort={receiptSort} /></th>
                      <th onClick={() => toggleReceiptSort("location")}>Location <SortArrow col="location" sort={receiptSort} /></th>
                      <th onClick={() => toggleReceiptSort("assignee")}>Assignee <SortArrow col="assignee" sort={receiptSort} /></th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReceipts.map((r, i) => (
                      <tr key={r.id || i}>
                        <td className="font-mono">{r.equipmentNumber || r.containerNo || r.trailerNo || "—"}</td>
                        <td className="font-mono">{r.equipmentNumber ? `${r.equipmentNumber} | ${r.receiptId || r.entryTicket || "—"}` : (r.receiptId || r.entryTicket || r.id || "—")}</td>
                        <td>{r.checkIn ? formatPDT(r.checkIn) : formatPDT(r.inYardTime)}</td>
                        <td>{r.timeInYard || timeInYard(r.checkIn || r.inYardTime)}</td>
                        <td>{r.customerName || r.customer || "—"}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <select
                              value={selectedDocks[`section1-${r.entryTicket || r.id || String(i)}`] || r.dockId || ""}
                              onChange={(e) => setSelectedDocks((prev) => ({ ...prev, [`section1-${r.entryTicket || r.id || String(i)}`]: e.target.value }))}
                              onFocus={() => loadDocks()}
                              style={{ minWidth: "100px", background: "rgba(7, 20, 40, 0.92)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--fg-dim)", padding: "3px 6px", fontSize: "10px" }}
                            >
                              <option value={r.dockId || ""}>{r.location || r.dockId || "—"}</option>
                              {dockList.filter((d) => d.id !== (r.dockId || "")).map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            {(selectedDocks[`section1-${r.entryTicket || r.id || String(i)}`] && selectedDocks[`section1-${r.entryTicket || r.id || String(i)}`] !== (r.dockId || "")) && (
                              <button
                                className="btn-action"
                                style={{ padding: "1px 5px", fontSize: "8px", borderColor: "var(--warning)", color: "var(--warning)" }}
                                onClick={() => {
                                  const newId = selectedDocks[`section1-${r.entryTicket || r.id || String(i)}`];
                                  const dock = dockList.find((d) => d.id === newId);
                                  setDockConfirm({ row: r, newDockId: newId, newDockName: dock?.name || newId });
                                }}
                              >
                                Move
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <select
                            value={selectedAssignees[`section1-${r.entryTicket || r.id || String(i)}`] || r.assignee || ""}
                            onChange={(e) => setSelectedAssignees((prev) => ({ ...prev, [`section1-${r.entryTicket || r.id || String(i)}`]: e.target.value }))}
                            style={{ minWidth: "150px", background: "rgba(7, 20, 40, 0.92)", border: "1px solid var(--border-strong)", borderRadius: "5px", color: "#fff", padding: "4px 8px", fontSize: "11px", fontWeight: 600 }}
                          >
                            {BAY5_ASSIGNEES.map((a) => (
                              <option key={a.userId} value={a.displayName}>{a.displayName}</option>
                            ))}
                          </select>
                        </td>
                        <td><button className="btn-action" style={{ padding: "3px 8px", fontSize: "9px" }} onClick={() => {
                          const selectedName = selectedAssignees[`section1-${r.entryTicket || r.id || String(i)}`] || r.assignee || "";
                          const selected = BAY5_ASSIGNEES.find((a) => a.displayName === selectedName);
                          setAssignConfirm({ row: { ...r, assignee: selected?.displayName || selectedName || r.assignee, assigneeUserId: selected?.userId || r.assigneeUserId }, type: "inyard" });
                        }}>Assign</button></td>
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
                  <span key={name} className={`filter-chip ${customerFilter === name ? "active" : ""}`} onClick={() => setCustomerFilter(customerFilter === name ? null : name)}>
                    {name} <span style={{ opacity: 0.75 }}>{orderCustomerCounts.get(name) || 0}</span>
                  </span>
                ))}
              </div>
            )}

            {loading ? (
              <div className="empty-state">Loading...</div>
            ) : sortedOrders.length === 0 ? (
              <div className="empty-state">No orders match the current filters.</div>
            ) : (
              <div className="overflow-x-auto section-scroll-10">
                <table>
                  <thead>
                    <tr>
                      <th onClick={() => toggleOrderSort("id")}>Order # <SortArrow col="id" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("customerName")}>Customer <SortArrow col="customerName" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("assignee")}>Assignee <SortArrow col="assignee" sort={orderSort} /></th>
                      <th>Action</th>
                      <th onClick={() => toggleOrderSort("createdTime")}>Created Date <SortArrow col="createdTime" sort={orderSort} /></th>
                      <th onClick={() => toggleOrderSort("location")}>Location <SortArrow col="location" sort={orderSort} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map((o, i) => (
                      <tr key={o.id || i}>
                        <td className="font-mono">{o.id || "—"}</td>
                        <td>{o.customerName || "—"}</td>
                        <td>
                          <select
                            value={selectedAssignees[o.id || String(i + 20000)] || o.assignee || ""}
                            onChange={(e) => setSelectedAssignees((prev) => ({ ...prev, [o.id || String(i + 20000)]: e.target.value }))}
                            style={{ minWidth: "150px", background: "rgba(7, 20, 40, 0.92)", border: "1px solid var(--border-strong)", borderRadius: "5px", color: "#fff", padding: "4px 7px", fontSize: "10px", fontWeight: 600 }}
                          >
                            {BAY5_ASSIGNEES.map((a) => (
                              <option key={a.userId} value={a.displayName}>{a.displayName}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            className="btn-action"
                            style={{ padding: "3px 8px", fontSize: "9px", background: "rgba(0,186,124,0.12)", color: "var(--success)", borderColor: "var(--success)" }}
                            onClick={() => {
                              const selectedName = selectedAssignees[o.id || String(i + 20000)] || o.assignee || "";
                              const selected = BAY5_ASSIGNEES.find((a) => a.displayName === selectedName);
                              setAssignConfirm({ row: { ...o, assignee: selected?.displayName || selectedName || o.assignee, assigneeUserId: selected?.userId || o.assigneeUserId }, type: "order" });
                            }}
                          >
                            Assign
                          </button>
                        </td>
                        <td>{formatPDT(o.createdTime)}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <select
                              value={selectedDocks[`section2-${o.id || String(i)}`] || o.dockId || ""}
                              onChange={(e) => setSelectedDocks((prev) => ({ ...prev, [`section2-${o.id || String(i)}`]: e.target.value }))}
                              onFocus={() => loadDocks()}
                              style={{ minWidth: "100px", background: "rgba(7, 20, 40, 0.92)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--fg-dim)", padding: "3px 6px", fontSize: "10px" }}
                            >
                              <option value={o.dockId || ""}>{o.location || o.dockId || "—"}</option>
                              {dockList.filter((d) => d.id !== (o.dockId || "")).map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            {(selectedDocks[`section2-${o.id || String(i)}`] && selectedDocks[`section2-${o.id || String(i)}`] !== (o.dockId || "")) && (
                              <button
                                className="btn-action"
                                style={{ padding: "1px 5px", fontSize: "8px", borderColor: "var(--warning)", color: "var(--warning)" }}
                                onClick={() => {
                                  const newId = selectedDocks[`section2-${o.id || String(i)}`];
                                  const dock = dockList.find((d) => d.id === newId);
                                  setOrderDockConfirm({ row: o, newDockId: newId, newDockName: dock?.name || newId });
                                }}
                              >
                                Move
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 3 - Outbound Shipping (NEW loads with PICKED DNs) */}
          {shippingLoads.length > 0 && (
            <section className="section-card">
              <div className="section-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 className="section-title">Section 3 - Outbound Shipping</h2>
                  <span style={{ fontSize: "10px", color: "var(--fg-muted)" }}>{shippingLoads.length} rows</span>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>DN / Order</th>
                      <th>Customer</th>
                      <th>DN Status</th>
                      <th>Load Status</th>
                      <th>Dock</th>
                      <th>ET</th>
                      <th>Assignee</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shippingLoads.map((row, i) => (
                      <tr key={`ship-${row.loadTaskId || i}`}>
                        <td className="font-mono">{row.id || "—"}</td>
                        <td>{row.customerName || "—"}</td>
                        <td><span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", background: "rgba(0,230,138,0.1)", color: "var(--success)" }}>{row.status || "PICKED"}</span></td>
                        <td><span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", background: "rgba(77,105,255,0.1)", color: "var(--accent)" }}>{row.loadStatus || "NEW"}</span></td>
                        <td>{row.dockId || "—"}</td>
                        <td className="font-mono">{row.entryId || "—"}</td>
                        <td>
                          <select
                            value={selectedAssignees[`ship-${row.loadTaskId || i}`] || row.assignee || ""}
                            onChange={(e) => setSelectedAssignees((prev) => ({ ...prev, [`ship-${row.loadTaskId || i}`]: e.target.value }))}
                            style={{ minWidth: "150px", background: "rgba(7, 20, 40, 0.92)", border: "1px solid var(--border-strong)", borderRadius: "5px", color: "#fff", padding: "4px 8px", fontSize: "11px", fontWeight: 600 }}
                          >
                            {BAY5_ASSIGNEES.map((a) => (
                              <option key={a.userId} value={a.displayName}>{a.displayName}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            className="btn-action"
                            style={{ padding: "2px 8px", fontSize: "9px", background: row.entryId ? "rgba(0,186,124,0.12)" : "rgba(255,255,255,0.05)", color: row.entryId ? "var(--success)" : "var(--fg-muted)", borderColor: row.entryId ? "var(--success)" : "var(--border)" }}
                            disabled={!row.entryId}
                            title={row.entryId ? "Assign load task" : "No ET — cannot assign"}
                            onClick={() => {
                              if (!row.entryId) return;
                              const selectedName = selectedAssignees[`ship-${row.loadTaskId || i}`] || row.assignee || "";
                              const selected = BAY5_ASSIGNEES.find((a) => a.displayName === selectedName);
                              setAssignConfirm({ row: { ...row, assignee: selected?.displayName || selectedName, assigneeUserId: selected?.userId || row.assigneeUserId }, type: "order" });
                            }}
                          >
                            {row.entryId ? "Assign" : "No ET"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", position: "sticky", top: "12px" }}>
          {/* Assigned Today Card */}
          <aside className="section-card">
            <div className="section-header">
              <h2 className="section-title">Assigned Today</h2>
              <span style={{ fontSize: "10px", color: "var(--fg-muted)" }}>{assignedTodayList.length} task{assignedTodayList.length !== 1 ? "s" : ""}</span>
            </div>
            {assignedTodayList.length === 0 ? (
              <div className="empty-state">No tasks assigned by this dashboard today.</div>
            ) : (
              <div style={{ padding: "8px", maxHeight: "200px", overflowY: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ fontSize: "9px" }}>Task</th>
                      <th style={{ fontSize: "9px" }}>Assignee</th>
                      <th style={{ fontSize: "9px" }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedTodayList.map((rec, i) => (
                      <tr key={`${rec.key}-${i}`}>
                        <td className="font-mono" style={{ fontSize: "10px" }}>{rec.key}</td>
                        <td style={{ fontSize: "10px", color: "var(--accent)" }}>{rec.assignee}</td>
                        <td style={{ fontSize: "10px", color: "var(--fg-muted)" }}>{rec.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </aside>

          {/* Bay 5 Assignees */}
          <aside className="section-card">
            <div className="section-header">
              <h2 className="section-title">Bay 5 Assignees</h2>
            </div>
            <div style={{ minHeight: "360px" }} />
          </aside>
        </div>
      </div>

      {/* Assignment Confirmation Modal */}
      {assignConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--bg-section)", border: "1px solid var(--border-strong)", borderRadius: "8px", padding: "20px 24px", maxWidth: "400px", width: "90%" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>Confirm Assignment</h3>
            <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "6px" }}>
              Task: <strong style={{ color: "#fff" }}>{(assignConfirm.row as Receipt).receiptId || (assignConfirm.row as Receipt).entryTicket || assignConfirm.row.id || "—"}</strong>
            </p>
            <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "6px" }}>
              Customer: <strong style={{ color: "#fff" }}>{assignConfirm.row.customerName || "—"}</strong>
            </p>
            <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "10px" }}>
              Assign to: <strong style={{ color: "var(--accent)" }}>{assignConfirm.row.assignee || "Unassigned"}</strong>
            </p>
            {assignConfirm.type === "inyard" ? (
              <p style={{ fontSize: "11px", color: "var(--success)", marginBottom: "16px" }}>
                Press OK to send this assignment to WISE.
              </p>
            ) : (
              <p style={{ fontSize: "11px", color: "var(--fg-muted)", marginBottom: "16px" }}>
                Press OK to create or locate the WISE pick task, then assign it to the selected assignee.
              </p>
            )}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button className="btn-action" onClick={() => setAssignConfirm(null)} style={{ padding: "6px 14px", fontSize: "11px" }}>Cancel</button>
              <button className="btn-action primary" onClick={handleAssignConfirm} disabled={assigning} style={{ padding: "6px 14px", fontSize: "11px" }}>{assigning ? "Sending..." : "OK"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Dock Change Confirmation Modal */}
      {dockConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--bg-section)", border: "1px solid var(--border-strong)", borderRadius: "8px", padding: "20px 24px", maxWidth: "400px", width: "90%" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>Confirm Dock Change</h3>
            <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "6px" }}>
              Task: <strong style={{ color: "#fff" }}>{dockConfirm.row.receiptId || dockConfirm.row.entryTicket || "—"}</strong>
            </p>
            <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "6px" }}>
              Current: <strong style={{ color: "#fff" }}>{dockConfirm.row.location || "—"}</strong>
            </p>
            <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "10px" }}>
              Move to: <strong style={{ color: "var(--warning)" }}>{dockConfirm.newDockName}</strong>
            </p>
            <p style={{ fontSize: "11px", color: "var(--success)", marginBottom: "16px" }}>
              Press OK to change dock assignment in WISE.
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button className="btn-action" onClick={() => setDockConfirm(null)} style={{ padding: "6px 14px", fontSize: "11px" }}>Cancel</button>
              <button className="btn-action primary" onClick={handleDockChange} disabled={assigning} style={{ padding: "6px 14px", fontSize: "11px" }}>{assigning ? "Sending..." : "OK"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Outbound Dock Change Confirmation Modal */}
      {orderDockConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--bg-section)", border: "1px solid var(--border-strong)", borderRadius: "8px", padding: "20px 24px", maxWidth: "400px", width: "90%" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>Confirm Dock Change</h3>
            <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "6px" }}>
              DN: <strong style={{ color: "#fff" }}>{orderDockConfirm.row.id || "—"}</strong>
            </p>
            <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "6px" }}>
              Current: <strong style={{ color: "#fff" }}>{orderDockConfirm.row.location || "—"}</strong>
            </p>
            <p style={{ fontSize: "12px", color: "var(--fg-dim)", marginBottom: "10px" }}>
              Move to: <strong style={{ color: "var(--warning)" }}>{orderDockConfirm.newDockName}</strong>
            </p>
            <p style={{ fontSize: "11px", color: "var(--success)", marginBottom: "16px" }}>
              Press OK to change the outbound load dock in WISE.
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button className="btn-action" onClick={() => setOrderDockConfirm(null)} style={{ padding: "6px 14px", fontSize: "11px" }}>Cancel</button>
              <button className="btn-action primary" onClick={handleOrderDockChange} disabled={assigning} style={{ padding: "6px 14px", fontSize: "11px" }}>{assigning ? "Sending..." : "OK"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "10px 0", fontSize: "10px", color: "var(--fg-muted)", borderTop: "1px solid var(--border-table)" }}>
        Bay 5 Dashboard &mdash; Valley View (LT_F1) &mdash; {TIMEZONE}
        {generatedAt && ` — ${generatedAt.toLocaleString("en-US", { timeZone: TIMEZONE })}`}
      </footer>
    </div>
  );
}
