import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";

const DATA_PATH = "/tmp/bay3-assigned-today.json";

interface AssignedRecord {
  key: string;
  assignee: string;
  customer: string;
  time: string;
  date: string;
  tenant?: string;
  facility?: string;
}

function readRecords(): AssignedRecord[] {
  try {
    if (existsSync(DATA_PATH)) {
      return JSON.parse(readFileSync(DATA_PATH, "utf-8"));
    }
  } catch { /* ignore corrupt file */ }
  return [];
}

function writeRecords(records: AssignedRecord[]) {
  writeFileSync(DATA_PATH, JSON.stringify(records, null, 2));
}

function getTodayPT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export async function GET() {
  const today = getTodayPT();
  const all = readRecords();
  const todayRecords = all.filter((r) => r.date === today);
  return NextResponse.json({ records: todayRecords });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const record: AssignedRecord = {
      key: body.key || "",
      assignee: body.assignee || "",
      customer: body.customer || "",
      time: body.time || new Date().toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }),
      date: body.date || getTodayPT(),
      tenant: body.tenant || "LT",
      facility: body.facility || "LT_F1",
    };

    if (!record.key) {
      return NextResponse.json({ error: "missing key" }, { status: 400 });
    }

    const all = readRecords();
    const today = getTodayPT();
    const todayRecords = all.filter((r) => r.date === today);
    const alreadyExists = todayRecords.some((r) => r.key === record.key);
    if (alreadyExists) {
      return NextResponse.json({ records: todayRecords, duplicate: true });
    }

    todayRecords.push(record);
    writeRecords(todayRecords);
    return NextResponse.json({ records: todayRecords, added: true });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
