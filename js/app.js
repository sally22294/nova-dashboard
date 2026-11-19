import { initDashboard } from "./dashboard.js";
import { initCustomers } from "./customers.js";
import { initInventory } from "./inventory.js";
import { initAnalytics } from "./analytics.js";
import { initSettings } from "./settings.js";
import { createInventoryMovementRepository } from "./inventory-storage.js";
import { initNavigation } from "./navigation.js";
import { createCustomerRepository } from "./customer-storage.js";
import { createOrderRepository } from "./order-storage.js";
import { initOrders } from "./orders.js";
import { createProductRepository, getStockStatus } from "./product-storage.js";
import { initProducts } from "./products.js";
import { createSettingsRepository } from "./settings-storage.js";
import { formatNumber, setFormattingPreferences } from "./formatting.js";

const toastRegion = document.querySelector("#toastRegion");
const productRepository = createProductRepository();
const orderRepository = createOrderRepository();
const customerRepository = createCustomerRepository();
const movementRepository = createInventoryMovementRepository();
const settingsRepository = createSettingsRepository();
const dashboardRoot = document.querySelector("#dashboardRoot");
const pageTitle = document.querySelector("#pageTitle");
const pageContext = document.querySelector("#pageContext");
const storeName = document.querySelector("#storeName");
const orderSearch = document.querySelector("#orderSearch");
const globalSearch = orderSearch.closest(".global-search");
const ordersNavCount = document.querySelector("#ordersNavCount");
const inventoryNavDot = document.querySelector("#inventoryNavDot");
let toastTimer;
let disposeCurrentPage = () => {};
let requestedOrderId = "";

function updateOrderNavigationCount() {
  ordersNavCount.textContent = formatNumber(orderRepository.getAll().length);
}

function updateInventoryNavigationIndicator() {
  const needsAttention = productRepository.getAll().some((product) => getStockStatus(product) !== "In Stock");
  const alertsEnabled = settingsRepository.getNotifications().lowStockAlerts;
  inventoryNavDot.hidden = !needsAttention || !alertsEnabled;
  inventoryNavDot.setAttribute("aria-label", !alertsEnabled
    ? "Low-stock alerts are disabled"
    : needsAttention
      ? "Products need restocking"
      : "All products are above their stock thresholds");
}

function updateApplicationIndicators() {
  updateOrderNavigationCount();
  updateInventoryNavigationIndicator();
}

function showNotice(message) {
  toastRegion.innerHTML = `<div class="toast-message" role="status">${message}</div>`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastRegion.replaceChildren();
  }, 3200);
}

function updatePageContext(page) {
  const pageSections = {
    Dashboard: "OVERVIEW",
    Products: "CATALOG",
    Orders: "ORDERS",
    Inventory: "INVENTORY",
    Customers: "CUSTOMERS",
    Analytics: "ANALYTICS",
    Settings: "SETTINGS"
  };
  const businessName = settingsRepository.getBusiness().name.trim().toLocaleUpperCase();
  pageContext.textContent = `${businessName} / ${pageSections[page] || "OVERVIEW"}`;
}

function applySettings() {
  const settings = settingsRepository.getAll();
  setFormattingPreferences(settings.preferences);
  document.documentElement.dataset.tableDensity = settings.appearance.tableDensity;
  storeName.textContent = settings.business.name;
  updatePageContext(pageTitle.textContent);
}

function onSettingsSaved() {
  applySettings();
  updateApplicationIndicators();
}

function navigateTo(page) {
  disposeCurrentPage();
  window.scrollTo(0, 0);
  pageTitle.textContent = page;
  updatePageContext(page);
  globalSearch.hidden = page !== "Dashboard";
  document.title = `${page} · Nova`;

  if (page === "Products") {
    disposeCurrentPage = initProducts(dashboardRoot, productRepository, updateInventoryNavigationIndicator);
    return;
  }
  if (page === "Orders") {
    const initialOrderId = requestedOrderId;
    requestedOrderId = "";
    disposeCurrentPage = initOrders(
      dashboardRoot,
      orderRepository,
      productRepository,
      updateApplicationIndicators,
      customerRepository,
      initialOrderId
    );
    return;
  }
  if (page === "Inventory") {
    disposeCurrentPage = initInventory(dashboardRoot, productRepository, movementRepository, updateInventoryNavigationIndicator);
    return;
  }
  if (page === "Customers") {
    disposeCurrentPage = initCustomers(
      dashboardRoot,
      customerRepository,
      orderRepository,
      updateApplicationIndicators,
      (orderId) => {
        requestedOrderId = orderId;
        document.querySelector('#sidebar [data-page="Orders"]').click();
      }
    );
    return;
  }
  if (page === "Analytics") {
    disposeCurrentPage = initAnalytics(
      dashboardRoot,
      orderRepository,
      productRepository,
      customerRepository,
      settingsRepository.getPreferences().defaultAnalyticsRange
    );
    return;
  }
  if (page === "Settings") {
    disposeCurrentPage = initSettings(
      dashboardRoot,
      settingsRepository,
      onSettingsSaved,
      () => window.location.reload()
    );
    return;
  }
  disposeCurrentPage = initDashboard(
    dashboardRoot,
    orderSearch,
    productRepository.getAll(),
    orderRepository.getAll(),
    customerRepository.getAll().length
  );
}

applySettings();
updateApplicationIndicators();
initNavigation({
  sidebar: document.querySelector("#sidebar"),
  menuToggle: document.querySelector("#menuToggle"),
  scrim: document.querySelector("#sidebarScrim"),
  onNotice: showNotice,
  onNavigate: navigateTo
});
globalSearch.hidden = true;
navigateTo("Dashboard");

const notificationToggle = document.querySelector("#notificationToggle");
const notificationPanel = document.querySelector("#notificationPanel");
notificationToggle.addEventListener("click", () => {
  const isExpanded = notificationToggle.getAttribute("aria-expanded") === "true";
  notificationToggle.setAttribute("aria-expanded", String(!isExpanded));
  notificationPanel.hidden = isExpanded;
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".notification-wrap")) {
    notificationToggle.setAttribute("aria-expanded", "false");
    notificationPanel.hidden = true;
  }
});
