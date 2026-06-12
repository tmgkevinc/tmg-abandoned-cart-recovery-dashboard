const SALES_USERS = [
  "Johnny",
  "Brian",
  "Adam",
  "Josh",
  "Steven",
  "Arsenio",
  "Michael",
  "Non-sales",
];

const COUNTRY_META = {
  US: { currency: "USD", theme: "blue", siteBaseUrl: "https://www.tmgindustrial.com" },
  CA: { currency: "CAD", theme: "yellow", siteBaseUrl: "https://www.tmgindustrial.ca" },
  AU: { currency: "AUD", theme: "purple", siteBaseUrl: "https://www.tmgindustrial.com.au" },
};

let DATA_HUB_BASE_URL = "";
let DATA_HUB_API_KEY = "";
let DATA_HUB_KEY_TYPE = "missing";
let AUTH_MODE = "manual";
let ADMIN_EMAILS = new Set();
let SALES_EMAIL_MAP = new Map();
let DATA_HUB_ASSIGNMENTS_WRITE_PATH = "";
let DATA_HUB_ASSIGNMENTS_READ_PATH = "";

export default {
  async fetch(request, env) {
    configureRuntime(env);
    const url = new URL(request.url);
    const session = getDashboardSession(request);

    try {
      if (url.pathname === "/api/session") return jsonResponse(200, session);

      if (AUTH_MODE === "cloudflare_access" && url.pathname.startsWith("/api/") && !session.authenticated) {
        return jsonResponse(403, { error: "Cloudflare Access email is required for this dashboard.", session });
      }

      if (url.pathname === "/api/health") {
        return jsonResponse(200, {
          authMode: AUTH_MODE,
          cloudflareAccessEnabled: AUTH_MODE === "cloudflare_access",
          currentUser: session.authenticated ? { email: session.email, user: session.user, role: session.role } : null,
          dataHubConfigured: Boolean(DATA_HUB_BASE_URL && DATA_HUB_API_KEY),
          dataHubBaseUrl: DATA_HUB_BASE_URL || null,
          dataHubKeyType: DATA_HUB_KEY_TYPE,
          dataHubUsesAdminKey: DATA_HUB_KEY_TYPE === "admin",
          dataHubUsesDashboardEditorKey: DATA_HUB_KEY_TYPE === "dashboard_editor",
          dataHubWriteCredential: DATA_HUB_KEY_TYPE === "dashboard_editor",
          markets: Object.keys(COUNTRY_META),
          salesUsers: SALES_USERS,
          persistence: getPersistenceMode(),
          writeAccess: Boolean(DATA_HUB_ASSIGNMENTS_WRITE_PATH),
          readAccess: Boolean(DATA_HUB_ASSIGNMENTS_READ_PATH),
          assignmentWritePathConfigured: Boolean(DATA_HUB_ASSIGNMENTS_WRITE_PATH),
          assignmentReadPathConfigured: Boolean(DATA_HUB_ASSIGNMENTS_READ_PATH),
          runtime: "cloudflare-worker",
        });
      }

      if (url.pathname === "/api/data-hub/catalog") return await proxyDataHub("/api/data-hub/catalog");
      if (url.pathname === "/api/data-hub/freshness") return await proxyDataHub("/api/data-hub/freshness");
      if (url.pathname === "/api/leads") return await handleLeads(url);
      if (url.pathname === "/api/drafts") return await handleDrafts(url);
      if (url.pathname === "/api/assignments" && request.method === "GET") return jsonResponse(200, await readAssignments());
      if (url.pathname === "/api/assignments" && request.method === "POST") return await handleSaveAssignment(request);

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return jsonResponse(500, { error: "An unknown server error occurred.", detail: error.message });
    }
  },
};

