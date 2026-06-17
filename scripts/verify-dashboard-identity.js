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

if (!files.wrangler.includes('"name": "high-shipping-no-completed-dashboard"')) {
  fail("wrangler.jsonc must deploy only to high-shipping-no-completed-dashboard.");
}

if (!files.packageJson.includes('"name": "tmg-high-shipping-no-completed-dashboard"')) {
  fail("package.json must use the high shipping draft dashboard package name.");
}

if (!files.indexHtml.includes("TMG High Shipping Not Completed Draft")) {
  fail("public/index.html must render the high shipping draft workspace.");
}

if (!files.indexHtml.includes("High Shipping Not Completed Drafts")) {
  fail("public/index.html must include the high shipping drafts table.");
}

if (!files.appJs.includes("/api/drafts?market=${market}&limit=3000") || !files.appJs.includes("Promise.allSettled")) {
  fail("public/app.js must call the high shipping drafts API per market.");
}

if (!files.serverJs.includes("/api/data-hub/reports/draft-recovery") || !files.workerJs.includes("/api/data-hub/reports/draft-recovery")) {
  fail("server and worker must read the Data Hub draft-recovery report.");
}

const forbiddenMarkers = [
  "TMG Abandoned Cart Leads Recovery",
  "Abandoned Cart Leads",
  "tmg-abandoned-cart-recovery-dashboard",
];

for (const [name, content] of Object.entries(files)) {
  for (const marker of forbiddenMarkers) {
    if (content.includes(marker)) {
      fail(`${name} contains forbidden dashboard marker: ${marker}`);
    }
  }
}

if (!files.appJs.includes("formatMarginWithPercent")) {
  fail("public/app.js must render margin values with percentages.");
}

if (/async function loadAllData\(\)\s*{\s*await loadLeads\(\);/m.test(files.appJs)) {
  fail("public/app.js must not load abandoned cart leads before draft data.");
}

if (process.exitCode) {
  process.exit();
}

console.log("[dashboard identity check] High shipping draft dashboard identity verified.");
