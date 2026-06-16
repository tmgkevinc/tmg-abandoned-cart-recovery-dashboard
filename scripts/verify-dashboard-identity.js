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

if (!files.indexHtml.includes("Draft Recovery")) {
  fail("public/index.html must render the draft recovery workspace.");
}

if (!files.indexHtml.includes("Draft Recovery Leads")) {
  fail("public/index.html must include the draft recovery table.");
}

const forbiddenMarkers = ["All abandoned carts"];

for (const [name, content] of Object.entries(files)) {
  for (const marker of forbiddenMarkers) {
    if (content.includes(marker)) {
      fail(`${name} contains forbidden dashboard marker: ${marker}`);
    }
  }
}

if (!files.serverJs.includes("draft-recovery") || !files.workerJs.includes("draft-recovery")) {
  fail("server and worker must read draft-recovery.");
}

if (!files.wrangler.includes("DATA_HUB_ASSIGNMENTS_READ_PATH") || !files.wrangler.includes("DATA_HUB_ASSIGNMENTS_WRITE_PATH")) {
  fail("wrangler.jsonc must configure Data Hub assignment read/write paths.");
}

if (process.exitCode) {
  process.exit();
}

console.log("[dashboard identity check] High shipping draft dashboard identity verified.");
