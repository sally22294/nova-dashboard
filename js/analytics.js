import { findMatchingCustomer } from "./customer-storage.js";
import { formatCurrency, formatDate as formatUserDate, formatNumber } from "./formatting.js";
const rangeOptions = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  year: "This year",
  all: "All time"
};

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function toCents(value) {
  return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) : 0;
}

function formatMoney(cents) {
  return formatCurrency(cents / 100);
}

function formatDate(value, options) {
  return formatUserDate(value, options);
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function getLocalDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getRangeBounds(range, now) {
  const end = new Date(now);
  let start = null;
  if (range === "year") {
    start = new Date(end.getFullYear(), 0, 1);
  } else if (range !== "all") {
    const days = Number(range);
    start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    start.setDate(start.getDate() - days + 1);
  }
  return { start, end };
}

function isWithinRange(order, bounds) {
  if (!isValidDate(order.createdAt)) return false;
  const createdAt = new Date(order.createdAt);
  return createdAt <= bounds.end && (!bounds.start || createdAt >= bounds.start);
}

function uniqueOrders(orders) {
  const seen = new Set();
  return (Array.isArray(orders) ? orders : []).filter((order) => {
    if (!order || typeof order.id !== "string" || !order.id || seen.has(order.id) || !isValidDate(order.createdAt)) return false;
    seen.add(order.id);
    return true;
  });
}

function isRevenueOrder(order) {
  return order.paymentStatus === "Paid" && order.orderStatus !== "Cancelled";
}

function getNetItemAmounts(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const lineCents = items.map((item) => Math.max(0, toCents(item.lineTotal)));
  const subtotalCents = lineCents.reduce((sum, amount) => sum + amount, 0);
  const discountCents = Math.min(subtotalCents, Math.max(0, toCents(order.discount || 0)));
  if (!subtotalCents || !discountCents) return lineCents;

  const allocations = lineCents.map((amount, index) => {
    const exactShare = amount * discountCents / subtotalCents;
    return { index, cents: Math.floor(exactShare), remainder: exactShare - Math.floor(exactShare) };
  });
  let remaining = discountCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  allocations.slice().sort((first, second) => second.remainder - first.remainder || first.index - second.index)
    .forEach((allocation) => {
      if (remaining > 0) {
        allocations[allocation.index].cents += 1;
        remaining -= 1;
      }
    });

  return lineCents.map((amount, index) => amount - allocations[index].cents);
}

function bucketKey(date, granularity) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  if (granularity === "month") return `${year}-${month}`;
  return getLocalDateKey(date);
}

