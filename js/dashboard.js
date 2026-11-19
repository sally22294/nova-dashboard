import { dashboardRanges } from "./data.js";
import { getStockStatus } from "./product-storage.js";
import { formatCurrency, formatDate, formatNumber } from "./formatting.js";

function icon(name) {
  const paths = {
    sales: '<path d="M3 17 9 11l4 4 8-9"/><path d="M15 6h6v6"/>',
    orders: '<path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    average: '<path d="M12 3v18"/><path d="M17 7.5c0-1.7-1.9-3-5-3S7 6 7 8s1.5 3 5 4 5 2.3 5 4.5-2 4-5 4-5-1.5-5-3.5"/>',
    customers: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 11a3.5 3.5 0 0 0 0-7M21 20v-1.5a4 4 0 0 0-3-3.87"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M16 3v4M8 3v4M3.5 10h17"/>',
    alert: '<path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4m0 3h.01"/>'
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${paths[name]}</svg>`;
}

function renderChart(range) {
  const left = 43;
  const right = 610;
  const top = 17;
  const bottom = 178;
  const points = range.chartValues.map((value, index) => {
    const x = left + (right - left) * index / (range.chartValues.length - 1);
    const y = bottom - (bottom - top) * value / 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(" ");
  const area = `${left},${bottom} ${line} ${right},${bottom}`;
  const labels = range.chartLabels.map((label, index) => {
    const x = left + (right - left) * index / (range.chartLabels.length - 1);
    return `<text class="chart-axis-label" x="${x.toFixed(1)}" y="202" text-anchor="middle">${label}</text>`;
  }).join("");
  const yLabels = range.chartTicks.map((label, index) => {
    const y = bottom - (bottom - top) * index / (range.chartTicks.length - 1);
    return `<text class="chart-axis-label" x="5" y="${(y + 3).toFixed(1)}">${label}</text>`;
  }).join("");
  const last = points[points.length - 1].split(",");
  return `<svg class="sales-chart" viewBox="0 0 640 215" role="img" aria-label="Sales trend ${range.label.toLowerCase()}">
    <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#b9cbb9" stop-opacity=".48"/><stop offset="100%" stop-color="#b9cbb9" stop-opacity="0"/></linearGradient></defs>
    <line class="chart-gridline" x1="${left}" y1="18" x2="${right}" y2="18"/><line class="chart-gridline" x1="${left}" y1="72" x2="${right}" y2="72"/><line class="chart-gridline" x1="${left}" y1="125" x2="${right}" y2="125"/><line class="chart-gridline" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"/>
    ${yLabels}<polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${line}"/><circle class="chart-point" cx="${last[0]}" cy="${last[1]}" r="4"/>
    ${labels}
  </svg>`;
}

function renderMetrics(range, totalCustomers) {
  const metrics = [
    { title: "Total sales", value: range.sales, change: range.salesChange, note: "vs. previous period", icon: "sales", tone: "sage" },
    { title: "Orders", value: range.orders, change: range.ordersChange, note: "vs. previous period", icon: "orders", tone: "clay" },
    { title: "Avg. order value", value: range.averageOrder, change: range.averageChange, note: "vs. previous period", icon: "average", tone: "sage" },
    { title: "Customers", value: formatNumber(totalCustomers), change: "", note: "Saved customer profiles", icon: "customers", tone: "clay" }
  ];
  return metrics.map((metric) => `<article class="metric-card">
    <div class="metric-top"><span class="metric-label">${metric.title}</span><span class="metric-icon metric-icon--${metric.tone}">${icon(metric.icon)}</span></div>
    <div class="metric-value">${metric.value}</div>
    <div class="metric-bottom">${metric.change ? `<span class="metric-change">${metric.change}</span>` : ""}<span>${metric.note}</span></div>
  </article>`).join("");
}

function renderOrders(orders) {
  if (!orders.length) return '<div class="empty-state">No saved orders match your search.</div>';
  return `<table class="orders-table">
    <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead>
    <tbody>${orders.map((order) => {
      const statusClass = order.orderStatus.toLowerCase();
      const date = formatDate(order.createdAt);
      const customerInitials = order.customerName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
      return `<tr>
        <td class="order-number">${escapeHTML(order.orderNumber)}</td>
        <td><span class="customer-cell"><span class="customer-avatar" aria-hidden="true">${escapeHTML(customerInitials)}</span><span class="customer-name">${escapeHTML(order.customerName)}</span></span></td>
        <td>${escapeHTML(date)}</td><td class="order-amount">${formatCurrency(order.total)}</td>
        <td><span class="status-badge status--${statusClass}">${escapeHTML(order.orderStatus)}</span></td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderProductSnapshot(products) {
  if (!products.length) return '<div class="empty-state">No products in your catalog yet.</div>';
  const tones = ["sage", "clay", "blue", "gold"];
  return products.slice(0, 4).map((product, index) => {
    const status = getStockStatus(product);
    const initials = product.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
    return `<div class="product-row">
      <span class="product-art product-art--${tones[index % tones.length]}" aria-hidden="true">${escapeHTML(initials)}</span>
      <span class="product-detail"><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.category)} · ${escapeHTML(product.sku)}</small></span>
      <span class="product-sales"><strong>${formatNumber(product.quantity)} in stock</strong><small>${status}</small></span>
    </div>`;
  }).join("");
}

function renderStock(products) {
  const alerts = products
    .filter((product) => getStockStatus(product) !== "In Stock")
    .sort((first, second) => first.quantity - second.quantity || first.name.localeCompare(second.name));
  if (!alerts.length) return { count: 0, content: '<div class="empty-state">All products are above their low-stock thresholds.</div>', message: "Your catalog is comfortably stocked." };

  const content = alerts.slice(0, 4).map((product) => {
    const status = getStockStatus(product);
    const initials = product.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
    const quantity = status === "Out of Stock" ? "Out of stock" : `${product.quantity} left`;
    const quantityClass = status === "Out of Stock" ? "stock-quantity--out" : status === "Low Stock" ? "stock-quantity--warning" : "";
    return `<div class="stock-row">
      <span class="stock-art" aria-hidden="true">${escapeHTML(initials)}</span>
      <span class="stock-info"><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.category)} · threshold ${product.lowStockThreshold}</small></span>
      <span class="stock-quantity ${quantityClass}">${quantity}</span>
    </div>`;
  }).join("");
  return { count: alerts.length, content, message: `${alerts.length} product${alerts.length === 1 ? "" : "s"} need restocking.` };
}

export function initDashboard(root, searchInput, products, orders, totalCustomers = 0) {
  const stock = renderStock(products);
  root.innerHTML = `<section class="dashboard-intro" aria-labelledby="welcomeTitle">
    <div class="welcome-copy"><h2 id="welcomeTitle">Good morning, Alex</h2><p>Sales analytics are illustrative; recent orders and customer counts use saved records.</p></div>
    <label class="date-control">${icon("calendar")}<span class="sr-only">Sales date range</span><select id="dateRange" aria-label="Sales date range"><option value="30">Last 30 days</option><option value="7">Last 7 days</option><option value="90">Last 90 days</option></select></label>
  </section>
  <section class="metric-grid" id="metricGrid" aria-label="Store performance summary"></section>
  <section class="dashboard-grid" aria-label="Sales and product inventory">
    <article class="panel">
      <header class="panel-header"><div class="panel-heading"><h3>Sales overview</h3><p>Illustrative demo analytics, separate from saved orders</p></div><span class="chart-legend">Sales</span><strong class="chart-total" id="chartTotal"></strong></header>
      <div class="chart-frame" id="salesChart"></div><footer class="chart-footer"><span id="chartComparison"></span><strong id="chartChange"></strong></footer>
    </article>
    <article class="panel">
      <header class="panel-header"><div class="panel-heading"><h3>Product snapshot</h3><p>Current items from your catalog</p></div><span class="panel-meta">${Math.min(products.length, 4)} of ${products.length}</span></header>
      <div class="products-list">${renderProductSnapshot(products)}</div>
    </article>
  </section>
  <section class="lower-grid" aria-label="Recent orders and stock alerts">
    <article class="panel">
      <header class="panel-header"><div class="panel-heading"><h3>Recent orders</h3><p>Latest saved order records</p></div><span class="panel-meta">${orders.length} saved</span></header>
      <div class="orders-table-wrap" id="ordersTable" tabindex="0" aria-label="Scrollable recent orders table"></div>
    </article>
    <article class="panel">
      <header class="panel-header"><div class="panel-heading"><h3>Low stock</h3><p>Low and out-of-stock products</p></div><span class="stock-count">${stock.count} items</span></header>
      <div class="stock-list">${stock.content}</div>
      <div class="stock-note">${icon("alert")}<span>${stock.message}</span></div>
    </article>
  </section>`;

  const rangeSelect = root.querySelector("#dateRange");
  const metricGrid = root.querySelector("#metricGrid");
  const chart = root.querySelector("#salesChart");
  const chartTotal = root.querySelector("#chartTotal");
  const chartComparison = root.querySelector("#chartComparison");
  const chartChange = root.querySelector("#chartChange");
  const table = root.querySelector("#ordersTable");

  function updateRange() {
    const range = dashboardRanges[rangeSelect.value];
    metricGrid.innerHTML = renderMetrics(range, totalCustomers);
    chart.innerHTML = renderChart(range);
    chartTotal.textContent = range.chartTotal;
    chartComparison.textContent = range.comparison;
    chartChange.textContent = `${range.salesChange} ↗`;
  }
  function updateOrders() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = orders
      .filter((order) => `${order.orderNumber} ${order.customerName} ${order.orderStatus}`.toLowerCase().includes(query))
      .slice()
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .slice(0, 8);
    table.innerHTML = renderOrders(filtered);
  }

  rangeSelect.addEventListener("change", updateRange);
  searchInput.addEventListener("input", updateOrders);
  updateRange();
  updateOrders();
  return () => searchInput.removeEventListener("input", updateOrders);
}