function configureRuntime(env) {
  DATA_HUB_BASE_URL = String(env.TMG_DATA_HUB_BASE_URL || "").replace(/\/+$/, "");
  DATA_HUB_API_KEY = env.TEAM_API_KEY_DASHBOARD_EDITOR || env.TEAM_API_KEY_ADMIN || env.TMG_DATA_HUB_API_KEY || "";
  DATA_HUB_KEY_TYPE = env.TEAM_API_KEY_DASHBOARD_EDITOR ? "dashboard_editor" : env.TEAM_API_KEY_ADMIN ? "admin" : env.TMG_DATA_HUB_API_KEY ? "read_only" : "missing";
  AUTH_MODE = normalizeAuthMode(env.DASHBOARD_AUTH_MODE || env.AUTH_MODE || "manual");
  ADMIN_EMAILS = parseEmailSet(env.ADMIN_EMAILS);
  SALES_EMAIL_MAP = parseSalesEmailMap(env.SALES_EMAIL_MAP);
  DATA_HUB_ASSIGNMENTS_WRITE_PATH = text(env.DATA_HUB_ASSIGNMENTS_WRITE_PATH || "");
  DATA_HUB_ASSIGNMENTS_READ_PATH = text(env.DATA_HUB_ASSIGNMENTS_READ_PATH || "");
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function getHeader(req, name) {
  if (req.headers && typeof req.headers.get === "function") return req.headers.get(name) || "";
  return req.headers?.[name] || req.headers?.[name.toLowerCase()] || "";
}

function base64DecodeToText(value) {
  return decodeURIComponent(escape(atob(value)));
}

async function handleLeads(url) {
  if (!DATA_HUB_BASE_URL || !DATA_HUB_API_KEY) {
    return jsonResponse(400, {
      error: "Set TMG_DATA_HUB_BASE_URL and TMG_DATA_HUB_API_KEY in .env before loading leads.",
    });
  }

  const markets = String(url.searchParams.get("market") || "US,CA,AU")
    .split(",")
    .map((market) => market.trim().toUpperCase())
    .filter((market) => COUNTRY_META[market]);
  const limit = Math.max(25, Math.min(Number(url.searchParams.get("limit") || 500), 10000));
  const fetchAllPages = url.searchParams.get("all") === "1";
  const includeKlaviyo = url.searchParams.get("klaviyo") === "1";
  const useEnriched = url.searchParams.get("source") !== "raw";

  const startedAt = new Date();
  const checkoutResults = await Promise.all(markets.map(async (market) => {
    const records = await fetchAbandonedCartLeads(market, limit, useEnriched ? "enriched" : "raw", fetchAllPages);
    return {
      market,
      records,
    };
  }));

  const productLookup = useEnriched ? {} : await buildProductLookupFromCheckouts(checkoutResults);
  const klaviyoProfiles = useEnriched || !includeKlaviyo ? [] : await buildKlaviyoProfilesFromCheckouts(checkoutResults);
  const klaviyoLookup = buildKlaviyoLookup(klaviyoProfiles);

  const assignments = await readAssignments(markets, 10000);
  const allLeads = checkoutResults
    .flatMap((result) => result.records.map((record) => ({ record, market: result.market })))
    .filter(Boolean)
    .map(({ record, market }) => normalizeCheckout(record, market, productLookup, klaviyoLookup))
    .filter((lead) => markets.includes(lead.market))
    .map((lead) => applyAssignment(lead, assignments))
    .sort(sortByGradeThenDate);

  const withFunnel = applyFunnelStatus(allLeads)
    .map((lead) => ({ ...lead, assignmentSource: lead.assignedSales ? "Manual" : "" }))
    .sort(sortByGradeThenDate);
  const summary = buildSummary(withFunnel);
  summary.bySales = buildSalesAssignmentSummary(assignments, markets);

  return jsonResponse(200, {
    fetchedAt: startedAt.toISOString(),
    count: withFunnel.length,
    markets,
    source: useEnriched ? "enriched" : "raw",
    klaviyoStatus: includeKlaviyo ? "loaded" : "skipped",
    salesUsers: SALES_USERS,
    summary,
    leads: withFunnel,
  });
}

async function handleDrafts(url) {
  if (!DATA_HUB_BASE_URL || !DATA_HUB_API_KEY) {
    return jsonResponse(400, {
      error: "Set TMG_DATA_HUB_BASE_URL and TMG_DATA_HUB_API_KEY before loading drafts.",
    });
  }

  const markets = String(url.searchParams.get("market") || "US,CA,AU")
    .split(",")
    .map((market) => market.trim().toUpperCase())
    .filter((market) => COUNTRY_META[market]);
  const limit = Math.max(25, Math.min(Number(url.searchParams.get("limit") || 10000), 50000));
  const startedAt = new Date();

  const draftResults = await Promise.all(markets.map(async (market) => ({
    market,
    records: await fetchDraftOrders(market, limit),
  })));
  const productLookup = await buildProductLookupFromCheckouts(draftResults);
  const assignments = await readAssignments(markets, 10000);
  const drafts = draftResults
    .flatMap((result) => result.records.map((record) => ({ record, market: result.market })))
    .map(({ record, market }) => normalizeDraft(record, market, productLookup))
    .filter((draft) => markets.includes(draft.market))
    .filter((draft) => !draft.completed && draft.hasManualShipping)
    .map((draft) => applyAssignment(draft, assignments))
    .map(applyDraftOpportunityStatus)
    .sort(sortBySubtotalDesc);

  return jsonResponse(200, {
    fetchedAt: startedAt.toISOString(),
    count: drafts.length,
    markets,
    source: "shopify_draft_orders_raw",
    summary: buildDraftSummary(drafts),
    salesUsers: SALES_USERS,
    drafts,
  });
}

async function proxyDataHub(endpoint) {
  if (!DATA_HUB_BASE_URL || !DATA_HUB_API_KEY) {
    return jsonResponse(400, { error: "Data Hub environment variables are missing." });
  }

  const response = await fetch(`${DATA_HUB_BASE_URL}${endpoint}`, {
    headers: { "x-api-key": DATA_HUB_API_KEY },
  });
  const text = await response.text();
  return new Response(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8" } });
}

async function fetchDataHubRecords(table, country, limit) {
  const params = new URLSearchParams({ table, limit: String(limit) });
  if (country) params.set("country", country);

  const response = await fetch(`${DATA_HUB_BASE_URL}/api/data-hub/records?${params}`, {
    headers: { "x-api-key": DATA_HUB_API_KEY },
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Data Hub returned invalid JSON for ${table}/${country}.`);
  }

  if (!response.ok) {
    throw new Error(payload.error || `Data Hub returned ${response.status} for ${table}/${country}.`);
  }

  return payload;
}

async function fetchDraftOrders(country, limit) {
  const pageSize = Math.min(Math.max(Number(limit || 10000), 1), 10000);
  const rows = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && rows.length < limit) {
    const params = new URLSearchParams({
      table: "shopify_draft_orders_raw",
      country,
      limit: String(Math.min(pageSize, limit - rows.length)),
      offset: String(offset),
    });
    const response = await fetch(`${DATA_HUB_BASE_URL}/api/data-hub/records?${params}`, {
      headers: { "x-api-key": DATA_HUB_API_KEY },
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`Data Hub returned invalid JSON for shopify_draft_orders_raw/${country}.`);
    }
    if (!response.ok) {
      throw new Error(payload.error || `Data Hub returned ${response.status} for shopify_draft_orders_raw/${country}.`);
    }

    const pageRows = extractRecords(payload);
    rows.push(...pageRows);
    offset += pageRows.length;
    hasMore = Boolean(payload.hasMore || payload.has_more) && pageRows.length > 0;
  }

  return rows;
}

async function fetchAbandonedCartLeads(country, limit, source = "enriched", fetchAllPages = false) {
  const pageSize = Math.min(Math.max(Number(limit || 5000), 1), 5000);
  const rows = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      country,
      limit: String(pageSize),
      offset: String(offset),
    });
    const report = source === "raw" ? "abandoned-cart-leads" : "abandoned-cart-leads-enriched";
    const response = await fetch(`${DATA_HUB_BASE_URL}/api/data-hub/reports/${report}?${params}`, {
      headers: { "x-api-key": DATA_HUB_API_KEY },
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`Data Hub returned invalid JSON for ${report}/${country}.`);
    }
    if (!response.ok) {
      throw new Error(payload.error || `Data Hub returned ${response.status} for ${report}/${country}.`);
    }

    const pageRows = extractRecords(payload);
    rows.push(...pageRows);
    offset += pageRows.length;
    hasMore = fetchAllPages && Boolean(payload.hasMore || payload.has_more) && pageRows.length > 0;
  }

  return rows;
}

async function fetchKlaviyoProfiles(markets) {
  const rows = [];
  for (const market of markets) {
    const payload = await fetchDataHubRecords("klaviyo_profiles_raw", market, 5000);
    rows.push(...extractRecords(payload));
  }
  return dedupeBy(rows, (row) => row.profile_id || row.raw?.id || `${row.email || ""}:${row.phone_number || ""}`);
}

async function buildKlaviyoProfilesFromCheckouts(checkoutResults) {
  const rows = [];
  for (const result of checkoutResults) {
    const market = text(result.market).toUpperCase();
    const emails = collectCheckoutEmails(result.records);
    if (!emails.length) continue;
    const records = await fetchKlaviyoProfileLookup(market, emails);
    rows.push(...records);
  }
  return dedupeBy(rows, (row) => row.profile_id || `${row.country_normalized || ""}:${row.matched_email || row.email || ""}`);
}

function collectCheckoutEmails(records) {
  const emails = new Set();
  for (const record of records) {
    const raw = record.raw || record.payload || record.data || record.checkout || record;
    const customer = raw.customer || {};
    const email = normalizeEmail(raw.email || customer.email || record.email || record.customer_email);
    if (email) emails.add(email);
  }
  return [...emails];
}

async function fetchKlaviyoProfileLookup(country, emails) {
  const rows = [];
  const chunkSize = 25;
  for (let index = 0; index < emails.length; index += chunkSize) {
    const contacts = emails.slice(index, index + chunkSize).map((email) => ({ email }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(`${DATA_HUB_BASE_URL}/api/data-hub/reports/klaviyo-profile-lookup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": DATA_HUB_API_KEY,
        },
        body: JSON.stringify({ country, contacts }),
        signal: controller.signal,
      });
    } catch (error) {
      console.warn(`Skipped slow Klaviyo lookup batch for ${country}: ${error.message}`);
      clearTimeout(timeout);
      continue;
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      console.warn(`Skipped invalid Klaviyo lookup batch for ${country}.`);
      continue;
    }

    if (!response.ok) {
      console.warn(payload.error || `Skipped Klaviyo lookup batch for ${country}: ${response.status}.`);
      continue;
    }

    rows.push(...extractRecords(payload));
  }
  return rows;
}

async function buildProductLookupFromCheckouts(checkoutResults) {
  const lookup = {};
  for (const result of checkoutResults) {
    const market = text(result.market).toUpperCase();
    const skus = collectCheckoutSkus(result.records);
    const records = skus.length ? await fetchProductLookup(market, skus) : [];
    lookup[market] = buildProductLookupFromProductLookupRecords(records, market);
  }
  return lookup;
}

function collectCheckoutSkus(records) {
  const skus = new Set();
  for (const record of records) {
    const raw = record.raw || record.payload || record.data || record.checkout || record;
    for (const item of getLineItems(raw)) {
      if (isPpProduct(item)) continue;
      const sku = normalizeSku(item.sku);
      if (sku) skus.add(sku);
    }
  }
  return [...skus];
}

async function fetchProductLookup(country, skus) {
  const response = await fetch(`${DATA_HUB_BASE_URL}/api/data-hub/reports/product-lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": DATA_HUB_API_KEY,
    },
    body: JSON.stringify({ country, skus }),
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Data Hub returned invalid JSON for product-lookup/${country}.`);
  }

  if (!response.ok) {
    throw new Error(payload.error || `Data Hub returned ${response.status} for product-lookup/${country}.`);
  }

  return extractRecords(payload);
}

function extractRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function dedupeBy(rows, getKey) {
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    const key = text(getKey(row));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function normalizeCheckout(record, market, productLookup, klaviyoLookup) {
  market = text(market || record.country).toUpperCase();
  const raw = record.raw || record.payload || record.data || record.checkout || record;
  const checkoutId = text(raw.id || raw.checkout_gid || raw.checkout_id || raw.checkoutId || raw.token || record.id);
  const checkoutName = text(raw.name || raw.checkout_name || raw.checkoutName || record.name || (checkoutId ? `#${checkoutId}` : ""));
  const enrichedProductLookup = buildProductLookupFromEnriched(raw.product_lookup_json, market);
  const lineItems = getLineItems(raw)
    .filter((item) => !isPpProduct(item))
    .map((item) => enrichLineItemFromProducts(item, enrichedProductLookup || productLookup?.[market]));
  const shipping = raw.shipping_address || raw.shippingAddress || {};
  const billing = raw.billing_address || raw.billingAddress || {};
  const customer = raw.customer || {};
  const subtotal = number(raw.subtotal || raw.subtotal_price || raw.subtotalPrice || raw.total_price || raw.totalPrice || record.subtotal || record.total_price);
  const createdAt = text(raw.created_at || raw.createdAt || record.created_at || record.createdAt);
  const email = text(raw.email || customer.email || record.email || record.customer_email);
  const phone = text(
    raw.phone ||
      raw.sms_marketing_phone ||
      shipping.phone ||
      billing.phone ||
      customer.phone ||
      customer.default_address?.phone ||
      record.phone ||
      record.shipping_phone,
  );
  const klaviyoProfile = findKlaviyoProfile(market, email, klaviyoLookup);
  const klaviyoEmailSubscribed = getLookupMarketingState(raw.klaviyo_email_subscribed) || getKlaviyoMarketingState(klaviyoProfile, "email");
  const klaviyoTextSubscribed = getLookupMarketingState(raw.klaviyo_sms_subscribed) || getKlaviyoMarketingState(klaviyoProfile, "sms");
  const shippingName = text(raw.shipping_name || shipping.name || [shipping.first_name, shipping.last_name].filter(Boolean).join(" "));
  const billingName = text(billing.name || [billing.first_name, billing.last_name].filter(Boolean).join(" "));
  const customerName = text(
    raw.customer_name ||
      raw.customerName ||
      shippingName ||
      billingName ||
      [customer.first_name, customer.last_name].filter(Boolean).join(" "),
  );
  const state = normalizeState(raw.shipping_state || shipping.province_code || shipping.province || shipping.state || billing.province_code || billing.province || "");
  const currency = text(raw.currency || raw.presentment_currency || record.currency || COUNTRY_META[market]?.currency || "USD");
  const ageHours = createdAt ? Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 36e5) : null;
  const productKey = lineItems.map((item) => normalizeComparable(item.sku || item.title)).sort().join("|");
  const enrichedGrade = text(raw.grade);
  const grade = enrichedGrade && enrichedGrade !== "!" ? enrichedGrade : buildGrade(subtotal, ageHours, klaviyoEmailSubscribed, klaviyoTextSubscribed);
  const recoveredOrderTags = getRecoveredOrderTags(raw);
  const recoveredBySalesName = getRecoveredBySalesName(raw, recoveredOrderTags);
  const recoveredBySales = booleanValue(raw.recovered_by_sales || raw.recoveredBySales) || Boolean(recoveredBySalesName);
  const recovered = Boolean(
    raw.completed_at ||
      raw.completedAt ||
      raw.order_id ||
      raw.orderId ||
      booleanValue(raw.is_recovered || raw.isRecovered),
  );

  return {
    id: checkoutId || checkoutName,
    market,
    checkout: checkoutName,
    grade,
    name: customerName || shippingName || billingName || "No name",
    shippingName,
    billingName,
    subtotal,
    currency,
    checkoutPhone: phone,
    checkoutEmail: email,
    createdAt,
    createdAtVancouver: formatVancouverDateTime(createdAt),
    shippingState: state,
    timeZone: getTimeZoneForState(state, market) || normalizeTimeZone(raw.time_zone),
    checkoutDiscountCode: getDiscountCode(raw),
    checkoutDiscountAmount: number(raw.discount_amount || raw.total_discounts || raw.totalDiscounts || record.discount_amount),
    klaviyoEmailSubscribed,
    klaviyoTextSubscribed,
    klaviyoMaximumDiscount: calculateKlaviyoMaxDiscount(subtotal),
    address: formatAddress(shipping || billing),
    lineItems,
    productKey,
    ageHours,
    source: text(raw.source_name || raw.sourceName || raw.source || ""),
    recovered,
    recoveredOrderNumber: text(raw.recovered_order_name || raw.order?.name || raw.order_name || raw.orderName || raw.order_id || raw.orderId),
    recoveredOrderCreatedAt: text(raw.recovered_order_created_at || raw.recoveredOrderCreatedAt || raw.completed_at || raw.completedAt || raw.order?.created_at || raw.order?.createdAt),
    recoveredBySales,
    recoveredBySalesName,
    relatedSales: getRelatedSalesName(raw),
    recoveredOrderTags,
    rawUpdatedAt: text(raw.updated_at || raw.updatedAt || record.updated_at || record.updatedAt),
    leadStatus: normalizeLeadStatus(raw.lead_status || ""),
    salesStatus: normalizeLeadStatus(raw.lead_status || ""),
    funnelStatus: normalizeFunnelStatus(raw.funnel_status || ""),
    funnelReason: text(raw.funnel_reason || ""),
  };
}

function normalizeDraft(record, market, productLookup) {
  market = text(market || record.country).toUpperCase();
  const raw = record.raw || record.payload || record.data || record.draft_order || record.draftOrder || record;
  const draftId = text(raw.admin_graphql_api_id || raw.id || raw.shopify_gid || raw.draft_order_id || raw.draftOrderId || record.shopify_gid || record.legacy_resource_id);
  const draftName = text(raw.name || record.name || (draftId ? `#${draftId}` : ""));
  const customer = raw.customer || {};
  const shipping = raw.shipping_address || raw.shippingAddress || {};
  const billing = raw.billing_address || raw.billingAddress || {};
  const lineItems = getLineItems(raw)
    .filter((item) => !isPpProduct(item))
    .map((item) => enrichLineItemFromProducts(item, productLookup?.[market]));
  const completedAt = text(raw.completed_at || raw.completedAt || record.completed_at || record.completedAt);
  const status = text(raw.status || record.status);
  const subtotal = number(raw.subtotal_price || raw.subtotalPrice || raw.subtotalPriceSet?.shopMoney?.amount || record.subtotal_price || raw.total_price || record.total_price);
  const total = number(raw.total_price || raw.totalPrice || raw.totalPriceSet?.shopMoney?.amount || record.total_price || subtotal);
  const totalTax = number(raw.total_tax || raw.totalTax || raw.totalTaxSet?.shopMoney?.amount || record.total_tax);
  const shippingLine = getDraftShippingLine(raw, subtotal, total, totalTax);
  const createdAt = text(raw.created_at || raw.createdAt || record.created_at || record.createdAt);
  const email = text(raw.email || customer.email || record.customer_email);
  const phone = text(
    raw.phone ||
      shipping.phone ||
      billing.phone ||
      customer.phone ||
      customer.default_address?.phone ||
      record.phone ||
      record.shipping_phone,
  );
  const shippingName = text(raw.shipping_name || shipping.name || [shipping.first_name, shipping.last_name].filter(Boolean).join(" "));
  const billingName = text(billing.name || [billing.first_name, billing.last_name].filter(Boolean).join(" "));
  const customerName = text(raw.customer_name || shippingName || billingName || [customer.first_name, customer.last_name].filter(Boolean).join(" "));
  const state = normalizeState(shipping.province_code || shipping.province || shipping.state || billing.province_code || billing.province || "");
  const currency = text(raw.currency || raw.currency_code || record.currency_code || COUNTRY_META[market]?.currency || "USD");
  const tags = normalizeTags(raw.tags || record.tags);
  const ageHours = createdAt ? Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 36e5) : null;
  const marginSummary = calculateMarginSummary(lineItems, subtotal);

  return {
    id: draftId || draftName,
    market,
    checkout: draftName,
    draftStatus: status || "open",
    completed: Boolean(completedAt || status.toLowerCase() === "completed"),
    hasManualShipping: hasManualShippingLine(shippingLine),
    manualShippingTitle: text(shippingLine.title || shippingLine.name || shippingLine.code || "Manual shipping"),
    manualShippingPrice: number(shippingLine.price || shippingLine.price_set?.shop_money?.amount || shippingLine.priceSet?.shopMoney?.amount),
    grade: buildGrade(total || subtotal, ageHours, "", ""),
    name: customerName || shippingName || billingName || "No name",
    shippingName,
    billingName,
    subtotal,
    total,
    totalCost: marginSummary.totalCost,
    margin: marginSummary.margin,
    marginPercent: marginSummary.marginPercent,
    currency,
    checkoutPhone: phone,
    checkoutEmail: email,
    createdAt,
    createdAtVancouver: formatVancouverDateTime(createdAt),
    shippingState: state,
    timeZone: getTimeZoneForState(state, market),
    checkoutDiscountCode: getDiscountCode(raw),
    checkoutDiscountAmount: number(raw.total_discounts || raw.applied_discount?.amount || record.total_discounts),
    klaviyoEmailSubscribed: "",
    klaviyoTextSubscribed: "",
    klaviyoMaximumDiscount: calculateKlaviyoMaxDiscount(total || subtotal),
    address: formatAddress(shipping || billing),
    lineItems,
    productKey: lineItems.map((item) => normalizeComparable(item.sku || item.title)).sort().join("|"),
    ageHours,
    source: text(raw.source_name || raw.sourceName || record.source_name || "draft_order"),
    tags,
    recovered: false,
    recoveredOrderNumber: "",
    recoveredBySales: false,
    recoveredBySalesName: "",
    recoveredOrderTags: [],
    rawUpdatedAt: text(raw.updated_at || raw.updatedAt || record.updated_at || record.updatedAt),
    leadStatus: "",
    salesStatus: "",
    funnelStatus: "",
    funnelReason: "",
  };
}

