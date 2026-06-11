# Deployment

This dashboard must run behind a server-side API layer. Do not publish it as static GitHub Pages, because the server protects Data Hub API keys, reads Cloudflare Access identity, and saves assignment updates.

## Recommended Production Shape

```text
User -> Cloudflare Access one-time PIN -> Cloudflare Worker dashboard -> TMG Data Hub API
```

Use the Cloudflare Worker in `src/index.js` to serve static dashboard assets and proxy Data Hub API requests. Use Cloudflare Access as a self-hosted application in front of the dashboard URL.

## Required Production Environment

Set these variables in the hosting platform, not in GitHub:

```env
TMG_DATA_HUB_BASE_URL=https://tmg-data-hub-api.tony-t.workers.dev
TEAM_API_KEY_DASHBOARD_EDITOR=replace_with_dashboard_editor_key
DASHBOARD_AUTH_MODE=cloudflare_access
ADMIN_EMAILS=kevin.c@tmgindustrial.com;raina.l@tmgindustrial.com;tony.t@tmgindustrial.com;davidc@tmgindustrial.com
SALES_EMAIL_MAP=michael.g@tmgindustrial.com=Michael;brian.r@tmgindustrial.com=Brian;brian.l@tmgindustrial.com=Steven;adam.g@tmgindustrial.com=Adam;johnny.c@tmgindustrial.com=Johnny;josh.a@tmgindustrial.com=Josh;arsenio.b@tmgindustrial.com=Arsenio
DATA_HUB_ASSIGNMENTS_WRITE_PATH=/api/data-hub/lead-assignments/upsert
DATA_HUB_ASSIGNMENTS_READ_PATH=/api/data-hub/reports/lead-assignments
```

For Cloudflare, set `TEAM_API_KEY_DASHBOARD_EDITOR` as a secret, not as a plain variable:

```bash
npx wrangler secret put TEAM_API_KEY_DASHBOARD_EDITOR
```

## Cloudflare Worker

This repo includes:

```text
src/index.js
wrangler.jsonc
```

Deploy:

```bash
npm install
npx wrangler deploy
```

The Worker serves `public/` through Cloudflare Workers Assets and handles `/api/*` routes in `src/index.js`.

## Release Checks

After deployment, verify:

```text
GET /api/health
GET /api/leads?market=US,CA,AU&limit=1000
```

Expected production health:

```json
{
  "authMode": "cloudflare_access",
  "dataHubConfigured": true,
  "dataHubUsesDashboardEditorKey": true
}
```

## Security Notes

- Do not commit `.env`, API keys, Shopify tokens, or assignment JSON files.
- For serverless or multi-instance hosting, do not rely on local JSON. Use Data Hub assignment read/write endpoints or another durable database.
