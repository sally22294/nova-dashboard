import {
  findDuplicateCustomer,
  findMatchingCustomer,
  isValidCustomerEmail,
  isValidCustomerPhone,
  normalizeCustomerPhone
} from "./customer-storage.js";
import { formatCurrency, formatDate as formatUserDate, formatNumber } from "./formatting.js";

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function statusClass(value) {
  return value.toLocaleLowerCase().replace(/\s+/g, "-");
}

function formatDate(value) {
  return value ? formatUserDate(value) : "—";
}

function renderStatCard(label, value, note, tone, extraClass = "") {
  return `<article class="product-stat-card ${extraClass}">
    <div class="product-stat-heading"><span>${label}</span><span class="product-stat-mark product-stat-mark--${tone}" aria-hidden="true"></span></div>
    <strong>${value}</strong>
    <small>${note}</small>
  </article>`;
}

function resolveOrderCustomerId(order, customers) {
  if (order.customerId && customers.some((customer) => customer.id === order.customerId)) {
    return order.customerId;
  }
  return findMatchingCustomer(customers, order.customerEmail, order.customerPhone)?.id || "";
}

function getCustomerOrders(customer, customers, orders) {
  return orders.filter((order) => resolveOrderCustomerId(order, customers) === customer.id);
}

function getCustomerMetrics(customer, customers, orders) {
  const linkedOrders = getCustomerOrders(customer, customers, orders);
  const qualifyingOrders = linkedOrders.filter((order) => order.paymentStatus === "Paid" && order.orderStatus !== "Cancelled");
  const totalSpentCents = qualifyingOrders.reduce((sum, order) => sum + Math.round((order.total + Number.EPSILON) * 100), 0);
  const lastOrder = qualifyingOrders
    .slice()
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0];
  return {
    linkedOrders,
    qualifyingOrders,
    orderCount: qualifyingOrders.length,
    totalSpent: totalSpentCents / 100,
    averageOrderValue: qualifyingOrders.length ? totalSpentCents / 100 / qualifyingOrders.length : 0,
    lastOrderAt: lastOrder?.createdAt || "",
    type: qualifyingOrders.length > 1 ? "Returning" : "New"
  };
}

function renderCustomerRow(customer, metrics) {
  const email = customer.email || "—";
  const phone = customer.phone || "—";
  return `<tr>
    <td><span class="customer-table-person"><span class="customer-avatar" aria-hidden="true">${escapeHTML(initials(customer.name))}</span><strong>${escapeHTML(customer.name)}</strong></span></td>
    <td>${escapeHTML(email)}</td>
    <td>${escapeHTML(phone)}</td>
    <td>${formatNumber(metrics.orderCount)}</td>
    <td class="customer-spend">${formatCurrency(metrics.totalSpent)}</td>
    <td>${escapeHTML(formatDate(metrics.lastOrderAt))}</td>
    <td><span class="customer-type-badge customer-type-badge--${statusClass(metrics.type)}">${metrics.type}</span></td>
    <td><span class="customer-row-actions">
      <button class="customer-action-button" type="button" data-view-customer="${escapeHTML(customer.id)}" aria-label="View ${escapeHTML(customer.name)} details">View</button>
      <button class="customer-action-button" type="button" data-edit-customer="${escapeHTML(customer.id)}" aria-label="Edit ${escapeHTML(customer.name)}">Edit</button>
      <button class="customer-action-button customer-action-button--delete" type="button" data-delete-customer="${escapeHTML(customer.id)}" aria-label="Delete ${escapeHTML(customer.name)}">Delete</button>
    </span></td>
  </tr>`;
}

