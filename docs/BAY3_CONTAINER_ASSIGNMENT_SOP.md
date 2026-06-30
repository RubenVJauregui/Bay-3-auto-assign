# SOP — Bay 3 Container Assignment & Handheld Check-In

Scope: Valley View / LT_F1 Bay 3 inbound containers.

## Goal

A container assignment is not complete until the handheld can open Dock Check, show the dock name/equipment type, and allow CHECK IN. The Bay 3 Dashboard must also show every eligible full in-yard Bay 3 container.

## Bay 3 Dashboard visibility rule

A container should appear in Section 1 — In-Yard FULL Equipment when all are true:

- Customer belongs to the Bay 3 scope.
- Equipment is a full container in the yard.
- It has an active real entry ticket (`ET-...`).
- It is not closed, force closed, cancelled, task completed, empty after offload, devanned/processed, or checked out.

The dashboard should not depend on receive task or dock assignment being perfect before showing the container. Those are required for handheld operation, not basic dashboard visibility.

## Complete assignment SOP

Do not consider the assignment complete until the handheld can see Dock Check with dock name/equipment type and CHECK IN is enabled.

1. Validate the container/RN/customer.
   - Confirm the RN belongs to a Bay 3 customer.
   - Confirm the container is full and still active in yard.
   - Confirm it is not closed/cancelled/processed/devanned/checked out.

2. Create or confirm the receive task.
   - Search by receipt/RN.
   - If no active receive task exists, create one.
   - Assign the correct Bay 3 user/assignee if required.

3. Create or confirm a compatible Entry Ticket.
   - The ET must be active and compatible with the container/RN.
   - If the current ET is stale, checked out, or incompatible, create/recreate a compatible ET.

4. Link the receive task and ET.
   - The receive task must reference the correct `entryId`.
   - The ET/check-info must reference the correct `receiveTaskId` and `inboundReceiptIds`.

5. Assign the correct dock.
   - Set the target dock on the receive task.
   - Use the internal dock/location ID when required by WMS/YMS, not only the dock name.
   - Example: `DOCK44` may correspond to internal location ID `569`.

6. Populate equipment action on the ET.
   Required fields include:
   - `equipmentType = Container`
   - `equipmentNo = <container number>`
   - `currentLocationId = <dock internal numeric id>`
   - `currentLocationName = <dock name, e.g. DOCK44>`
   - `currentLocationType = DOCK`
   - receipt/RN linkage when available

7. Populate YMS/check-info.
   Required fields include:
   - `dockId`
   - `dockName`
   - `dockType = DOCK`
   - `dropOffLocationId`
   - `dropOffLocationType = DOCK`
   - `receiveTaskId`
   - `inboundReceiptIds`
   - `dropOffEquipmentId`
   - `taskEquipmentId`
   - driver/license values must not be empty. Use `TBD` / `TBD` if needed.

8. Verify handheld Dock Check.
   - Dock name is visible.
   - Equipment type is visible.
   - CHECK IN button is enabled.

9. If CHECK IN fails with `BE,500 => location is not available`:
   - Check whether the dock has stale occupancy from an old ET/equipment.
   - Release/clear the stale dock occupancy.
   - Retry handheld CHECK IN.

## Validated examples

- `HAMU2085803 / RN-5008179 / ET-506883 / TASK-5304368 / DOCK42`
- `TXGU6841590 / RN-5008193 / ET-506884 / TASK-5304366 / DOCK43`
- `TXGU7336084 / RN-5008183 / ET-506885 / TASK-5304367 / DOCK44`
- `HAMU1958261 / RN-5008194 / ET-506887 / TASK-5304836 / DOCK42`
- `UACU5982000 / RN-5008195 / ET-506885 / TASK-5304837 / DOCK44`
- `HAMU1710721 / RN-5008191 / ET-506886 / TASK-5304849 / DOCK44`

## Important rule

Do not mark a Bay 3 container assignment as complete just because the receive task exists. The complete chain is:

`WMS/YMS → active ET → task/receipt/equipment/dock linkage → YMS check-info → handheld CHECK IN works → Bay 3 Dashboard visibility`

Dashboard visibility and handheld readiness are related but not identical:

- Dashboard visibility: active full Bay 3 container with real ET in yard.
- Handheld readiness: full SOP completed, including task/ET/equipment action/YMS check-info/dock occupancy validation.
