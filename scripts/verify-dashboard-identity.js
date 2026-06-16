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
  fail("public/index.html must render the high shipping draft dashboard.");
}

if (!files.indexHtml.includes('data-tab="drafts"')) {
  fail("public/index.html must default to the draft workspace tab.");
}

if (!files.appJs.includes("limit=3000")) {
  fail("public/app.js must keep draft API requests within Worker limits.");
}

if (!files.serverJs.includes("draft-recovery") || !files.workerJs.includes("draft-recovery")) {
  fail("server and worker must read draft-recovery.");
}

if (!files.serverJs.includes("isCurrentYearDraft") || !files.workerJs.includes("isCurrentYearDraft")) {
  fail("server and worker must apply current-year draft filtering.");
}

if (process.exitCode) {
  process.exit();
}

console.log("[dashboard identity check] High shipping draft dashboard identity verified.");
