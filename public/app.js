const els = {
  loginOverlay: document.querySelector("#loginOverlay"),
  loginForm: document.querySelector("#loginForm"),
  loginUser: document.querySelector("#loginUser"),
  loginRole: document.querySelector("#loginRole"),
  loginStatus: document.querySelector("#loginStatus"),
  currentUserLabel: document.querySelector("#currentUserLabel"),
  switchUserButton: document.querySelector("#switchUserButton"),
  adminSalesPreviewControls: document.querySelector("#adminSalesPreviewControls"),
  adminSalesPreviewSelect: document.querySelector("#adminSalesPreviewSelect"),
  adminSalesPreviewButton: document.querySelector("#adminSalesPreviewButton"),
  adminSalesPreviewExitButton: document.querySelector("#adminSalesPreviewExitButton"),
  dataFreshness: document.querySelector("#dataFreshness"),
  tabButtons: document.querySelectorAll("[data-tab]"),
  workspaceTab: document.querySelector("#workspaceTab"),
  draftsTab: document.querySelector("#draftsTab"),
  rulesTab: document.querySelector("#rulesTab"),
  marketFilter: document.querySelector("#marketFilter"),
  leadStatusFilter: document.querySelector("#leadStatusFilter"),
  gradeFilter: document.querySelector("#gradeFilter"),
  bangGradeFilter: document.querySelector("#bangGradeFilter"),
  salesFilter: document.querySelector("#salesFilter"),
  timeZoneFilter: document.querySelector("#timeZoneFilter"),
  minSubtotalFilter: document.querySelector("#minSubtotalFilter"),
  maxSubtotalFilter: document.querySelector("#maxSubtotalFilter"),
  searchInput: document.querySelector("#searchInput"),
  salesMarketFilter: document.querySelector("#salesMarketFilter"),
  salesLeadStatusFilter: document.querySelector("#salesLeadStatusFilter"),
  salesGradeFilter: document.querySelector("#salesGradeFilter"),
  salesBangGradeFilter: document.querySelector("#salesBangGradeFilter"),
  salesDetailSalesFilter: document.querySelector("#salesDetailSalesFilter"),
  salesAssignedUserLocked: document.querySelector("#salesAssignedUserLocked"),
  salesAssignedDateFilter: document.querySelector("#salesAssignedDateFilter"),
  salesTimeZoneFilter: document.querySelector("#salesTimeZoneFilter"),
  salesMinSubtotalFilter: document.querySelector("#salesMinSubtotalFilter"),
  salesMaxSubtotalFilter: document.querySelector("#salesMaxSubtotalFilter"),
  salesSearchInput: document.querySelector("#salesSearchInput"),
  draftMarketFilter: document.querySelector("#draftMarketFilter"),
  draftLeadStatusFilter: document.querySelector("#draftLeadStatusFilter"),
  draftSalesFilter: document.querySelector("#draftSalesFilter"),
  draftSearchInput: document.querySelector("#draftSearchInput"),
  marketSummary: document.querySelector("#marketSummary"),
  salesPersonalSummary: document.querySelector("#salesPersonalSummary"),
  leadTableHead: document.querySelector("#leadTableHead"),
  leadTableBody: document.querySelector("#leadTableBody"),
  leadCardList: document.querySelector("#leadCardList"),
  qualifiedSubtitle: document.querySelector("#qualifiedSubtitle"),
  bulkAssignBar: document.querySelector("#bulkAssignBar"),
  bulkSelectedCount: document.querySelector("#bulkSelectedCount"),
  bulkAssignSales: document.querySelector("#bulkAssignSales"),
  bulkAssignButton: document.querySelector("#bulkAssignButton"),
  bulkClearButton: document.querySelector("#bulkClearButton"),
  bulkAssignStatus: document.querySelector("#bulkAssignStatus"),
  leadPager: document.querySelector("#leadPager"),
  leadPrevPage: document.querySelector("#leadPrevPage"),
  leadNextPage: document.querySelector("#leadNextPage"),
  leadPageInfo: document.querySelector("#leadPageInfo"),
  salesOverview: document.querySelector("#salesOverview"),
  salesTableHead: document.querySelector("#salesTableHead"),
  salesTableBody: document.querySelector("#salesTableBody"),
  salesQuickList: document.querySelector("#salesQuickList"),
  salesCardList: document.querySelector("#salesCardList"),
  salesCardPager: document.querySelector("#salesCardPager"),
  salesPrevPage: document.querySelector("#salesPrevPage"),
  salesNextPage: document.querySelector("#salesNextPage"),
  salesPageInfo: document.querySelector("#salesPageInfo"),
  salesDetailSubtitle: document.querySelector("#salesDetailSubtitle"),
  draftSummary: document.querySelector("#draftSummary"),
  draftTableHead: document.querySelector("#draftTableHead"),
  draftTableBody: document.querySelector("#draftTableBody"),
  draftSubtitle: document.querySelector("#draftSubtitle"),
  exportSalesTabsButton: document.querySelector("#exportSalesTabsButton"),
  exportDraftButton: document.querySelector("#exportDraftButton"),
  rulesFunnel: document.querySelector("#rulesFunnel"),
};

const leadStatuses = ["Valid", "Drafted", "Closed", "Invalid", "Recovered Auto", "Recovered by Sales"];
const gradeOrder = ["A+!", "A+", "A!", "A", "A-!", "A-", "B+!", "B+", "B!", "B", "B-!", "B-"];
const markets = ["US", "CA", "AU"];

const baseColumns = [
  "Lead Status",
  "Market",
  "Grade",
  "Checkout",
  "Created At Date",
  "Subtotal",
  "Sales",
  "Assigned Time",
  "Leads notes",
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
const trailingLeadColumns = ["Related Sales", "Related Order", "Related Order Date", "Recovered By", "Recovered Order", "Recovered Order Date"];

let state = {
  user: null,
  role: "admin",
  authMode: "manual",
  authBlocked: false,
  authEmail: "",
  salesPreview: {
    active: false,
    adminUser: null,
    adminRole: "admin",
  },
  salesUsers: [],
  leads: [],
  drafts: [],
  draftFunnel: null,
  visibleLeads: [],
  pagedVisibleLeads: [],
  salesVisibleLeads: [],
  visibleDrafts: [],
  selectedLeadKeys: new Set(),
  leadPage: 1,
  salesPage: 1,
  salesControlsPopulated: false,
};

const leadPageSize = 5;
const salesPageSize = 1;

els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.authMode === "cloudflare_access") return;
  resetSalesPreview();
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
els.adminSalesPreviewButton.addEventListener("click", enterSalesPreview);
els.adminSalesPreviewExitButton.addEventListener("click", exitSalesPreview);
els.adminSalesPreviewSelect.addEventListener("change", renderUserMode);

