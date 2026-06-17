# Bay 5 Auto Assign Dashboard - Source

Live site: https://wms-valley-view-dashboard-a3c848.coolify.item.pub/

## Run locally on Windows
1. Install Node.js 20+ from https://nodejs.org/
2. Extract this ZIP.
3. Open the `bay5-dashboard-sandbox` folder.
4. Double-click `start-3021.bat`.
5. Keep the terminal open and browse to http://localhost:3021

## Manual commands
```bash
npm install
npm run build
npx next start -H 0.0.0.0 -p 3021
```

## Environment
`.env.example` contains non-secret public/default values. Copy it to `.env.local` if needed.