function makeRevenueSeries(orders, range, bounds) {
  if (!orders.length) return [];
  const granularity = range === "7" || range === "30" ? "day" : "month";
  const earliestOrder = orders.reduce((earliest, order) => {
    const date = new Date(order.createdAt);
    return !earliest || date < earliest ? date : earliest;
  }, null);
  const start = range === "all"
    ? new Date(earliestOrder.getFullYear(), earliestOrder.getMonth(), 1)
    : new Date(bounds.start);
  if (granularity === "month") start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const revenueByBucket = new Map();
  orders.forEach((order) => {
    const key = bucketKey(new Date(order.createdAt), granularity);
    revenueByBucket.set(key, (revenueByBucket.get(key) || 0) + toCents(order.total));
  });

  const series = [];
  const cursor = new Date(start);
  while (cursor <= bounds.end) {
    const key = bucketKey(cursor, granularity);
    series.push({
      key,
      label: granularity === "day"
        ? formatDate(cursor, { month: "short", day: "numeric" })
        : formatDate(cursor, { month: "short", year: "2-digit" }),
      revenueCents: revenueByBucket.get(key) || 0
    });
    if (granularity === "day") cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return series;
}

function resolveCustomer(order, customersById, customers) {
  const linkedCustomer = order.customerId ? customersById.get(order.customerId) : null;
  return linkedCustomer || findMatchingCustomer(customers, order.customerEmail, order.customerPhone);
}

function buildCustomerInsights(allRevenueOrders, rangeRevenueOrders, customers, rangeStart) {
  const customerRecords = Array.isArray(customers) ? customers : [];
  const customersById = new Map(customerRecords.map((customer) => [customer.id, customer]));
  const inRangeIds = new Set(rangeRevenueOrders.map((order) => order.id));
  const aggregates = new Map();
  let unmatchedOrderCount = 0;

  allRevenueOrders.forEach((order) => {
    const customer = resolveCustomer(order, customersById, customerRecords);
    if (!customer) {
      if (inRangeIds.has(order.id)) unmatchedOrderCount += 1;
      return;
    }

    let aggregate = aggregates.get(customer.id);
    if (!aggregate) {
      aggregate = { customer, lifetimeOrders: [], rangeOrders: [], revenueCents: 0 };
      aggregates.set(customer.id, aggregate);
    }
    aggregate.lifetimeOrders.push(order);
    if (inRangeIds.has(order.id)) {
      aggregate.rangeOrders.push(order);
      aggregate.revenueCents += toCents(order.total);
    }
  });

  const activeCustomers = [...aggregates.values()].filter((item) => item.rangeOrders.length);
  let newCustomers = 0;
  let returningCustomers = 0;
  activeCustomers.forEach((item) => {
    const firstPurchase = item.lifetimeOrders.reduce((earliest, order) => {
      const date = new Date(order.createdAt);
      return !earliest || date < earliest ? date : earliest;
    }, null);
    const isNew = rangeStart
      ? firstPurchase >= rangeStart
      : item.lifetimeOrders.length === 1;
    if (isNew) newCustomers += 1;
    else returningCustomers += 1;
  });

  const totalCustomerRevenue = activeCustomers.reduce((sum, item) => sum + item.revenueCents, 0);
  const topCustomers = activeCustomers
    .slice()
    .sort((first, second) => second.revenueCents - first.revenueCents
      || first.customer.name.localeCompare(second.customer.name))
    .slice(0, 5)
    .map((item) => ({
      id: item.customer.id,
      name: item.customer.name,
      orderCount: item.rangeOrders.length,
      revenueCents: item.revenueCents
    }));

  return {
    newCustomers,
    returningCustomers,
    activeCustomerCount: activeCustomers.length,
    averageSpendCents: activeCustomers.length ? Math.round(totalCustomerRevenue / activeCustomers.length) : 0,
    unmatchedOrderCount,
    topCustomers
  };
}

export function buildAnalyticsReport({
  orders = [],
  products = [],
  customers = [],
  range = "30",
  now = new Date()
} = {}) {
  const rangeKey = Object.prototype.hasOwnProperty.call(rangeOptions, range) ? range : "30";
  const bounds = getRangeBounds(rangeKey, now);
  const savedOrders = uniqueOrders(orders);
  const rangeOrders = savedOrders.filter((order) => isWithinRange(order, bounds));
  const rangeRevenueOrders = rangeOrders.filter(isRevenueOrder);
  const historicalRevenueOrders = savedOrders
    .filter((order) => new Date(order.createdAt) <= bounds.end && isRevenueOrder(order));
  const revenueCents = rangeRevenueOrders.reduce((sum, order) => sum + toCents(order.total), 0);
  const paymentMethods = new Map();
  rangeRevenueOrders.forEach((order) => {
    const method = typeof order.paymentMethod === "string" && order.paymentMethod.trim()
      ? order.paymentMethod.trim()
      : "Unspecified";
    paymentMethods.set(method, (paymentMethods.get(method) || 0) + toCents(order.total));
  });

  const statusCounts = new Map();
  const paymentStatusCounts = new Map();
  rangeOrders.forEach((order) => {
    statusCounts.set(order.orderStatus, (statusCounts.get(order.orderStatus) || 0) + 1);
    paymentStatusCounts.set(order.paymentStatus, (paymentStatusCounts.get(order.paymentStatus) || 0) + 1);
  });

  const productsById = new Map((Array.isArray(products) ? products : []).map((product) => [product.id, product]));
  const productTotals = new Map();
  let unitsSold = 0;
  rangeRevenueOrders.forEach((order) => {
    const itemAmounts = getNetItemAmounts(order);
    (Array.isArray(order.items) ? order.items : []).forEach((item, index) => {
      const productId = typeof item.productId === "string" ? item.productId : "";
      const sku = typeof item.sku === "string" ? item.sku : "";
      const key = productId || sku;
      if (!key || !Number.isInteger(item.quantity) || item.quantity < 1) return;
      const catalogProduct = productsById.get(productId);
      let total = productTotals.get(key);
      if (!total) {
        total = {
          name: item.productName || catalogProduct?.name || "Archived product",
          sku: sku || catalogProduct?.sku || "",
          quantity: 0,
          revenueCents: 0,
          latestOrderAt: ""
        };
        productTotals.set(key, total);
      }
      if (!total.latestOrderAt || order.createdAt > total.latestOrderAt) {
        total.name = item.productName || catalogProduct?.name || total.name;
        total.sku = sku || catalogProduct?.sku || total.sku;
        total.latestOrderAt = order.createdAt;
      }
      total.quantity += item.quantity;
      total.revenueCents += itemAmounts[index] || 0;
      unitsSold += item.quantity;
    });
  });

  const topProducts = [...productTotals.values()]
    .sort((first, second) => second.quantity - first.quantity
      || second.revenueCents - first.revenueCents
      || first.name.localeCompare(second.name))
    .slice(0, 5);

  return {
    rangeKey,
    rangeLabel: rangeOptions[rangeKey],
    totalOrders: rangeOrders.length,
    revenueCents,
    paidOrderCount: rangeRevenueOrders.length,
    averageOrderValueCents: rangeRevenueOrders.length ? Math.round(revenueCents / rangeRevenueOrders.length) : 0,
    unitsSold,
    revenueSeries: makeRevenueSeries(rangeRevenueOrders, rangeKey, bounds),
    paymentMethods: [...paymentMethods.entries()]
      .map(([label, amountCents]) => ({ label, amountCents }))
      .sort((first, second) => second.amountCents - first.amountCents || first.label.localeCompare(second.label)),
    statusCounts: [...statusCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label)),
    paymentStatusCounts: [...paymentStatusCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label)),
    topProducts,
    customers: buildCustomerInsights(
      historicalRevenueOrders,
      rangeRevenueOrders,
      customers,
      bounds.start
    )
  };
}

