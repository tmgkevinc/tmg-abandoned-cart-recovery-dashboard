# TMG Lead Recovery Dashboard

This is a Node.js dashboard for abandoned cart lead review and sales assignment.

## Data Source

All dashboard/report data must come from the TMG Data Hub API through this local/server-side Node app.

The browser must not call the Data Hub directly with API keys. API keys stay in server environment variables only.

## Required Environment Variables

Create a `.env` file locally, or set these variables in the hosting platform:

```env
TMG_DATA_HUB_BASE_URL=https://your-data-hub-api.example.com
TEAM_API_KEY_DASHBOARD_EDITOR=replace_with_server_side_key
HOST=0.0.0.0
PORT=4174
```

`TEAM_API_KEY_ADMIN` and `TMG_DATA_HUB_API_KEY` are also supported as fallback keys, but the dashboard editor key is preferred for this app.

## Login With Cloudflare Access Email PIN

For local testing, keep:

```env
DASHBOARD_AUTH_MODE=manual
```

For production, place the dashboard behind Cloudflare Access and set:

```env
DASHBOARD_AUTH_MODE=cloudflare_access
ADMIN_EMAILS=kevin@example.com
SALES_EMAIL_MAP=johnny@example.com=Johnny;steven@example.com=Steven;brian@example.com=Brian
```

Cloudflare Access should be configured as a self-hosted web application with One-time PIN login. Cloudflare verifies the user's email before the request reaches the dashboard.

The dashboard reads the verified email from Cloudflare Access and maps it to:

- `Admin`: full dashboard view
- sales name: sales-only view for assigned leads

If a verified email is not listed in `ADMIN_EMAILS` or `SALES_EMAIL_MAP`, the dashboard returns an unauthorized session.

Security note: If the origin is public on the Internet, validate the Cloudflare Access JWT at the origin or only expose the app through Cloudflare Tunnel / locked-down infrastructure. Do not trust a user-supplied email field from the browser.

## Local Run

```bash
npm start
```

Then open:

```text
http://localhost:4174/
```

On Kevin's workstation, `start-dashboard-4174.bat` also starts the app with the bundled Node runtime.

## Checks Before Release

```bash
npm run check
```

Also verify:

```text
GET /api/health
GET /api/leads?market=US,CA,AU&limit=1000
```

## Current Persistence

Assignments, lead status edits, and notes are currently saved in:

```text
lead-assignments.json
```

You can override this path in production:

```env
ASSIGNMENTS_FILE=/data/lead-assignments.json
```

This is local JSON persistence. It is acceptable for a single controlled Node server with a persistent disk, but it is not enough for multi-instance hosting or ephemeral serverless hosting.

Before deploying to serverless or multiple instances, move assignment writes to a Data Hub write endpoint or another durable database.

## Data Hub Assignment Writeback

The dashboard supports Data Hub assignment writeback once Data Hub exposes a POST endpoint.

Set:

```env
DATA_HUB_ASSIGNMENTS_WRITE_PATH=/api/data-hub/lead-assignments/upsert
```

Expected payload sent by the dashboard:

```json
{
  "country": "US",
  "checkout_gid": "gid://shopify/AbandonedCheckout/314...",
  "checkout_name": "#314...",
  "assigned_sales": "Johnny",
  "lead_status": "Valid",
  "sales_notes": "Customer asked for follow-up next week",
  "assigned_at": "2026-06-10T03:00:00.000Z",
  "updated_at": "2026-06-10T03:05:00.000Z",
  "updated_by": "kevin.c@tmgindustrial.com"
}
```

Data Hub should upsert this into:

```text
abandoned_checkout_lead_assignments
```

Recommended unique key:

```text
country + checkout_gid
```

As of the last local verification, the Data Hub proxy still returned `Method not allowed. This Data Hub proxy is read-only.` for POST/PUT/PATCH record writes. Keep `DATA_HUB_ASSIGNMENTS_WRITE_PATH` unset until that endpoint is live.

## Do Not Commit

Do not commit:

- `.env`
- API keys
- Shopify tokens
- `lead-assignments.json`
- runtime log files
