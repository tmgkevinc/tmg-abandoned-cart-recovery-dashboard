# Cloudflare Deployment

This project is prepared for Cloudflare Containers. The existing Node dashboard runs inside the Docker container, and a small Worker in `src/index.js` routes requests to that container.

## Why Containers

The dashboard is a Node server, not a static-only site. It needs server-side routes to:

- keep the Data Hub API key out of the browser
- read Cloudflare Access identity headers
- write assignment/status/notes back to Data Hub

Cloudflare Pages static hosting alone is not enough for this version.

## One-Time Requirements

Cloudflare Containers requires:

- Workers Paid plan with Containers enabled
- Docker running locally when deploying with Wrangler
- Wrangler login or `CLOUDFLARE_API_TOKEN`

## Required Secret

Do not put this value in GitHub or `wrangler.jsonc`.

```bash
npx wrangler secret put TEAM_API_KEY_DASHBOARD_EDITOR
```

Paste the dashboard editor key when Wrangler asks for the value.

## Non-Secret Vars

These are already in `wrangler.jsonc`:

```env
TMG_DATA_HUB_BASE_URL=https://tmg-data-hub-api.tony-t.workers.dev
DASHBOARD_AUTH_MODE=cloudflare_access
ADMIN_EMAILS=kevin.c@tmgindustrial.com;raina.l@tmgindustrial.com;tony.t@tmgindustrial.com;davidc@tmgindustrial.com
SALES_EMAIL_MAP=michael.g@tmgindustrial.com=Michael;brian.r@tmgindustrial.com=Brian;brian.l@tmgindustrial.com=Steven;adam.g@tmgindustrial.com=Adam;johnny.c@tmgindustrial.com=Johnny;josh.a@tmgindustrial.com=Josh;arsenio.b@tmgindustrial.com=Arsenio
DATA_HUB_ASSIGNMENTS_WRITE_PATH=/api/data-hub/lead-assignments/upsert
DATA_HUB_ASSIGNMENTS_READ_PATH=/api/data-hub/reports/lead-assignments
```

## Deploy

```bash
npm install
npx wrangler deploy
```

During deploy, Wrangler builds the Docker image, pushes it to Cloudflare's container registry, and deploys the Worker that routes traffic to the container.

## Add Cloudflare Access

After the Worker URL exists:

1. Cloudflare Zero Trust -> Access -> Applications
2. Add application -> Self-hosted
3. Domain: the Worker/dashboard hostname
4. Login method: Email one-time PIN
5. Policy: allow only the admin and sales emails used by the dashboard

## Verify

Open:

```text
https://<dashboard-host>/api/health
```

Expected:

```json
{
  "authMode": "cloudflare_access",
  "dataHubConfigured": true,
  "dataHubUsesDashboardEditorKey": true,
  "persistence": "data-hub-with-local-cache",
  "readAccess": true,
  "writeAccess": true
}
```

Then test persistence:

1. Assign one test lead or edit one lead note.
2. Refresh the page.
3. Confirm the value remains.
4. Open in another browser/login.
5. Confirm the value remains.

