# Bay 3 Auto Assign Dashboard — Local Install

This ZIP contains the current source for the Bay 3 Auto Assign Dashboard.

## Important: remove old copies first

If you previously extracted an older `bay3-report` folder, delete or rename it before extracting this ZIP. Otherwise Windows may keep old files and you may see the old light "Bay 3 Report" screen.

## Requirements

- Node.js 20 or newer: https://nodejs.org/
- Network access to ITEM/WISE services
- Valid WISE/ITEM login with LT_F1 access

## Run on Windows at http://localhost:3021

1. Extract this ZIP.
2. Open the extracted `bay3-report` folder.
3. Double-click `start-3021.bat`.
4. Keep the black terminal window open.
5. The browser opens at `http://localhost:3021`.

The start script cleans old `.next` and `out` folders before building, so stale UI should not be served.

## Environment

The script creates `.env.local` from `.env.example` if needed.

```env
NEXT_PUBLIC_WMS_API_BASE_URL=https://unis.item.com/api
NEXT_PUBLIC_IAM_BASE_URL=https://id.item.com
NEXT_PUBLIC_FACILITY_ID=LT_F1
NEXT_PUBLIC_TENANT_ID=LT
NEXT_PUBLIC_TIMEZONE=America/Los_Angeles
```