els.exportSalesTabsButton.addEventListener("click", () => exportCsv(state.salesVisibleLeads, "sales-lead-detail"));
els.exportDraftButton.addEventListener("click", () => exportCsv(state.visibleDrafts, "draft-recovery-leads"));
els.bulkAssignButton.addEventListener("click", bulkAssignSelectedLeads);
els.bulkClearButton.addEventListener("click", clearBulkSelection);
els.leadPrevPage.addEventListener("click", () => changeLeadPage(-1));
els.leadNextPage.addEventListener("click", () => changeLeadPage(1));
els.salesPrevPage.addEventListener("click", () => changeSalesPage(-1));
els.salesNextPage.addEventListener("click", () => changeSalesPage(1));
els.tabButtons.forEach((button) => button.addEventListener("click", () => setActiveTab(button.dataset.tab)));

for (const control of [
  els.marketFilter,
  els.leadStatusFilter,
  els.gradeFilter,
  els.bangGradeFilter,
  els.salesFilter,
  els.timeZoneFilter,
  els.minSubtotalFilter,
  els.maxSubtotalFilter,
  els.searchInput,
]) {
  control.addEventListener("input", applyFilters);
}

for (const control of [
  els.salesMarketFilter,
  els.salesLeadStatusFilter,
  els.salesGradeFilter,
  els.salesBangGradeFilter,
  els.salesDetailSalesFilter,
  els.salesAssignedDateFilter,
  els.salesTimeZoneFilter,
  els.salesMinSubtotalFilter,
  els.salesMaxSubtotalFilter,
  els.salesSearchInput,
]) {
  control.addEventListener("input", applyFilters);
}

for (const control of [els.draftMarketFilter, els.draftLeadStatusFilter, els.draftSalesFilter, els.draftSearchInput]) {
  control.addEventListener("input", applyFilters);
}

els.leadTableBody.addEventListener("change", handleLeadChange);
els.leadTableHead.addEventListener("change", handleLeadSelectionChange);
els.leadTableBody.addEventListener("change", handleLeadSelectionChange);
els.leadTableBody.addEventListener("input", handleLeadInput);
els.leadTableBody.addEventListener("click", handleLeadClick);
els.leadCardList.addEventListener("change", handleLeadChange);
els.leadCardList.addEventListener("change", handleLeadSelectionChange);
els.leadCardList.addEventListener("input", handleLeadInput);
els.leadCardList.addEventListener("click", handleLeadClick);
els.salesTableBody.addEventListener("change", handleLeadChange);
els.salesTableBody.addEventListener("input", handleLeadInput);
els.salesTableBody.addEventListener("click", handleLeadClick);
els.salesQuickList.addEventListener("click", handleSalesQuickListClick);
els.salesCardList.addEventListener("change", handleLeadChange);
els.salesCardList.addEventListener("input", handleLeadInput);
els.salesCardList.addEventListener("click", handleLeadClick);
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
    populateSalesUserControls();
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
    resetSalesPreview();
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
    populateSalesUserControls();
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
      resetSalesPreview();
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

function resetSalesPreview() {
  state.salesPreview.active = false;
  state.salesPreview.adminUser = null;
  state.salesPreview.adminRole = "admin";
}

function populateSalesUserControls() {
  const salesOptions = state.salesUsers.filter((name) => name !== "Non-sales");
  const alreadyPopulated = state.salesControlsPopulated;
  const previousSalesFilter = alreadyPopulated ? els.salesFilter.value : "";
  const previousSalesDetailFilter = alreadyPopulated ? els.salesDetailSalesFilter.value : "ALL";
  const previousDraftSalesFilter = alreadyPopulated ? els.draftSalesFilter.value : "ALL";
  const previousBulkSales = els.bulkAssignSales.value;
  const previousPreviewSales = els.adminSalesPreviewSelect.value;

  els.loginUser.innerHTML = [
    `<option value="Admin">Admin</option>`,
    ...salesOptions.map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`),
  ].join("");
  els.salesFilter.innerHTML = [
    `<option value="ALL">All sales</option>`,
    `<option value="">Unassigned</option>`,
    ...state.salesUsers.map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`),
  ].join("");
  els.bulkAssignSales.innerHTML = [
    `<option value="">Choose sales</option>`,
    ...salesOptions.map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`),
  ].join("");
  els.salesDetailSalesFilter.innerHTML = [
    `<option value="ALL">All sales</option>`,
    ...salesOptions.map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`),
  ].join("");
  els.draftSalesFilter.innerHTML = [
    `<option value="ALL">All sales</option>`,
    `<option value="">Unassigned</option>`,
    ...state.salesUsers.map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`),
  ].join("");
  els.adminSalesPreviewSelect.innerHTML = [
    `<option value="">Choose sales view</option>`,
    ...salesOptions.map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`),
  ].join("");

  setSelectValueIfAvailable(els.salesFilter, previousSalesFilter || "");
  setSelectValueIfAvailable(els.salesDetailSalesFilter, previousSalesDetailFilter || "ALL");
  setSelectValueIfAvailable(els.draftSalesFilter, previousDraftSalesFilter || "ALL");
  setSelectValueIfAvailable(els.bulkAssignSales, previousBulkSales || "");
  setSelectValueIfAvailable(els.adminSalesPreviewSelect, previousPreviewSales || "");
  state.salesControlsPopulated = true;
}

function setSelectValueIfAvailable(select, value) {
  const hasValue = [...select.options].some((option) => option.value === value);
  if (hasValue) select.value = value;
}

function enterSalesPreview() {
  const salesUser = els.adminSalesPreviewSelect.value;
  if (!salesUser) return;
  if (!state.salesPreview.active) {
    state.salesPreview.adminUser = state.user || "Admin";
    state.salesPreview.adminRole = state.role || "admin";
  }
  state.salesPreview.active = true;
  state.user = salesUser;
  state.role = "sales";
  renderUserMode();
  applyFilters();
}

