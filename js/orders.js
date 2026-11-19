import {
  commitOrderAndInventory,
  createOrderId,
  createOrderNumber,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES
} from "./order-storage.js";
import {
  findMatchingCustomer,
  isValidCustomerEmail,
  isValidCustomerPhone
} from "./customer-storage.js";
import { formatCurrency, formatDate as formatUserDate, formatNumber } from "./formatting.js";

const editableStatuses = ["Pending", "Processing"];

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
  return Math.round((value + Number.EPSILON) * 100);
}

function fromCents(value) {
  return value / 100;
}

function formatDate(value) {
  return formatUserDate(value);
}

function statusClass(value) {
  return value.toLocaleLowerCase().replace(/\s+/g, "-");
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function orderItemCount(order) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function renderOrderRow(order) {
  const canEdit = order.inventoryApplied && editableStatuses.includes(order.orderStatus);
  const canCancel = order.orderStatus !== "Delivered" && order.orderStatus !== "Cancelled";
  const editReason = !order.inventoryApplied
    ? "Demo orders do not reserve inventory and cannot be edited."
    : order.orderStatus === "Shipped"
    ? "Shipped orders cannot be edited because fulfillment has started."
    : order.orderStatus === "Delivered"
      ? "Delivered orders cannot be edited."
      : order.orderStatus === "Cancelled"
        ? "Cancelled orders cannot be edited."
        : "";
  const cancelReason = order.orderStatus === "Delivered"
    ? "Delivered orders cannot be cancelled."
    : order.orderStatus === "Cancelled"
      ? "This order is already cancelled."
      : "";

  return `<tr>
    <td><strong class="order-number">${escapeHTML(order.orderNumber)}</strong></td>
    <td><span class="order-customer"><span class="customer-avatar" aria-hidden="true">${escapeHTML(initials(order.customerName))}</span><span><strong>${escapeHTML(order.customerName)}</strong>${order.customerEmail ? `<small>${escapeHTML(order.customerEmail)}</small>` : ""}</span></span></td>
    <td>${escapeHTML(formatDate(order.createdAt))}</td>
    <td>${formatNumber(orderItemCount(order))}</td>
    <td class="order-amount">${formatCurrency(order.total)}</td>
    <td><span class="order-payment-method">${escapeHTML(order.paymentMethod)}</span><span class="order-payment-badge order-payment-badge--${statusClass(order.paymentStatus)}">${escapeHTML(order.paymentStatus)}</span></td>
    <td><span class="order-status-badge order-status-badge--${statusClass(order.orderStatus)}">${escapeHTML(order.orderStatus)}</span></td>
    <td><div class="order-row-actions">
      <button class="order-action-button" type="button" data-view-order="${escapeHTML(order.id)}" aria-label="View ${escapeHTML(order.orderNumber)}">View</button>
      <button class="order-action-button" type="button" data-edit-order="${escapeHTML(order.id)}" aria-label="Edit ${escapeHTML(order.orderNumber)}"${canEdit ? "" : ` disabled title="${escapeHTML(editReason)}"`}>Edit</button>
      <button class="order-action-button order-action-button--cancel" type="button" data-cancel-order="${escapeHTML(order.id)}" aria-label="Cancel ${escapeHTML(order.orderNumber)}"${canCancel ? "" : ` disabled title="${escapeHTML(cancelReason)}"`}>Cancel</button>
    </div></td>
  </tr>`;
}

function renderSelectOptions(values, selectedValue) {
  return values.map((value) => `<option value="${escapeHTML(value)}"${value === selectedValue ? " selected" : ""}>${escapeHTML(value)}</option>`).join("");
}

function getAllowedStatusChanges(status) {
  const transitions = {
    Pending: ["Processing"],
    Processing: ["Shipped"],
    Shipped: ["Delivered"],
    Delivered: [],
    Cancelled: []
  };
  return [status, ...transitions[status]];
}

export function initOrders(
  root,
  orderRepository,
  productRepository,
  onDataChanged = () => {},
  customerRepository = null,
  initialOrderId = ""
) {
  root.innerHTML = `<section class="orders-page" aria-labelledby="ordersIntroTitle">
    <header class="orders-intro">
      <div><h2 id="ordersIntroTitle">Orders</h2><p>Review customer purchases and keep fulfillment moving.</p></div>
      <button class="button-primary" id="createOrderButton" type="button">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Create order
      </button>
    </header>

    <section class="product-stats order-stats" id="orderStats" aria-label="Order summary"></section>
    <p class="product-notice" id="orderNotice" role="status" aria-live="polite" hidden></p>
    <section class="panel orders-management-panel" aria-label="Order records">
      <div class="orders-toolbar">
        <label class="product-search order-search">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
          <span class="sr-only">Search orders by number or customer</span>
          <input id="ordersSearch" type="search" placeholder="Search orders or customers..." autocomplete="off">
        </label>
        <label class="product-filter"><span class="sr-only">Filter by order status</span><select id="orderStatusFilter"><option value="">All order statuses</option>${renderSelectOptions(ORDER_STATUSES, "")}</select></label>
        <label class="product-filter"><span class="sr-only">Filter by payment status</span><select id="paymentStatusFilter"><option value="">All payment statuses</option>${renderSelectOptions(PAYMENT_STATUSES, "")}</select></label>
        <label class="product-filter"><span class="sr-only">Filter by payment method</span><select id="paymentMethodFilter"><option value="">All payment methods</option>${renderSelectOptions(PAYMENT_METHODS, "")}</select></label>
        <label class="product-filter order-date-filter"><span class="sr-only">Orders from date</span><input id="orderDateFrom" type="date" aria-label="Orders from date"></label>
        <label class="product-filter order-date-filter"><span class="sr-only">Orders through date</span><input id="orderDateTo" type="date" aria-label="Orders through date"></label>
        <label class="product-filter"><span class="sr-only">Sort orders</span><select id="orderSort">
          <option value="date-desc">Date: newest first</option>
          <option value="date-asc">Date: oldest first</option>
          <option value="total-desc">Total: high to low</option>
          <option value="total-asc">Total: low to high</option>
        </select></label>
        <button class="button-text" id="clearOrderFilters" type="button" hidden>Clear filters</button>
      </div>
      <div class="order-table-wrap" role="region" aria-label="Scrollable orders table" tabindex="0">
        <table class="management-orders-table">
          <thead><tr>
            <th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Date</th>
            <th scope="col">Items</th><th scope="col">Total</th><th scope="col">Payment</th>
            <th scope="col">Order status</th><th scope="col">Actions</th>
          </tr></thead>
          <tbody id="ordersTableBody"></tbody>
        </table>
        <div class="order-empty product-empty" id="ordersEmpty" hidden></div>
      </div>
      <div class="orders-table-footer" id="ordersTableFooter"></div>
    </section>

    <dialog class="product-dialog order-dialog" id="orderFormDialog" aria-labelledby="orderFormTitle">
      <form class="product-form order-form" id="orderForm" novalidate>
        <header class="product-dialog-header">
          <div><span class="eyebrow">ORDER MANAGEMENT</span><h2 id="orderFormTitle">Create order</h2></div>
          <button class="icon-button product-dialog-close" id="closeOrderForm" type="button" aria-label="Close order form">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="order-form-content">
          <div class="product-form-fields">
            <div class="product-form-field product-form-field--full" id="orderCustomerRecordField">
              <label for="orderCustomerRecord">Customer record <span>Optional</span></label>
              <select id="orderCustomerRecord" name="customerRecord" aria-describedby="orderCustomerRecordHint"></select>
              <small class="order-customer-link-hint" id="orderCustomerRecordHint">Choose a saved customer, or enter customer details manually.</small>
            </div>
            <div class="product-form-field">
              <label for="orderCustomerName">Customer name <span aria-hidden="true">*</span></label>
              <input id="orderCustomerName" name="customerName" type="text" maxlength="100" autocomplete="name" required aria-describedby="orderCustomerNameError">
              <p class="field-error" id="orderCustomerNameError"></p>
            </div>
            <div class="product-form-field">
              <label for="orderCustomerEmail">Customer email <span>Optional</span></label>
              <input id="orderCustomerEmail" name="customerEmail" type="email" maxlength="160" autocomplete="email" aria-describedby="orderCustomerEmailError">
              <p class="field-error" id="orderCustomerEmailError"></p>
            </div>
            <div class="product-form-field">
              <label for="orderCustomerPhone">Customer phone <span>Optional</span></label>
              <input id="orderCustomerPhone" name="customerPhone" type="tel" maxlength="40" autocomplete="tel" aria-describedby="orderCustomerPhoneError">
              <p class="field-error" id="orderCustomerPhoneError"></p>
            </div>
            <div class="product-form-field">
              <label for="orderPaymentMethod">Payment method</label>
              <select id="orderPaymentMethod" name="paymentMethod" aria-describedby="orderPaymentMethodError">${renderSelectOptions(PAYMENT_METHODS, "Card")}</select>
              <p class="field-error" id="orderPaymentMethodError"></p>
            </div>
            <div class="product-form-field">
              <label for="orderPaymentStatus">Payment status</label>
              <select id="orderPaymentStatus" name="paymentStatus" aria-describedby="orderPaymentStatusError">${renderSelectOptions(PAYMENT_STATUSES, "Unpaid")}</select>
              <p class="field-error" id="orderPaymentStatusError"></p>
            </div>
            <div class="product-form-field">
              <label for="orderOrderStatus">Order status</label>
              <select id="orderOrderStatus" name="orderStatus" aria-describedby="orderOrderStatusError">${renderSelectOptions(ORDER_STATUSES.filter((status) => status !== "Cancelled"), "Pending")}</select>
              <p class="field-error" id="orderOrderStatusError"></p>
            </div>
          </div>

          <section class="order-items-section" aria-labelledby="orderItemsTitle">
            <div class="order-section-heading"><div><h3 id="orderItemsTitle">Items</h3><p>Select products from your current catalog.</p></div><button class="button-secondary order-add-item" id="addOrderItem" type="button">Add product</button></div>
            <p class="field-error order-items-error" id="orderItemsError"></p>
            <div class="order-items-list" id="orderItemsList"></div>
          </section>

          <div class="product-form-fields order-extra-fields">
            <div class="product-form-field">
              <label for="orderDiscount">Discount (USD)</label>
              <input id="orderDiscount" name="discount" type="number" min="0" step="0.01" inputmode="decimal" value="0" aria-describedby="orderDiscountError">
              <p class="field-error" id="orderDiscountError"></p>
            </div>
            <div class="product-form-field product-form-field--full">
              <label for="orderNotes">Notes <span>Optional</span></label>
              <textarea id="orderNotes" name="notes" rows="3" maxlength="1000"></textarea>
            </div>
          </div>

          <section class="order-live-summary" id="orderLiveSummary" aria-live="polite" aria-label="Order total summary"></section>
          <p class="product-form-feedback" id="orderFormFeedback" role="alert"></p>
        </div>
        <footer class="product-form-actions">
          <button class="button-secondary" id="cancelOrderForm" type="button">Cancel</button>
          <button class="button-primary" id="saveOrderButton" type="submit">Save order</button>
        </footer>
      </form>
    </dialog>

    <dialog class="product-dialog order-details-dialog" id="orderDetailsDialog" aria-labelledby="orderDetailsTitle">
      <div class="order-details-shell">
        <header class="product-dialog-header">
          <div><span class="eyebrow">ORDER DETAILS</span><h2 id="orderDetailsTitle">Order</h2></div>
          <button class="icon-button product-dialog-close" id="closeOrderDetails" type="button" aria-label="Close order details">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="order-details-content" id="orderDetailsContent"></div>
      </div>
    </dialog>
  </section>`;

  const stats = root.querySelector("#orderStats");
  const notice = root.querySelector("#orderNotice");
  const tableBody = root.querySelector("#ordersTableBody");
  const emptyState = root.querySelector("#ordersEmpty");
  const table = root.querySelector(".management-orders-table");
  const tableFooter = root.querySelector("#ordersTableFooter");
  const search = root.querySelector("#ordersSearch");
  const orderStatusFilter = root.querySelector("#orderStatusFilter");
  const paymentStatusFilter = root.querySelector("#paymentStatusFilter");
  const paymentMethodFilter = root.querySelector("#paymentMethodFilter");
  const dateFromFilter = root.querySelector("#orderDateFrom");
  const dateToFilter = root.querySelector("#orderDateTo");
  const sortSelect = root.querySelector("#orderSort");
  const clearFiltersButton = root.querySelector("#clearOrderFilters");
  const formDialog = root.querySelector("#orderFormDialog");
  const form = root.querySelector("#orderForm");
  const formFeedback = root.querySelector("#orderFormFeedback");
  const saveButton = root.querySelector("#saveOrderButton");
  const itemsList = root.querySelector("#orderItemsList");
  const itemsError = root.querySelector("#orderItemsError");
  const customerRecordSelect = root.querySelector("#orderCustomerRecord");
  const customerRecordHint = root.querySelector("#orderCustomerRecordHint");
  const detailsDialog = root.querySelector("#orderDetailsDialog");
  const detailsContent = root.querySelector("#orderDetailsContent");
  let orders = orderRepository.getAll();
  let products = productRepository.getAll();
  let selectedLines = [];
  let editingOrder = null;
  let activeDetailsOrderId = "";
  let isSaving = false;
  const createCustomerValue = "__create_customer__";

  if (!customerRepository) root.querySelector("#orderCustomerRecordField").hidden = true;

  function getSavedCustomers() {
    return customerRepository ? customerRepository.getAll() : [];
  }

  function refreshCustomerOptions(selectedCustomerId = "", allowCreate = true) {
    if (!customerRepository) return;
    const savedCustomers = getSavedCustomers().slice().sort((first, second) => first.name.localeCompare(second.name));
    customerRecordSelect.innerHTML = `<option value="">Enter customer details manually</option>
      ${savedCustomers.map((customer) => {
        const contact = customer.email || customer.phone || "No contact details";
        return `<option value="existing:${escapeHTML(customer.id)}">${escapeHTML(customer.name)} · ${escapeHTML(contact)}</option>`;
      }).join("")}
      ${allowCreate ? `<option value="${createCustomerValue}">Save as a new customer</option>` : ""}`;
    customerRecordSelect.value = selectedCustomerId ? `existing:${selectedCustomerId}` : "";
  }

  function applyCustomerSelection(value, preserveOrderSnapshot = false) {
    const nameField = form.elements.namedItem("customerName");
    const emailField = form.elements.namedItem("customerEmail");
    const phoneField = form.elements.namedItem("customerPhone");
    const existingId = value.startsWith("existing:") ? value.slice("existing:".length) : "";
    const customer = existingId ? getSavedCustomers().find((item) => item.id === existingId) : null;
    if (customer) {
      if (!preserveOrderSnapshot) {
        nameField.value = customer.name;
        emailField.value = customer.email;
        phoneField.value = customer.phone;
      }
      nameField.readOnly = true;
      emailField.readOnly = true;
      phoneField.readOnly = true;
      customerRecordHint.textContent = preserveOrderSnapshot
        ? "This order keeps its saved customer snapshots; profile edits will not change this order."
        : "Contact details are saved as snapshots on the order.";
      return;
    }

    nameField.readOnly = false;
    emailField.readOnly = false;
    phoneField.readOnly = false;
    customerRecordHint.textContent = value === createCustomerValue
      ? "A new customer record will be saved with this order unless the contact details match an existing customer."
      : "Enter customer details manually. Matching email or phone details will link to an existing customer.";
  }

  function showNotice(message, type = "success") {
    notice.textContent = message;
    notice.className = `product-notice product-notice--${type}`;
    notice.hidden = !message;
  }

  function updateStats() {
    const paidRevenue = orders
      .filter((order) => order.paymentStatus === "Paid" && order.orderStatus !== "Cancelled")
      .reduce((sum, order) => sum + toCents(order.total), 0);
    const pending = orders.filter((order) => order.orderStatus === "Pending").length;
    const eligibleOrders = orders.filter((order) => order.orderStatus !== "Cancelled" && order.paymentStatus !== "Refunded");
    const average = eligibleOrders.length
      ? fromCents(Math.round(eligibleOrders.reduce((sum, order) => sum + toCents(order.total), 0) / eligibleOrders.length))
      : 0;

    stats.innerHTML = [
      `<article class="product-stat-card"><div class="product-stat-heading"><span>Total orders</span><span class="product-stat-mark product-stat-mark--forest" aria-hidden="true"></span></div><strong>${formatNumber(orders.length)}</strong><small>Including cancelled orders</small></article>`,
      `<article class="product-stat-card"><div class="product-stat-heading"><span>Paid revenue</span><span class="product-stat-mark product-stat-mark--sage" aria-hidden="true"></span></div><strong>${formatCurrency(fromCents(paidRevenue))}</strong><small>Paid, excluding cancelled and refunded</small></article>`,
      `<article class="product-stat-card"><div class="product-stat-heading"><span>Pending orders</span><span class="product-stat-mark product-stat-mark--amber" aria-hidden="true"></span></div><strong>${formatNumber(pending)}</strong><small>Awaiting fulfillment</small></article>`,
      `<article class="product-stat-card"><div class="product-stat-heading"><span>Average order value</span><span class="product-stat-mark product-stat-mark--clay" aria-hidden="true"></span></div><strong>${formatCurrency(average)}</strong><small>Excludes cancelled and refunded</small></article>`
    ].join("");
  }

  function getVisibleOrders() {
    const query = search.value.trim().toLocaleLowerCase();
    const status = orderStatusFilter.value;
    const paymentStatus = paymentStatusFilter.value;
    const paymentMethod = paymentMethodFilter.value;
    const dateFrom = dateFromFilter.value;
    const dateTo = dateToFilter.value;

    const visible = orders.filter((order) => {
      const matchesQuery = !query || `${order.orderNumber} ${order.customerName}`.toLocaleLowerCase().includes(query);
      const orderDate = order.createdAt.slice(0, 10);
      return matchesQuery
        && (!status || order.orderStatus === status)
        && (!paymentStatus || order.paymentStatus === paymentStatus)
        && (!paymentMethod || order.paymentMethod === paymentMethod)
        && (!dateFrom || orderDate >= dateFrom)
        && (!dateTo || orderDate <= dateTo);
    });

    const comparators = {
      "date-desc": (first, second) => second.createdAt.localeCompare(first.createdAt),
      "date-asc": (first, second) => first.createdAt.localeCompare(second.createdAt),
      "total-desc": (first, second) => second.total - first.total || second.createdAt.localeCompare(first.createdAt),
      "total-asc": (first, second) => first.total - second.total || second.createdAt.localeCompare(first.createdAt)
    };
    return visible.sort(comparators[sortSelect.value] || comparators["date-desc"]);
  }

  function updateRows() {
    const visible = getVisibleOrders();
    tableBody.innerHTML = visible.map(renderOrderRow).join("");
    table.hidden = visible.length === 0;
    emptyState.hidden = visible.length > 0;
    emptyState.textContent = orders.length === 0
      ? "There are no saved orders yet. Create an order to get started."
      : "No orders match these filters. Try changing your search or clearing the filters.";
    tableFooter.textContent = `Showing ${formatNumber(visible.length)} of ${formatNumber(orders.length)} orders`;

    const hasFilters = Boolean(
      search.value.trim()
      || orderStatusFilter.value
      || paymentStatusFilter.value
      || paymentMethodFilter.value
      || dateFromFilter.value
      || dateToFilter.value
      || sortSelect.value !== "date-desc"
    );
    clearFiltersButton.hidden = !hasFilters;
  }

  function refreshOrders() {
    orders = orderRepository.getAll();
    products = productRepository.getAll();
    updateStats();
    updateRows();
    const warnings = [orderRepository.getWarning(), productRepository.getWarning()].filter(Boolean);
    showNotice(warnings.join(" "), warnings.length ? "warning" : "success");
  }

  function clearFormValidation() {
    form.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
    form.querySelectorAll("[aria-invalid='true']").forEach((field) => field.removeAttribute("aria-invalid"));
    formFeedback.textContent = "";
  }

  function setFieldError(field, errorElement, message) {
    field.setAttribute("aria-invalid", "true");
    errorElement.textContent = message;
    return field;
  }

  function getOriginalQuantity(productId) {
    if (!editingOrder) return 0;
    const item = editingOrder.items.find((orderItem) => orderItem.productId === productId);
    return item ? item.quantity : 0;
  }

  function getAvailableQuantity(product) {
    return product.quantity + getOriginalQuantity(product.id);
  }

  function getProductSnapshot(product) {
    const previousItem = editingOrder?.items.find((item) => item.productId === product.id);
    return previousItem
      ? { productName: previousItem.productName, sku: previousItem.sku, unitPrice: previousItem.unitPrice }
      : { productName: product.name, sku: product.sku, unitPrice: product.price };
  }

  function getSelectedProductIds(exceptIndex = -1) {
    return new Set(selectedLines.filter((line, index) => index !== exceptIndex && line.productId).map((line) => line.productId));
  }

  function renderOrderLines() {
    if (!selectedLines.length) {
      itemsList.innerHTML = '<p class="order-no-items">No products added yet. Choose a product to begin.</p>';
      updateOrderSummary();
      return;
    }

    itemsList.innerHTML = selectedLines.map((line, index) => {
      const selectedIds = getSelectedProductIds(index);
      const selectedProduct = products.find((product) => product.id === line.productId);
      const options = products.map((product) => {
        const available = getAvailableQuantity(product);
        const disabled = (available < 1 && product.id !== line.productId) || selectedIds.has(product.id);
        const snapshot = getProductSnapshot(product);
        const label = `${snapshot.productName} · ${formatCurrency(snapshot.unitPrice)} · ${formatNumber(available)} available`;
        return `<option value="${escapeHTML(product.id)}"${product.id === line.productId ? " selected" : ""}${disabled ? " disabled" : ""}>${escapeHTML(label)}</option>`;
      }).join("");
      const available = selectedProduct ? getAvailableQuantity(selectedProduct) : 0;
      const snapshot = selectedProduct ? getProductSnapshot(selectedProduct) : null;
      return `<div class="order-item-line" data-order-line="${index}">
        <div class="order-line-product">
          <label for="orderProduct-${index}">Product <span aria-hidden="true">*</span></label>
          <select id="orderProduct-${index}" data-line-product="${index}" aria-label="Product for item ${index + 1}" aria-describedby="orderLineError-${index}">
            <option value="">Choose a product</option>${options}
          </select>
          <small class="order-line-availability">${selectedProduct ? `${formatNumber(available)} available · ${formatCurrency(snapshot.unitPrice)} each` : "Select an in-stock product"}</small>
        </div>
        <div class="order-line-quantity">
          <label for="orderQuantity-${index}">Quantity <span aria-hidden="true">*</span></label>
          <input id="orderQuantity-${index}" type="number" min="1" step="1" inputmode="numeric" value="${escapeHTML(line.quantity)}" max="${available || 1}" data-line-quantity="${index}" aria-describedby="orderLineError-${index}">
          <p class="field-error" id="orderLineError-${index}"></p>
        </div>
        <button class="product-action-button product-action-button--delete order-remove-item" type="button" data-remove-line="${index}" aria-label="Remove item ${index + 1}" title="Remove item">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>
        </button>
      </div>`;
    }).join("");

    itemsError.textContent = "";
    updateOrderSummary();
  }

  function updateOrderSummary() {
    const lines = selectedLines.map((line) => {
      const product = products.find((item) => item.id === line.productId);
      const quantity = Number(line.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1) return null;
      const snapshot = getProductSnapshot(product);
      return { quantity, lineCents: toCents(snapshot.unitPrice) * quantity };
    }).filter(Boolean);
    const subtotalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);
    const discountText = form.elements.namedItem("discount").value.trim();
    const discount = discountText ? Number(discountText) : 0;
    const discountCents = Number.isFinite(discount) ? toCents(Math.max(0, discount)) : 0;
    const totalCents = Math.max(0, subtotalCents - discountCents);
    const unitCount = lines.reduce((sum, line) => sum + line.quantity, 0);

    root.querySelector("#orderLiveSummary").innerHTML = `<div class="order-summary-lines">
      <span>Products</span><strong>${formatNumber(lines.length)}</strong>
      <span>Units</span><strong>${formatNumber(unitCount)}</strong>
      <span>Subtotal</span><strong>${formatCurrency(fromCents(subtotalCents))}</strong>
      <span>Discount</span><strong>−${formatCurrency(fromCents(discountCents))}</strong>
      <span class="order-summary-total">Order total</span><strong class="order-summary-total">${formatCurrency(fromCents(totalCents))}</strong>
    </div>`;
  }

  function addOrderLine() {
    const availableProduct = products.find((product) => getAvailableQuantity(product) > 0 && !selectedLines.some((line) => line.productId === product.id));
    if (!availableProduct) {
      itemsError.textContent = "There are no additional in-stock products to add.";
      return;
    }
    selectedLines.push({ productId: "", quantity: "1" });
    renderOrderLines();
    const select = itemsList.querySelector(`[data-line-product="${selectedLines.length - 1}"]`);
    if (select) select.focus();
  }

  function clearOrderFilters() {
    search.value = "";
    orderStatusFilter.value = "";
    paymentStatusFilter.value = "";
    paymentMethodFilter.value = "";
    dateFromFilter.value = "";
    dateToFilter.value = "";
    sortSelect.value = "date-desc";
    updateRows();
  }

  function openOrderForm(order = null) {
    products = productRepository.getAll();
    editingOrder = order ? orders.find((item) => item.id === order.id) || null : null;
    if (order && !editingOrder) return;
    if (editingOrder && !editingOrder.inventoryApplied) {
      showNotice("Demo orders do not reserve inventory and cannot be edited. Create a new order to manage stock.", "warning");
      return;
    }
    if (editingOrder && !editableStatuses.includes(editingOrder.orderStatus)) {
      showNotice(editingOrder.orderStatus === "Shipped"
        ? "Shipped orders cannot be edited because fulfillment has started."
        : "Only pending or processing orders can be edited.", "warning");
      return;
    }
    if (editingOrder && editingOrder.items.some((item) => !products.some((product) => product.id === item.productId))) {
      showNotice("This order cannot be edited because one or more products are no longer in the catalog.", "warning");
      return;
    }

    clearFormValidation();
    form.reset();
    form.elements.namedItem("customerName").value = editingOrder?.customerName || "";
    form.elements.namedItem("customerEmail").value = editingOrder?.customerEmail || "";
    form.elements.namedItem("customerPhone").value = editingOrder?.customerPhone || "";
    const savedCustomers = getSavedCustomers();
    const linkedCustomer = editingOrder
      ? savedCustomers.find((customer) => customer.id === editingOrder.customerId)
        || findMatchingCustomer(savedCustomers, editingOrder.customerEmail, editingOrder.customerPhone)
      : null;
    refreshCustomerOptions(linkedCustomer?.id || "", !editingOrder);
    applyCustomerSelection(customerRecordSelect.value, Boolean(editingOrder && linkedCustomer));
    form.elements.namedItem("paymentMethod").value = editingOrder?.paymentMethod || "Card";
    form.elements.namedItem("paymentStatus").value = editingOrder?.paymentStatus || "Unpaid";
    form.elements.namedItem("discount").value = String(editingOrder?.discount || 0);
    form.elements.namedItem("notes").value = editingOrder?.notes || "";
    const statusSelect = form.elements.namedItem("orderStatus");
    const allowedStatuses = editingOrder
      ? getAllowedStatusChanges(editingOrder.orderStatus)
      : ORDER_STATUSES.filter((status) => status !== "Cancelled");
    statusSelect.innerHTML = renderSelectOptions(allowedStatuses, editingOrder?.orderStatus || "Pending");
    selectedLines = editingOrder
      ? editingOrder.items.map((item) => ({ productId: item.productId, quantity: String(item.quantity) }))
      : [{ productId: "", quantity: "1" }];
    root.querySelector("#orderFormTitle").textContent = editingOrder ? `Edit ${editingOrder.orderNumber}` : "Create order";
    saveButton.textContent = editingOrder ? "Save changes" : "Save order";
    renderOrderLines();
    formDialog.showModal();
    form.elements.namedItem("customerName").focus();
  }

  function validateAndBuildItems() {
    const errors = [];
    const productMap = new Map(products.map((product) => [product.id, product]));
    const seenProductIds = new Set();
    const oldQuantities = new Map();
    if (editingOrder) {
      editingOrder.items.forEach((item) => oldQuantities.set(item.productId, item.quantity));
    }

    const items = [];
    selectedLines.forEach((line, index) => {
      const productSelect = itemsList.querySelector(`[data-line-product="${index}"]`);
      const quantityInput = itemsList.querySelector(`[data-line-quantity="${index}"]`);
      const lineError = itemsList.querySelector(`#orderLineError-${index}`);
      const product = productMap.get(line.productId);
      const quantity = Number(line.quantity);
      let message = "";
      let invalidField = productSelect;

      if (!product) message = "Choose a product from the catalog.";
      else if (seenProductIds.has(product.id)) message = "A product can only appear once in an order.";
      else if (!Number.isInteger(quantity) || quantity < 1) {
        message = "Enter a whole-number quantity of at least 1.";
        invalidField = quantityInput;
      } else if (quantity > product.quantity + (oldQuantities.get(product.id) || 0)) {
        message = `Only ${product.quantity + (oldQuantities.get(product.id) || 0)} units are available.`;
        invalidField = quantityInput;
      }
      else {
        const snapshot = getProductSnapshot(product);
        items.push({
          productId: product.id,
          productName: snapshot.productName,
          sku: snapshot.sku,
          unitPrice: snapshot.unitPrice,
          quantity,
          lineTotal: fromCents(toCents(snapshot.unitPrice) * quantity)
        });
        seenProductIds.add(product.id);
      }

      if (message) {
        if (invalidField) setFieldError(invalidField, lineError, message);
        else if (lineError) lineError.textContent = message;
        errors.push({ field: productSelect || quantityInput, message });
      } else {
        productSelect?.removeAttribute("aria-invalid");
        quantityInput?.removeAttribute("aria-invalid");
        if (lineError) lineError.textContent = "";
      }
    });

    if (!selectedLines.length) {
      itemsError.textContent = "Add at least one product to this order.";
      errors.push({ field: root.querySelector("#addOrderItem"), message: itemsError.textContent });
    } else {
      itemsError.textContent = "";
    }

    return { items, errors };
  }

  function handleOrderSubmit(event) {
    event.preventDefault();
    if (isSaving) return;
    clearFormValidation();

    const customerNameField = form.elements.namedItem("customerName");
    const customerEmailField = form.elements.namedItem("customerEmail");
    const customerPhoneField = form.elements.namedItem("customerPhone");
    const discountField = form.elements.namedItem("discount");
    const customerName = customerNameField.value.trim();
    const customerEmail = customerEmailField.value.trim();
    const customerPhone = customerPhoneField.value.trim();
    const customerRecordValue = customerRepository ? customerRecordSelect.value : "";
    const paymentMethod = form.elements.namedItem("paymentMethod").value;
    const paymentStatus = form.elements.namedItem("paymentStatus").value;
    const orderStatus = form.elements.namedItem("orderStatus").value;
    const discountText = discountField.value.trim();
    const discount = discountText ? Number(discountText) : 0;
    const notes = form.elements.namedItem("notes").value.trim();
    let firstInvalid = null;

    function addError(field, errorElement, message) {
      const invalid = setFieldError(field, errorElement, message);
      if (!firstInvalid) firstInvalid = invalid;
    }

    if (!customerName) addError(customerNameField, root.querySelector("#orderCustomerNameError"), "Enter the customer name.");
    if (customerEmail && (!customerEmailField.validity.valid
      || (customerRecordValue === createCustomerValue && !isValidCustomerEmail(customerEmail)))) {
      addError(customerEmailField, root.querySelector("#orderCustomerEmailError"), "Enter a valid email address.");
    }
    if (customerRecordValue === createCustomerValue && customerPhone && !isValidCustomerPhone(customerPhone)) {
      addError(customerPhoneField, root.querySelector("#orderCustomerPhoneError"), "Enter a valid phone number with 7 to 15 digits.");
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) addError(form.elements.namedItem("paymentMethod"), root.querySelector("#orderPaymentMethodError"), "Choose a valid payment method.");
    if (!PAYMENT_STATUSES.includes(paymentStatus)) addError(form.elements.namedItem("paymentStatus"), root.querySelector("#orderPaymentStatusError"), "Choose a valid payment status.");
    if (!ORDER_STATUSES.includes(orderStatus) || orderStatus === "Cancelled") {
      addError(form.elements.namedItem("orderStatus"), root.querySelector("#orderOrderStatusError"), "Choose a valid order status.");
    } else if (editingOrder && !getAllowedStatusChanges(editingOrder.orderStatus).includes(orderStatus)) {
      addError(form.elements.namedItem("orderStatus"), root.querySelector("#orderOrderStatusError"), "This order status change is not allowed.");
    }

    products = productRepository.getAll();
    if (editingOrder && editingOrder.items.some((item) => !products.some((product) => product.id === item.productId))) {
      formFeedback.textContent = "This order includes a product that is no longer in the catalog. Inventory was not changed.";
      return;
    }
    const { items, errors } = validateAndBuildItems();
    if (!firstInvalid && errors.length) firstInvalid = errors[0].field;

    if (!discountText) {
      discountField.value = "0";
    }
    if (!Number.isFinite(discount) || discount < 0) {
      addError(discountField, root.querySelector("#orderDiscountError"), "Discount must be a non-negative amount.");
    } else if (Math.abs(discount * 100 - Math.round(discount * 100)) > 1e-8) {
      addError(discountField, root.querySelector("#orderDiscountError"), "Use no more than two decimal places.");
    }

    const subtotalCents = items.reduce((sum, item) => sum + toCents(item.lineTotal), 0);
    const discountCents = Number.isFinite(discount) ? toCents(discount) : 0;
    if (discountCents > subtotalCents) {
      addError(discountField, root.querySelector("#orderDiscountError"), "Discount cannot be greater than the subtotal.");
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const currentOrders = orderRepository.getAll();
    const existing = editingOrder ? currentOrders.find((order) => order.id === editingOrder.id) : null;
    if (editingOrder && !existing) {
      formFeedback.textContent = "This order is no longer available. Reload the page before making changes.";
      return;
    }

    const oldItems = existing?.items || [];
    let linkedCustomerId = existing?.customerId || "";
    let createCustomerForOrder = false;
    if (customerRepository) {
      if (customerRecordValue.startsWith("existing:")) {
        const selectedCustomerId = customerRecordValue.slice("existing:".length);
        const selectedCustomer = getSavedCustomers().find((customer) => customer.id === selectedCustomerId);
        if (!selectedCustomer) {
          formFeedback.textContent = "The selected customer is no longer available. Reload the page and try again.";
          return;
        }
        linkedCustomerId = selectedCustomer.id;
      } else {
        const matchingCustomer = findMatchingCustomer(getSavedCustomers(), customerEmail, customerPhone);
        linkedCustomerId = matchingCustomer?.id || "";
        createCustomerForOrder = !existing && !matchingCustomer && customerRecordValue === createCustomerValue;
      }
    }

    const stockDeltas = new Map();
    oldItems.forEach((item) => stockDeltas.set(item.productId, (stockDeltas.get(item.productId) || 0) + item.quantity));
    items.forEach((item) => stockDeltas.set(item.productId, (stockDeltas.get(item.productId) || 0) - item.quantity));
    const updatedAt = new Date().toISOString();
    const nextProducts = products.map((product) => {
      const delta = stockDeltas.get(product.id) || 0;
      return delta
        ? { ...product, quantity: product.quantity + delta, updatedAt }
        : product;
    });

    isSaving = true;
    saveButton.disabled = true;
    let createdCustomer = null;
    let nextOrder;
    try {
      if (createCustomerForOrder) {
        createdCustomer = customerRepository.create({
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address: "",
          notes: ""
        });
        linkedCustomerId = createdCustomer.id;
      }

      nextOrder = {
        id: existing?.id || createOrderId(),
        orderNumber: existing?.orderNumber || createOrderNumber(currentOrders),
        ...(linkedCustomerId ? { customerId: linkedCustomerId } : {}),
        customerName,
        customerEmail,
        customerPhone,
        items,
        subtotal: fromCents(subtotalCents),
        discount: fromCents(discountCents),
        total: fromCents(subtotalCents - discountCents),
        paymentMethod,
        paymentStatus,
        orderStatus,
        inventoryApplied: existing ? existing.inventoryApplied : true,
        notes,
        createdAt: existing?.createdAt || updatedAt,
        updatedAt
      };
      const nextOrders = existing
        ? currentOrders.map((order) => order.id === existing.id ? nextOrder : order)
        : [nextOrder, ...currentOrders];
      commitOrderAndInventory(productRepository, orderRepository, nextProducts, nextOrders);
      editingOrder = null;
      if (!existing) clearOrderFilters();
      refreshOrders();
      onDataChanged();
      formDialog.close();
      showNotice(existing ? `${nextOrder.orderNumber} was updated.` : `${nextOrder.orderNumber} was created and inventory was updated.`);
    } catch (error) {
      let message = error.message;
      if (createdCustomer) {
        try {
          customerRepository.delete(createdCustomer.id);
        } catch (rollbackError) {
          message = `${message} The new customer record could not be rolled back: ${rollbackError.message}`;
        }
      }
      formFeedback.textContent = message;
    } finally {
      isSaving = false;
      saveButton.disabled = false;
    }
  }

  function canCancel(order) {
    return order.orderStatus !== "Delivered" && order.orderStatus !== "Cancelled";
  }

  function cancelOrder(orderId) {
    const order = orderRepository.getAll().find((item) => item.id === orderId);
    if (!order) return;
    if (!canCancel(order)) {
      showNotice(order.orderStatus === "Delivered" ? "Delivered orders cannot be cancelled." : "This order has already been cancelled.", "warning");
      return;
    }
    const currentProducts = productRepository.getAll();
    if (order.inventoryApplied && order.items.some((item) => !currentProducts.some((product) => product.id === item.productId))) {
      showNotice("This order cannot be cancelled because a product is no longer in the catalog. Inventory was not changed.", "error");
      return;
    }
    const inventoryMessage = order.inventoryApplied ? " and return its items to inventory" : "";
    if (!window.confirm(`Cancel ${order.orderNumber}${inventoryMessage}?`)) return;

    const updatedAt = new Date().toISOString();
    const quantitiesToRestore = new Map();
    order.items.forEach((item) => quantitiesToRestore.set(item.productId, (quantitiesToRestore.get(item.productId) || 0) + item.quantity));
    const nextProducts = order.inventoryApplied
      ? currentProducts.map((product) => {
        const restored = quantitiesToRestore.get(product.id) || 0;
        return restored
          ? { ...product, quantity: product.quantity + restored, updatedAt }
          : product;
      })
      : currentProducts;
    const nextOrders = orderRepository.getAll().map((item) => item.id === order.id
      ? { ...item, orderStatus: "Cancelled", updatedAt }
      : item);

    try {
      if (order.inventoryApplied) commitOrderAndInventory(productRepository, orderRepository, nextProducts, nextOrders);
      else orderRepository.save(nextOrders);
      refreshOrders();
      onDataChanged();
      if (detailsDialog.open) detailsDialog.close();
      showNotice(order.inventoryApplied
        ? `${order.orderNumber} was cancelled and its inventory was restored.`
        : `${order.orderNumber} was cancelled. Demo inventory was not changed.`);
    } catch (error) {
      showNotice(error.message, "error");
    }
  }

  function renderOrderDetails(order) {
    const itemRows = order.items.map((item) => `<tr>
      <td><strong>${escapeHTML(item.productName)}</strong><small>${escapeHTML(item.sku)}</small></td>
      <td>${formatNumber(item.quantity)}</td>
      <td>${formatCurrency(item.unitPrice)}</td>
      <td>${formatCurrency(item.lineTotal)}</td>
    </tr>`).join("");
    const allowedStatuses = getAllowedStatusChanges(order.orderStatus);
    const isStatusLocked = order.orderStatus === "Cancelled";
    const canEditOrder = order.inventoryApplied
      && editableStatuses.includes(order.orderStatus)
      && !order.items.some((item) => !products.some((product) => product.id === item.productId));
    const editExplanation = !order.inventoryApplied
      ? "This sample order did not reserve inventory and is read-only. Create an order to test inventory changes."
      : order.orderStatus === "Shipped"
      ? "Editing is disabled because shipment has started."
      : order.orderStatus === "Delivered"
        ? "Delivered orders cannot be edited."
        : order.orderStatus === "Cancelled"
          ? "Cancelled orders cannot be edited."
          : canEditOrder
            ? ""
            : "Editing is unavailable because a product is no longer in the catalog.";

    detailsContent.innerHTML = `<div class="order-details-topline">
      <div><span class="order-detail-label">Order number</span><strong>${escapeHTML(order.orderNumber)}</strong></div>
      <div><span class="order-detail-label">Placed</span><strong>${escapeHTML(formatDate(order.createdAt))}</strong></div>
    </div>
    <section class="order-detail-section">
      <h3>Customer</h3>
      <div class="order-detail-customer"><span class="customer-avatar" aria-hidden="true">${escapeHTML(initials(order.customerName))}</span><span><strong>${escapeHTML(order.customerName)}</strong><small>${escapeHTML(order.customerEmail || "No email provided")}${order.customerPhone ? ` · ${escapeHTML(order.customerPhone)}` : ""}</small></span></div>
    </section>
    <section class="order-detail-section">
      <h3>Items</h3>
      <div class="order-detail-items-wrap"><table class="order-detail-items">
        <thead><tr><th scope="col">Product</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table></div>
      <div class="order-detail-totals"><span>Subtotal</span><strong>${formatCurrency(order.subtotal)}</strong><span>Discount</span><strong>−${formatCurrency(order.discount)}</strong><span class="order-detail-grand-total">Total</span><strong class="order-detail-grand-total">${formatCurrency(order.total)}</strong></div>
    </section>
    <form class="order-detail-section order-status-form" id="orderStatusForm">
      <h3>Payment and fulfillment</h3>
      <div class="order-details-controls">
        <label class="product-form-field"><span>Payment method</span><select name="paymentMethod">${renderSelectOptions(PAYMENT_METHODS, order.paymentMethod)}</select></label>
        <label class="product-form-field"><span>Payment status</span><select name="paymentStatus"${isStatusLocked ? " disabled" : ""}>${renderSelectOptions(PAYMENT_STATUSES, order.paymentStatus)}</select></label>
        <label class="product-form-field"><span>Order status</span><select name="orderStatus"${isStatusLocked ? " disabled" : ""}>${renderSelectOptions(allowedStatuses, order.orderStatus)}</select></label>
      </div>
      <p class="order-details-feedback" id="orderDetailsFeedback" role="status"></p>
      <button class="button-secondary" type="submit"${isStatusLocked ? " disabled" : ""}>Save status changes</button>
    </form>
    <section class="order-detail-section">
      <h3>Notes</h3><p class="order-detail-notes">${escapeHTML(order.notes || "No notes for this order.")}</p>
    </section>
    <p class="order-edit-explanation"${editExplanation ? "" : " hidden"}>${escapeHTML(editExplanation)}</p>
    <footer class="order-details-actions">
      <button class="button-secondary" type="button" data-details-edit="${escapeHTML(order.id)}"${canEditOrder ? "" : ` disabled title="${escapeHTML(editExplanation)}"`}>Edit order</button>
      <button class="button-secondary order-cancel-button" type="button" data-details-cancel="${escapeHTML(order.id)}"${canCancel(order) ? "" : " disabled"}>${order.orderStatus === "Cancelled" ? "Cancelled" : "Cancel order"}</button>
    </footer>`;
  }

  function openOrderDetails(orderId) {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    products = productRepository.getAll();
    activeDetailsOrderId = order.id;
    root.querySelector("#orderDetailsTitle").textContent = order.orderNumber;
    renderOrderDetails(order);
    detailsDialog.showModal();
  }

  function saveDetailsChanges(event) {
    if (event.target.id !== "orderStatusForm") return;
    event.preventDefault();
    const order = orderRepository.getAll().find((item) => item.id === activeDetailsOrderId);
    if (!order || order.orderStatus === "Cancelled") return;
    const paymentMethod = event.target.elements.namedItem("paymentMethod").value;
    const paymentStatus = event.target.elements.namedItem("paymentStatus").value;
    const orderStatus = event.target.elements.namedItem("orderStatus").value;
    const feedback = detailsContent.querySelector("#orderDetailsFeedback");

    if (!PAYMENT_METHODS.includes(paymentMethod) || !PAYMENT_STATUSES.includes(paymentStatus)) {
      feedback.textContent = "Choose a valid payment method and payment status.";
      return;
    }
    if (!getAllowedStatusChanges(order.orderStatus).includes(orderStatus)) {
      feedback.textContent = "That order status change is not allowed.";
      return;
    }

    const updatedAt = new Date().toISOString();
    const nextOrder = { ...order, paymentMethod, paymentStatus, orderStatus, updatedAt };
    try {
      orderRepository.save(orderRepository.getAll().map((item) => item.id === order.id ? nextOrder : item));
      refreshOrders();
      onDataChanged();
      renderOrderDetails(nextOrder);
      detailsContent.querySelector("#orderDetailsFeedback").textContent = "Order status and payment details saved.";
    } catch (error) {
      feedback.textContent = error.message;
    }
  }

  function resetFormAfterClose() {
    form.reset();
    clearFormValidation();
    form.elements.namedItem("customerName").readOnly = false;
    form.elements.namedItem("customerEmail").readOnly = false;
    form.elements.namedItem("customerPhone").readOnly = false;
    selectedLines = [];
    editingOrder = null;
    isSaving = false;
    saveButton.disabled = false;
  }

  function closeOpenOrderDialog(event) {
    if (event.key !== "Escape") return;
    if (detailsDialog.open) {
      event.preventDefault();
      detailsDialog.close();
    } else if (formDialog.open) {
      event.preventDefault();
      formDialog.close();
    }
  }

  root.querySelector("#createOrderButton").addEventListener("click", () => openOrderForm());
  root.querySelector("#closeOrderForm").addEventListener("click", () => formDialog.close());
  root.querySelector("#cancelOrderForm").addEventListener("click", () => formDialog.close());
  formDialog.addEventListener("close", resetFormAfterClose);
  formDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      formDialog.close();
    }
  });
  formDialog.addEventListener("click", (event) => {
    if (event.target === formDialog) formDialog.close();
  });
  form.addEventListener("submit", handleOrderSubmit);
  form.addEventListener("input", (event) => {
    if (event.target.matches("[data-line-quantity]")) {
      const index = Number(event.target.dataset.lineQuantity);
      if (selectedLines[index]) selectedLines[index].quantity = event.target.value;
      const error = root.querySelector(`#orderLineError-${index}`);
      if (error) error.textContent = "";
      event.target.removeAttribute("aria-invalid");
    } else if (event.target.id === "orderDiscount") {
      event.target.removeAttribute("aria-invalid");
      root.querySelector("#orderDiscountError").textContent = "";
    } else if (event.target.id === "orderCustomerName" || event.target.id === "orderCustomerEmail" || event.target.id === "orderCustomerPhone") {
      event.target.removeAttribute("aria-invalid");
      root.querySelector(`#${event.target.id}Error`).textContent = "";
    }
    formFeedback.textContent = "";
    updateOrderSummary();
  });
  form.addEventListener("change", (event) => {
    if (event.target.id) {
      const error = root.querySelector(`#${event.target.id}Error`);
      if (error) error.textContent = "";
      event.target.removeAttribute("aria-invalid");
    }
    if (!event.target.matches("[data-line-product]")) return;
    const index = Number(event.target.dataset.lineProduct);
    const line = selectedLines[index];
    if (!line) return;
    const selectedProductId = event.target.value;
    const duplicateIndex = selectedLines.findIndex((otherLine, otherIndex) => otherIndex !== index && otherLine.productId === selectedProductId);
    if (selectedProductId && duplicateIndex !== -1) {
      const combinedQuantity = Number(selectedLines[duplicateIndex].quantity) + Number(line.quantity);
      selectedLines[duplicateIndex].quantity = String(combinedQuantity);
      selectedLines.splice(index, 1);
    } else {
      line.productId = selectedProductId;
    }
    renderOrderLines();
  });
  customerRecordSelect.addEventListener("change", () => {
    applyCustomerSelection(customerRecordSelect.value);
    [ "orderCustomerName", "orderCustomerEmail", "orderCustomerPhone" ].forEach((fieldId) => {
      root.querySelector(`#${fieldId}`).removeAttribute("aria-invalid");
      root.querySelector(`#${fieldId}Error`).textContent = "";
    });
    formFeedback.textContent = "";
  });
  itemsList.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-line]");
    if (!removeButton) return;
    selectedLines.splice(Number(removeButton.dataset.removeLine), 1);
    renderOrderLines();
  });
  root.querySelector("#addOrderItem").addEventListener("click", addOrderLine);
  root.querySelector("#closeOrderDetails").addEventListener("click", () => detailsDialog.close());
  detailsDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      detailsDialog.close();
    }
  });
  detailsDialog.addEventListener("click", (event) => {
    if (event.target === detailsDialog) detailsDialog.close();
  });
  document.addEventListener("keydown", closeOpenOrderDialog);
  detailsContent.addEventListener("submit", saveDetailsChanges);
  detailsContent.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-details-edit]");
    const cancelButton = event.target.closest("[data-details-cancel]");
    if (editButton) {
      const order = orders.find((item) => item.id === editButton.dataset.detailsEdit);
      detailsDialog.close();
      if (order) openOrderForm(order);
    } else if (cancelButton) {
      cancelOrder(cancelButton.dataset.detailsCancel);
    }
  });

  [search, orderStatusFilter, paymentStatusFilter, paymentMethodFilter, dateFromFilter, dateToFilter, sortSelect]
    .forEach((control) => control.addEventListener(control.tagName === "INPUT" ? "input" : "change", updateRows));
  clearFiltersButton.addEventListener("click", clearOrderFilters);
  tableBody.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view-order]");
    const editButton = event.target.closest("[data-edit-order]");
    const cancelButton = event.target.closest("[data-cancel-order]");
    if (viewButton) openOrderDetails(viewButton.dataset.viewOrder);
    else if (editButton && !editButton.disabled) {
      const order = orders.find((item) => item.id === editButton.dataset.editOrder);
      if (order) openOrderForm(order);
    } else if (cancelButton && !cancelButton.disabled) cancelOrder(cancelButton.dataset.cancelOrder);
  });

  updateStats();
  updateRows();
  const warnings = [orderRepository.getWarning(), productRepository.getWarning()].filter(Boolean);
  if (warnings.length) showNotice(warnings.join(" "), "warning");
  if (initialOrderId) openOrderDetails(initialOrderId);

  return () => {
    document.removeEventListener("keydown", closeOpenOrderDialog);
    if (formDialog.open) formDialog.close();
    if (detailsDialog.open) detailsDialog.close();
  };
}
