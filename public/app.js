const els = {
  loginOverlay: document.querySelector("#loginOverlay"),
  loginForm: document.querySelector("#loginForm"),
  loginUser: document.querySelector("#loginUser"),
  loginRole: document.querySelector("#loginRole"),
  loginStatus: document.querySelector("#loginStatus"),
  currentUserLabel: document.querySelector("#currentUserLabel"),
  switchUserButton: document.querySelector("#switchUserButton"),
  dataFreshness: document.querySelector("#dataFreshness"),
  tabButtons: document.querySelectorAll("[data-tab]"),
  workspaceTab: document.querySelector("#workspaceTab"),
  draftsTab: document.querySelector("#draftsTab"),
  rulesTab: document.querySelector("#rulesTab"),
  marketFilter: document.querySelector("#marketFilter"),
  leadStatusFilter: document.querySelector("#leadStatusFilter"),
  gradeFilter: document.querySelector("#gradeFilter"),
  salesFilter: document.querySelector("#salesFilter"),
  searchInput: document.querySelector("#searchInput"),
  salesMarketFilter: document.querySelector("#salesMarketFilter"),
  salesLeadStatusFilter: document.querySelector("#salesLeadStatusFilter"),
  salesGradeFilter: document.querySelector("#salesGradeFilter"),
  salesDetailSalesFilter: document.querySelector("#salesDetailSalesFilter"),
  salesSearchInput: document.querySelector("#salesSearchInput"),
  draftMarketFilter: document.querySelector("#draftMarketFilter"),
  draftLeadStatusFilter: document.querySelector("#draftLeadStatusFilter"),
  draftSalesFilter: document.querySelector("#draftSalesFilter"),
  draftSearchInput: document.querySelector("#draftSearchInput"),
  refreshButton: document.querySelector("#refreshButton"),
  marketSummary: document.querySelector("#marketSummary"),
  salesPersonalSummary: document.querySelector("#salesPersonalSummary"),
  leadTableHead: document.querySelector("#leadTableHead"),
  leadTableBody: document.querySelector("#leadTableBody"),
  qualifiedSubtitle: document.querySelector("#qualifiedSubtitle"),
  salesOverview: document.querySelector("#salesOverview"),
  salesTableHead: document.querySelector("#salesTableHead"),
  salesTableBody: document.querySelector("#salesTableBody"),
  salesDetailSubtitle: document.querySelector("#salesDetailSubtitle"),
  draftSummary: document.querySelector("#draftSummary"),
  draftTableHead: document.querySelector("#draftTableHead"),
  draftTableBody: document.querySelector("#draftTableBody"),
  draftSubtitle: document.querySelector("#draftSubtitle"),
  exportVisibleButton: document.querySelector("#exportVisibleButton"),
  exportSalesTabsButton: document.querySelector("#exportSalesTabsButton"),
  exportDraftButton: document.querySelector("#exportDraftButton"),
  rulesFunnel: document.querySelector("#rulesFunnel"),
};

const leadStatuses = ["Valid", "Invalid", "Recovered Auto", "Recovered by Sales"];
const gradeOrder = ["A+!", "A+", "A!", "A", "A-!", "A-", "B+!", "B+", "B!", "B", "B-!", "B-"];
const markets = ["US", "CA", "AU"];

const baseColumns = [
  "Lead Status",
  "Market",
  "Grade",
  "Checkout",
  "Sales",
  "Leads notes",
  "Created At Date",
  "Subtotal",
  "Shipping Name",
  "Checkout Phone",
  "Checkout Email",
  "Shipping Address",
  "Time Zone",
  "Checkout Discount Code",
  "Check out Discount Amount",
  "Klaviyo Email Subscribed",
  "Klaviyo Text Subscribed",
  "Klaviyo Maximum Discount",
];
const trailingLeadColumns = ["Related Sales", "Recovered By"];

let state = {
  user: null,
  role: "admin",
  authMode: "manual",
  authBlocked: false,
  authEmail: "",
  salesUsers: [],
  leads: [],
  drafts: [],
  visibleLeads: [],
  salesVisibleLeads: [],
  visibleDrafts: [],
};

els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.authMode === "cloudflare_access") return;
  state.user = els.loginUser.value;
  state.role = els.loginRole.value;
  localStorage.setItem("tmgLeadRecoverySession", JSON.stringify({ user: state.user, role: state.role }));
  els.loginOverlay.hidden = true;
  renderUserMode();
  applyFilters();
});

els.switchUserButton.addEventListener("click", () => {
  if (state.authMode === "cloudflare_access") return;
  els.loginOverlay.hidden = false;
});

els.refreshButton.addEventListener("click", loadAllData);
els.exportVisibleButton.addEventListener("click", () => exportCsv(state.visibleLeads, "visible-leads"));
els.exportSalesTabsButton.addEventListener("click", () => exportCsv(state.salesVisibleLeads, "sales-lead-detail"));
els.exportDraftButton.addEventListener("click", () => exportCsv(state.visibleDrafts, "draft-recovery-leads"));
els.tabButtons.forEach((button) => button.addEventListener("click", () => setActiveTab(button.dataset.tab)));

for (const control of [els.marketFilter, els.leadStatusFilter, els.gradeFilter, els.salesFilter, els.searchInput]) {
  control.addEventListener("input", applyFilters);
}

for (const control of [
  els.salesMarketFilter,
  els.salesLeadStatusFilter,
  els.salesGradeFilter,
  els.salesDetailSalesFilter,
  els.salesSearchInput,
]) {
  control.addEventListener("input", applyFilters);
}

for (const control of [els.draftMarketFilter, els.draftLeadStatusFilter, els.draftSalesFilter, els.draftSearchInput]) {
  control.addEventListener("input", applyFilters);
}

els.leadTableBody.addEventListener("change", handleLeadChange);
els.leadTableBody.addEventListener("input", handleLeadInput);
els.leadTableBody.addEventListener("click", handleLeadClick);
els.salesTableBody.addEventListener("change", handleLeadChange);
els.salesTableBody.addEventListener("input", handleLeadInput);
els.salesTableBody.addEventListener("click", handleLeadClick);
els.draftTableBody.addEventListener("change", handleLeadChange);
els.draftTableBody.addEventListener("input", handleLeadInput);
els.draftTableBody.addEventListener("click", handleLeadClick);

initialize();

