# SOP — Bay 3 Container Assignment & Handheld Check-In

Scope: Valley View / LT_F1 Bay 3 inbound containers.

## Goal

A container assignment is not complete until the handheld can open Dock Check, show the dock name/equipment type, and allow CHECK IN.

## Visibility Rule for Bay 3 Dashboard

A container should appear in Section 1 when all are true:

- Customer belongs to the Bay 3 scope.
- Equipment is a full container in the yard.
- It has an active real entry ticket (`ET-`).
- It is not closed, force closed, cancelled, empty, devanned/processed, or checked out.

The dashboard should not depend on receive task or dock assignment being perfect before showing the container.

## Assignment SOP

1. Validate the container/RN/customer.
   - Confirm the container belongs to a Bay 3 customer.
   - Confirm the RN is active and eligible.
   - Confirm the container is full and in yard.

2. Create or locate the receive task.
   - Search by RN.
   - If no active receive task exists, create one.
   - Assign the Bay 3 user/assignee.

3. Create or use a compatible entry ticket.
   - The ET must be active and compatible with the container/RN.
   - Link the receive task to the ET.

4. Assign the correct dock.
   - Set the target dock on the receive task.
   - Use the internal dock/location ID when required by WMS/YMS, not only the dock name.
   - Example: `DOCK44` may correspond to internal location ID `569`.

5. Populate equipment action on the ET.
   Required fields:
   - `currentLocationId`
   - `currentLocationName`
   - `currentLocationType = DOCK`
   - `equipmentType = Container`
   - `equipmentNo`
   - receipt/RN linkage when available

6. Populate YMS/check-info.
   Required fields:
   - `dockId`
   - `dockName`
   - `dockType = DOCK`
   - `dropOffLocationId`
   - `dropOffLocationType = DOCK`
   - `receiveTaskId`
   - `inboundReceiptIds`
   - `dropOffEquipmentId`
   - `taskEquipmentId`
   - driver/license values must not be empty; use `TBD/TBD` if needed.

7. Verify handheld Dock Check.
   - Dock name is visible.
   - Equipment type is visible.
   - CHECK IN button is enabled.

8. If CHECK IN fails with `BE,500 => location is not available`:
   - Check if the dock has stale occupancy from an old ET.
   - Release/clear the stale dock occupancy.
   - Retry handheld CHECK IN.

## Proven Examples

- `HAMU2085803 / RN-5008179 / ET-506883 / TASK-5304368 / DOCK42`
- `TXGU6841590 / RN-5008193 / ET-506884 / TASK-5304366 / DOCK43`
- `TXGU7336084 / RN-5008183 / ET-506885 / TASK-5304367 / DOCK44`
- `HAMU1958261 / RN-5008194 / ET-506887 / TASK-5304836 / DOCK42`
- `UACU5982000 / RN-5008195 / ET-506885 / TASK-5304837 / DOCK44`
- `HAMU1710721 / RN-5008191 / ET-506886 / TASK-5304849 / DOCK44`

## Important Rule

Do not mark a Bay 3 container assignment as complete just because the receive task exists. The complete chain is:

`WMS/YMS → active ET → task/receipt/equipment/dock linkage → YMS check-info → handheld CHECK IN works → Bay 3 Dashboard visibility`
