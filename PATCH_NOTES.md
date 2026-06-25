# Bay 3 Dashboard — Dock Validation Safeguards

**Date:** 2026-06-23  
**Context:** Prevents incorrect WMS receive task creation that causes downstream Check In errors (e.g. TXGU8156852 / RN-5008005 / ET-1112644 scenario where physical door was DOCK47 but task was created with stale/mismatched dock).

## Changes

### 1. Receive task creation now uses verified dock state (assignInYardRow)

**Before:** The `dockId` passed to `/wms/inbound/receive-task/create` came directly from the row's cached data, which could be up to 5 minutes stale due to the dashboard refresh interval.

**After:** Before creating a new receive task, the code calls `GET /wms-bam/entry-ticket/{etId}` in real-time to:
- Get the **verified current dock** from the live entry ticket detail (not stale row data)
- Validate the entry ticket is in a check-in state that allows task creation (WINDOW CHECKED IN, DOCK CHECKED IN, GATE CHECKED IN, or WAITING)
- Block with a clear business message if the ET is unreachable, in an invalid state, or has no dock assigned

If the live dock differs from the stale row dock, the verified value is used.

### 2. Dock change (window-checkin) is now guarded (handleDockChange)

**Before:** Clicking "Change Dock" immediately called `/wms-bam/entry-ticket/window-checkin/{etId}` regardless of the entry ticket's current state. If the ET was already checked in at a dock, this could create conflicting state.

**After:**
- Refreshes entry ticket state before any mutation
- If the ET is already at the selected dock: no-op with informational message
- If the ET is already Dock/Window Checked In at a **different** dock: shows a confirmation dialog explaining this is a dock move, and only proceeds if the user explicitly confirms
- If the ET state cannot be verified: blocks with an error message

### 3. Helper: refreshEntryTicketState

New `useCallback` that fetches live entry ticket detail and returns:
- `verifiedDockId` / `verifiedDockName` — the actual current dock from equipment actions or receipt
- `etStatus` — the entry ticket's current workflow status
- `receiptId` — resolved receipt ID from the entry ticket

Used by both `assignInYardRow` and `handleDockChange` to ensure mutations operate on verified state.

## What is NOT changed

- UI/design, layout, styling — all preserved
- Outbound pick task assignment flow — unchanged (no dock validation needed there)
- Auto Assign All — now inherits the `assignInYardRow` safeguards automatically
- Dashboard data loading/refresh logic — unchanged
- Auth flow — unchanged
- API routes (`/api/assigned-today`, `/api/dashboard-bay3`) — unchanged

## Environment Variables

Configure in `.env.local` (see `.env.example`):

```
NEXT_PUBLIC_WMS_API_BASE_URL=https://unis.item.com/api
NEXT_PUBLIC_IAM_BASE_URL=https://id.item.com
NEXT_PUBLIC_FACILITY_ID=LT_F1
NEXT_PUBLIC_TENANT_ID=LT
NEXT_PUBLIC_TIMEZONE=America/Los_Angeles
```

## Deployment

1. Copy `.env.example` to `.env.local` (or set env vars in Coolify/hosting)
2. `npm install`
3. `npm run build`
4. `npm run start` (serves on 0.0.0.0:3000)

The Dockerfile in the repo handles this for container deployments.

---

## 2026-06-23 (patch 2) — Closed receipts excluded from active dashboard

**Context:** Container CAAU8710878 / RN-5008291 / ET-1112398 / TASK-5298538 still appeared in the dashboard despite all WMS statuses being CLOSED. The upstream in-yard API does not filter by receipt lifecycle status, so closed containers leaked into the actionable view.

### Changes

#### 1. `INACTIVE_STATUSES` constant + `isInactiveStatus()` helper

Centralized set of terminal statuses (`CLOSED`, `FORCE_CLOSED`, `CANCELLED`, `TASK_COMPLETED`) and a case-insensitive check function. All filtering paths now use this instead of scattered inline arrays.

#### 2. In-yard enrichment now excludes closed rows

During the RN lookup step, the receipt status and entry ticket status are now captured from the entry ticket detail response. Rows whose receipt or ET is in an inactive status are filtered out before they reach the `setReceipts()` call.

#### 3. Supplement fetch also filters by receipt status

The supplemental receipt search (Section 1 backfill) already requested `excludeStatuses` from the API, but now also applies a client-side `isInactiveStatus()` check on each row as a safety net against API inconsistencies.

#### 4. `visibleReceipts` / `visibleOrders` / `shippingLoads` safety filter

The computed display lists that feed the table UI now also exclude rows with inactive statuses, ensuring that even if a closed row somehow enters state (race condition, stale localStorage), it won't render as actionable.

#### 5. Pick task search uses `isInactiveStatus`

The outbound `findPickTasks` filter replaced its inline status array with the shared helper.

### Behavior

- Closed/completed containers no longer appear in the active Bay 3 dashboard by default.
- No "historical/archive" mode was added — closed rows are simply hidden from the actionable list. The existing "Show Assigned History" toggle only shows dashboard-assigned rows, not WMS-closed rows.
- If an operator searches for a closed container, it will not appear in results (same as any non-active row).

