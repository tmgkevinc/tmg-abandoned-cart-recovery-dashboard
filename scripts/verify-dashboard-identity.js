const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  console.error(`[dashboard identity check] ${message}`);
  process.exitCode = 1;
}

const files = {
  packageJson: read("package.json"),
  wrangler: read("wrangler.jsonc"),
  indexHtml: read(path.join("public", "index.html")),
  appJs: read(path.join("public", "app.js")),
  serverJs: read("server.js"),
  workerJs: read(path.join("src", "index.js")),
};

if (!files.wrangler.includes('"name": "tmg-abandoned-cart-recovery-dashboard"')) {
  fail("wrangler.jsonc must deploy only to tmg-abandoned-cart-recovery-dashboard.");
}

if (!files.packageJson.includes('"name": "tmg-abandoned-cart-recovery-dashboard"')) {
  fail("package.json must use the abandoned cart dashboard package name.");
}

if (!files.indexHtml.includes("TMG Abandoned Cart Leads Recovery")) {
  fail("public/index.html must render the lead recovery workspace.");
}

if (!files.indexHtml.includes("Abandoned Cart Leads")) {
  fail("public/index.html must include the abandoned cart leads table.");
}

if (!/await\s+loadLeads\(\);/.test(files.appJs)) {
  fail("public/app.js must load abandoned cart leads.");
}

if (!files.appJs.includes('/api/leads?market=US,CA,AU&limit=5000&all=1')) {
  fail("public/app.js must call the abandoned cart leads API.");
}

const forbiddenMarkers = [
  "TMG High Shipping Not Completed Draft",
  "High Shipping Not Completed",
  "high-shipping-no-completed-dashboard",
  "tmg-high-shipping-no-completed-dashboard",
  '"name": "high-shipping-no-completed-dashboard"',
  '"name": "tmg-high-shipping-no-completed-dashboard"',
];

for (const [name, content] of Object.entries(files)) {
  for (const marker of forbiddenMarkers) {
    if (content.includes(marker)) {
      fail(`${name} contains forbidden dashboard marker: ${marker}`);
    }
  }
}

if (!files.serverJs.includes("abandoned-cart-leads-enriched") || !files.workerJs.includes("abandoned-cart-leads-enriched")) {
  fail("server and worker must read abandoned-cart-leads-enriched.");
}

if (!files.serverJs.includes("abandoned_cart_lead_assignments") || !files.workerJs.includes("abandoned_cart_lead_assignments")) {
  fail("server and worker must read abandoned_cart_lead_assignments.");
}

if (process.exitCode) {
  process.exit();
}

console.log("[dashboard identity check] Abandoned cart dashboard identity verified.");