function exitSalesPreview() {
  if (!state.salesPreview.active) return;
  state.user = state.salesPreview.adminUser || "Admin";
  state.role = state.salesPreview.adminRole || "admin";
  state.salesPreview.active = false;
  state.salesPreview.adminUser = null;
  state.salesPreview.adminRole = "admin";
  renderUserMode();
  applyFilters();
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
  try {
    const response = await fetch("/api/leads?market=US,CA,AU&limit=5000&all=1", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : { error: `Dashboard API returned ${response.status} ${response.statusText || ""} instead of JSON.` };
    if (!response.ok) throw new Error(data.error || "Could not load leads.");
    state.salesUsers = data.salesUsers || state.salesUsers;
    populateSalesUserControls();
    state.leads = data.leads || [];
    state.selectedLeadKeys.clear();
    populateGradeFilter(state.leads);
    populateTimeZoneFilter(state.leads);
    renderSummary(data.summary || {});
    renderRulesFunnel();
    applyFilters();
    els.qualifiedSubtitle.textContent = `${state.leads.length.toLocaleString()} abandoned cart leads loaded from Data Hub.`;
  } catch (error) {
    state.leads = [];
    renderRulesFunnel();
    applyFilters();
    els.qualifiedSubtitle.textContent = error.message;
  }
}

async function loadDrafts() {
  try {
    const response = await fetch("/api/drafts?market=US,CA,AU&limit=3000", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load drafts.");
    state.salesUsers = data.salesUsers || state.salesUsers;
    populateSalesUserControls();
    state.drafts = data.drafts || [];
    state.draftFunnel = data.funnel || null;
    renderDraftSummary(data.summary || {});
    renderRulesFunnel();
    applyFilters();
    els.draftSubtitle.textContent = `${state.drafts.length.toLocaleString()} open draft orders with manual shipping loaded from Data Hub.`;
  } catch (error) {
    state.drafts = [];
    state.draftFunnel = null;
    renderDraftSummary({});
    renderRulesFunnel();
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
  const isSalesPreview = state.salesPreview.active;
  const originalRole = isSalesPreview ? state.salesPreview.adminRole : state.role;
  const canPreviewSales = isSalesPreview || originalRole === "admin" || state.user === "Admin";
  els.currentUserLabel.textContent = isSalesPreview
    ? `Previewing ${state.user} sales view`
    : state.authEmail
      ? `${state.user || "Not signed in"} (${state.role}) - ${state.authEmail}`
      : `${state.user || "Not signed in"} (${state.role})`;
  document.body.dataset.role = state.role;
  document.body.dataset.auth = state.authMode;
  document.body.dataset.salesPreview = isSalesPreview ? "true" : "false";
  els.adminSalesPreviewControls.hidden = !canPreviewSales;
  els.adminSalesPreviewSelect.hidden = isSalesPreview;
  els.adminSalesPreviewButton.hidden = isSalesPreview;
  els.adminSalesPreviewButton.disabled = !els.adminSalesPreviewSelect.value;
  els.adminSalesPreviewExitButton.hidden = !isSalesPreview;
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
    els.salesDetailSalesFilter.hidden = true;
    els.salesAssignedUserLocked.hidden = false;
    els.salesAssignedUserLocked.textContent = state.user;
    els.draftSalesFilter.value = state.user;
    els.draftSalesFilter.disabled = true;
  } else {
    els.salesFilter.disabled = false;
    els.salesDetailSalesFilter.disabled = false;
    els.salesDetailSalesFilter.hidden = false;
    els.salesAssignedUserLocked.hidden = true;
    els.salesAssignedUserLocked.textContent = "";
    els.draftSalesFilter.disabled = false;
  }
}

function populateGradeFilter(leads) {
  const grades = [...new Set(leads.map((lead) => lead.grade).filter(Boolean))].sort((a, b) => gradeRank(a) - gradeRank(b));
  els.gradeFilter.innerHTML = [`<option value="ALL">All grades</option>`, ...grades.map((grade) => `<option value="${grade}">${grade}</option>`)].join("");
  els.salesGradeFilter.innerHTML = [`<option value="ALL">All grades</option>`, ...grades.map((grade) => `<option value="${grade}">${grade}</option>`)].join("");
}

function populateTimeZoneFilter(leads) {
  const zones = [...new Set(leads.map((lead) => normalizeTimeZoneFilterValue(lead.timeZone)).filter(Boolean))].sort();
  const options = [`<option value="ALL">All time zones</option>`, ...zones.map((zone) => `<option value="${escapeAttribute(zone)}">${escapeHtml(zone)}</option>`)];
  els.timeZoneFilter.innerHTML = options.join("");
  els.salesTimeZoneFilter.innerHTML = options.join("");
}

function populateSalesAssignedDateFilter() {
  const previousValue = els.salesAssignedDateFilter.value || "ALL";
  const selectedSales = els.salesDetailSalesFilter.value;
  const dateRows = state.leads
    .filter((lead) => lead.assignedSales && lead.assignedAt)
    .filter((lead) => (state.role === "sales" && state.user !== "Admin" ? lead.assignedSales === state.user : true))
    .filter((lead) => (selectedSales !== "ALL" ? (lead.assignedSales || "") === selectedSales : true))
    .map((lead) => getAssignedDateOption(lead.assignedAt))
    .filter(Boolean);
  const uniqueDates = [...new Map(dateRows.map((row) => [row.value, row])).values()].sort((a, b) => b.value.localeCompare(a.value));
  els.salesAssignedDateFilter.innerHTML = [
    `<option value="ALL">All assigned dates</option>`,
    ...uniqueDates.map((row) => `<option value="${escapeAttribute(row.value)}">${escapeHtml(row.label)}</option>`),
  ].join("");
  setSelectValueIfAvailable(els.salesAssignedDateFilter, previousValue);
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
      rule: "All abandoned cart leads loaded from Data Hub for US, CA, and AU.",
      outcome: "This is the starting pool before any lead selection gate runs.",
    },
    {
      label: "Age gate",
      count: counts.tooNew,
      rule: "Leads created less than 72 hours ago are held out first. They can become Valid once they pass 72 hours.",
      outcome: "Filtered status: Too New.",
    },
    {
      label: "Phone gate",
      count: counts.noContact,
      rule: "Lead must have checkout phone. Checkout email is helpful but not required. Leads older than 30 days remain Valid when they pass the other gates.",
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
      rule: "If Data Hub marks the abandoned cart as recovered, remove it from active lead selection. If the recovered order happened after a prior assignment, it can be counted as Recovered by Sales; otherwise it is Recovered Auto.",
      outcome: "Filtered status: Recovered.",
    },
    {
      label: "Inventory gate",
      count: counts.noInventory,
      rule: "At least one non-PP / non-PSP / non-surcharge product in the cart must have usable inventory from Data Hub product inventory data.",
      outcome: "Filtered status: No Inventory.",
    },
    {
      label: "Valid before manual review",
      count: counts.afterInventory,
      countType: "total",
      rule: "Leads that pass age, phone, duplicate, recovered, and inventory gates become valid candidates before manual review.",
      outcome: "Manual review can still remove spam, tests, bad addresses, or leads sales already rejected.",
    },
    {
      label: "Manually marked gate",
      count: counts.manualMarked,
      rule: "Admin or sales can manually mark a lead Invalid after review, for reasons like spam, internal test, fake customer, bad fit, or not interested.",
      outcome: `${counts.manualMarked.toLocaleString()} leads are currently manually marked out.`,
    },
    {
      label: "Valid leads",
      count: counts.ready,
      countType: "total",
      rule: "Final Valid leads are the active abandoned cart leads available for assignment.",
      outcome: "This count should match the Valid filter when no other filters are applied.",
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
    ["Valid", "Lead qualifies for sales follow-up."],
    ["Drafted", "A draft has been created for the lead and it should be tracked separately from active Valid leads."],
    ["Closed", "The lead has been closed after review or follow-up and is no longer counted as active Valid assigned work."],
    ["Invalid", "Lead does not qualify, or sales/admin manually marked it as not useful."],
    ["Recovered Auto", "Data Hub shows a recovered order, but there was no earlier sales assignment before the order date."],
    ["Recovered by Sales", "The lead was assigned to a sales person before the recovered order was created."],
  ];

  const salesWorkflowRules = [
    ["Review first", "Check the product, checkout value, phone, email, shipping address, time zone, current price, and inventory before calling."],
    ["Call priority", "Start from the highest grade leads first. A+! is the highest priority, then A+, A!, A, A-!, A-, then B grades."],
    ["Use lead status", "Keep workable leads as Valid. Use Drafted when a draft has been created, Closed when follow-up is finished, and Invalid when the lead should not be worked."],
    ["Do not overwrite recovered", "Recovered Auto and Recovered by Sales are system recovery statuses. Only change them if admin confirms the lead status is wrong."],
  ];

  const notesRules = [
    ["Write the result", "Notes should explain what happened, not just say called. Example: Called, no answer, voicemail left."],
    ["Use names or blockers", "If the lead is invalid, write the clear reason, such as fake info, wrong number, not interested, already purchased, test, or internal person."],
    ["Add next step", "If follow-up is needed, write the callback date/time or action, such as call back Friday morning or waiting for freight quote."],
    ["Keep it short", "Use one clear sentence when possible so admin and other sales can quickly understand the lead history."],
  ];

  els.rulesFunnel.innerHTML = `
    <div class="rules-summary">
      <article><span>Abandoned carts</span><strong>${counts.all.toLocaleString()}</strong></article>
      <article><span>Valid leads</span><strong>${counts.ready.toLocaleString()}</strong></article>
      <article><span>Removed or inactive</span><strong>${(counts.all - counts.ready).toLocaleString()}</strong></article>
      <article><span>Valid rate</span><strong>${readyRate}%</strong></article>
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
        ["Storage", "Assignments, lead status, and notes are saved through Data Hub when write access is available."],
      ])}
      ${renderRuleGroup("Sales Follow-up Rules", salesWorkflowRules)}
      ${renderRuleGroup("Notes Rules", notesRules)}
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

function getDraftFunnelCounts(drafts) {
  const counts = {
    all: drafts.length,
    completed: 0,
    noManualShipping: 0,
    lowShipping: 0,
    noInventory: 0,
    manualMarked: 0,
    ready: 0,
  };

  for (const draft of drafts) {
    if (draft.completed) counts.completed += 1;
    if (!draft.hasManualShipping) counts.noManualShipping += 1;
    if (Number(draft.manualShippingPrice || 0) <= 100) counts.lowShipping += 1;
    if (draft.funnelStatus === "Needs Review") counts.noInventory += 1;
    if (draft.leadStatus !== "Valid" && draft.funnelStatus !== "Needs Review") counts.manualMarked += 1;
    if (draft.leadStatus === "Valid") counts.ready += 1;
  }

  return counts;
}

function applyFilters() {
  const market = els.marketFilter.value;
  const leadStatus = els.leadStatusFilter.value;
  const grade = els.gradeFilter.value;
  const bangGrade = els.bangGradeFilter.value;
  const sales = els.salesFilter.value;
  const timeZone = els.timeZoneFilter.value;
  const minSubtotal = parseSubtotalFilter(els.minSubtotalFilter.value);
  const maxSubtotal = parseSubtotalFilter(els.maxSubtotalFilter.value);
  const query = els.searchInput.value.trim().toLowerCase();
  const salesMarket = els.salesMarketFilter.value;
  const salesLeadStatus = els.salesLeadStatusFilter.value;
  const salesGrade = els.salesGradeFilter.value;
  const salesBangGrade = els.salesBangGradeFilter.value;
  const salesDetailSales = els.salesDetailSalesFilter.value;
  populateSalesAssignedDateFilter();
  const salesAssignedDate = els.salesAssignedDateFilter.value;
  const salesTimeZone = els.salesTimeZoneFilter.value;
  const salesMinSubtotal = parseSubtotalFilter(els.salesMinSubtotalFilter.value);
  const salesMaxSubtotal = parseSubtotalFilter(els.salesMaxSubtotalFilter.value);
  const salesQuery = els.salesSearchInput.value.trim().toLowerCase();
  const draftMarket = els.draftMarketFilter.value;
  const draftLeadStatus = els.draftLeadStatusFilter.value;
  const draftSales = els.draftSalesFilter.value;
  const draftQuery = els.draftSearchInput.value.trim().toLowerCase();

  state.visibleLeads = state.leads.filter((lead) => {
    if (market !== "ALL" && lead.market !== market) return false;
    if (leadStatus !== "ALL" && getLeadStatus(lead) !== leadStatus) return false;
    if (grade !== "ALL" && lead.grade !== grade) return false;
    if (bangGrade === "ONLY" && !String(lead.grade || "").includes("!")) return false;
    if (sales !== "ALL" && (lead.assignedSales || "") !== sales) return false;
    if (timeZone !== "ALL" && normalizeTimeZoneFilterValue(lead.timeZone) !== timeZone) return false;
    if (!matchesSubtotalRange(lead, minSubtotal, maxSubtotal)) return false;
    if (state.role === "sales" && state.user !== "Admin" && lead.assignedSales !== state.user) return false;
    if (!query) return true;
    return searchBlob(lead).includes(query);
  }).sort(sortBySubtotalDesc);
  state.leadPage = Math.min(state.leadPage, getLeadPageCount());
  if (state.leadPage < 1) state.leadPage = 1;
  state.pagedVisibleLeads = getPagedVisibleLeads();

  state.salesVisibleLeads = state.leads
    .filter((lead) => lead.assignedSales && lead.funnelStatus !== "Recovered")
    .filter((lead) => (state.role === "sales" && state.user !== "Admin" ? lead.assignedSales === state.user : true))
    .filter((lead) => (salesDetailSales !== "ALL" ? (lead.assignedSales || "") === salesDetailSales : true))
    .filter((lead) => (salesMarket !== "ALL" ? lead.market === salesMarket : true))
    .filter((lead) => (salesLeadStatus !== "ALL" ? getLeadStatus(lead) === salesLeadStatus : true))
    .filter((lead) => (salesGrade !== "ALL" ? lead.grade === salesGrade : true))
    .filter((lead) => (salesBangGrade === "ONLY" ? String(lead.grade || "").includes("!") : true))
    .filter((lead) => (salesAssignedDate !== "ALL" ? getAssignedDateKey(lead.assignedAt) === salesAssignedDate : true))
    .filter((lead) => (salesTimeZone !== "ALL" ? normalizeTimeZoneFilterValue(lead.timeZone) === salesTimeZone : true))
    .filter((lead) => matchesSubtotalRange(lead, salesMinSubtotal, salesMaxSubtotal))
    .filter((lead) => (salesQuery ? searchBlob(lead).includes(salesQuery) : true))
    .sort(sortByGradeThenDate);
  state.salesPage = Math.min(state.salesPage, getSalesPageCount());
  if (state.salesPage < 1) state.salesPage = 1;

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
  els.leadTableHead.innerHTML = `
    <tr>
      <th class="bulk-select-col">
        <input type="checkbox" data-action="select-visible-leads" aria-label="Select all visible assignable leads on this page" />
      </th>
      ${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}
    </tr>
  `;
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
    "Shopify Draft Status",
    "Subtotal",
    "Estimated Cost",
    "Shipping",
    "Margin without shipping",
    "Margin with shipping",
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
  state.pagedVisibleLeads = getPagedVisibleLeads();
  if (!state.visibleLeads.length) {
    els.leadTableBody.innerHTML = `<tr class="empty-row"><td colspan="62">No leads match the current filters.</td></tr>`;
    els.leadCardList.innerHTML = "";
    updateBulkAssignBar();
    updateLeadPager();
    return;
  }
  els.leadTableBody.innerHTML = state.pagedVisibleLeads.map((lead) => renderLeadRow(lead, { selectable: true })).join("");
  els.leadCardList.innerHTML = "";
  updateBulkAssignBar();
  updateLeadPager();
}

function renderSalesRows() {
  const salesCardMode = state.role === "sales" && state.user !== "Admin";
  updateSalesPager();
  if (!state.salesVisibleLeads.length) {
    els.salesTableBody.innerHTML = salesCardMode ? "" : `<tr class="empty-row"><td colspan="61">No active assigned leads match the current filters.</td></tr>`;
    els.salesQuickList.innerHTML = salesCardMode ? `<div class="lead-card-empty">No leads match the current sales filters.</div>` : "";
    els.salesCardList.innerHTML = salesCardMode ? `<div class="lead-card-empty">No active assigned leads match the current filters.</div>` : "";
    els.salesDetailSubtitle.textContent = "No assigned lead detail to show.";
    return;
  }
  if (salesCardMode) {
    const pagedSalesLeads = getPagedSalesVisibleLeads();
    els.salesTableBody.innerHTML = "";
    els.salesQuickList.innerHTML = renderSalesQuickList();
    els.salesCardList.innerHTML = pagedSalesLeads.map((lead) => renderLeadCard(lead)).join("");
    els.salesDetailSubtitle.textContent = `${state.salesVisibleLeads.length.toLocaleString()} active assigned leads. Showing ${state.salesPage.toLocaleString()} of ${getSalesPageCount().toLocaleString()}.`;
    updateSalesPager();
    return;
  }
  els.salesTableBody.innerHTML = state.salesVisibleLeads.map((lead) => renderLeadRow(lead)).join("");
  els.salesQuickList.innerHTML = "";
  els.salesCardList.innerHTML = "";
  els.salesDetailSubtitle.textContent = `${state.salesVisibleLeads.length.toLocaleString()} active assigned leads.`;
  updateSalesPager();
}

function renderSalesQuickList() {
  const activeLead = getPagedSalesVisibleLeads()[0];
  const activeKey = activeLead ? leadSelectionKey(activeLead) : "";
  return `
    <div class="sales-quick-list-header">
      <span>Quick list</span>
      <small>Click a row to view the full lead below.</small>
    </div>
    <div class="sales-quick-rows">
      ${state.salesVisibleLeads.map((lead, index) => renderSalesQuickRow(lead, index, leadSelectionKey(lead) === activeKey)).join("")}
    </div>
  `;
}

function renderSalesQuickRow(lead, index, isActive) {
  const productText = lead.lineItems.map((item) => item.sku || item.title).filter(Boolean).slice(0, 3).join(", ");
  return `
    <button
      type="button"
      class="sales-quick-row ${isActive ? "is-active" : ""}"
      data-action="select-sales-lead"
      data-index="${index}"
      data-id="${escapeAttribute(lead.id)}"
      data-market="${escapeAttribute(lead.market)}"
    >
      <span class="sales-quick-main">
        <b>${escapeHtml(lead.checkout || "-")}</b>
        <small>${escapeHtml(lead.shippingName || lead.name || "-")}</small>
      </span>
      <span class="grade">${escapeHtml(lead.grade || "-")}</span>
      <span>${escapeHtml(formatMoney(lead.subtotal, lead.currency))}</span>
      <span>${escapeHtml(getAssignedDateKey(lead.assignedAt) || "-")}</span>
      <span>${escapeHtml(productText || "-")}</span>
    </button>
  `;
}

function renderDraftRows() {
  if (!state.visibleDrafts.length) {
    els.draftTableBody.innerHTML = `<tr class="empty-row"><td colspan="59">No draft recovery leads match the current filters.</td></tr>`;
    return;
  }
  els.draftTableBody.innerHTML = state.visibleDrafts.map(renderDraftRow).join("");
}

function renderLeadRow(lead, options = {}) {
  const isRecovered = getLeadStatus(lead).startsWith("Recovered") || lead.funnelStatus === "Recovered";
  const disabledSales = state.role === "sales" || isRecovered ? "disabled" : "";
  const selectionKey = leadSelectionKey(lead);
  const bulkDisabledReason = getBulkDisabledReason(lead);
  const selectionCell = options.selectable
    ? `<td class="bulk-select-col">
        <input
          type="checkbox"
          data-action="select-lead"
          aria-label="Select ${escapeAttribute(lead.checkout)}"
          ${state.selectedLeadKeys.has(selectionKey) ? "checked" : ""}
          ${bulkDisabledReason ? "disabled" : ""}
          title="${escapeAttribute(bulkDisabledReason || "Select for bulk assignment")}"
        />
      </td>`
    : "";
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
      ${selectionCell}
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
      ${cell(formatCreatedAtWithAge(lead))}
      ${cell(formatMoney(lead.subtotal, lead.currency))}
      <td>
        <select data-field="sales" ${disabledSales}>
          <option value="">Unassigned</option>
          ${state.salesUsers.map((name) => `<option value="${escapeAttribute(name)}" ${lead.assignedSales === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
        </select>
      </td>
      <td>
        <div class="notes-cell">
          <textarea data-field="notes" placeholder="Leads notes">${escapeHtml(getLeadNotes(lead))}</textarea>
          <div class="notes-actions">
            <button class="notes-submit-button" type="button" data-action="submit-notes">Submit</button>
            <span class="notes-save-status" data-role="notes-save-status"></span>
          </div>
        </div>
      </td>
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
      ${cell(lead.relatedOrderNumber)}
      ${cell(formatDateTime(lead.relatedOrderCreatedAt))}
      ${cell(getRecoveredByValue(lead))}
      ${cell(lead.recoveredOrderNumber)}
      ${cell(formatDateTime(lead.recoveredOrderCreatedAt))}
    </tr>
  `;
}

function renderLeadCard(lead, options = {}) {
  const isRecovered = getLeadStatus(lead).startsWith("Recovered") || lead.funnelStatus === "Recovered";
  const disabledSales = state.role === "sales" || isRecovered ? "disabled" : "";
  const selectionKey = leadSelectionKey(lead);
  const bulkDisabledReason = getBulkDisabledReason(lead);
  const marketClass = `lead-form-card-${String(lead.market || "").toLowerCase()}`;
  const selectableControl = options.selectable
    ? `<label class="lead-card-select" title="${escapeAttribute(bulkDisabledReason || "Select for bulk assignment")}">
        <input
          type="checkbox"
          data-action="select-lead"
          aria-label="Select ${escapeAttribute(lead.checkout)}"
          ${state.selectedLeadKeys.has(selectionKey) ? "checked" : ""}
          ${bulkDisabledReason ? "disabled" : ""}
        />
        <span>Select</span>
      </label>`
    : "";
  const productCards = lead.lineItems.length
    ? lead.lineItems.map((item) => renderLeadProductCard(item, lead)).join("")
    : `<div class="lead-product-card empty-product">No products found.</div>`;

  return `
    <article data-id="${escapeAttribute(lead.id)}" data-market="${escapeAttribute(lead.market)}" class="lead-form-card ${marketClass}">
      <div class="lead-form-header">
        <div class="lead-form-identity">
          <div class="lead-form-checkout-line">
            ${selectableControl}
            <span class="lead-market-pill">${escapeHtml(lead.market)}</span>
            <span class="grade">${escapeHtml(lead.grade)}</span>
            <strong class="lead-checkout">${escapeHtml(lead.checkout)}</strong>
            <button class="copy-row-button" type="button" data-action="copy-row">Copy row</button>
          </div>
          <div class="lead-form-muted">Created at ${escapeHtml(formatCreatedAtWithAge(lead) || "-")}</div>
        </div>
        <div class="lead-form-actions">
          <select data-field="leadStatus" class="lead-form-status">
            ${leadStatuses.map((status) => `<option value="${escapeAttribute(status)}" ${getLeadStatus(lead) === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
          </select>
          <select data-field="sales" class="lead-form-sales" ${disabledSales}>
            <option value="">Unassigned</option>
            ${state.salesUsers.map((name) => `<option value="${escapeAttribute(name)}" ${lead.assignedSales === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
          </select>
          <button class="notes-submit-button" type="button" data-action="submit-notes">Save</button>
        </div>
        <div class="lead-form-amount">
          <span>Subtotal</span>
          <strong>${escapeHtml(formatMoney(lead.subtotal, lead.currency))}</strong>
        </div>
      </div>

      <div class="lead-form-body">
        <section class="lead-form-section">
          <h3>Customer & Address</h3>
          <div class="lead-form-field-grid">
            ${leadField("Shipping name", lead.shippingName)}
            ${leadField("Phone", lead.checkoutPhone)}
            ${leadField("Email", lead.checkoutEmail)}
            ${leadField("Time zone", lead.timeZone)}
          </div>
          <pre class="lead-address-box">${escapeHtml(lead.address || "")}</pre>
        </section>

        <section class="lead-form-section lead-form-notes-section">
          <h3>Lead Notes</h3>
          <textarea data-field="notes" placeholder="Leads notes">${escapeHtml(getLeadNotes(lead))}</textarea>
          <div class="notes-actions">
            <button class="notes-submit-button" type="button" data-action="submit-notes">Submit Notes</button>
            <span class="notes-save-status" data-role="notes-save-status"></span>
          </div>
        </section>

        <section class="lead-form-section">
          <h3>Assignment & Marketing</h3>
          <div class="lead-form-field-grid">
            ${leadField("Assigned time", formatAssignedTime(lead))}
            ${leadField("Discount code", lead.checkoutDiscountCode)}
            ${leadField("Checkout discount", lead.checkoutDiscountAmount ? formatMoney(lead.checkoutDiscountAmount, lead.currency) : "")}
            ${leadField("Klaviyo max discount", formatMoney(lead.klaviyoMaximumDiscount, lead.currency))}
            ${leadField("Email subscribed", renderSubscriptionPill(lead.klaviyoEmailSubscribed))}
            ${leadField("SMS subscribed", renderSubscriptionPill(lead.klaviyoTextSubscribed))}
          </div>
        </section>
      </div>

      <section class="lead-products-section">
        <h3>Products</h3>
        <div class="lead-product-list">${productCards}</div>
      </section>

      <div class="lead-form-footer">
        ${leadField("Related sales", lead.relatedSales)}
        ${leadField("Related order", lead.relatedOrderNumber)}
        ${leadField("Related order date", formatDateTime(lead.relatedOrderCreatedAt))}
        ${leadField("Recovered by", getRecoveredByValue(lead))}
        ${leadField("Recovered order", lead.recoveredOrderNumber)}
        ${leadField("Recovered order date", formatDateTime(lead.recoveredOrderCreatedAt))}
      </div>
    </article>
  `;
}

function renderLeadProductCard(item, lead) {
  return `
    <div class="lead-product-card">
      <div class="lead-product-title">
        <strong>${escapeHtml(item.title || "")}</strong>
        <span>SKU: ${escapeHtml(item.sku || "-")}</span>
      </div>
      <div class="lead-product-metric"><span>Checkout</span><strong>${escapeHtml(item.checkoutPrice ? formatMoney(item.checkoutPrice, lead.currency) : "-")}</strong></div>
      <div class="lead-product-metric"><span>Current</span><strong>${escapeHtml(item.currentPrice ? formatMoney(item.currentPrice, lead.currency) : "-")}</strong></div>
      <div class="lead-product-metric"><span>Inventory</span><strong>${escapeHtml(item.inventory ?? "-")}</strong></div>
      <div class="lead-product-metric"><span>Qty</span><strong>${escapeHtml(item.quantity ?? "1")}</strong></div>
      <div>${item.productUrl ? `<a href="${escapeAttribute(item.productUrl)}" target="_blank" rel="noreferrer">Open URL</a>` : `<span class="lead-form-muted">No URL</span>`}</div>
    </div>
  `;
}

function leadField(label, value) {
  return `
    <div class="lead-form-label">${escapeHtml(label)}</div>
    <div class="lead-form-value">${typeof value === "string" && value.includes("<span") ? value : escapeHtml(value || "-")}</div>
  `;
}

function renderSubscriptionPill(value) {
  const label = value || "Not found";
  const normalized = String(label).toLowerCase();
  const tone = normalized.includes("subscribed") && !normalized.includes("not") && !normalized.includes("never") ? "yes" : "no";
  return `<span class="lead-form-pill ${tone}">${escapeHtml(label)}</span>`;
}

function formatAssignedTime(lead) {
  if (!lead.assignedAt) return "-";
  const relative = formatRelativeAgo(lead.assignedAt);
  return relative ? `${formatDateTime(lead.assignedAt)} (${relative})` : formatDateTime(lead.assignedAt);
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
      <td>
        <div class="notes-cell">
          <textarea data-field="notes" placeholder="Leads notes">${escapeHtml(getLeadNotes(draft))}</textarea>
          <div class="notes-actions">
            <button class="notes-submit-button" type="button" data-action="submit-notes">Submit</button>
            <span class="notes-save-status" data-role="notes-save-status"></span>
          </div>
        </div>
      </td>
      ${cell(formatCreatedAtWithAge(draft))}
      ${cell(draft.draftStatus)}
      ${cell(formatMoney(draft.subtotal, draft.currency))}
      ${cell(formatOptionalMoney(draft.totalCost, draft.currency))}
      ${cell(formatMoney(draft.manualShippingPrice || 0, draft.currency))}
      ${cell(formatOptionalMoney(draft.marginWithoutShipping ?? draft.margin, draft.currency))}
      ${cell(formatOptionalMoney(draft.marginWithShipping, draft.currency))}
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

function handleLeadSelectionChange(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  if (action === "select-visible-leads") {
    const checked = event.target.checked;
    for (const lead of state.pagedVisibleLeads) {
      const key = leadSelectionKey(lead);
      if (getBulkDisabledReason(lead)) {
        state.selectedLeadKeys.delete(key);
      } else if (checked) {
        state.selectedLeadKeys.add(key);
      } else {
        state.selectedLeadKeys.delete(key);
      }
    }
    renderLeadRows();
    return;
  }

  if (action === "select-lead") {
    const row = event.target.closest("[data-id][data-market]");
    const lead = row ? findLead(row.dataset.market, row.dataset.id) : null;
    if (!lead || getBulkDisabledReason(lead)) return;
    const key = leadSelectionKey(lead);
    if (event.target.checked) {
      state.selectedLeadKeys.add(key);
    } else {
      state.selectedLeadKeys.delete(key);
    }
    updateBulkAssignBar();
  }
}

function handleLeadInput(event) {
  const field = event.target.dataset.field;
  if (!field || event.target.tagName !== "TEXTAREA") return;
  clearTimeout(event.target._saveTimer);
  event.target._saveTimer = setTimeout(() => saveRowFromControl(event.target), 450);
}

async function handleLeadClick(event) {
  const submitNotesButton = event.target.closest("[data-action='submit-notes']");
  if (submitNotesButton) {
    const row = submitNotesButton.closest("[data-id][data-market]");
    const notesControl = row ? row.querySelector('[data-field="notes"]') : null;
    if (!notesControl) return;
    const status = row.querySelector('[data-role="notes-save-status"]');
    clearTimeout(notesControl._saveTimer);
    submitNotesButton.disabled = true;
    if (status) {
      status.textContent = "Saving...";
      status.dataset.state = "saving";
    }
    try {
      const saved = await saveRowFromControl(notesControl);
      if (saved) {
        if (status) {
          status.textContent = "Saved";
          status.dataset.state = "saved";
        }
        showTemporaryButtonText(submitNotesButton, "Saved");
      } else if (status) {
        status.textContent = "Not saved";
        status.dataset.state = "error";
      }
    } finally {
      submitNotesButton.disabled = false;
      if (status) {
        window.setTimeout(() => {
          status.textContent = "";
          status.dataset.state = "";
        }, 2200);
      }
    }
    return;
  }

  const button = event.target.closest("[data-action='copy-row']");
  if (!button) return;
  const row = button.closest("[data-id][data-market]");
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

function handleSalesQuickListClick(event) {
  const row = event.target.closest("[data-action='select-sales-lead']");
  if (!row) return;
  const index = Number(row.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= state.salesVisibleLeads.length) return;
  state.salesPage = index + 1;
  renderSalesRows();
}

async function saveRowFromControl(control) {
  const row = control.closest("[data-id][data-market]");
  if (!row) {
    alert("Could not find this lead on the page. Reload the page and try again.");
    return false;
  }
  const lead = findLead(row.dataset.market, row.dataset.id);
  if (!lead) {
    alert("Could not find this lead in the loaded table. Reload the page and try again.");
    return false;
  }
  const changedField = control.dataset.field || "";
  const notes = getRowField(row, "notes");
  const payload = {
    id: lead.id,
    market: lead.market,
    checkout: lead.checkout,
    checkoutName: lead.checkout,
    sales: getRowField(row, "sales"),
    leadStatus: getRowField(row, "leadStatus"),
    salesStatus: getRowField(row, "leadStatus"),
    notes,
    sales_notes: notes,
    updatedBy: state.authEmail || state.user || "",
  };
  try {
    const data = await postAssignment(payload);
    applyAssignmentResponseToLead(lead, data.assignment);
    if (changedField !== "notes") applyFilters();
    return true;
  } catch (error) {
    alert(error.message);
    return false;
  }
}

async function postAssignment(payload) {
  const response = await fetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.error || "Save failed");
  if (data.dataHubSyncError) throw new Error(data.dataHubSyncError);
  return data;
}

function applyAssignmentResponseToLead(lead, assignment = {}) {
  Object.assign(lead, {
    assignedSales: assignment.sales || "",
    leadStatus: assignment.leadStatus || assignment.salesStatus || "Valid",
    salesStatus: assignment.leadStatus || assignment.salesStatus || "Valid",
    salesNotes: assignment.notes || "",
    assignedAt: assignment.assignedAt || "",
    lastWorklogAt: assignment.updatedAt || "",
  });
}

async function bulkAssignSelectedLeads() {
  const sales = els.bulkAssignSales.value;
  if (!sales) {
    alert("Choose a sales person first.");
    return;
  }

  const selectedLeads = state.leads.filter((lead) => state.selectedLeadKeys.has(leadSelectionKey(lead)));
  const assignableLeads = selectedLeads.filter((lead) => !getBulkDisabledReason(lead));
  const skippedCount = selectedLeads.length - assignableLeads.length;
  if (!assignableLeads.length) {
    alert("No selected leads are eligible for bulk assignment.");
    return;
  }

  const confirmMessage = skippedCount
    ? `Assign ${assignableLeads.length} selected leads to ${sales}? ${skippedCount} ineligible lead(s) will be skipped.`
    : `Assign ${assignableLeads.length} selected leads to ${sales}?`;
  if (!window.confirm(confirmMessage)) return;

  els.bulkAssignButton.disabled = true;
  els.bulkAssignStatus.textContent = "Assigning...";
  let savedCount = 0;
  const failures = [];

  for (const lead of assignableLeads) {
    try {
      const data = await postAssignment({
        id: lead.id,
        market: lead.market,
        checkout: lead.checkout,
        checkoutName: lead.checkout,
        sales,
        leadStatus: getLeadStatus(lead) || "Valid",
        salesStatus: getLeadStatus(lead) || "Valid",
        notes: lead.salesNotes || "",
        sales_notes: lead.salesNotes || "",
        updatedBy: state.authEmail || state.user || "",
      });
      applyAssignmentResponseToLead(lead, data.assignment);
      state.selectedLeadKeys.delete(leadSelectionKey(lead));
      savedCount += 1;
    } catch (error) {
      failures.push(`${lead.checkout}: ${error.message}`);
    }
  }

  els.bulkAssignStatus.textContent = failures.length
    ? `${savedCount} assigned, ${failures.length} failed`
    : `${savedCount} assigned`;
  applyFilters();
  updateBulkAssignBar();
  if (failures.length) {
    alert(`Bulk assignment finished with errors:\n${failures.slice(0, 8).join("\n")}`);
  }
  window.setTimeout(() => {
    els.bulkAssignStatus.textContent = "";
  }, 3500);
}

function clearBulkSelection() {
  state.selectedLeadKeys.clear();
  renderLeadRows();
}

function updateBulkAssignBar() {
  const pageAssignable = state.pagedVisibleLeads.filter((lead) => !getBulkDisabledReason(lead));
  for (const key of [...state.selectedLeadKeys]) {
    const lead = state.leads.find((item) => leadSelectionKey(item) === key);
    if (!lead || getBulkDisabledReason(lead)) state.selectedLeadKeys.delete(key);
  }
  const selectedCount = state.selectedLeadKeys.size;
  els.bulkAssignBar.hidden = state.role === "sales";
  els.bulkSelectedCount.textContent = `${selectedCount.toLocaleString()} selected`;
  els.bulkAssignButton.disabled = selectedCount === 0;
  els.bulkClearButton.disabled = selectedCount === 0;
  const selectAll = els.leadTableHead.querySelector('[data-action="select-visible-leads"]');
  if (selectAll) {
    const selectedPageCount = pageAssignable.filter((lead) => state.selectedLeadKeys.has(leadSelectionKey(lead))).length;
    selectAll.checked = pageAssignable.length > 0 && selectedPageCount === pageAssignable.length;
    selectAll.indeterminate = selectedPageCount > 0 && selectedPageCount < pageAssignable.length;
    selectAll.disabled = state.role === "sales" || pageAssignable.length === 0;
  }
}

function getBulkDisabledReason(lead) {
  if (state.role === "sales") return "Sales users cannot bulk assign leads.";
  if (getLeadStatus(lead) !== "Valid") return "Only Valid leads can be bulk assigned.";
  if (lead.funnelStatus === "Recovered" || getLeadStatus(lead).startsWith("Recovered")) return "Recovered leads cannot be assigned.";
  if (lead.assignedSales) return `Already assigned to ${lead.assignedSales}.`;
  return "";
}

function leadSelectionKey(lead) {
  return `${lead.market}:${lead.id}`;
}

function getLeadPageCount() {
  return Math.max(1, Math.ceil(state.visibleLeads.length / leadPageSize));
}

function getPagedVisibleLeads() {
  const start = (state.leadPage - 1) * leadPageSize;
  return state.visibleLeads.slice(start, start + leadPageSize);
}

function updateLeadPager() {
  const total = state.visibleLeads.length;
  const pageCount = getLeadPageCount();
  els.leadPager.hidden = total <= leadPageSize;
  els.leadPageInfo.textContent = `${state.leadPage.toLocaleString()} / ${pageCount.toLocaleString()}`;
  els.leadPrevPage.disabled = state.leadPage <= 1;
  els.leadNextPage.disabled = state.leadPage >= pageCount;
}

function changeLeadPage(delta) {
  const pageCount = getLeadPageCount();
  state.leadPage = Math.min(pageCount, Math.max(1, state.leadPage + delta));
  renderLeadRows();
}

function getSalesPageCount() {
  return Math.max(1, Math.ceil(state.salesVisibleLeads.length / salesPageSize));
}

function getPagedSalesVisibleLeads() {
  const start = (state.salesPage - 1) * salesPageSize;
  return state.salesVisibleLeads.slice(start, start + salesPageSize);
}

function updateSalesPager() {
  const salesCardMode = state.role === "sales" && state.user !== "Admin";
  const total = state.salesVisibleLeads.length;
  const pageCount = getSalesPageCount();
  els.salesCardPager.hidden = !salesCardMode || total <= salesPageSize;
  els.salesPageInfo.textContent = `${state.salesPage.toLocaleString()} / ${pageCount.toLocaleString()}`;
  els.salesPrevPage.disabled = state.salesPage <= 1;
  els.salesNextPage.disabled = state.salesPage >= pageCount;
}

function changeSalesPage(delta) {
  const pageCount = getSalesPageCount();
  state.salesPage = Math.min(pageCount, Math.max(1, state.salesPage + delta));
  renderSalesRows();
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

function parseSubtotalFilter(value) {
  if (String(value || "").trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimeZoneFilterValue(value) {
  return String(value || "").trim().toUpperCase();
}

function matchesSubtotalRange(lead, minSubtotal, maxSubtotal) {
  const subtotal = Number(lead.subtotal || 0);
  if (minSubtotal !== null && subtotal < minSubtotal) return false;
  if (maxSubtotal !== null && subtotal > maxSubtotal) return false;
  return true;
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
    "Shopify Draft Status",
    "Subtotal",
    "Estimated Cost",
    "Shipping",
    "Margin without shipping",
    "Margin with shipping",
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
    formatCreatedAtWithAge(lead),
    lead.subtotal,
    lead.assignedSales,
    formatAssignedTime(lead),
    getLeadNotes(lead),
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
  values.push(
    lead.relatedSales,
    lead.relatedOrderNumber,
    formatDateTime(lead.relatedOrderCreatedAt),
    getRecoveredByValue(lead),
    lead.recoveredOrderNumber,
    formatDateTime(lead.recoveredOrderCreatedAt),
  );
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
    draft.totalCost ?? "",
    draft.manualShippingPrice || 0,
    draft.marginWithoutShipping ?? draft.margin ?? "",
    draft.marginWithShipping ?? "",
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

function getAssignedDateOption(value) {
  const dateKey = getAssignedDateKey(value);
  if (!dateKey) return null;
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Vancouver",
    weekday: "long",
  }).format(new Date(value));
  return { value: dateKey, label: `${dateKey} (${weekday})` };
}

function getAssignedDateKey(value) {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