function orderItemCount(order) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function initCustomers(
  root,
  customerRepository,
  orderRepository,
  onDataChanged = () => {},
  onViewOrder = null
) {
  root.innerHTML = `<section class="customers-page" aria-labelledby="customersIntroTitle">
    <header class="customers-intro">
      <div><h2 id="customersIntroTitle">Customers</h2><p>Know your customers and keep their details in one place.</p></div>
      <button class="button-primary" id="addCustomerButton" type="button">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Add customer
      </button>
    </header>

    <section class="product-stats customer-stats" id="customerStats" aria-label="Customer summary"></section>
    <p class="product-notice" id="customerNotice" role="status" aria-live="polite" hidden></p>
    <p class="customer-analytics-note">Customer purchase metrics include Paid orders only; Cancelled, Unpaid, and Refunded orders are excluded.</p>
    <section class="panel customers-panel" aria-label="Customer records">
      <div class="products-toolbar customers-toolbar">
        <label class="product-search">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
          <span class="sr-only">Search customers by name, email, or phone</span>
          <input id="customerSearch" type="search" placeholder="Search customers..." autocomplete="off">
        </label>
        <label class="product-filter"><span class="sr-only">Filter by customer type</span><select id="customerTypeFilter">
          <option value="">All customer types</option><option value="New">New</option><option value="Returning">Returning</option>
        </select></label>
        <label class="product-filter"><span class="sr-only">Sort customers</span><select id="customerSort">
          <option value="name-asc">Name (A–Z)</option>
          <option value="name-desc">Name (Z–A)</option>
          <option value="spend-desc">Total spent: high to low</option>
          <option value="spend-asc">Total spent: low to high</option>
          <option value="orders-desc">Orders: high to low</option>
          <option value="orders-asc">Orders: low to high</option>
          <option value="recent-desc">Most recent order</option>
          <option value="recent-asc">Oldest last order</option>
        </select></label>
        <button class="button-text" id="clearCustomerFilters" type="button" hidden>Clear filters</button>
      </div>
      <div class="customer-table-wrap" role="region" aria-label="Scrollable customer table" tabindex="0">
        <table class="customers-table">
          <thead><tr>
            <th scope="col">Customer</th><th scope="col">Email</th><th scope="col">Phone</th>
            <th scope="col">Orders</th><th scope="col">Total spent</th><th scope="col">Last order</th>
            <th scope="col">Customer type</th><th scope="col">Actions</th>
          </tr></thead>
          <tbody id="customerTableBody"></tbody>
        </table>
        <div class="product-empty" id="customerEmpty" hidden></div>
      </div>
      <div class="orders-table-footer" id="customerTableFooter"></div>
    </section>

    <dialog class="product-dialog customer-form-dialog" id="customerFormDialog" aria-labelledby="customerFormTitle">
      <form class="product-form" id="customerForm" novalidate>
        <header class="product-dialog-header">
          <div><span class="eyebrow">CUSTOMER RECORD</span><h2 id="customerFormTitle">Add customer</h2></div>
          <button class="icon-button product-dialog-close" id="closeCustomerForm" type="button" aria-label="Close customer form">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="product-form-fields">
          <div class="product-form-field product-form-field--full">
            <label for="customerName">Full name <span aria-hidden="true">*</span></label>
            <input id="customerName" name="name" type="text" maxlength="100" autocomplete="name" required aria-describedby="customerNameError">
            <p class="field-error" id="customerNameError"></p>
          </div>
          <div class="product-form-field">
            <label for="customerEmail">Email <span>Optional</span></label>
            <input id="customerEmail" name="email" type="email" maxlength="160" autocomplete="email" aria-describedby="customerEmailError">
            <p class="field-error" id="customerEmailError"></p>
          </div>
          <div class="product-form-field">
            <label for="customerPhone">Phone <span>Optional</span></label>
            <input id="customerPhone" name="phone" type="tel" maxlength="40" autocomplete="tel" aria-describedby="customerPhoneError">
            <p class="field-error" id="customerPhoneError"></p>
          </div>
          <div class="product-form-field product-form-field--full">
            <label for="customerAddress">Address <span>Optional</span></label>
            <input id="customerAddress" name="address" type="text" maxlength="300" autocomplete="street-address">
          </div>
          <div class="product-form-field product-form-field--full">
            <label for="customerNotes">Notes <span>Optional</span></label>
            <textarea id="customerNotes" name="notes" rows="3" maxlength="1000"></textarea>
          </div>
        </div>
        <p class="product-form-feedback" id="customerFormFeedback" role="alert"></p>
        <footer class="product-form-actions">
          <button class="button-secondary" id="cancelCustomerForm" type="button">Cancel</button>
          <button class="button-primary" id="saveCustomerButton" type="submit">Save customer</button>
        </footer>
      </form>
    </dialog>

    <dialog class="product-dialog customer-details-dialog" id="customerDetailsDialog" aria-labelledby="customerDetailsTitle">
      <div class="customer-details-shell">
        <header class="product-dialog-header">
          <div><span class="eyebrow">CUSTOMER PROFILE</span><h2 id="customerDetailsTitle">Customer details</h2></div>
          <button class="icon-button product-dialog-close" id="closeCustomerDetails" type="button" aria-label="Close customer details">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="customer-details-content" id="customerDetailsContent"></div>
      </div>
    </dialog>
  </section>`;

  const statsElement = root.querySelector("#customerStats");
  const notice = root.querySelector("#customerNotice");
  const search = root.querySelector("#customerSearch");
  const typeFilter = root.querySelector("#customerTypeFilter");
  const sortSelect = root.querySelector("#customerSort");
  const clearFiltersButton = root.querySelector("#clearCustomerFilters");
  const table = root.querySelector(".customers-table");
  const tableBody = root.querySelector("#customerTableBody");
  const emptyState = root.querySelector("#customerEmpty");
  const tableFooter = root.querySelector("#customerTableFooter");
  const formDialog = root.querySelector("#customerFormDialog");
  const form = root.querySelector("#customerForm");
  const formFeedback = root.querySelector("#customerFormFeedback");
  const saveButton = root.querySelector("#saveCustomerButton");
  const detailsDialog = root.querySelector("#customerDetailsDialog");
  const detailsTitle = root.querySelector("#customerDetailsTitle");
  const detailsContent = root.querySelector("#customerDetailsContent");
  let customers = customerRepository.getAll();
  let orders = orderRepository.getAll();
  let editingCustomerId = "";
  let activeDetailsCustomerId = "";
  let returnToDetails = false;
  let isSaving = false;
  let startupWarning = "";

  function showNotice(message, type = "success") {
    notice.textContent = message;
    notice.className = `product-notice product-notice--${type}`;
    notice.hidden = !message;
  }

  function linkExistingOrders() {
    if (customerRepository.getWarning() || orderRepository.getWarning()) return;
    let linkedAny = false;
    const nextOrders = orders.map((order) => {
      if (order.customerId && customers.some((customer) => customer.id === order.customerId)) return order;
      const match = findMatchingCustomer(customers, order.customerEmail, order.customerPhone);
      if (!match) return order;
      linkedAny = true;
      return { ...order, customerId: match.id };
    });
    if (!linkedAny) return;
    try {
      orderRepository.save(nextOrders);
      orders = orderRepository.getAll();
    } catch (error) {
      startupWarning = `Some existing orders could not be linked to customer records: ${error.message}`;
    }
  }

  function getMetrics(customer) {
    return getCustomerMetrics(customer, customers, orders);
  }

  function updateStats() {
    const metrics = customers.map((customer) => ({ customer, ...getMetrics(customer) }));
    const returningCount = metrics.filter((item) => item.type === "Returning").length;
    const topCustomer = metrics
      .filter((item) => item.totalSpent > 0)
      .sort((first, second) => second.totalSpent - first.totalSpent || first.customer.name.localeCompare(second.customer.name))[0];
    statsElement.innerHTML = [
      renderStatCard("Total customers", formatNumber(customers.length), "Saved customer records", "forest"),
      renderStatCard("New customers", formatNumber(customers.length - returningCount), "Zero or one paid order", "sage"),
      renderStatCard("Returning customers", formatNumber(returningCount), "More than one paid order", "amber"),
      renderStatCard(
        "Top customer",
        topCustomer ? escapeHTML(topCustomer.customer.name) : "—",
        topCustomer ? `${formatCurrency(topCustomer.totalSpent)} qualifying spend` : "No qualifying paid orders",
        "clay",
        "customer-top-stat"
      )
    ].join("");
  }

  function getVisibleCustomers() {
    const query = search.value.trim().toLocaleLowerCase();
    const phoneQuery = query.replace(/\D/g, "");
    const type = typeFilter.value;
    const visible = customers.filter((customer) => {
      const matchesPhone = phoneQuery.length >= 3 && normalizeCustomerPhone(customer.phone).includes(phoneQuery);
      const matchesQuery = !query || `${customer.name} ${customer.email} ${customer.phone}`.toLocaleLowerCase().includes(query) || matchesPhone;
      const matchesType = !type || getMetrics(customer).type === type;
      return matchesQuery && matchesType;
    });
    const byName = (first, second) => first.name.localeCompare(second.name);
    const comparators = {
      "name-asc": byName,
      "name-desc": (first, second) => byName(second, first),
      "spend-desc": (first, second) => getMetrics(second).totalSpent - getMetrics(first).totalSpent || byName(first, second),
      "spend-asc": (first, second) => getMetrics(first).totalSpent - getMetrics(second).totalSpent || byName(first, second),
      "orders-desc": (first, second) => getMetrics(second).orderCount - getMetrics(first).orderCount || byName(first, second),
      "orders-asc": (first, second) => getMetrics(first).orderCount - getMetrics(second).orderCount || byName(first, second),
      "recent-desc": (first, second) => (getMetrics(second).lastOrderAt || "").localeCompare(getMetrics(first).lastOrderAt || "") || byName(first, second),
      "recent-asc": (first, second) => {
        const firstDate = getMetrics(first).lastOrderAt;
        const secondDate = getMetrics(second).lastOrderAt;
        if (!firstDate || !secondDate) return firstDate ? -1 : secondDate ? 1 : byName(first, second);
        return firstDate.localeCompare(secondDate) || byName(first, second);
      }
    };
    return visible.sort(comparators[sortSelect.value] || byName);
  }

  function updateRows() {
    const visible = getVisibleCustomers();
    tableBody.innerHTML = visible.map((customer) => renderCustomerRow(customer, getMetrics(customer))).join("");
    table.hidden = visible.length === 0;
    emptyState.hidden = visible.length > 0;
    emptyState.textContent = customers.length === 0
      ? "No customer records yet. Add your first customer to get started."
      : "No customers match these filters. Try changing your search or clearing the filters.";
    tableFooter.textContent = `Showing ${formatNumber(visible.length)} of ${formatNumber(customers.length)} customers`;
    const hasFilters = Boolean(search.value.trim() || typeFilter.value || sortSelect.value !== "name-asc");
    clearFiltersButton.hidden = !hasFilters;
  }

  function updateCustomerDetails(customerId) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) {
      detailsDialog.close();
      return;
    }
    const metrics = getMetrics(customer);
    const history = metrics.linkedOrders
      .slice()
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    const historyContent = history.length
      ? `<div class="customer-history-wrap" role="region" aria-label="Scrollable customer order history" tabindex="0">
          <table class="customer-history-table">
            <thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Items</th><th scope="col">Total</th><th scope="col">Payment</th><th scope="col">Status</th></tr></thead>
            <tbody>${history.map((order) => `<tr>
              <td>${onViewOrder
                ? `<button class="customer-order-link" type="button" data-view-customer-order="${escapeHTML(order.id)}">${escapeHTML(order.orderNumber)}</button>`
                : `<strong class="order-number">${escapeHTML(order.orderNumber)}</strong>`}</td>
              <td>${escapeHTML(formatDate(order.createdAt))}</td>
              <td>${formatNumber(orderItemCount(order))}</td>
              <td class="customer-spend">${formatCurrency(order.total)}</td>
              <td><span class="order-payment-badge order-payment-badge--${statusClass(order.paymentStatus)}">${escapeHTML(order.paymentStatus)}</span></td>
              <td><span class="order-status-badge order-status-badge--${statusClass(order.orderStatus)}">${escapeHTML(order.orderStatus)}</span></td>
            </tr>`).join("")}</tbody>
          </table>
        </div>`
      : '<div class="customer-history-empty">No linked orders yet.</div>';

    detailsTitle.textContent = customer.name;
    detailsContent.innerHTML = `<div class="customer-detail-heading">
        <span class="customer-avatar customer-avatar--large" aria-hidden="true">${escapeHTML(initials(customer.name))}</span>
        <div><strong>${escapeHTML(customer.name)}</strong><span class="customer-type-badge customer-type-badge--${statusClass(metrics.type)}">${metrics.type} customer</span></div>
      </div>
      <dl class="customer-contact-grid">
        <div><dt>Email</dt><dd>${escapeHTML(customer.email || "Not provided")}</dd></div>
        <div><dt>Phone</dt><dd>${escapeHTML(customer.phone || "Not provided")}</dd></div>
        <div><dt>Address</dt><dd>${escapeHTML(customer.address || "Not provided")}</dd></div>
        <div><dt>Date added</dt><dd>${escapeHTML(formatDate(customer.createdAt))}</dd></div>
      </dl>
      <section class="customer-detail-metrics" aria-label="Customer purchase metrics">
        <div><span>Qualifying orders</span><strong>${formatNumber(metrics.orderCount)}</strong></div>
        <div><span>Qualifying spend</span><strong>${formatCurrency(metrics.totalSpent)}</strong></div>
        <div><span>Average order value</span><strong>${formatCurrency(metrics.averageOrderValue)}</strong></div>
        <div><span>Last paid order</span><strong>${escapeHTML(formatDate(metrics.lastOrderAt))}</strong></div>
      </section>
      <section class="customer-detail-notes"><h3>Notes</h3><p>${escapeHTML(customer.notes || "No notes for this customer.")}</p></section>
      <section class="customer-history-section">
        <header><div><h3>Order history</h3><p>Includes linked orders of every payment and fulfillment status.</p></div><span>${formatNumber(history.length)} orders</span></header>
        ${historyContent}
      </section>
      <footer class="customer-details-actions">
        <button class="button-secondary" type="button" data-details-edit-customer="${escapeHTML(customer.id)}">Edit customer</button>
      </footer>`;
  }

  function openDetails(customerId) {
    if (!customers.some((customer) => customer.id === customerId)) return;
    activeDetailsCustomerId = customerId;
    updateCustomerDetails(customerId);
    detailsDialog.showModal();
  }

  function refreshCustomers() {
    customers = customerRepository.getAll();
    orders = orderRepository.getAll();
    updateStats();
    updateRows();
    if (detailsDialog.open) updateCustomerDetails(activeDetailsCustomerId);
    onDataChanged();
  }

  function refreshFromStorage(showWarnings = true) {
    refreshCustomers();
    if (showWarnings) {
      const warnings = [customerRepository.getWarning(), orderRepository.getWarning(), startupWarning].filter(Boolean);
      showNotice(warnings.join(" "), warnings.length ? "warning" : "");
    }
  }

  function showSuccessOrWarnings(message) {
    const warnings = [customerRepository.getWarning(), orderRepository.getWarning(), startupWarning].filter(Boolean);
    showNotice(warnings.join(" ") || message, warnings.length ? "warning" : "success");
  }

  function clearFilters() {
    search.value = "";
    typeFilter.value = "";
    sortSelect.value = "name-asc";
    updateRows();
  }

  function clearValidation() {
    form.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
    form.querySelectorAll("[aria-invalid='true']").forEach((field) => field.removeAttribute("aria-invalid"));
    formFeedback.textContent = "";
  }

  function setFieldError(field, errorElement, message) {
    field.setAttribute("aria-invalid", "true");
    errorElement.textContent = message;
    return field;
  }

  function openForm(customer = null, reopenDetails = false) {
    editingCustomerId = customer?.id || "";
    returnToDetails = reopenDetails;
    clearValidation();
    form.reset();
    form.elements.namedItem("name").value = customer?.name || "";
    form.elements.namedItem("email").value = customer?.email || "";
    form.elements.namedItem("phone").value = customer?.phone || "";
    form.elements.namedItem("address").value = customer?.address || "";
    form.elements.namedItem("notes").value = customer?.notes || "";
    root.querySelector("#customerFormTitle").textContent = customer ? "Edit customer" : "Add customer";
    saveButton.textContent = customer ? "Save changes" : "Save customer";
    formDialog.showModal();
    form.elements.namedItem("name").focus();
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    if (isSaving) return;
    clearValidation();

    const nameField = form.elements.namedItem("name");
    const emailField = form.elements.namedItem("email");
    const phoneField = form.elements.namedItem("phone");
    const values = {
      name: nameField.value.trim(),
      email: emailField.value.trim(),
      phone: phoneField.value.trim(),
      address: form.elements.namedItem("address").value.trim(),
      notes: form.elements.namedItem("notes").value.trim()
    };
    const fields = {
      name: root.querySelector("#customerNameError"),
      email: root.querySelector("#customerEmailError"),
      phone: root.querySelector("#customerPhoneError")
    };
    let firstInvalid = null;
    function addError(field, errorElement, message) {
      const invalid = setFieldError(field, errorElement, message);
      if (!firstInvalid) firstInvalid = invalid;
    }

    if (!values.name) addError(nameField, fields.name, "Enter the customer's full name.");
    if (values.email && (!emailField.validity.valid || !isValidCustomerEmail(values.email))) {
      addError(emailField, fields.email, "Enter a valid email address.");
    }
    if (values.phone && !isValidCustomerPhone(values.phone)) {
      addError(phoneField, fields.phone, "Enter a valid phone number with 7 to 15 digits.");
    }
    const duplicate = findDuplicateCustomer(customers, values, editingCustomerId);
    if (duplicate) {
      const field = duplicate.field === "email" ? emailField : phoneField;
      addError(field, fields[duplicate.field], duplicate.message);
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    isSaving = true;
    saveButton.disabled = true;
    try {
      const wasEditing = Boolean(editingCustomerId);
      const updatedCustomer = editingCustomerId
        ? customerRepository.update(editingCustomerId, values)
        : customerRepository.create(values);
      const shouldReopenDetails = returnToDetails ? updatedCustomer.id : "";
      formDialog.close();
      refreshFromStorage();
      showSuccessOrWarnings(wasEditing ? "Customer details were updated." : "Customer was added.");
      if (shouldReopenDetails) openDetails(shouldReopenDetails);
    } catch (error) {
      formFeedback.textContent = error.message;
    } finally {
      isSaving = false;
      if (formDialog.open) saveButton.disabled = false;
    }
  }

  function deleteCustomer(customerId) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    const linkedOrders = getCustomerOrders(customer, customers, orders);
    if (linkedOrders.length) {
      showNotice(`${customer.name} has ${linkedOrders.length} linked order${linkedOrders.length === 1 ? "" : "s"} and cannot be deleted.`, "warning");
      return;
    }
    if (!window.confirm(`Delete ${customer.name}? This customer record cannot be restored.`)) return;
    try {
      customerRepository.delete(customerId);
      if (detailsDialog.open && activeDetailsCustomerId === customerId) detailsDialog.close();
      refreshFromStorage();
      showSuccessOrWarnings(`${customer.name} was deleted.`);
    } catch (error) {
      showNotice(error.message, "error");
    }
  }

  function closeOnEscape(dialog) {
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dialog.close();
      }
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dialog.close();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  root.querySelector("#addCustomerButton").addEventListener("click", () => openForm());
  root.querySelector("#closeCustomerForm").addEventListener("click", () => formDialog.close());
  root.querySelector("#cancelCustomerForm").addEventListener("click", () => formDialog.close());
  formDialog.addEventListener("close", () => {
    form.reset();
    clearValidation();
    editingCustomerId = "";
    returnToDetails = false;
    isSaving = false;
    saveButton.disabled = false;
  });
  closeOnEscape(formDialog);
  form.addEventListener("submit", handleFormSubmit);
  form.addEventListener("input", (event) => {
    const field = event.target;
    const error = field.id ? root.querySelector(`#${field.id}Error`) : null;
    if (error) error.textContent = "";
    field.removeAttribute("aria-invalid");
    formFeedback.textContent = "";
  });

  root.querySelector("#closeCustomerDetails").addEventListener("click", () => detailsDialog.close());
  detailsDialog.addEventListener("close", () => { activeDetailsCustomerId = ""; });
  closeOnEscape(detailsDialog);
  detailsContent.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-details-edit-customer]");
    const orderButton = event.target.closest("[data-view-customer-order]");
    if (editButton) {
      const customer = customers.find((item) => item.id === editButton.dataset.detailsEditCustomer);
      if (!customer) return;
      detailsDialog.close();
      openForm(customer, true);
    } else if (orderButton && onViewOrder) {
      detailsDialog.close();
      onViewOrder(orderButton.dataset.viewCustomerOrder);
    }
  });

  root.querySelector("#customerSearch").addEventListener("input", updateRows);
  typeFilter.addEventListener("change", updateRows);
  sortSelect.addEventListener("change", updateRows);
  clearFiltersButton.addEventListener("click", clearFilters);

  tableBody.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view-customer]");
    const editButton = event.target.closest("[data-edit-customer]");
    const deleteButton = event.target.closest("[data-delete-customer]");
    if (viewButton) openDetails(viewButton.dataset.viewCustomer);
    else if (editButton) {
      const customer = customers.find((item) => item.id === editButton.dataset.editCustomer);
      if (customer) openForm(customer);
    } else if (deleteButton) deleteCustomer(deleteButton.dataset.deleteCustomer);
  });

  linkExistingOrders();
  updateStats();
  updateRows();
  const warnings = [customerRepository.getWarning(), orderRepository.getWarning(), startupWarning].filter(Boolean);
  if (warnings.length) showNotice(warnings.join(" "), "warning");

  return () => {
    if (formDialog.open) formDialog.close();
    if (detailsDialog.open) detailsDialog.close();
  };
}