function calculateMarginSummary(lineItems, subtotal) {
  const costs = lineItems.map((item) => item.totalCost).filter((value) => value !== null && value !== undefined);
  if (!costs.length) return { totalCost: null, margin: null, marginPercent: null };
  const totalCost = costs.reduce((sum, value) => sum + Number(value || 0), 0);
  const revenue = Number(subtotal || 0);
  const margin = revenue - totalCost;
  const marginPercent = revenue ? margin / revenue : null;
  return { totalCost, margin, marginPercent };
}

function getDraftShippingLine(raw, subtotal = 0, total = 0, totalTax = 0) {
  const line = raw.shipping_line || raw.shippingLine || raw.applied_shipping_rate || raw.appliedShippingRate;
  if (line && typeof line === "object") return line;
  if (Array.isArray(raw.shipping_lines) && raw.shipping_lines.length) return raw.shipping_lines[0];
  if (Array.isArray(raw.shippingLines) && raw.shippingLines.length) return raw.shippingLines[0];
  const inferred = Number(total || 0) - Number(subtotal || 0) - Number(totalTax || 0);
  if (inferred > 0.009) return { title: "Inferred manual shipping/fee", price: inferred };
  return {};
}

function hasManualShippingLine(line) {
  if (!line || typeof line !== "object") return false;
  const label = text(line.title || line.name || line.code || line.custom || line.handle);
  const price = number(line.price || line.price_set?.shop_money?.amount || line.priceSet?.shopMoney?.amount);
  return Boolean(label) || price > 0;
}

function applyDraftOpportunityStatus(draft) {
  const hasContact = Boolean(draft.checkoutPhone || draft.checkoutEmail);
  const hasProduct = draft.lineItems.length > 0;
  const hasInventory = draft.lineItems.some((item) => itemHasInventory(item));
  const rawSavedLeadStatus = text(draft.leadStatus || draft.salesStatus);
  const savedLeadStatus = ["Valid", "Invalid", "Recovered Auto", "Recovered by Sales"].includes(rawSavedLeadStatus)
    ? rawSavedLeadStatus
    : "";
  const blockedReasons = [];
  if (!hasContact) blockedReasons.push("No phone or email");
  if (!hasProduct) blockedReasons.push("No product line items");
  if (!hasInventory) blockedReasons.push("No product with known inventory");

  const leadStatus = savedLeadStatus || (blockedReasons.length ? "Invalid" : "Valid");
  return {
    ...draft,
    leadStatus,
    salesStatus: leadStatus,
    funnelStatus: blockedReasons.length ? "Needs Review" : "Ready",
    funnelReason: blockedReasons.length ? blockedReasons.join("; ") : "Open draft with manual shipping",
  };
}

function itemHasInventory(item) {
  const value = item.inventory;
  if (typeof value === "number") return value > 0;
  const normalized = text(value).toLowerCase();
  if (!normalized) return true;
  return normalized !== "0" && normalized !== "not available" && normalized !== "false";
}

function getLineItems(raw) {
  const direct = raw.line_items_json || raw.line_items || raw.lineItems;
  if (Array.isArray(direct)) return direct.map(normalizeLineItem);
  if (Array.isArray(direct?.edges)) return direct.edges.map((edge) => normalizeLineItem(edge.node || edge));
  return [];
}

function normalizeLineItem(item) {
  const sku = text(item.sku || item.variant_sku || item.variantSku);
  const title = text(item.title || item.name || item.product_title || item.productTitle || item.presentment_title);
  const quantity = number(item.quantity || 1);
  const checkoutPrice = number(
    item.price ||
      item.line_price ||
      item.linePrice ||
      item.original_line_price ||
      item.originalUnitPriceSet?.shopMoney?.amount ||
      item.discountedUnitPriceSet?.shopMoney?.amount,
  );
  const currentPrice = number(item.current_price || item.currentPrice || item.variant?.price || item.product?.price);
  const cost = nullableNumber(item.cost || item.rate_sheet_cost || item.landed_cost || item.unit_cost || item.product_cost);
  const inventory = number(item.inventory_quantity || item.inventoryQuantity || item.variant?.inventory_quantity || item.available);
  const productUrl = text(item.product_url || item.productUrl || item.url || "");
  return addMarginFields({ title, sku, quantity, checkoutPrice, currentPrice, cost, inventory, productUrl });
}

function addMarginFields(item) {
  const cost = item.cost;
  const quantity = Number(item.quantity || 1);
  const revenue = Number(item.checkoutPrice || 0) * quantity;
  const totalCost = cost === null || cost === undefined ? null : Number(cost || 0) * quantity;
  const margin = totalCost === null ? null : revenue - totalCost;
  const marginPercent = margin === null || !revenue ? null : margin / revenue;
  return { ...item, totalCost, margin, marginPercent };
}

function buildProductLookupByMarket(results) {
  const lookup = {};
  for (const result of results) {
    const market = text(result.market).toUpperCase();
    lookup[market] = buildProductLookup(result.records, market);
  }
  return lookup;
}

function buildProductLookupFromProductLookupRecords(records, market) {
  const lookup = new Map();
  for (const record of records) {
    const sku = normalizeSku(record.sku || record.requested_sku);
    if (!sku) continue;
    lookup.set(sku, {
      title: text(record.product_title || record.title),
      currentPrice: number(record.current_price || record.price),
      cost: nullableNumber(record.cost || record.rate_sheet_cost || record.landed_cost || record.unit_cost || record.product_cost),
      inventory: getLookupInventory(record),
      productUrl: text(record.product_url) || getProductUrlFromHandle(record.handle, market),
    });
  }
  return lookup;
}