---

## 2026-06-24 (patch 3) — Dock assignment now syncs to WMS receive task + post-verification

**Context:** When Martín assigned a dock from the dashboard, the `window-checkin` call updated the entry ticket's dock in WMS/BAM, but the **receive task's `dockId`** was not updated. The handheld reads the receive task's dock during Dock Check In, so it displayed the old dock name and Check In sometimes failed. Example: ONEU6407746 / ET-1112740 / TASK-5299774 showed DOCK43 (id 543) correctly in WMS entry ticket but the task/handheld could lag behind.

### Root cause

The previous `handleDockChange` only called `POST /wms-bam/entry-ticket/window-checkin/{entryId}` which updates the entry ticket dock. The WMS receive task object (`/wms/inbound/receive-task`) has its own `dockId` field that was never explicitly updated — the handheld reads this field, not the entry ticket.

### Fix: 3-step transactional dock sync

The new `handleDockChange` performs:

1. **WMS window-checkin** (`POST /wms-bam/entry-ticket/window-checkin/{entryId}`) — updates the entry ticket dock assignment (existing behavior, preserved).

2. **WMS receive task dockId update** (`PUT /wms/inbound/receive-task/batch-update`) — if a receive task exists for this entry, explicitly sets `dockId` on the task so the handheld reflects the correct dock. Uses the ontology-confirmed contract: `[{id: taskId, dockId: newDockId}]`.

3. **Post-verification** — refetches the entry ticket detail via `GET /wms-bam/entry-ticket/{entryId}` and confirms the dock ID matches the requested dock. Only updates local UI state if verification passes.

### Error handling

| Scenario | UI message |
|----------|-----------|
| Window-checkin fails | "WMS did not accept the window check-in — verify the entry ticket is eligible." |
| Checkin OK but task update fails | "Dock assigned but receive task dock could not be updated. Handheld may show old dock. Retry or update in WISE." |
| Checkin OK but verification shows dock didn't propagate | "Dock assigned in yard, but WMS has not confirmed it yet. Wait and retry or verify in WISE before Check In." |
| Full success | "Dock changed to {name}. Verified in WMS." |

### API contracts used (from ontology discovery)

- `POST /wms-bam/entry-ticket/window-checkin/{entryId}` — WMS BAM write endpoint, updates ET dock + optional inbound task
- `PUT /wms/inbound/receive-task/batch-update` — WMS core write endpoint, accepts `[{id, dockId, ...}]` to update receive task fields
- `GET /wms-bam/entry-ticket/{entryId}` — read-only verification

### Why both systems must agree

The WMS window-checkin updates the entry ticket (BAM layer), but the handheld/WISE reads the receive task's `dockId` for the Dock Check In screen. If they disagree, the operator sees the wrong dock name on the handheld and Check In fails validation. This is why the dashboard now updates both and verifies.

---

## 2026-06-24 (patch 4) — Container Lookup + Workflow Reference panels

**Context:** Martín needs to see today's operational learnings inside the dashboard (not rely on chat history) and have a way to look up any container's receiving readiness before assigning.

### New: "Buscar Contenedor" (Container Lookup) — Section 4

A new section below Outbound Shipping in the left column. Provides:

1. **Search by container number** — text input + "Buscar" button
2. **Live data summary** — fetches receipt, entry ticket, receive task using read-only APIs:
   - `POST /wms/inbound/receipt/search-by-paging` (by container)
   - `GET /wms-bam/entry-ticket/{entryId}` (detail + equipment actions)
   - `POST /wms/inbound/receive-task/search` (by receiptIds)
3. **Readiness checks** — client-side computed indicators:
   - ✅/❌ Receipt found
   - ✅/❌ Entry Ticket found
   - ✅/❌ Dock assigned
   - ✅/❌ Receive Task exists
   - ✅/⚠️ Dock consistency (task dockId vs ET dockId)
   - ✅/❌ Assignee assigned
4. **Dock mismatch blocker** — red warning panel if task dock ≠ ET dock, with instructions to reconcile before Check In
5. **Refresh button** — re-fetches the same container to see updated state

No mutations are executed. All searches are read-only.

### New: "Trabajo de Hoy" (Today's Workflow) — Right sidebar

A collapsible card between "Assigned Today" and "Bay 3 Assignees" showing 3 operational reference cases from today:

1. **ONEU6407746** — Dock Check In mismatch fix pattern
2. **CSGU7067706** — Receive Now / Window Check-in flow
3. **CSNU6594424** — Assignee + duplicate receipt fix

Each card expands to show ET, RN, TASK, dock, and a Spanish-language pattern description. These are static operational notes (not WMS data) to help Martín reference the workflows without searching chat history.

### Labels

UI labels use business-friendly Spanish where Martín will interact: "Buscar Contenedor", "Verificaciones de disponibilidad", "Recibo (RN)", "Dock asignado", "Sin dock", "No encontrado", "Refrescar datos", "Trabajo de Hoy". Technical identifiers (ET-xxx, RN-xxx, TASK-xxx) remain in their standard format.