async function initialize() {
  renderTableHeads();
  const cloudflareSessionApplied = await loadSession();
  await loadHealth();
  if (!cloudflareSessionApplied) restoreSession();
  if (state.authBlocked) return;
  await loadFreshness();
  await loadAllData();
}

async function loadAllData() {
  await loadLeads();
  await loadDrafts();
}

async function loadSession() {
  try {
    const response = await fetch("/api/session", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      state.authBlocked = true;
      els.loginOverlay.hidden = false;
      els.loginForm.querySelector("button").disabled = true;
      els.loginStatus.textContent = "Cloudflare Access session is not active. Refresh this page and sign in with your email code.";
      els.currentUserLabel.textContent = "Cloudflare login required";
      return true;
    }
    const session = await response.json();
    state.authMode = session.authMode || "manual";
    state.authEmail = session.email || "";
    document.body.dataset.auth = state.authMode;

    if (state.authMode !== "cloudflare_access") return false;

    state.salesUsers = session.salesUsers || state.salesUsers;
    if (!session.authenticated) {
      state.authBlocked = true;
      els.loginOverlay.hidden = false;
      els.loginForm.querySelector("button").disabled = true;
      els.loginStatus.textContent = session.reason || "Cloudflare Access login is required.";
      els.currentUserLabel.textContent = "Cloudflare login required";
      return true;
    }

    state.user = session.user;
    state.role = session.role;
    els.loginUser.value = session.user;
    els.loginRole.value = session.role;
    els.loginOverlay.hidden = true;
    renderUserMode();
    return true;
  } catch (error) {
    return false;
  }
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const health = await response.json();
    if (!response.ok) {
      if (response.status === 403 && health.session) {
        state.authBlocked = true;
        els.loginOverlay.hidden = false;
        els.loginForm.querySelector("button").disabled = true;
        els.loginStatus.textContent = health.session.reason || health.error || "Cloudflare Access login is required.";
        els.currentUserLabel.textContent = "Cloudflare login required";
        return;
      }
      els.loginStatus.textContent = health.error || `Dashboard API returned ${response.status}.`;
      return;
    }
    state.salesUsers = health.salesUsers || [];
    els.loginUser.innerHTML = [
      `<option value="Admin">Admin</option>`,
      ...state.salesUsers.filter((name) => name !== "Non-sales").map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`),
    ].join("");
    els.salesFilter.innerHTML = [
      `<option value="ALL">All sales</option>`,
      `<option value="">Unassigned</option>`,
      ...state.salesUsers.map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`),
    ].join("");
    els.salesDetailSalesFilter.innerHTML = [
      `<option value="ALL">All sales</option>`,
      ...state.salesUsers.filter((name) => name !== "Non-sales").map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`),
    ].join("");
    els.draftSalesFilter.innerHTML = [
      `<option value="ALL">All sales</option>`,
      `<option value="">Unassigned</option>`,
      ...state.salesUsers.map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`),
    ].join("");
    els.loginStatus.textContent = health.dataHubConfigured
      ? "Data Hub connection is configured."
      : "Data Hub environment variables are missing on the dashboard server.";
  } catch (error) {
    els.loginStatus.textContent = "Local dashboard server is not responding.";
  }
}

function restoreSession() {
  if (state.authMode === "cloudflare_access") return;
  try {
    const session = JSON.parse(localStorage.getItem("tmgLeadRecoverySession") || "{}");
    if (session.user && session.role) {
      state.user = session.user;
      state.role = session.role;
      els.loginUser.value = session.user;
      els.loginRole.value = session.role;
      els.loginOverlay.hidden = true;
      renderUserMode();
      return;
    }
  } catch (error) {
    // Ignore broken saved sessions.
  }
  els.loginOverlay.hidden = false;
}

async function loadFreshness() {
  try {
    const response = await fetch("/api/data-hub/freshness", { cache: "no-store" });
    if (!response.ok) throw new Error("Freshness unavailable");
    const data = await response.json();
    els.dataFreshness.textContent = `Data Hub freshness loaded at ${new Date().toLocaleString("en-CA", { timeZone: "America/Vancouver" })} Vancouver time.`;
    if (data.updatedAt || data.generatedAt) {
      els.dataFreshness.textContent += ` Source timestamp: ${data.updatedAt || data.generatedAt}.`;
    }
  } catch (error) {
    els.dataFreshness.textContent = "Data Hub freshness is not available yet.";
  }
}