function buildProductLookupFromEnriched(records, market) {
  const direct = normalizeJsonArray(records);
  if (!direct.length) return null;
  return buildProductLookupFromProductLookupRecords(direct, market);
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function buildProductLookup(records, market) {
  const lookup = new Map();
  for (const record of records) {
    const raw = record.raw || {};
    const title = text(record.title || raw.title);
    const handle = text(record.handle || raw.handle);
    const productUrl = getProductUrl(record, raw, market);
    for (const variant of getProductVariants(raw)) {
      const sku = normalizeSku(variant.sku);
      if (!sku) continue;
      lookup.set(sku, {
        title,
        currentPrice: number(variant.price || variant.compareAtPrice || variant.compare_at_price),
        cost: nullableNumber(variant.cost || variant.unit_cost || variant.inventoryItem?.unitCost?.amount),
        inventory: getVariantInventory(variant),
        productUrl,
      });
    }
  }
  return lookup;
}

function getLookupInventory(record) {
  const quantity = record.inventory_quantity ?? record.inventoryQuantity;
  if (quantity !== undefined && quantity !== null && quantity !== "") return number(quantity);
  const available = record.available_for_sale ?? record.availableForSale;
  if (available === true) return "Available";
  if (available === false) return "Not available";
  return "";
}

function getProductVariants(raw) {
  const variants = raw.variants;
  if (Array.isArray(variants?.edges)) return variants.edges.map((edge) => edge.node || edge).filter(Boolean);
  if (Array.isArray(variants)) return variants;
  return [];
}

function enrichLineItemFromProducts(item, productLookup) {
  const product = productLookup?.get(normalizeSku(item.sku));
  if (!product) return item;
  return addMarginFields({
    ...item,
    title: item.title || product.title,
    currentPrice: product.currentPrice ?? item.currentPrice,
    cost: product.cost ?? item.cost,
    inventory: product.inventory ?? item.inventory,
    productUrl: product.productUrl || item.productUrl,
  });
}

function getVariantInventory(variant) {
  const quantity = variant.inventoryQuantity ?? variant.inventory_quantity ?? variant.inventory_quantity_adjustment;
  if (quantity !== undefined && quantity !== null && quantity !== "") return number(quantity);
  const available = variant.availableForSale ?? variant.available_for_sale ?? variant.available;
  if (available === true) return "Available";
  if (available === false) return "Not available";
  return "";
}

function getProductUrl(record, raw, market) {
  const directUrl = text(raw.onlineStoreUrl || raw.online_store_url || record.product_url || raw.product_url);
  if (directUrl) return directUrl;
  const handle = text(record.handle || raw.handle);
  return getProductUrlFromHandle(handle, market);
}

function getProductUrlFromHandle(handle, market) {
  const baseUrl = COUNTRY_META[market]?.siteBaseUrl;
  return handle && baseUrl ? `${baseUrl}/products/${handle}` : "";
}

function normalizeSku(value) {
  return text(value).toUpperCase();
}

function isPpProduct(item) {
  const sku = text(item.sku).toUpperCase();
  const title = text(item.title).toUpperCase();
  return sku.includes("PP") || sku.includes("PSP") || title.includes("SURCHARGE");
}

function applyAssignment(lead, assignments) {
  const saved = assignments[assignmentKey(lead)] || {};
  const savedLeadStatus = saved.leadStatus || saved.salesStatus || "";
  return {
    ...lead,
    assignedSales: saved.sales || "",
    leadStatus: savedLeadStatus,
    salesStatus: savedLeadStatus,
    salesNotes: saved.notes || "",
    funnelStatus: normalizeFunnelStatus(saved.funnelStatus || lead.funnelStatus || ""),
    manualStatus: normalizeFunnelStatus(saved.manualStatus || ""),
    manualNotes: saved.manualStatus === "No Contact" && !saved.manualNotes ? "No checkout phone" : saved.manualNotes || "",
    assignedAt: saved.assignedAt || "",
    lastWorklogAt: saved.updatedAt || "",
  };
}

function applyFunnelStatus(leads) {
  const latestByNameProducts = new Map();
  for (const lead of leads) {
    const key = `${normalizeComparable(lead.name)}|${lead.productKey}`;
    const previous = latestByNameProducts.get(key);
    if (!previous || new Date(lead.createdAt).getTime() > new Date(previous.createdAt).getTime()) {
      latestByNameProducts.set(key, lead);
    }
  }

  return leads.map((lead) => {
    let status = lead.funnelStatus || "Ready";
    let reason = lead.funnelReason || status;
    const savedLeadStatus = normalizeLeadStatus(lead.leadStatus || lead.salesStatus);
    const recoveredFromData = lead.recovered || status === "Recovered";
    const recoveredAfterAssignment = isRecoveredAfterAssignment(lead);
    const canRunAutoGate = !lead.funnelStatus || lead.funnelStatus === "Ready" || lead.funnelStatus === "Older Than 30 Days";
    const hasProduct = lead.lineItems.length > 0;
    const hasInventory = lead.lineItems.some((item) => itemHasInventory(item));

    if (recoveredFromData) {
      status = "Recovered";
      reason = buildRecoveredReason(lead);
    } else if (lead.manualStatus && !(lead.manualStatus === "No Phone" && lead.checkoutPhone)) {
      status = lead.manualStatus;
      reason = lead.manualNotes || "Manually updated";
    } else if (canRunAutoGate && lead.ageHours !== null && lead.ageHours < 72) {
      status = "Too New";
      reason = "Less than 72 hours old";
    } else if (canRunAutoGate && !lead.checkoutPhone) {
      status = "No Phone";
      reason = "No checkout phone";
    } else if (canRunAutoGate && latestByNameProducts.get(`${normalizeComparable(lead.name)}|${lead.productKey}`)?.id !== lead.id) {
      status = "Duplicate";
      reason = "Older checkout with same name and products";
    } else if (canRunAutoGate && hasProduct && !hasInventory) {
      status = "No Inventory";
      reason = "All non-PP/PSP/surcharge products have no inventory";
    }
    const validFunnelStatus = status === "Ready" || status === "Older Than 30 Days";
    const leadStatus =
      recoveredFromData
        ? recoveredAfterAssignment
          ? "Recovered by Sales"
          : "Recovered Auto"
        : savedLeadStatus === "Recovered Auto" || savedLeadStatus === "Recovered by Sales"
          ? savedLeadStatus
          : validFunnelStatus
            ? savedLeadStatus || "Valid"
            : "Invalid";
    return {
      ...lead,
      recoveredBy: getRecoveredByLabel(lead, recoveredFromData, recoveredAfterAssignment),
      assignedSales: recoveredFromData && !recoveredAfterAssignment ? "" : lead.assignedSales,
      assignedAt: recoveredFromData && !recoveredAfterAssignment ? "" : lead.assignedAt,
      funnelStatus: status,
      funnelReason: reason,
      leadStatus,
      salesStatus: leadStatus,
    };
  });
}

function isRecoveredAfterAssignment(lead) {
  const assignedSales = text(lead.assignedSales);
  if (!assignedSales) return false;
  const assignedAt = new Date(lead.assignedAt || "").getTime();
  const recoveredAt = new Date(lead.recoveredOrderCreatedAt || "").getTime();
  if (!Number.isFinite(assignedAt) || !Number.isFinite(recoveredAt)) return false;
  return recoveredAt >= assignedAt;
}

function getRecoveredByLabel(lead, recoveredFromData, recoveredAfterAssignment) {
  if (!recoveredFromData) return "";
  if (!recoveredAfterAssignment) return "Auto";
  return lead.assignedSales || lead.recoveredBySalesName || "Sales";
}

function buildRecoveredReason(lead) {
  const order = lead.recoveredOrderNumber ? `Recovered order ${lead.recoveredOrderNumber}` : "Checkout already recovered";
  if (isRecoveredAfterAssignment(lead)) return `${order}; recovered after assignment to ${lead.assignedSales}`;
  if (lead.assignedAt && lead.recoveredOrderCreatedAt) return `${order}; recovered before assignment`;
  if (lead.recoveredBySalesName) return `${order}; sales tag: ${lead.recoveredBySalesName}; no post-assignment recovery`;
  if (lead.recoveredBySales) return `${order}; sales tag found; no post-assignment recovery`;
  return `${order}; no sales tag`;
}

function getRecoveredOrderTags(raw) {
  return normalizeTags(
    raw.recovered_order_tags ||
      raw.recoveredOrderTags ||
      raw.recovered_order?.tags ||
      raw.recoveredOrder?.tags ||
      raw.order_tags ||
      raw.orderTags ||
      raw.order?.tags,
  );
}

function getRecoveredBySalesName(raw, recoveredOrderTags) {
  const direct = text(
    raw.recovered_by_sales_name ||
      raw.recoveredBySalesName ||
      raw.recovered_sales_name ||
      raw.recoveredSalesName ||
      raw.sales_name ||
      raw.salesName ||
      raw.order?.sales_name ||
      raw.order?.salesName,
  );
  return matchSalesName(direct) || matchSalesName(recoveredOrderTags.join(" "));
}

function getRelatedSalesName(raw) {
  const direct = text(
    raw.related_sales ||
      raw.relatedSales ||
      raw.related_sales_name ||
      raw.relatedSalesName ||
      raw.customer_related_sales ||
      raw.customerRelatedSales ||
      raw.customer_sales_owner ||
      raw.customerSalesOwner,
  );
  return matchSalesName(direct) || direct;
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean);
    } catch (error) {
      // Fall back to comma splitting below.
    }
    return value.split(",").map(text).filter(Boolean);
  }
  return [];
}

function matchSalesName(value) {
  const haystack = normalizeComparable(value);
  if (!haystack) return "";
  return SALES_USERS.find((name) => name !== "Non-sales" && haystack.includes(normalizeComparable(name))) || "";
}

function booleanValue(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined || value === "") return false;
  return ["true", "1", "yes", "y"].includes(text(value).toLowerCase());
}

function buildSummary(leads) {
  const byMarket = {};
  const bySales = {};
  const latestCreatedAt = {};
  for (const lead of leads) {
    byMarket[lead.market] ||= {
      total: 0,
      valid: 0,
      validAvailable: 0,
      assigned: 0,
      amount: 0,
      validAmount: 0,
      validAssignedAmount: 0,
      ageBuckets: { under72h: 0, h72To1w: 0, w1To1m: 0, over1m: 0 },
    };
    byMarket[lead.market].total += 1;
    byMarket[lead.market].amount += lead.subtotal;
    incrementAgeBucket(byMarket[lead.market].ageBuckets, lead.ageHours);
    if (lead.leadStatus === "Valid") {
      byMarket[lead.market].valid += 1;
      byMarket[lead.market].validAmount += lead.subtotal;
    }
    if (lead.leadStatus === "Valid" && !lead.assignedSales) byMarket[lead.market].validAvailable += 1;
    if (lead.assignedSales && lead.leadStatus === "Valid") {
      byMarket[lead.market].assigned += 1;
      byMarket[lead.market].validAssignedAmount += lead.subtotal;
    }
    if (!latestCreatedAt[lead.market] || new Date(lead.createdAt) > new Date(latestCreatedAt[lead.market])) {
      latestCreatedAt[lead.market] = lead.createdAt;
    }
    if (lead.assignedSales && lead.leadStatus === "Valid") {
      bySales[lead.assignedSales] ||= { US: 0, CA: 0, AU: 0, total: 0, lastAssignedAt: "" };
      bySales[lead.assignedSales][lead.market] += 1;
      bySales[lead.assignedSales].total += 1;
      if (!bySales[lead.assignedSales].lastAssignedAt || new Date(lead.assignedAt) > new Date(bySales[lead.assignedSales].lastAssignedAt)) {
        bySales[lead.assignedSales].lastAssignedAt = lead.assignedAt;
      }
    }
  }
  return { byMarket, bySales, latestCreatedAt };
}

