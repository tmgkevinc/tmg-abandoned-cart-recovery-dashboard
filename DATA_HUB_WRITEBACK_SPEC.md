# Data Hub Writeback Spec

This dashboard should not write directly to PostgreSQL and should not rely on local JSON in production. All assignment, lead status, and lead notes changes must be persisted through TMG Data Hub API.

## Target Architecture

```text
User
  -> Cloudflare Access email one-time PIN
  -> Cloudflare-hosted dashboard
  -> server-side dashboard API / Cloudflare Function
  -> TMG Data Hub API
  -> database
```

The frontend must never contain API keys, Shopify tokens, database credentials, or Data Hub write credentials.

## Required Data Hub Table

Create a durable assignment table:

```text
abandoned_cart_lead_assignments
```

Recommended primary key:

```text
(country, checkout_gid)
```

Recommended columns:

```text
country                    text       required  -- US, CA, AU
checkout_gid               text       required  -- Shopify checkout id / gid used by dashboard
checkout_name              text       optional  -- #314...
assigned_sales             text       optional  -- Johnny, Steven, etc.
lead_status                text       required  -- Valid, Invalid, Recovered Auto, Recovered by Sales
sales_notes                text       optional
assigned_at                timestamptz optional
updated_at                 timestamptz required
updated_by                 text       optional  -- Cloudflare Access email
source                     text       optional  -- dashboard
```

Allowed lead status values:

```text
Valid
Invalid
Recovered Auto
Recovered by Sales
```

## Optional Audit Table

For history/debugging, create:

```text
abandoned_cart_lead_assignment_events
```

Recommended columns:

```text
event_id                   uuid       required
country                    text       required
checkout_gid               text       required
previous_assigned_sales    text       optional
new_assigned_sales         text       optional
previous_lead_status       text       optional
new_lead_status            text       optional
previous_sales_notes       text       optional
new_sales_notes            text       optional
updated_by                 text       optional
created_at                 timestamptz required
```

## Required Data Hub API

### 1. Upsert one assignment

```http
POST /api/data-hub/lead-assignments/upsert
x-api-key: <dashboard editor key>
content-type: application/json
```

Request body:

```json
{
  "country": "US",
  "checkout_gid": "31400000000000",
  "checkout_name": "#31400000000000",
  "assigned_sales": "Johnny",
  "lead_status": "Valid",
  "sales_notes": "Customer asked for callback tomorrow",
  "assigned_at": "2026-06-10T20:30:00.000Z",
  "updated_at": "2026-06-10T20:30:00.000Z",
  "updated_by": "kevin.c@tmgindustrial.com",
  "source": "abandoned-cart-dashboard"
}
```

Expected response:

```json
{
  "ok": true,
  "assignment": {
    "country": "US",
    "checkout_gid": "31400000000000",
    "assigned_sales": "Johnny",
    "lead_status": "Valid",
    "sales_notes": "Customer asked for callback tomorrow",
    "updated_at": "2026-06-10T20:30:00.000Z"
  }
}
```

### 2. Read assignments

Either expose a report endpoint:

```http
GET /api/data-hub/reports/lead-assignments?country=US,CA,AU&limit=10000
```

or support the existing records endpoint:

```http
GET /api/data-hub/records?table=abandoned_cart_lead_assignments&country=US&limit=10000
```

The dashboard must read these records on load and merge them into abandoned cart leads by:

```text
country + checkout_gid
```

## Dashboard Changes Needed

Current dashboard behavior:

- Frontend posts changes to `/api/assignments`.
- Server saves to `lead-assignments.json`.
- Server can POST to Data Hub when `DATA_HUB_ASSIGNMENTS_WRITE_PATH` is configured.
- Server can read persisted assignments from Data Hub when `DATA_HUB_ASSIGNMENTS_READ_PATH` is configured.
- If Data Hub assignment read fails or is not configured, the server falls back to local JSON.

Required production behavior:

- `/api/assignments POST` writes to Data Hub.
- `/api/assignments GET` reads from Data Hub.
- `/api/leads` reads abandoned carts and assignment records from Data Hub, then merges them.
- Local JSON should be disabled in Cloudflare production or used only as emergency fallback.

Required dashboard env var after Data Hub endpoint is live:

```env
DATA_HUB_ASSIGNMENTS_WRITE_PATH=/api/data-hub/lead-assignments/upsert
```

Recommended read env var:

```env
DATA_HUB_ASSIGNMENTS_READ_PATH=/api/data-hub/reports/lead-assignments
```

## Cloudflare Hosting Notes

Plain static Cloudflare Pages is not enough because the dashboard needs server-side API routes to protect Data Hub credentials.

Use one of these:

```text
Cloudflare Pages + Functions
Cloudflare Workers
Cloudflare Containers running the current Node server
```

Best long-term option:

```text
Cloudflare Pages + Functions
```

The Cloudflare Function should:

1. Read Cloudflare Access identity from request headers.
2. Enforce admin/sales role mapping by exact email.
3. Proxy read/write requests to Data Hub using server-side env secrets.
4. Never expose Data Hub API keys to the browser.

## Acceptance Tests

1. Change one lead from Valid to Invalid and add notes.
2. Refresh the dashboard.
3. Confirm the same status and notes still show.
4. Open the dashboard in another browser/session.
5. Confirm the same status and notes still show.
6. Confirm Data Hub table contains the changed row.
7. Re-deploy the dashboard.
8. Confirm the assignment/status/notes still remain.