function icon(name) {
  const paths = {
    revenue: '<path d="M3 17 9 11l4 4 8-9"/><path d="M15 6h6v6"/>',
    orders: '<path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    average: '<path d="M12 3v18"/><path d="M17 7.5c0-1.7-1.9-3-5-3S7 6 7 8s1.5 3 5 4 5 2.3 5 4.5-2 4-5 4-5-1.5-5-3.5"/>',
    units: '<path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z"/><path d="m3.8 7.7 8.2 4.5 8.2-4.5M12 12.2V21"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M16 3v4M8 3v4M3.5 10h17"/>'
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${paths[name]}</svg>`;
}

function renderMetric(label, value, note, iconName, tone) {
  return `<article class="metric-card">
    <div class="metric-top"><span class="metric-label">${label}</span><span class="metric-icon metric-icon--${tone}">${icon(iconName)}</span></div>
    <div class="metric-value">${value}</div>
    <div class="metric-bottom"><span>${note}</span></div>
  </article>`;
}

function renderMetrics(report) {
  return [
    renderMetric("Total revenue", formatMoney(report.revenueCents), "Paid orders only", "revenue", "sage"),
    renderMetric("Total orders", formatNumber(report.totalOrders), "Includes cancelled orders", "orders", "clay"),
    renderMetric("Average order value", formatMoney(report.averageOrderValueCents), "Paid orders only", "average", "sage"),
    renderMetric("Units sold", formatNumber(report.unitsSold), "From paid orders", "units", "clay")
  ].join("");
}

function renderRevenueChart(report) {
  if (!report.revenueSeries.length || report.revenueCents <= 0) {
    return '<div class="analytics-empty">No qualifying paid revenue to chart for this date range.</div>';
  }

  const left = 58;
  const right = 704;
  const top = 20;
  const bottom = 208;
  const maxValue = Math.max(...report.revenueSeries.map((point) => point.revenueCents));
  const axisMax = Math.max(1, Math.ceil(maxValue / 4) * 4);
  const points = report.revenueSeries.map((point, index) => {
    const x = report.revenueSeries.length === 1
      ? (left + right) / 2
      : left + (right - left) * index / (report.revenueSeries.length - 1);
    const y = bottom - (bottom - top) * point.revenueCents / axisMax;
    return { ...point, x, y };
  });
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${left},${bottom} ${line} ${right},${bottom}`;
  const tickLines = [0, 1, 2, 3, 4].map((index) => {
    const value = axisMax * index / 4;
    const y = bottom - (bottom - top) * index / 4;
    return `<line class="analytics-gridline" x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}"/>
      <text class="analytics-axis-label" x="${left - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${escapeHTML(formatMoney(value))}</text>`;
  }).join("");
  const labelCount = Math.min(6, points.length);
  const labelIndexes = new Set(Array.from({ length: labelCount }, (_, index) => (
    labelCount === 1 ? 0 : Math.round(index * (points.length - 1) / (labelCount - 1))
  )));
  const xLabels = [...labelIndexes].map((index) => {
    const point = points[index];
    return `<text class="analytics-axis-label" x="${point.x.toFixed(1)}" y="235" text-anchor="middle">${escapeHTML(point.label)}</text>`;
  }).join("");
  const circles = points.map((point) => `<circle class="analytics-chart-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5">
      <title>${escapeHTML(point.label)}: ${escapeHTML(formatMoney(point.revenueCents))}</title>
    </circle>`).join("");

  return `<svg class="analytics-chart" viewBox="0 0 730 250" role="img" aria-label="Revenue trend for ${escapeHTML(report.rangeLabel)}">
    <defs><linearGradient id="analyticsRevenueFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#b9cbb9" stop-opacity=".5"/><stop offset="100%" stop-color="#b9cbb9" stop-opacity="0"/></linearGradient></defs>
    ${tickLines}
    <polygon class="analytics-chart-area" points="${area}"/>
    <polyline class="analytics-chart-line" points="${line}"/>
    ${circles}
    ${xLabels}
  </svg>`;
}

function renderBreakdownRows(rows, maximum, getValue, getDetail) {
  if (!rows.length) return '<div class="analytics-empty">No order data in this date range.</div>';
  return `<div class="analytics-breakdown-list">${rows.map((row) => {
    const percentage = maximum ? Math.round(row.value / maximum * 100) : 0;
    return `<div class="analytics-breakdown-row">
      <div class="analytics-breakdown-heading"><span>${escapeHTML(row.label)}</span><strong>${escapeHTML(getValue(row))}</strong></div>
      <div class="analytics-bar-track" aria-hidden="true"><span style="width:${percentage}%"></span></div>
      <small>${escapeHTML(getDetail(row))}</small>
    </div>`;
  }).join("")}</div>`;
}

function renderPaymentMethodPanel(report) {
  const rows = report.paymentMethods.map((method) => ({
    label: method.label,
    value: method.amountCents,
    amountCents: method.amountCents
  }));
  const maximum = Math.max(0, ...rows.map((row) => row.value));
  const list = rows.length
    ? renderBreakdownRows(
      rows,
      maximum,
      (row) => formatMoney(row.amountCents),
      (row) => `${report.revenueCents ? Math.round(row.amountCents / report.revenueCents * 100) : 0}% of paid revenue`
    )
    : '<div class="analytics-empty">No paid orders with payment method data in this date range.</div>';
  return `<article class="panel analytics-performance-card">
    <header class="panel-header"><div class="panel-heading"><h3>Revenue by payment method</h3><p>Paid sales only</p></div></header>
    ${list}
  </article>`;
}

function renderStatusPanel(title, subtitle, rows, totalCount) {
  const list = rows.length
    ? renderBreakdownRows(
      rows.map((row) => ({ ...row, value: row.count })),
      Math.max(0, ...rows.map((row) => row.count)),
      (row) => `${formatNumber(row.count)} ${row.count === 1 ? "order" : "orders"}`,
      (row) => `${totalCount ? Math.round(row.count / totalCount * 100) : 0}% of orders`
    )
    : '<div class="analytics-empty">No order data in this date range.</div>';
  return `<article class="panel analytics-performance-card">
    <header class="panel-header"><div class="panel-heading"><h3>${title}</h3><p>${subtitle}</p></div></header>
    ${list}
  </article>`;
}

function renderProducts(report) {
  if (!report.topProducts.length) {
    return '<div class="analytics-empty">No products sold on qualifying paid orders in this date range.</div>';
  }
  return `<ol class="analytics-ranked-list">${report.topProducts.map((product, index) => `<li class="analytics-ranked-row">
    <span class="analytics-rank" aria-label="Rank ${index + 1}">${String(index + 1).padStart(2, "0")}</span>
    <span class="analytics-ranked-copy"><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.sku || "Product snapshot")}</small></span>
    <span class="analytics-ranked-values"><strong>${formatNumber(product.quantity)} ${product.quantity === 1 ? "unit" : "units"}</strong><small>${formatMoney(product.revenueCents)}</small></span>
  </li>`).join("")}</ol>`;
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function renderCustomerInsights(report) {
  const insight = report.customers;
  const topCustomers = insight.topCustomers.length
    ? `<ol class="analytics-ranked-list">${insight.topCustomers.map((customer, index) => `<li class="analytics-ranked-row">
        <span class="analytics-rank" aria-label="Rank ${index + 1}">${String(index + 1).padStart(2, "0")}</span>
        <span class="analytics-ranked-copy analytics-customer-copy"><span class="customer-avatar" aria-hidden="true">${escapeHTML(initials(customer.name))}</span><strong>${escapeHTML(customer.name)}</strong></span>
        <span class="analytics-ranked-values"><strong>${formatNumber(customer.orderCount)} ${customer.orderCount === 1 ? "order" : "orders"}</strong><small>${formatMoney(customer.revenueCents)}</small></span>
      </li>`).join("")}</ol>`
    : '<div class="analytics-empty">No paid customer purchases could be linked in this date range.</div>';

  return `<div class="analytics-customer-summary">
      <div><span>New customers</span><strong>${formatNumber(insight.newCustomers)}</strong></div>
      <div><span>Returning customers</span><strong>${formatNumber(insight.returningCustomers)}</strong></div>
      <div class="analytics-average-spend"><span>Average spend per active customer</span><strong>${formatMoney(insight.averageSpendCents)}</strong></div>
    </div>
    <p class="analytics-customer-note">New customers made their first qualifying paid purchase in this period. Returning customers purchased in this period and had an earlier paid purchase. Average spend includes linked customers with a qualifying purchase.</p>
    ${insight.unmatchedOrderCount
      ? `<p class="analytics-customer-note">${formatNumber(insight.unmatchedOrderCount)} qualifying paid order${insight.unmatchedOrderCount === 1 ? " is" : "s are"} not linked to saved customers and ${insight.unmatchedOrderCount === 1 ? "is" : "are"} excluded from customer insights.</p>`
      : ""}
    <div class="analytics-top-customers">
      <div class="analytics-subheading"><h4>Top customers</h4><span>By paid revenue</span></div>
      ${topCustomers}
    </div>`;
}