function buildSalesAssignmentSummary(assignments, markets = []) {
  const allowedMarkets = new Set(markets.map((market) => text(market).toUpperCase()).filter(Boolean));
  const bySales = {};
  for (const assignment of Object.values(assignments || {})) {
    const sales = text(assignment.sales || assignment.assignedSales);
    if (!sales || sales === "Non-sales") continue;
    const status = normalizeLeadStatus(assignment.leadStatus || assignment.salesStatus);
    if (status !== "Valid") continue;
    const market = text(assignment.market).toUpperCase();
    if (!COUNTRY_META[market]) continue;
    if (allowedMarkets.size && !allowedMarkets.has(market)) continue;
    bySales[sales] ||= { US: 0, CA: 0, AU: 0, total: 0, lastAssignedAt: "" };
    bySales[sales][market] += 1;
    bySales[sales].total += 1;
    const assignedAt = assignment.assignedAt || assignment.updatedAt || "";
    if (assignedAt && (!bySales[sales].lastAssignedAt || new Date(assignedAt) > new Date(bySales[sales].lastAssignedAt))) {
      bySales[sales].lastAssignedAt = assignedAt;
    }
  }
  return bySales;
}

function buildDraftSummary(drafts) {
  const byMarket = {};
  const latestCreatedAt = {};
  for (const market of Object.keys(COUNTRY_META)) {
    byMarket[market] = { total: 0, valid: 0, assigned: 0, amount: 0, validAmount: 0, manualShipping: 0 };
  }
  for (const draft of drafts) {
    byMarket[draft.market] ||= { total: 0, valid: 0, assigned: 0, amount: 0, validAmount: 0, manualShipping: 0 };
    byMarket[draft.market].total += 1;
    byMarket[draft.market].amount += draft.total || draft.subtotal || 0;
    if (draft.hasManualShipping) byMarket[draft.market].manualShipping += 1;
    if (draft.leadStatus === "Valid") {
      byMarket[draft.market].valid += 1;
      byMarket[draft.market].validAmount += draft.total || draft.subtotal || 0;
    }
    if (draft.assignedSales && draft.leadStatus === "Valid") byMarket[draft.market].assigned += 1;
    if (!latestCreatedAt[draft.market] || new Date(draft.createdAt) > new Date(latestCreatedAt[draft.market])) {
      latestCreatedAt[draft.market] = draft.createdAt;
    }
  }
  return { byMarket, latestCreatedAt };
}

function incrementAgeBucket(buckets, ageHours) {
  if (ageHours === null || ageHours === undefined || !Number.isFinite(Number(ageHours))) return;
  if (ageHours < 72) buckets.under72h += 1;
  else if (ageHours < 24 * 7) buckets.h72To1w += 1;
  else if (ageHours <= 24 * 30) buckets.w1To1m += 1;
  else buckets.over1m += 1;
}

async function handleSaveAssignment(req) {
  const body = await readJsonBody(req);
  const id = text(body.id);
  const market = text(body.market).toUpperCase();
  if (!id || !COUNTRY_META[market]) {
    return jsonResponse(400, { error: "Lead id and market are required." });
  }

  const assignments = await readAssignments([market], 10000);
  const key = `${market}:${id}`;
  const previous = assignments[key] || {};
  const now = new Date().toISOString();
  const leadStatus = normalizeLeadStatus(body.leadStatus || body.salesStatus || previous.leadStatus || previous.salesStatus || "Valid");
  assignments[key] = {
    ...previous,
    id,
    market,
    checkoutName: text(body.checkoutName || body.checkout || previous.checkoutName || ""),
    sales: text(body.sales),
    leadStatus,
    salesStatus: leadStatus,
    notes: text(body.notes),
    funnelStatus: text(body.funnelStatus || previous.funnelStatus || ""),
    manualStatus: text(body.manualStatus || previous.manualStatus || ""),
    manualNotes: text(body.manualNotes || previous.manualNotes || ""),
    assignedAt: body.sales && body.sales !== previous.sales ? now : previous.assignedAt || "",
    updatedAt: now,
    dataHubSyncedAt: previous.dataHubSyncedAt || "",
    dataHubSyncError: "",
  };

  const syncResult = await syncAssignmentToDataHub(assignments[key], body);
  assignments[key].dataHubSyncedAt = syncResult.syncedAt || assignments[key].dataHubSyncedAt || "";
  assignments[key].dataHubSyncError = syncResult.error || "";
  writeAssignments(assignments);
  return jsonResponse(200, {
    ok: true,
    assignment: assignments[key],
    dataHubSynced: Boolean(syncResult.syncedAt),
    dataHubSyncError: syncResult.error || "",
  });
}

