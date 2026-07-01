# Lennox Shipping Report Format

For Lennox shipping reports, provide the complete report in one pass.

Business scope:
- Tenant: LT
- Facility: LT_F1 / Valley View
- Customer: LENNOX INDUSTRIES INC. / ORG-754962
- Timezone: America/Los_Angeles

Required columns:
- DN
- Load
- Status
- Appointment time
- Dock
- Load task
- Assignee
- Carrier
- Equipment / trailer
- Seal
- Pallets
- Cajas / cartons

Required totals:
- Total pallets by DN/load
- Total cajas/cartons by DN/load
- Grand total pallets
- Grand total cajas/cartons

Notes:
- Do not omit pallets or cajas/cartons.
- If the user asks for a daily or rest-of-week Lennox shipping report, include all operational details and totals together from the start.