function repositoryWarnings(repositories) {
  const warnings = repositories
    .map((repository) => repository.getWarning?.())
    .filter(Boolean);
  return warnings;
}

export function initAnalytics(root, orderRepository, productRepository, customerRepository, defaultRange = "30") {
  const selectedRange = ["7", "30", "90", "year", "all"].includes(defaultRange) ? defaultRange : "30";
  root.innerHTML = `<section class="analytics-page" aria-labelledby="analyticsIntroTitle">
    <header class="analytics-intro">
      <div><h2 id="analyticsIntroTitle">Analytics</h2><p>Understand store performance using your saved orders and customer records.</p></div>
      <label class="date-control analytics-date-control">${icon("calendar")}
        <span class="sr-only">Analytics date range</span>
        <select id="analyticsRange" aria-label="Analytics date range">
          <option value="7" ${selectedRange === "7" ? "selected" : ""}>Last 7 days</option>
          <option value="30" ${selectedRange === "30" ? "selected" : ""}>Last 30 days</option>
          <option value="90" ${selectedRange === "90" ? "selected" : ""}>Last 90 days</option>
          <option value="year" ${selectedRange === "year" ? "selected" : ""}>This year</option>
          <option value="all" ${selectedRange === "all" ? "selected" : ""}>All time</option>
        </select>
      </label>
    </header>
    <p class="analytics-data-note">Revenue and units sold include Paid orders only; Cancelled, Unpaid, and Refunded orders are excluded. Total order and status counts include cancelled orders.</p>
    <div class="product-notice analytics-storage-notice" id="analyticsStorageNotice" role="status" hidden></div>
    <section class="metric-grid analytics-metrics" id="analyticsMetrics" aria-label="Analytics overview"></section>
    <section class="panel analytics-revenue-panel" aria-label="Revenue trend">
      <header class="panel-header"><div class="panel-heading"><h3>Revenue trend</h3><p id="analyticsChartSubtitle"></p></div><span class="analytics-chart-total" id="analyticsChartTotal"></span></header>
      <div class="analytics-chart-frame" id="analyticsChart" role="region" aria-label="Scrollable revenue trend chart" tabindex="0"></div>
    </section>
    <section class="analytics-performance-grid" aria-label="Sales performance">
      <div id="analyticsPaymentMethods"></div>
      <div id="analyticsOrderStatuses"></div>
      <div id="analyticsPaymentStatuses"></div>
    </section>
    <section class="analytics-insights-grid" aria-label="Product and customer insights">
      <article class="panel analytics-insight-panel">
        <header class="panel-header"><div class="panel-heading"><h3>Top products</h3><p>Ranked by units from qualifying paid orders</p></div></header>
        <div id="analyticsTopProducts"></div>
      </article>
      <article class="panel analytics-insight-panel">
        <header class="panel-header"><div class="panel-heading"><h3>Customer insights</h3><p>Based on linked, qualifying paid purchases</p></div></header>
        <div id="analyticsCustomerInsights"></div>
      </article>
    </section>
  </section>`;

  const rangeSelect = root.querySelector("#analyticsRange");
  const metrics = root.querySelector("#analyticsMetrics");
  const chartSubtitle = root.querySelector("#analyticsChartSubtitle");
  const chartTotal = root.querySelector("#analyticsChartTotal");
  const chart = root.querySelector("#analyticsChart");
  const storageNotice = root.querySelector("#analyticsStorageNotice");
  const paymentMethods = root.querySelector("#analyticsPaymentMethods");
  const orderStatuses = root.querySelector("#analyticsOrderStatuses");
  const paymentStatuses = root.querySelector("#analyticsPaymentStatuses");
  const topProducts = root.querySelector("#analyticsTopProducts");
  const customerInsights = root.querySelector("#analyticsCustomerInsights");

  function update() {
    const report = buildAnalyticsReport({
      orders: orderRepository.getAll(),
      products: productRepository.getAll(),
      customers: customerRepository.getAll(),
      range: rangeSelect.value
    });
    metrics.innerHTML = renderMetrics(report);
    chartSubtitle.textContent = `${report.rangeLabel} · paid revenue, excluding cancelled and refunded orders`;
    chartTotal.textContent = formatMoney(report.revenueCents);
    chart.innerHTML = renderRevenueChart(report);
    paymentMethods.innerHTML = renderPaymentMethodPanel(report);
    orderStatuses.innerHTML = renderStatusPanel(
      "Orders by status",
      "All orders in this date range",
      report.statusCounts,
      report.totalOrders
    );
    paymentStatuses.innerHTML = renderStatusPanel(
      "Payment status",
      "Counts include cancelled orders",
      report.paymentStatusCounts,
      report.totalOrders
    );
    topProducts.innerHTML = renderProducts(report);
    customerInsights.innerHTML = renderCustomerInsights(report);

    const warnings = repositoryWarnings([orderRepository, productRepository, customerRepository]);
    storageNotice.hidden = warnings.length === 0;
    storageNotice.textContent = warnings.length
      ? "Some saved data could not be loaded. Analytics are using the data currently available."
      : "";
  }

  rangeSelect.addEventListener("change", update);
  update();
  return () => rangeSelect.removeEventListener("change", update);
}