async function syncAssignmentToDataHub(assignment, requestBody) {
  if (!DATA_HUB_ASSIGNMENTS_WRITE_PATH) {
    return { skipped: true };
  }
  if (!DATA_HUB_BASE_URL || !DATA_HUB_API_KEY) {
    return { error: "Data Hub environment variables are missing." };
  }

  const endpoint = DATA_HUB_ASSIGNMENTS_WRITE_PATH.startsWith("/")
    ? DATA_HUB_ASSIGNMENTS_WRITE_PATH
    : `/${DATA_HUB_ASSIGNMENTS_WRITE_PATH}`;
  const payload = {
    country: assignment.market,
    checkout_gid: assignment.id,
    checkout_name: text(requestBody.checkoutName || requestBody.checkout || assignment.checkoutName || ""),
    assigned_sales: assignment.sales,
    lead_status: assignment.leadStatus,
    sales_notes: assignment.notes,
    assigned_at: assignment.assignedAt || null,
    updated_at: assignment.updatedAt,
    updated_by: text(requestBody.updatedBy || requestBody.updated_by || requestBody.userEmail || ""),
  };

  try {
    const response = await fetch(`${DATA_HUB_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": DATA_HUB_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();
    if (!response.ok) {
      return { error: getDataHubErrorMessage(response.status, responseText) };
    }
    return { syncedAt: new Date().toISOString() };
  } catch (error) {
    return { error: error.message };
  }
}

function getDataHubErrorMessage(status, responseText) {
  try {
    const parsed = JSON.parse(responseText || "{}");
    return parsed.error ? `Data Hub ${status}: ${parsed.error}` : `Data Hub ${status}: ${responseText.slice(0, 180)}`;
  } catch (error) {
    return `Data Hub ${status}: ${responseText.slice(0, 180)}`;
  }
}

function getPersistenceMode() {
  if (DATA_HUB_ASSIGNMENTS_READ_PATH && DATA_HUB_ASSIGNMENTS_WRITE_PATH) return "data-hub-with-local-cache";
  if (DATA_HUB_ASSIGNMENTS_READ_PATH) return "data-hub-read-local-write-cache";
  if (DATA_HUB_ASSIGNMENTS_WRITE_PATH) return "local-read-data-hub-write-cache";
  return "local-json";
}

function normalizeEndpoint(endpoint) {
  const value = text(endpoint);
  return value.startsWith("/") ? value : `/${value}`;
}

function appendQuery(endpoint, params) {
  const [pathOnly, queryString = ""] = endpoint.split("?");
  const search = new URLSearchParams(queryString);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered ? `${pathOnly}?${rendered}` : pathOnly;
}

async function readAssignments(markets = [], limit = 10000) {
  if (DATA_HUB_ASSIGNMENTS_READ_PATH && DATA_HUB_BASE_URL && DATA_HUB_API_KEY) {
    try {
      return await fetchAssignmentsFromDataHub(markets, limit);
    } catch (error) {
      console.warn(`Data Hub assignment read failed; using local cache. ${error.message}`);
    }
  }
  return readLocalAssignments();
}

async function fetchAssignmentsFromDataHub(markets = [], limit = 10000) {
  const normalizedMarkets = [...new Set(markets.map((market) => text(market).toUpperCase()).filter((market) => COUNTRY_META[market]))];
  const endpoint = normalizeEndpoint(DATA_HUB_ASSIGNMENTS_READ_PATH);
  const rows = [];
  const shouldReadPerMarket = endpoint.includes("/api/data-hub/records") && normalizedMarkets.length > 1;

  if (shouldReadPerMarket) {
    for (const market of normalizedMarkets) {
      rows.push(...await fetchAssignmentRows(endpoint, [market], limit));
    }
  } else {
    rows.push(...await fetchAssignmentRows(endpoint, normalizedMarkets, limit));
  }

  const directRecordsEndpoint = "/api/data-hub/records?table=abandoned_cart_lead_assignments";
  if (!endpoint.includes("abandoned_cart_lead_assignments")) {
    for (const market of normalizedMarkets.length ? normalizedMarkets : Object.keys(COUNTRY_META)) {
      try {
        rows.push(...await fetchAssignmentRows(directRecordsEndpoint, [market], limit));
      } catch (error) {
        console.warn(`Data Hub direct assignment records read failed for ${market}; using report rows. ${error.message}`);
      }
    }
  }

  return buildAssignmentMap(rows);
}

async function fetchAssignmentRows(endpoint, markets, limit) {
  const params = {
    limit: String(Math.max(1, Math.min(Number(limit || 10000), 10000))),
  };
  if (markets.length) params.country = markets.join(",");
  const response = await fetch(`${DATA_HUB_BASE_URL}${appendQuery(endpoint, params)}`, {
    headers: { "x-api-key": DATA_HUB_API_KEY },
  });
  const responseText = await response.text();
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    throw new Error("Data Hub returned invalid JSON for lead assignments.");
  }
  if (!response.ok) {
    throw new Error(getDataHubErrorMessage(response.status, responseText));
  }
  return extractRecords(payload);
}

function buildAssignmentMap(rows) {
  const assignments = {};
  for (const row of rows) {
    const assignment = normalizeAssignmentRecord(row);
    if (!assignment) continue;
    assignments[`${assignment.market}:${assignment.id}`] = assignment;
  }
  return assignments;
}

function normalizeAssignmentRecord(row) {
  const raw = row.raw || row.payload || row.data || row.assignment || row;
  const market = text(raw.market || raw.country || raw.country_normalized || raw.countryNormalized).toUpperCase();
  const checkoutName = text(raw.checkout_name || raw.checkoutName || raw.checkout || raw.name);
  const id = normalizeCheckoutAssignmentId(
    raw.checkout_gid ||
      raw.checkoutGid ||
      raw.checkout_id ||
      raw.checkoutId ||
      raw.id ||
      checkoutName,
  );
  if (!COUNTRY_META[market] || !id) return null;

  const leadStatus = normalizeLeadStatus(raw.lead_status || raw.leadStatus || raw.sales_status || raw.salesStatus);
  return {
    id,
    market,
    checkoutName,
    sales: text(raw.assigned_sales || raw.assignedSales || raw.sales || raw.sales_name || raw.salesName),
    leadStatus,
    salesStatus: leadStatus,
    notes: text(raw.sales_notes || raw.salesNotes || raw.notes || raw.lead_notes || raw.leadNotes),
    funnelStatus: text(raw.funnel_status || raw.funnelStatus),
    manualStatus: text(raw.manual_status || raw.manualStatus),
    manualNotes: text(raw.manual_notes || raw.manualNotes),
    assignedAt: text(raw.assigned_at || raw.assignedAt),
    updatedAt: text(raw.updated_at || raw.updatedAt),
    dataHubSyncedAt: text(raw.data_hub_synced_at || raw.dataHubSyncedAt || raw.updated_at || raw.updatedAt),
    dataHubSyncError: "",
  };
}

function normalizeCheckoutAssignmentId(value) {
  const raw = text(value);
  if (!raw) return "";
  const gidMatch = raw.match(/\/([^/]+)$/);
  const candidate = gidMatch ? gidMatch[1] : raw;
  return candidate.replace(/^#/, "");
}

function readLocalAssignments() {
  return {};
}

function writeAssignments(assignments) {
  void assignments;
}

function assignmentKey(lead) {
  return `${lead.market}:${normalizeCheckoutAssignmentId(lead.id)}`;
}

function normalizeFunnelStatus(value) {
  const status = text(value);
  return status === "No Contact" ? "No Phone" : status;
}

function sortByGradeThenDate(a, b) {
  return gradeRank(a.grade) - gradeRank(b.grade) || new Date(b.createdAt) - new Date(a.createdAt);
}

function sortBySubtotalDesc(a, b) {
  return Number(b.total || b.subtotal || 0) - Number(a.total || a.subtotal || 0) || sortByGradeThenDate(a, b);
}

function gradeRank(grade) {
  const gradeOrder = { "A+": 0, A: 2, "A-": 4, "B+": 6, B: 8, "B-": 10 };
  const value = text(grade);
  const normalized = value.replace("!", "");
  const bangPriority = value.includes("!") ? -1 : 0;
  return (gradeOrder[normalized] ?? 99) + bangPriority;
}

function buildKlaviyoLookup(records) {
  const lookup = { byMarketEmail: new Map() };
  for (const record of records) {
    const profile = normalizeKlaviyoProfile(record);
    if (!profile) continue;
    for (const email of profile.emails) lookup.byMarketEmail.set(`${profile.market}:${email}`, profile);
  }
  return lookup;
}

function normalizeKlaviyoProfile(record) {
  const raw = record.raw || record.profile || record.data || {};
  const attributes = raw.attributes || raw;
  const email = normalizeEmail(record.matched_email || record.email || attributes.email);
  const market = text(record.country_normalized || record.country || attributes.country).toUpperCase();
  const subscriptions = normalizeSubscriptions(record.subscriptions || attributes.subscriptions || raw.subscriptions);
  const profile = {
    id: text(record.profile_id || raw.id || record.id),
    market,
    emails: email ? [email] : [],
    emailState: marketingStateFromLookup(record.klaviyo_email_subscribed) || marketingStateFromSubscription(subscriptions?.email?.marketing),
    smsState: marketingStateFromLookup(record.klaviyo_sms_subscribed) || marketingStateFromSubscription(subscriptions?.sms?.marketing),
  };
  if (!profile.market || !profile.emails.length) return null;
  return profile;
}

function normalizeSubscriptions(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }
  return value;
}

function marketingStateFromSubscription(marketing) {
  if (!marketing) return "Unknown";
  if (marketing.can_receive_email_marketing === true || marketing.can_receive_sms_marketing === true) return "Subscribed";
  const consent = text(marketing.consent || marketing.status || marketing.state).toLowerCase();
  if (["subscribed", "opted_in", "confirmed", "true"].includes(consent)) return "Subscribed";
  if (!consent) return "Unknown";
  return "Not subscribed";
}

function marketingStateFromLookup(value) {
  const state = text(value).toLowerCase();
  if (!state) return "";
  if (state === "subscribed") return "Subscribed";
  if (state.includes("not subscribed") || state.includes("never_subscribed") || state.includes("unsubscribed")) {
    return "Not subscribed";
  }
  return "";
}

function getLookupMarketingState(value) {
  return marketingStateFromLookup(value);
}

function findKlaviyoProfile(market, email, lookup) {
  if (!lookup) return null;
  const emailKey = normalizeEmail(email);
  const marketKey = text(market).toUpperCase();
  return emailKey && marketKey ? lookup.byMarketEmail.get(`${marketKey}:${emailKey}`) || null : null;
}

function getKlaviyoMarketingState(profile, type) {
  if (!profile) return "Unknown";
  return type === "email" ? profile.emailState || "Unknown" : profile.smsState || "Unknown";
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function buildGrade(subtotal, ageHours, klaviyoEmailSubscribed, klaviyoTextSubscribed) {
  const base = subtotal > 5000 ? "A" : "B";
  let suffix = "";
  if (ageHours !== null && ageHours >= 72 && ageHours < 24 * 7) suffix = "+";
  if (ageHours !== null && ageHours >= 24 * 7 && ageHours <= 24 * 30) suffix = "";
  if (ageHours !== null && ageHours > 24 * 30) suffix = "-";
  const unsubscribed = klaviyoEmailSubscribed !== "Subscribed" && klaviyoTextSubscribed !== "Subscribed";
  return `${base}${suffix}${unsubscribed ? "!" : ""}`;
}

function calculateKlaviyoMaxDiscount(subtotal) {
  if (subtotal <= 2000) return 25;
  if (subtotal <= 5000) return 100;
  return 200;
}

function normalizeLeadStatus(value) {
  const status = text(value);
  if (status === "Recovered") return "Recovered by Sales";
  return ["Valid", "Invalid", "Recovered Auto", "Recovered by Sales"].includes(status) ? status : "Valid";
}

function getDiscountCode(raw) {
  const discounts = raw.discount_codes || raw.discountCodes || raw.applied_discounts || raw.appliedDiscounts || [];
  if (Array.isArray(discounts) && discounts.length) {
    return discounts.map((discount) => discount.code || discount.title || discount).filter(Boolean).join("; ");
  }
  return text(raw.discount_code || raw.discountCode);
}

function getMarketingState(raw, type) {
  const consent =
    type === "email"
      ? raw.email_marketing_consent || raw.emailMarketingConsent || raw.customer?.email_marketing_consent
      : raw.sms_marketing_consent || raw.smsMarketingConsent || raw.customer?.sms_marketing_consent;
  const direct =
    type === "email"
      ? raw.buyer_accepts_marketing || raw.email_subscribed || raw.klaviyo_email_subscribed
      : raw.buyer_accepts_sms_marketing || raw.sms_subscribed || raw.klaviyo_sms_subscribed;
  if (direct === true) return "Subscribed";
  const state = text(consent?.state || consent?.marketingState || consent?.status || direct).toLowerCase();
  if (["subscribed", "opted_in", "confirmed", "true"].includes(state)) return "Subscribed";
  if (!state) return "Unknown";
  return "Not subscribed";
}

function formatAddress(address) {
  if (typeof address === "string") return address;
  if (!address) return "";
  return [
    address.address1,
    address.address2,
    [address.city, address.province_code || address.province, address.zip].filter(Boolean).join(", "),
    address.country || address.country_code,
    address.phone,
  ]
    .filter(Boolean)
    .map(text)
    .join("\n");
}

function formatVancouverDateTime(value) {
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

function normalizeState(value) {
  const state = text(value).trim().toUpperCase();
  const names = {
    ALABAMA: "AL",
    ALASKA: "AK",
    ARIZONA: "AZ",
    ARKANSAS: "AR",
    CALIFORNIA: "CA",
    COLORADO: "CO",
    CONNECTICUT: "CT",
    DELAWARE: "DE",
    FLORIDA: "FL",
    GEORGIA: "GA",
    HAWAII: "HI",
    IDAHO: "ID",
    ILLINOIS: "IL",
    INDIANA: "IN",
    IOWA: "IA",
    KANSAS: "KS",
    KENTUCKY: "KY",
    LOUISIANA: "LA",
    MAINE: "ME",
    MARYLAND: "MD",
    MASSACHUSETTS: "MA",
    MICHIGAN: "MI",
    MINNESOTA: "MN",
    MISSISSIPPI: "MS",
    MISSOURI: "MO",
    MONTANA: "MT",
    NEBRASKA: "NE",
    NEVADA: "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    OHIO: "OH",
    OKLAHOMA: "OK",
    OREGON: "OR",
    PENNSYLVANIA: "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    TENNESSEE: "TN",
    TEXAS: "TX",
    UTAH: "UT",
    VERMONT: "VT",
    VIRGINIA: "VA",
    WASHINGTON: "WA",
    "WEST VIRGINIA": "WV",
    WISCONSIN: "WI",
    WYOMING: "WY",
  };
  return names[state] || state;
}

function getTimeZoneForState(state, market) {
  if (!state) return "";
  if (market === "AU") return getAuTimeZoneForState(state);
  if (market === "CA") {
    if (["BC", "YT"].includes(state)) return "PT";
    if (["AB", "NT"].includes(state)) return "MT";
    if (["SK", "MB"].includes(state)) return "CT";
    if (["ON", "QC", "NU"].includes(state)) return "ET";
    if (["NB", "NS", "PE"].includes(state)) return "AT";
    if (state === "NL") return "NT";
    return "";
  }
  const pacific = new Set(["CA", "NV", "OR", "WA"]);
  const mountain = new Set(["AZ", "CO", "ID", "MT", "NM", "UT", "WY"]);
  const central = new Set(["AL", "AR", "IA", "IL", "KS", "LA", "MN", "MO", "MS", "ND", "NE", "OK", "SD", "TX", "WI"]);
  const eastern = new Set(["CT", "DC", "DE", "FL", "GA", "IN", "KY", "MA", "MD", "ME", "MI", "NC", "NH", "NJ", "NY", "OH", "PA", "RI", "SC", "TN", "VA", "VT", "WV"]);
  if (pacific.has(state)) return "PT";
  if (mountain.has(state)) return "MT";
  if (central.has(state)) return "CT";
  if (eastern.has(state)) return "ET";
  if (state === "AK") return "AKT";
  if (state === "HI") return "HT";
  return "";
}

function normalizeTimeZone(value) {
  const zone = text(value);
  if (!zone) return "";
  const ianaMap = {
    "America/Los_Angeles": "PT",
    "America/Denver": "MT",
    "America/Chicago": "CT",
    "America/New_York": "ET",
    "America/Vancouver": "PT",
    "America/Edmonton": "MT",
    "America/Winnipeg": "CT",
    "America/Toronto": "ET",
    "America/Halifax": "AT",
    "America/St_Johns": "NT",
    "Australia/Perth": "AWST",
    "Australia/Adelaide": "ACST",
    "Australia/Darwin": "ACST",
    "Australia/Brisbane": "AEST",
    "Australia/Sydney": "AEST",
    "Australia/Melbourne": "AEST",
  };
  return ianaMap[zone] || zone;
}

function getAuTimeZoneForState(state) {
  if (["WA"].includes(state)) return "AWT";
  if (["NT", "SA"].includes(state)) return "ACT";
  if (["ACT", "NSW", "QLD", "TAS", "VIC"].includes(state)) return "AET";
  return "";
}

function normalizeComparable(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeAuthMode(value) {
  const mode = text(value).toLowerCase().replace(/[-\s]+/g, "_");
  return mode === "cloudflare_access" || mode === "cloudflare" ? "cloudflare_access" : "manual";
}

function getDashboardSession(req) {
  if (AUTH_MODE !== "cloudflare_access") {
    return {
      authMode: AUTH_MODE,
      authenticated: false,
      user: "",
      role: "",
      email: "",
      source: "manual",
      salesUsers: SALES_USERS,
    };
  }

  const identity = getCloudflareAccessIdentity(req);
  const email = normalizeEmail(identity.email);
  const mapped = mapEmailToDashboardUser(email);
  return {
    authMode: AUTH_MODE,
    authenticated: Boolean(email && mapped),
    user: mapped?.user || "",
    role: mapped?.role || "",
    email,
    source: identity.source,
    reason: email ? (mapped ? "" : "Email is verified by Cloudflare Access but not mapped to a dashboard user.") : "No Cloudflare Access email found.",
    salesUsers: SALES_USERS,
  };
}

function getCloudflareAccessIdentity(req) {
  const token = text(getHeader(req, "cf-access-jwt-assertion"));
  const tokenPayload = decodeJwtPayload(token);
  if (tokenPayload?.email) return { email: tokenPayload.email, source: "cf-access-jwt-assertion" };

  const headerEmail = text(getHeader(req, "cf-access-authenticated-user-email"));
  if (headerEmail) return { email: headerEmail, source: "cf-access-authenticated-user-email" };

  return { email: "", source: "" };
}

function decodeJwtPayload(token) {
  const parts = text(token).split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(base64DecodeToText(padded));
  } catch (error) {
    return null;
  }
}

function mapEmailToDashboardUser(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (ADMIN_EMAILS.has(normalized)) return { user: "Admin", role: "admin" };
  const salesUser = SALES_EMAIL_MAP.get(normalized);
  if (salesUser && SALES_USERS.includes(salesUser)) return { user: salesUser, role: "sales" };
  return null;
}

function parseEmailSet(value) {
  return new Set(
    splitConfigList(value)
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  );
}

function parseSalesEmailMap(value) {
  const map = new Map();
  const raw = text(value);
  if (!raw) return map;

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      for (const [email, salesUser] of Object.entries(parsed || {})) {
        const normalizedEmail = normalizeEmail(email);
        const normalizedSales = text(salesUser);
        if (normalizedEmail && normalizedSales) map.set(normalizedEmail, normalizedSales);
      }
      return map;
    } catch (error) {
      return map;
    }
  }

  for (const pair of splitConfigList(raw)) {
    const separator = pair.includes("=") ? "=" : ":";
    const [email, salesUser] = pair.split(separator).map(text);
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail && salesUser) map.set(normalizedEmail, salesUser);
  }
  return map;
}

function splitConfigList(value) {
  return text(value)
    .split(/[;,\n]+/)
    .map(text)
    .filter(Boolean);
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function readJsonBody(req) {
  try {
    return await req.json();
  } catch (error) {
    return {};
  }
}

function text(value) {
  return String(value ?? "").trim();
}