async function loadLeads() {
  els.refreshButton.disabled = true;
  els.refreshButton.textContent = "Loading...";
  try {
    const response = await fetch("/api/leads?market=US,CA,AU&limit=5000&all=1", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : { error: `Dashboard API returned ${response.status} ${response.statusText || ""} instead of JSON.` };
    if (!response.ok) throw new Error(data.error || "Could not load leads.");
    state.salesUsers = data.salesUsers || state.salesUsers;
    state.leads = data.leads || [];
    populateGradeFilter(state.leads);
    renderSummary(data.summary || {});
    renderRulesFunnel();
    applyFilters();
    els.qualifiedSubtitle.textContent = `${state.leads.length.toLocaleString()} abandoned cart leads loaded from Data Hub.`;
  } catch (error) {
    state.leads = [];
    renderRulesFunnel();
    applyFilters();
    els.qualifiedSubtitle.textContent = error.message;
  } finally {
    els.refreshButton.disabled = false;
    els.refreshButton.textContent = "Refresh Data Hub";
  }
}

async function loadDrafts() {
  try {
    const response = await fetch("/api/drafts?market=US,CA,AU&limit=50000", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load drafts.");
    state.drafts = data.drafts || [];
    renderDraftSummary(data.summary || {});
    applyFilters();
    els.draftSubtitle.textContent = `${state.drafts.length.toLocaleString()} open draft orders with manual shipping loaded from Data Hub.`;
  } catch (error) {
    state.drafts = [];
    renderDraftSummary({});
    applyFilters();
    els.draftSubtitle.textContent = error.message;
  }
}

function setActiveTab(tabName) {
  els.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
  els.workspaceTab.classList.toggle("active", tabName === "workspace");
  els.draftsTab.classList.toggle("active", tabName === "drafts");
  els.rulesTab.classList.toggle("active", tabName === "rules");
}

function renderUserMode() {
  els.currentUserLabel.textContent = state.authEmail
    ? `${state.user || "Not signed in"} (${state.role}) - ${state.authEmail}`
    : `${state.user || "Not signed in"} (${state.role})`;
  document.body.dataset.role = state.role;
  document.body.dataset.auth = state.authMode;
  if (state.authMode === "cloudflare_access") {
    els.switchUserButton.textContent = "Cloudflare verified";
    els.switchUserButton.disabled = true;
  } else {
    els.switchUserButton.textContent = "Switch User";
    els.switchUserButton.disabled = false;
  }
  if (state.role === "sales" && state.user !== "Admin") {
    setActiveTab("workspace");
    els.salesFilter.value = state.user;
    els.salesFilter.disabled = true;
    els.salesDetailSalesFilter.value = state.user;
    els.salesDetailSalesFilter.disabled = true;
    els.draftSalesFilter.value = state.user;
    els.draftSalesFilter.disabled = true;
  } else {
    els.salesFilter.disabled = false;
    els.salesDetailSalesFilter.disabled = false;
    els.draftSalesFilter.disabled = false;
  }
}

function populateGradeFilter(leads) {
  const grades = [...new Set(leads.map((lead) => lead.grade).filter(Boolean))].sort((a, b) => gradeRank(a) - gradeRank(b));
  els.gradeFilter.innerHTML = [`<option value="ALL">All grades</option>`, ...grades.map((grade) => `<option value="${grade}">${grade}</option>`)].join("");
  els.salesGradeFilter.innerHTML = [`<option value="ALL">All grades</option>`, ...grades.map((grade) => `<option value="${grade}">${grade}</option>`)].join("");
}

function renderSummary(summary) {
  const byMarket = summary.byMarket || {};
  const latest = summary.latestCreatedAt || {};
  els.marketSummary.innerHTML = markets
    .map((market) => {
      const item = byMarket[market] || {
        total: 0,
        valid: 0,
        validAvailable: 0,
        assigned: 0,
        amount: 0,
        validAmount: 0,
        validAssignedAmount: 0,
      };
      const ageBuckets = item.ageBuckets || {};
      const assignedCountPercent = formatPercent(item.assigned, item.valid);
      const assignedAmountPercent = formatPercent(item.validAssignedAmount || 0, item.validAmount || 0);
      const validTotalPercent = formatPercent(item.valid, item.total);
      return `
        <article class="metric market-${market.toLowerCase()}">
          <span>${market}</span>
          <strong>${item.assigned.toLocaleString()} valid assigned / ${item.valid.toLocaleString()} valid (${assignedCountPercent})</strong>
          <small>${formatMoney(item.validAssignedAmount || 0, marketCurrency(market))} valid assigned / ${formatMoney(item.validAmount || 0, marketCurrency(market))} valid (${assignedAmountPercent})</small>
          <small>Valid all: ${item.valid.toLocaleString()} (${validTotalPercent}) | Total loaded: ${item.total.toLocaleString()}</small>
          <small>Latest: ${latest[market] ? formatDateTime(latest[market]) : "-"}</small>
          <div class="age-buckets" aria-label="${market} lead age buckets">
            <span>&lt;72h <b>${Number(ageBuckets.under72h || 0).toLocaleString()}</b></span>
            <span>72h-1w <b>${Number(ageBuckets.h72To1w || 0).toLocaleString()}</b></span>
            <span>1w-1m <b>${Number(ageBuckets.w1To1m || 0).toLocaleString()}</b></span>
            <span>&gt;1m <b>${Number(ageBuckets.over1m || 0).toLocaleString()}</b></span>
          </div>
        </article>
      `;
    })
    .join("");

  const bySales = summary.bySales || {};
  const recoveredBySales = getRecoveredBySalesSummary(state.leads);
  els.salesOverview.innerHTML = state.salesUsers
    .filter((name) => name !== "Non-sales")
    .map((name) => {
      const row = bySales[name] || { US: 0, CA: 0, AU: 0, total: 0, lastAssignedAt: "" };
      const recovered = recoveredBySales[name] || { count: 0, amountsByMarket: {} };
      return `
        <article class="sales-summary">
          <strong>${escapeHtml(name)}</strong>
          <span>US ${row.US || 0} / CA ${row.CA || 0} / AU ${row.AU || 0}</span>
          <small>Total ${row.total || 0}</small>
          <small>Recovered by sales: ${recovered.count.toLocaleString()}</small>
          <small>${formatMarketAmounts(recovered.amountsByMarket)} recovered value</small>
          <small>Last assigned: ${row.lastAssignedAt ? `${formatDateTime(row.lastAssignedAt)} (${formatRelativeAgo(row.lastAssignedAt)})` : "-"}</small>
        </article>
      `;
    })
    .join("");
}

function renderDraftSummary(summary) {
  const byMarket = summary.byMarket || {};
  const latest = summary.latestCreatedAt || {};
  els.draftSummary.innerHTML = markets
    .map((market) => {
      const item = byMarket[market] || { total: 0, valid: 0, assigned: 0, amount: 0, validAmount: 0, manualShipping: 0 };
      return `
        <article class="metric market-${market.toLowerCase()}">
          <span>${market}</span>
          <strong>${Number(item.valid || 0).toLocaleString()} recovery-ready / ${Number(item.total || 0).toLocaleString()} manual-shipping drafts</strong>
          <small>${formatMoney(item.validAmount || 0, marketCurrency(market))} recovery-ready / ${formatMoney(item.amount || 0, marketCurrency(market))} total</small>
          <small>${Number(item.assigned || 0).toLocaleString()} valid assigned</small>
          <small>Latest: ${latest[market] ? formatDateTime(latest[market]) : "-"}</small>
        </article>
      `;
    })
    .join("");
}

function renderRulesFunnel() {
  const counts = getFunnelCounts(state.leads);
  const readyRate = counts.all ? Math.round((counts.ready / counts.all) * 100) : 0;
  const steps = [
    {
      label: "All abandoned carts",
      count: counts.all,
      countType: "total",
      rule: "Loaded from Data Hub table shopify_abandoned_checkouts_raw for US, CA, and AU.",
      outcome: "Starting population before lead qualification.",
    },
    {
      label: "Age gate",
      count: counts.tooNew,
      rule: "Checkout must be older than 72 hours. Leads within 72 hours stay Invalid until they age in.",
      outcome: "Filtered status: Too New.",
    },
    {
      label: "Phone gate",
      count: counts.noContact,
      rule: "Lead must have checkout phone. Checkout email is not required. Leads older than 30 days remain Valid when they pass the other gates.",
      outcome: "Filtered status: No Phone.",
    },
    {
      label: "Duplicate gate",
      count: counts.duplicate,
      rule: "For the same customer name and same product set, keep only the newest checkout.",
      outcome: "Filtered status: Duplicate.",
    },
    {
      label: "Recovered gate",
      count: counts.recovered,
      rule: "Current matching is done upstream by Data Hub, not inside this page. This dashboard treats a checkout as recovered when the enriched abandoned-cart record includes completed/order/recovered signals such as completed_at, order_id, or is_recovered. If Data Hub provides a recovered order number, it is shown in Leads notes.",
      outcome: "If a lead was assigned before the recovered order was created, it becomes Recovered by Sales for that assigned sales rep. Otherwise it is Recovered Auto.",
    },
    {
      label: "Inventory gate",
      count: counts.noInventory,
      rule: "Lead is removed only when all non-PP/PSP/surcharge products in the cart have no inventory.",
      outcome: "Filtered status: No Inventory.",
    },
    {
      label: "Valid before manual review",
      count: counts.afterInventory,
      countType: "total",
      rule: "Leads that pass the automated Data Hub gates become valid follow-up candidates.",
      outcome: "Manual review can still remove leads that are not useful for sales follow-up.",
    },
    {
      label: "Manually marked gate",
      count: counts.manualMarked,
      rule: "Manual judgement can remove spam, not interested leads, internal test checkouts, or other leads that sales/admin decides should not be followed up.",
      outcome: `${counts.manualMarked.toLocaleString()} leads are currently recorded under Manually Marked.`,
    },
  ];

  const gradeRules = [
    ["A", "Subtotal is greater than 5000."],
    ["B", "Subtotal is 5000 or lower."],
    ["+", "Created 72 hours to 1 week ago."],
    ["No sign", "Created 1 week to 1 month ago."],
    ["-", "Created more than 1 month ago."],
    ["!", "Klaviyo email and SMS are both not subscribed or unavailable."],
    ["Priority", "Grades sort from highest to lowest, with A+! as the highest priority."],
  ];

  const statusRules = [
    ["Valid", "Effective lead for sales follow-up."],
    ["Invalid", "Lead does not qualify, or sales manually marked it as not useful."],
    ["Recovered Auto", "Shopify/Data Hub shows a recovered order, but there was no earlier sales assignment tied to that checkout."],
    ["Recovered by Sales", "The checkout was assigned to a sales rep before the recovered order was created."],
  ];

  els.rulesFunnel.innerHTML = `
    <div class="rules-summary">
      <article><span>Total loaded</span><strong>${counts.all.toLocaleString()}</strong></article>
      <article><span>Ready</span><strong>${counts.ready.toLocaleString()}</strong></article>
      <article><span>Invalid or filtered</span><strong>${(counts.all - counts.ready).toLocaleString()}</strong></article>
      <article><span>Ready rate</span><strong>${readyRate}%</strong></article>
    </div>
    <div class="funnel-steps">
      ${steps
        .map(
          (step, index) => `
            <article class="funnel-step">
              <div class="step-index">${index + 1}</div>
              <div>
                <div class="step-title">
                  <strong>${escapeHtml(step.label)}</strong>
                  <span class="${step.countType === "total" ? "" : "funnel-removal-count"}">${formatFunnelStepCount(step)}</span>
                </div>
                <p>${escapeHtml(step.rule)}</p>
                <small>${escapeHtml(step.outcome)}</small>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="rules-grid">
      ${renderRuleGroup("Grade Rules", gradeRules)}
      ${renderRuleGroup("Lead Status Rules", statusRules)}
      ${renderRuleGroup("Assignment Rules", [
        ["Manual only", "Leads stay unassigned until a user selects a sales owner."],
        ["No auto assignment", "Time zone and market are shown for review, but they do not assign leads automatically."],
        ["Storage", "Assignments and notes are saved by the local dashboard service until Data Hub write access is available."],
      ])}
    </div>
  `;
}

function renderRuleGroup(title, rows) {
  return `
    <section class="rule-group">
      <h3>${escapeHtml(title)}</h3>
      ${rows
        .map(
          ([name, description]) => `
            <div class="rule-row">
              <strong>${escapeHtml(name)}</strong>
              <span>${escapeHtml(description)}</span>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function formatFunnelStepCount(step) {
  const count = Number(step.count || 0);
  const label = `${Math.abs(count).toLocaleString()} leads`;
  return step.countType === "total" ? label : `-${label}`;
}

function getFunnelCounts(leads) {
  const counts = {
    all: leads.length,
    tooNew: 0,
    noContact: 0,
    duplicate: 0,
    recovered: 0,
    noInventory: 0,
    manualMarked: 0,
    ready: 0,
  };

  for (const lead of leads) {
    const autoReady = lead.funnelStatus === "Ready" || lead.funnelStatus === "Older Than 30 Days";
    if (lead.funnelStatus === "Too New") counts.tooNew += 1;
    if (lead.funnelStatus === "No Phone") counts.noContact += 1;
    if (lead.funnelStatus === "Duplicate") counts.duplicate += 1;
    if (lead.funnelStatus === "Recovered") counts.recovered += 1;
    if (lead.funnelStatus === "No Inventory") counts.noInventory += 1;
    if (autoReady && getLeadStatus(lead) !== "Valid") counts.manualMarked += 1;
    if (autoReady && getLeadStatus(lead) === "Valid") counts.ready += 1;
  }

  counts.afterTooNew = counts.all - counts.tooNew;
  counts.afterNoContact = counts.afterTooNew - counts.noContact;
  counts.afterDuplicate = counts.afterNoContact - counts.duplicate;
  counts.afterRecovered = counts.afterDuplicate - counts.recovered;
  counts.afterInventory = counts.afterRecovered - counts.noInventory;
  counts.afterManual = counts.afterInventory - counts.manualMarked;
  return counts;
}

function applyFilters() {
  const market = els.marketFilter.value;
  const leadStatus = els.leadStatusFilter.value;
  const grade = els.gradeFilter.value;
  const sales = els.salesFilter.value;
  const query = els.searchInput.value.trim().toLowerCase();
  const salesMarket = els.salesMarketFilter.value;
  const salesLeadStatus = els.salesLeadStatusFilter.value;
  const salesGrade = els.salesGradeFilter.value;
  const salesDetailSales = els.salesDetailSalesFilter.value;
  const salesQuery = els.salesSearchInput.value.trim().toLowerCase();
  const draftMarket = els.draftMarketFilter.value;
  const draftLeadStatus = els.draftLeadStatusFilter.value;
  const draftSales = els.draftSalesFilter.value;
  const draftQuery = els.draftSearchInput.value.trim().toLowerCase();

  state.visibleLeads = state.leads.filter((lead) => {
    if (market !== "ALL" && lead.market !== market) return false;
    if (leadStatus !== "ALL" && getLeadStatus(lead) !== leadStatus) return false;
    if (grade !== "ALL" && lead.grade !== grade) return false;
    if (sales !== "ALL" && (lead.assignedSales || "") !== sales) return false;
    if (state.role === "sales" && state.user !== "Admin" && lead.assignedSales !== state.user) return false;
    if (!query) return true;
    return searchBlob(lead).includes(query);
  }).sort(sortBySubtotalDesc);

  state.salesVisibleLeads = state.leads
    .filter((lead) => lead.assignedSales && lead.funnelStatus !== "Recovered")
    .filter((lead) => (state.role === "sales" && state.user !== "Admin" ? lead.assignedSales === state.user : true))
    .filter((lead) => (salesDetailSales !== "ALL" ? (lead.assignedSales || "") === salesDetailSales : true))
    .filter((lead) => (salesMarket !== "ALL" ? lead.market === salesMarket : true))
    .filter((lead) => (salesLeadStatus !== "ALL" ? getLeadStatus(lead) === salesLeadStatus : true))
    .filter((lead) => (salesGrade !== "ALL" ? lead.grade === salesGrade : true))
    .filter((lead) => (salesQuery ? searchBlob(lead).includes(salesQuery) : true))
    .sort(sortByGradeThenDate);

  state.visibleDrafts = state.drafts
    .filter((draft) => (draftMarket !== "ALL" ? draft.market === draftMarket : true))
    .filter((draft) => (draftLeadStatus !== "ALL" ? getLeadStatus(draft) === draftLeadStatus : true))
    .filter((draft) => (draftSales !== "ALL" ? (draft.assignedSales || "") === draftSales : true))
    .filter((draft) => (state.role === "sales" && state.user !== "Admin" ? draft.assignedSales === state.user : true))
    .filter((draft) => (draftQuery ? searchBlob(draft).includes(draftQuery) : true))
    .sort(sortBySubtotalDesc);

  renderSalesPersonalSummary();
  renderLeadRows();
  renderSalesRows();
  renderDraftRows();
}

function renderSalesPersonalSummary() {
  if (state.role !== "sales" || state.user === "Admin") {
    els.salesPersonalSummary.innerHTML = "";
    return;
  }

  const validAssigned = state.leads.filter((lead) =>
    lead.assignedSales === state.user &&
    getLeadStatus(lead) === "Valid" &&
    lead.funnelStatus !== "Recovered"
  );
  const amountsByMarket = validAssigned.reduce((totals, lead) => {
    totals[lead.market] = (totals[lead.market] || 0) + Number(lead.subtotal || 0);
    return totals;
  }, {});
  const amountParts = markets
    .filter((market) => amountsByMarket[market])
    .map((market) => `${market} ${formatMoney(amountsByMarket[market], marketCurrency(market))}`);
  const recovered = getRecoveredBySalesSummary(state.leads)[state.user] || { count: 0, amountsByMarket: {} };

  els.salesPersonalSummary.innerHTML = `
    <article class="sales-personal-card">
      <div class="sales-personal-stat">
        <span>${escapeHtml(state.user)} assigned leads</span>
        <strong>${validAssigned.length.toLocaleString()} valid assigned</strong>
        <small>${amountParts.length ? amountParts.join(" / ") : formatMoney(0, "USD")} assigned value</small>
      </div>
      <div class="sales-personal-stat">
        <span>Recovered by sales</span>
        <strong>${recovered.count.toLocaleString()} recovered by sales</strong>
        <small>${formatMarketAmounts(recovered.amountsByMarket)} recovered value</small>
      </div>
    </article>
  `;
}

function getRecoveredBySalesSummary(leads) {
  return leads.reduce((summary, lead) => {
    const salesName = getRecoveredBySalesOwner(lead);
    if (!salesName) return summary;
    summary[salesName] ||= { count: 0, amountsByMarket: {} };
    summary[salesName].count += 1;
    summary[salesName].amountsByMarket[lead.market] =
      (summary[salesName].amountsByMarket[lead.market] || 0) + Number(lead.subtotal || 0);
    return summary;
  }, {});
}

function getRecoveredBySalesOwner(lead) {
  if (getLeadStatus(lead) !== "Recovered by Sales") return "";
  const directName = findSalesName(lead.recoveredBy || lead.recoveredBySalesName || lead.assignedSales || "");
  if (directName) return directName;
  const tagText = Array.isArray(lead.recoveredOrderTags) ? lead.recoveredOrderTags.join(" ") : "";
  return findSalesName(tagText);
}

function findSalesName(value) {
  const haystack = normalizeComparableText(value);
  if (!haystack) return "";
  return state.salesUsers.find((name) => name !== "Non-sales" && haystack.includes(normalizeComparableText(name))) || "";
}

function normalizeComparableText(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function renderTableHeads() {
  const productColumns = [];
  for (let i = 1; i <= 7; i += 1) {
    productColumns.push(`Product ${i}`, `SKU ${i}`, `Checkout Price ${i}`, `Current Price ${i}`, `Inventory ${i}`, `Product URL ${i}`);
  }
  const columns = [...baseColumns, ...productColumns, ...trailingLeadColumns];
  const head = `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
  els.leadTableHead.innerHTML = head;
  els.salesTableHead.innerHTML = head;

  const draftProductColumns = [];
  for (let i = 1; i <= 7; i += 1) {
    draftProductColumns.push(`Product ${i}`, `SKU ${i}`, `Draft Price ${i}`, `Current Price ${i}`, `Cost ${i}`, `Margin ${i}`, `Margin % ${i}`, `Inventory ${i}`, `Product URL ${i}`);
  }
  const draftColumns = [
    "Lead Status",
    "Market",
    "Draft",
    "Sales",
    "Leads notes",
    "Created At Date",
    "Draft Status",
    "Subtotal",
    "Total",
    "Estimated Cost",
    "Margin",
    "Margin %",
    "Manual Shipping",
    "Customer",
    "Phone",
    "Email",
    "Shipping Address",
    "Time Zone",
    "Tags",
    "Opportunity Reason",
    ...draftProductColumns,
  ];
  els.draftTableHead.innerHTML = `<tr>${draftColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
}

function renderLeadRows() {
  if (!state.visibleLeads.length) {
    els.leadTableBody.innerHTML = `<tr class="empty-row"><td colspan="66">No leads match the current filters.</td></tr>`;
    return;
  }
  els.leadTableBody.innerHTML = state.visibleLeads.map(renderLeadRow).join("");
}

function renderSalesRows() {
  if (!state.salesVisibleLeads.length) {
    els.salesTableBody.innerHTML = `<tr class="empty-row"><td colspan="66">No active assigned leads match the current filters.</td></tr>`;
    els.salesDetailSubtitle.textContent = "No assigned lead detail to show.";
    return;
  }
  els.salesTableBody.innerHTML = state.salesVisibleLeads.map(renderLeadRow).join("");
  els.salesDetailSubtitle.textContent = `${state.salesVisibleLeads.length.toLocaleString()} active assigned leads.`;
}

function renderDraftRows() {
  if (!state.visibleDrafts.length) {
    els.draftTableBody.innerHTML = `<tr class="empty-row"><td colspan="59">No draft recovery leads match the current filters.</td></tr>`;
    return;
  }
  els.draftTableBody.innerHTML = state.visibleDrafts.map(renderDraftRow).join("");
}

function renderLeadRow(lead) {
  const isRecovered = getLeadStatus(lead).startsWith("Recovered") || lead.funnelStatus === "Recovered";
  const disabledSales = state.role === "sales" || isRecovered ? "disabled" : "";
  const productCells = [];
  for (let i = 0; i < 7; i += 1) {
    const item = lead.lineItems[i] || {};
    productCells.push(
      cell(item.title || ""),
      cell(item.sku || ""),
      cell(item.checkoutPrice ? formatMoney(item.checkoutPrice, lead.currency) : ""),
      cell(item.currentPrice ? formatMoney(item.currentPrice, lead.currency) : ""),
      cell(item.inventory ?? ""),
      item.productUrl ? `<td><a href="${escapeAttribute(item.productUrl)}" target="_blank" rel="noreferrer">Open</a></td>` : cell(""),
    );
  }
  return `
    <tr data-id="${escapeAttribute(lead.id)}" data-market="${escapeAttribute(lead.market)}" class="row-market-${lead.market.toLowerCase()}">
      <td>
        <select data-field="leadStatus">
          ${leadStatuses.map((status) => `<option value="${escapeAttribute(status)}" ${getLeadStatus(lead) === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
        </select>
      </td>
      ${cell(lead.market)}
      <td><span class="grade">${escapeHtml(lead.grade)}</span></td>
      <td>
        <div class="checkout-cell">
          <span>${escapeHtml(lead.checkout)}</span>
          <button class="copy-row-button" type="button" data-action="copy-row">Copy row</button>
        </div>
      </td>
      <td>
        <select data-field="sales" ${disabledSales}>
          <option value="">Unassigned</option>
          ${state.salesUsers.map((name) => `<option value="${escapeAttribute(name)}" ${lead.assignedSales === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
        </select>
      </td>
      <td><textarea data-field="notes" placeholder="Leads notes">${escapeHtml(getLeadNotes(lead))}</textarea></td>
      ${cell(formatCreatedAtWithAge(lead))}
      ${cell(formatMoney(lead.subtotal, lead.currency))}
      ${cell(lead.shippingName)}
      ${cell(lead.checkoutPhone)}
      ${cell(lead.checkoutEmail)}
      <td><pre>${escapeHtml(lead.address || "")}</pre></td>
      ${cell(lead.timeZone)}
      ${cell(lead.checkoutDiscountCode)}
      ${cell(lead.checkoutDiscountAmount ? formatMoney(lead.checkoutDiscountAmount, lead.currency) : "")}
      ${cell(lead.klaviyoEmailSubscribed)}
      ${cell(lead.klaviyoTextSubscribed)}
      ${cell(formatMoney(lead.klaviyoMaximumDiscount, lead.currency))}
      ${productCells.join("")}
      ${cell(lead.relatedSales)}
      ${cell(getRecoveredByValue(lead))}
    </tr>
  `;
}

function renderDraftRow(draft) {
  const productCells = [];
  for (let i = 0; i < 7; i += 1) {
    const item = draft.lineItems[i] || {};
    productCells.push(
      cell(item.title || ""),
      cell(item.sku || ""),
      cell(item.checkoutPrice ? formatMoney(item.checkoutPrice, draft.currency) : ""),
      cell(item.currentPrice ? formatMoney(item.currentPrice, draft.currency) : ""),
      cell(formatOptionalMoney(item.cost, draft.currency)),
      cell(formatOptionalMoney(item.margin, draft.currency)),
      cell(formatOptionalPercent(item.marginPercent)),
      cell(item.inventory ?? ""),
      item.productUrl ? `<td><a href="${escapeAttribute(item.productUrl)}" target="_blank" rel="noreferrer">Open</a></td>` : cell(""),
    );
  }
  return `
    <tr data-id="${escapeAttribute(draft.id)}" data-market="${escapeAttribute(draft.market)}" class="row-market-${draft.market.toLowerCase()}">
      <td>
        <select data-field="leadStatus">
          ${leadStatuses.map((status) => `<option value="${escapeAttribute(status)}" ${getLeadStatus(draft) === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
        </select>
      </td>
      ${cell(draft.market)}
      <td>
        <div class="checkout-cell">
          <span>${escapeHtml(draft.checkout)}</span>
          <button class="copy-row-button" type="button" data-action="copy-row">Copy row</button>
        </div>
      </td>
      <td>
        <select data-field="sales" ${state.role === "sales" ? "disabled" : ""}>
          <option value="">Unassigned</option>
          ${state.salesUsers.map((name) => `<option value="${escapeAttribute(name)}" ${draft.assignedSales === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
        </select>
      </td>
      <td><textarea data-field="notes" placeholder="Leads notes">${escapeHtml(getLeadNotes(draft))}</textarea></td>
      ${cell(formatCreatedAtWithAge(draft))}
      ${cell(draft.draftStatus)}
      ${cell(formatMoney(draft.subtotal, draft.currency))}
      ${cell(formatMoney(draft.total || draft.subtotal, draft.currency))}
      ${cell(formatOptionalMoney(draft.totalCost, draft.currency))}
      ${cell(formatOptionalMoney(draft.margin, draft.currency))}
      ${cell(formatOptionalPercent(draft.marginPercent))}
      ${cell(`${draft.manualShippingTitle || "Manual shipping"} ${formatMoney(draft.manualShippingPrice || 0, draft.currency)}`)}
      ${cell(draft.name)}
      ${cell(draft.checkoutPhone)}
      ${cell(draft.checkoutEmail)}
      <td><pre>${escapeHtml(draft.address || "")}</pre></td>
      ${cell(draft.timeZone)}
      ${cell(Array.isArray(draft.tags) ? draft.tags.join(", ") : draft.tags || "")}
      ${cell(draft.funnelReason)}
      ${productCells.join("")}
    </tr>
  `;
}

function handleLeadChange(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  saveRowFromControl(event.target);
}

function handleLeadInput(event) {
  const field = event.target.dataset.field;
  if (!field || event.target.tagName !== "TEXTAREA") return;
  clearTimeout(event.target._saveTimer);
  event.target._saveTimer = setTimeout(() => saveRowFromControl(event.target), 450);
}

async function handleLeadClick(event) {
  const button = event.target.closest("[data-action='copy-row']");
  if (!button) return;
  const row = button.closest("tr");
  const lead = findLead(row.dataset.market, row.dataset.id);
  if (!lead) return;

  lead.assignedSales = getRowField(row, "sales");
  lead.leadStatus = getRowField(row, "leadStatus");
  lead.salesStatus = lead.leadStatus;
  lead.salesNotes = getRowField(row, "notes");

  try {
    await copyTextToClipboard(getCopyRowText(lead));
    showTemporaryButtonText(button, "Copied");
  } catch (error) {
    alert("Copy failed. Please try again.");
  }
}

async function saveRowFromControl(control) {
  const row = control.closest("tr");
  const lead = findLead(row.dataset.market, row.dataset.id);
  if (!lead) return;
  const payload = {
    id: lead.id,
    market: lead.market,
    checkout: lead.checkout,
    checkoutName: lead.checkout,
    sales: getRowField(row, "sales"),
    leadStatus: getRowField(row, "leadStatus"),
    salesStatus: getRowField(row, "leadStatus"),
    notes: getRowField(row, "notes"),
    updatedBy: state.authEmail || state.user || "",
  };
  try {
    const response = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "Save failed");
    Object.assign(lead, {
      assignedSales: data.assignment.sales || "",
      leadStatus: data.assignment.leadStatus || data.assignment.salesStatus || "Valid",
      salesStatus: data.assignment.leadStatus || data.assignment.salesStatus || "Valid",
      salesNotes: data.assignment.notes || "",
      assignedAt: data.assignment.assignedAt || "",
      lastWorklogAt: data.assignment.updatedAt || "",
    });
    applyFilters();
  } catch (error) {
    alert(error.message);
  }
}

function getRowField(row, field) {
  const control = row.querySelector(`[data-field="${field}"]`);
  return control ? control.value : "";
}

function findLead(market, id) {
  return [...state.leads, ...state.drafts].find((lead) => lead.market === market && String(lead.id) === String(id));
}

function searchBlob(lead) {
  return [
    lead.checkout,
    lead.name,
    lead.shippingName,
    lead.checkoutEmail,
    lead.checkoutPhone,
    lead.relatedSales,
    lead.shippingState,
    lead.address,
    lead.draftStatus,
    lead.funnelReason,
    Array.isArray(lead.tags) ? lead.tags.join(" ") : lead.tags,
    lead.assignedSales,
    lead.lineItems.map((item) => `${item.title} ${item.sku}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function exportCsv(rows, name) {
  if (!rows.length) return;
  const isDraftExport = rows.some((row) => row.draftStatus !== undefined);
  const headers = isDraftExport ? getDraftExportHeaders() : getExportHeaders();
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((lead) => (isDraftExport ? getDraftExportValues(lead) : getExportValues(lead)).map(csvCell).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function getExportHeaders() {
  const productHeaders = [];
  for (let i = 1; i <= 7; i += 1) {
    productHeaders.push(`Product ${i}`, `SKU ${i}`, `Checkout Price ${i}`, `Current Price ${i}`, `Inventory ${i}`, `Product URL ${i}`);
  }
  return [...baseColumns, ...productHeaders, ...trailingLeadColumns];
}

function getDraftExportHeaders() {
  const productHeaders = [];
  for (let i = 1; i <= 7; i += 1) {
    productHeaders.push(`Product ${i}`, `SKU ${i}`, `Draft Price ${i}`, `Current Price ${i}`, `Cost ${i}`, `Margin ${i}`, `Margin % ${i}`, `Inventory ${i}`, `Product URL ${i}`);
  }
  return [
    "Lead Status",
    "Market",
    "Draft",
    "Sales",
    "Leads notes",
    "Created At Date",
    "Draft Status",
    "Subtotal",
    "Total",
    "Estimated Cost",
    "Margin",
    "Margin %",
    "Manual Shipping",
    "Customer",
    "Phone",
    "Email",
    "Shipping Address",
    "Time Zone",
    "Tags",
    "Opportunity Reason",
    ...productHeaders,
  ];
}

function getExportValues(lead) {
  const values = [
    getLeadStatus(lead),
    lead.market,
    lead.grade,
    lead.checkout,
    lead.assignedSales,
    getLeadNotes(lead),
    formatCreatedAtWithAge(lead),
    lead.subtotal,
    lead.shippingName,
    lead.checkoutPhone,
    lead.checkoutEmail,
    lead.address,
    lead.timeZone,
    lead.checkoutDiscountCode,
    lead.checkoutDiscountAmount,
    lead.klaviyoEmailSubscribed,
    lead.klaviyoTextSubscribed,
    lead.klaviyoMaximumDiscount,
  ];
  for (let i = 0; i < 7; i += 1) {
    const item = lead.lineItems[i] || {};
    values.push(item.title || "", item.sku || "", item.checkoutPrice || "", item.currentPrice || "", item.inventory ?? "", item.productUrl || "");
  }
  values.push(lead.relatedSales, getRecoveredByValue(lead));
  return values;
}

function getRecoveredByValue(lead) {
  const status = getLeadStatus(lead);
  if (status === "Recovered Auto") return "Auto";
  if (status === "Recovered by Sales") return lead.recoveredBy || getRecoveredBySalesOwner(lead) || "Sales";
  if (lead.funnelStatus === "Recovered") return lead.recoveredBy || (lead.recoveredBySales ? "Sales" : "Auto");
  return "";
}

function getDraftExportValues(draft) {
  const values = [
    getLeadStatus(draft),
    draft.market,
    draft.checkout,
    draft.assignedSales,
    getLeadNotes(draft),
    formatCreatedAtWithAge(draft),
    draft.draftStatus,
    draft.subtotal,
    draft.total || draft.subtotal,
    draft.totalCost ?? "",
    draft.margin ?? "",
    draft.marginPercent === null || draft.marginPercent === undefined ? "" : `${Math.round(draft.marginPercent * 1000) / 10}%`,
    `${draft.manualShippingTitle || "Manual shipping"} ${draft.manualShippingPrice || 0}`,
    draft.name,
    draft.checkoutPhone,
    draft.checkoutEmail,
    draft.address,
    draft.timeZone,
    Array.isArray(draft.tags) ? draft.tags.join(", ") : draft.tags || "",
    draft.funnelReason,
  ];
  for (let i = 0; i < 7; i += 1) {
    const item = draft.lineItems[i] || {};
    values.push(
      item.title || "",
      item.sku || "",
      item.checkoutPrice || "",
      item.currentPrice || "",
      item.cost ?? "",
      item.margin ?? "",
      item.marginPercent === null || item.marginPercent === undefined ? "" : `${Math.round(item.marginPercent * 1000) / 10}%`,
      item.inventory ?? "",
      item.productUrl || "",
    );
  }
  return values;
}

function getCopyRowText(lead) {
  return (lead.draftStatus !== undefined ? getDraftExportValues(lead) : getExportValues(lead)).map(tsvCell).join("\t");
}

function tsvCell(value) {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function showTemporaryButtonText(button, text) {
  const originalText = button.textContent;
  button.textContent = text;
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
  }, 900);
}

function gradeRank(grade) {
  return gradeOrder.indexOf(grade) === -1 ? 99 : gradeOrder.indexOf(grade);
}

function sortByGradeThenDate(a, b) {
  return gradeRank(a.grade) - gradeRank(b.grade) || new Date(b.createdAt) - new Date(a.createdAt);
}

function sortBySubtotalDesc(a, b) {
  return Number(b.subtotal || 0) - Number(a.subtotal || 0) || sortByGradeThenDate(a, b);
}

function getLeadStatus(lead) {
  return lead.leadStatus || lead.salesStatus || "Valid";
}

function getLeadNotes(lead) {
  const manualNotes = String(lead.salesNotes || "").trim();
  if (manualNotes) return lead.salesNotes;
  const leadStatus = getLeadStatus(lead);
  if (leadStatus === "Invalid") return getInvalidReasonNote(lead);
  if (leadStatus === "Recovered Auto" || leadStatus === "Recovered by Sales") return getRecoveredReasonNote(lead);
  return "";
}

function getInvalidReasonNote(lead) {
  const funnelStatus = lead.funnelStatus || "";
  const funnelReason = String(lead.funnelReason || "").trim();
  if (funnelStatus === "Too New") return `Invalid: ${funnelReason || "less than 72 hours old"}`;
  if (funnelStatus === "No Phone") return `Invalid: ${funnelReason || "no checkout phone"}`;
  if (funnelStatus === "Duplicate") return `Invalid: ${funnelReason || "older checkout with same customer name and products"}`;
  if (funnelStatus === "No Inventory") return `Invalid: ${funnelReason || "all non-PP/PSP/surcharge products have no inventory"}`;
  if (funnelReason && !["Ready", "Older Than 30 Days"].includes(funnelStatus)) return `Invalid: ${funnelStatus} - ${funnelReason}`;
  return "Invalid: manually marked";
}

function getRecoveredReasonNote(lead) {
  const order = String(lead.recoveredOrderNumber || "").trim();
  const status = getLeadStatus(lead);
  const parts = [order ? `Recovered order: ${order}` : "Recovered order: missing from Data Hub"];
  if (status === "Recovered by Sales") {
    const owner = lead.recoveredBy || lead.assignedSales || lead.recoveredBySalesName || "Sales";
    parts.push(`Recovered by: ${owner}`);
  }
  if (status === "Recovered Auto") {
    parts.push("No earlier sales assignment");
  }
  return parts.join("; ");
}

function cell(value) {
  return `<td>${escapeHtml(value ?? "")}</td>`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatOptionalMoney(value, currency) {
  if (value === null || value === undefined || value === "") return "";
  return formatMoney(value, currency);
}

function formatOptionalPercent(value) {
  if (value === null || value === undefined || value === "") return "";
  return `${Math.round(Number(value) * 1000) / 10}%`;
}

function formatMarketAmounts(amountsByMarket) {
  const parts = markets
    .filter((market) => Number(amountsByMarket?.[market] || 0))
    .map((market) => `${market} ${formatMoney(amountsByMarket[market], marketCurrency(market))}`);
  return parts.length ? parts.join(" / ") : formatMoney(0, "USD");
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatCreatedAtWithAge(lead) {
  const dateText = lead.createdAtVancouver || formatDateTime(lead.createdAt);
  const ageText = formatDaysAgo(lead);
  return ageText ? `${dateText} (${ageText})` : dateText;
}

function formatDaysAgo(lead) {
  let ageHours = Number(lead.ageHours);
  if (!Number.isFinite(ageHours) && lead.createdAt) {
    const createdAt = new Date(lead.createdAt).getTime();
    if (Number.isFinite(createdAt)) ageHours = Math.max(0, (Date.now() - createdAt) / 36e5);
  }
  if (!Number.isFinite(ageHours)) return "";
  return `${Math.max(0, Math.floor(ageHours / 24))}d ago`;
}

function formatRelativeAgo(value) {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatPercent(part, total) {
  const numerator = Number(part || 0);
  const denominator = Number(total || 0);
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function marketCurrency(market) {
  return { US: "USD", CA: "CAD", AU: "AUD" }[market] || "USD";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
