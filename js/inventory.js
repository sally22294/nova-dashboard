import { getStockStatus } from "./product-storage.js";
import {
  createInventoryMovementId,
  STOCK_IN_REASONS,
  STOCK_OUT_REASONS
} from "./inventory-storage.js";
import { formatCurrency, formatDate, formatNumber } from "./formatting.js";

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

function safeImageURL(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function formatMovementDate(value) {
  return formatDate(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderStatCard(label, value, note, tone) {
  return `<article class="product-stat-card">
    <div class="product-stat-heading"><span>${label}</span><span class="product-stat-mark product-stat-mark--${tone}" aria-hidden="true"></span></div>
    <strong>${value}</strong>
    <small>${note}</small>
  </article>`;
}

function renderInventoryRow(product) {
  const imageURL = safeImageURL(product.image);
  const thumbnail = `<span class="product-thumb__fallback" aria-hidden="true">${escapeHTML(initials(product.name))}</span>${imageURL
    ? `<img src="${escapeHTML(imageURL)}" alt="" loading="lazy">`
    : ""}`;
  const inventoryValue = formatCurrency(product.price * product.quantity);
  const stockStatus = getStockStatus(product);

  return `<tr>
    <td><span class="product-table-name"><span class="product-thumb">${thumbnail}</span><span class="product-name-copy"><strong>${escapeHTML(product.name)}</strong></span></span></td>
    <td class="product-sku">${escapeHTML(product.sku)}</td>
    <td>${escapeHTML(product.category)}</td>
    <td class="product-quantity">${formatNumber(product.quantity)}</td>
    <td>${formatNumber(product.lowStockThreshold)}</td>
    <td><span class="product-stock-badge product-stock-badge--${statusClass(stockStatus)}">${escapeHTML(stockStatus)}</span></td>
    <td class="product-price">${formatCurrency(product.price)}</td>
    <td class="product-price">${inventoryValue}</td>
    <td><span class="inventory-row-actions">
      <button class="inventory-action-button" type="button" data-adjust-stock="${escapeHTML(product.id)}" aria-label="Adjust stock for ${escapeHTML(product.name)}">Adjust stock</button>
      <button class="inventory-action-button" type="button" data-view-movements="${escapeHTML(product.id)}" aria-label="View movement history for ${escapeHTML(product.name)}">History</button>
    </span></td>
  </tr>`;
}

function renderMovementRow(movement) {
  const direction = movement.type === "stock_in" ? "Stock in" : "Stock out";
  const sign = movement.type === "stock_in" ? "+" : "−";
  const tone = movement.type === "stock_in" ? "in" : "out";
  return `<tr>
    <td><span class="movement-product"><span class="stock-art" aria-hidden="true">${escapeHTML(initials(movement.productName))}</span><span><strong>${escapeHTML(movement.productName)}</strong><small>${escapeHTML(movement.sku)}</small></span></span></td>
    <td>${escapeHTML(formatMovementDate(movement.createdAt))}</td>
    <td><span class="movement-type movement-type--${tone}">${direction}</span></td>
    <td class="movement-quantity movement-quantity--${tone}">${sign}${formatNumber(movement.quantity)}</td>
    <td>${formatNumber(movement.previousQuantity)} <span aria-hidden="true">→</span> ${formatNumber(movement.newQuantity)}</td>
    <td><strong class="movement-reason">${escapeHTML(movement.reason)}</strong>${movement.notes ? `<small class="movement-notes">${escapeHTML(movement.notes)}</small>` : ""}</td>
  </tr>`;
}

export function initInventory(root, productRepository, movementRepository, onDataChanged = () => {}) {
  root.innerHTML = `<section class="inventory-page" aria-labelledby="inventoryIntroTitle">
    <header class="products-intro inventory-intro">
      <div><h2 id="inventoryIntroTitle">Inventory</h2><p>Monitor stock levels and record manual inventory changes.</p></div>
      <button class="button-secondary" id="viewAllMovements" type="button">Movement history</button>
    </header>

    <section class="product-stats inventory-stats" id="inventoryStats" aria-label="Inventory summary"></section>
    <p class="product-notice" id="inventoryNotice" role="status" aria-live="polite" hidden></p>
    <section class="panel inventory-panel" aria-label="Inventory records">
      <div class="products-toolbar inventory-toolbar">
        <label class="product-search">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
          <span class="sr-only">Search inventory by product name or SKU</span>
          <input id="inventorySearch" type="search" placeholder="Search products or SKU..." autocomplete="off">
        </label>
        <label class="product-filter"><span class="sr-only">Filter inventory by category</span><select id="inventoryCategory"><option value="">All categories</option></select></label>
        <label class="product-filter"><span class="sr-only">Filter inventory by stock status</span><select id="inventoryStatus">
          <option value="">All stock statuses</option>
          <option value="In Stock">In stock</option>
          <option value="Low Stock">Low stock</option>
          <option value="Out of Stock">Out of stock</option>
        </select></label>
        <label class="product-filter"><span class="sr-only">Sort inventory</span><select id="inventorySort">
          <option value="name">Name (A–Z)</option>
          <option value="quantity-asc">Quantity: low to high</option>
          <option value="quantity-desc">Quantity: high to low</option>
          <option value="value-desc">Inventory value: high to low</option>
          <option value="value-asc">Inventory value: low to high</option>
        </select></label>
        <button class="button-text" id="clearInventoryFilters" type="button" hidden>Clear filters</button>
      </div>
      <div class="inventory-table-wrap" role="region" aria-label="Scrollable inventory table" tabindex="0">
        <table class="inventory-table">
          <thead><tr>
            <th scope="col">Product</th><th scope="col">SKU</th><th scope="col">Category</th>
            <th scope="col">Current stock</th><th scope="col">Low threshold</th><th scope="col">Status</th>
            <th scope="col">Price</th><th scope="col">Inventory value</th><th scope="col">Actions</th>
          </tr></thead>
          <tbody id="inventoryTableBody"></tbody>
        </table>
        <div class="product-empty" id="inventoryEmpty" hidden></div>
      </div>
      <div class="orders-table-footer" id="inventoryTableFooter"></div>
    </section>

    <dialog class="product-dialog inventory-adjust-dialog" id="stockAdjustmentDialog" aria-labelledby="stockAdjustmentTitle">
      <form class="product-form" id="stockAdjustmentForm" novalidate>
        <header class="product-dialog-header">
          <div><span class="eyebrow">INVENTORY CONTROL</span><h2 id="stockAdjustmentTitle">Adjust stock</h2></div>
          <button class="icon-button product-dialog-close" id="closeStockAdjustment" type="button" aria-label="Close stock adjustment">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="product-form-fields inventory-adjust-fields">
          <div class="product-form-field product-form-field--full">
            <span class="inventory-field-label">Selected product</span>
            <div class="inventory-selected-product" id="adjustmentProduct"></div>
          </div>
          <div class="product-form-field">
            <label for="adjustmentCurrentStock">Current stock</label>
            <input id="adjustmentCurrentStock" type="text" readonly aria-describedby="adjustmentCurrentHint">
            <small class="inventory-field-hint" id="adjustmentCurrentHint">Quantity saved in the product catalog</small>
          </div>
          <div class="product-form-field">
            <label for="adjustmentType">Adjustment type <span aria-hidden="true">*</span></label>
            <select id="adjustmentType" name="type" required aria-describedby="adjustmentTypeError">
              <option value="stock_in">Stock In</option><option value="stock_out">Stock Out</option>
            </select>
            <p class="field-error" id="adjustmentTypeError"></p>
          </div>
          <div class="product-form-field">
            <label for="adjustmentQuantity">Quantity <span aria-hidden="true">*</span></label>
            <input id="adjustmentQuantity" name="quantity" type="number" min="1" step="1" inputmode="numeric" required aria-describedby="adjustmentQuantityError">
            <p class="field-error" id="adjustmentQuantityError"></p>
          </div>
          <div class="product-form-field">
            <label for="adjustmentReason">Reason <span aria-hidden="true">*</span></label>
            <select id="adjustmentReason" name="reason" required aria-describedby="adjustmentReasonError"></select>
            <p class="field-error" id="adjustmentReasonError"></p>
          </div>
          <div class="product-form-field product-form-field--full">
            <label for="adjustmentNotes">Notes <span>Optional</span></label>
            <textarea id="adjustmentNotes" name="notes" rows="3" maxlength="500"></textarea>
          </div>
        </div>
        <div class="inventory-adjustment-preview" aria-live="polite">
          <span>Resulting stock</span><strong id="adjustmentPreview">—</strong>
          <small id="adjustmentPreviewHint">Enter a positive quantity to preview the change.</small>
        </div>
        <p class="product-form-feedback" id="adjustmentFeedback" role="alert"></p>
        <footer class="product-form-actions">
          <button class="button-secondary" id="cancelStockAdjustment" type="button">Cancel</button>
          <button class="button-primary" id="saveStockAdjustment" type="submit">Save adjustment</button>
        </footer>
      </form>
    </dialog>

    <dialog class="product-dialog movement-dialog" id="movementHistoryDialog" aria-labelledby="movementHistoryTitle">
      <div class="movement-dialog-shell">
        <header class="product-dialog-header">
          <div><span class="eyebrow">INVENTORY RECORDS</span><h2 id="movementHistoryTitle">Inventory movement history</h2></div>
          <button class="icon-button product-dialog-close" id="closeMovementHistory" type="button" aria-label="Close movement history">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 18 6 6"/></svg>
          </button>
        </header>
        <div class="movement-history-content">
          <div class="movement-toolbar">
            <label class="product-search">
              <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
              <span class="sr-only">Search movement history by product name or SKU</span>
              <input id="movementSearch" type="search" placeholder="Search products or SKU..." autocomplete="off">
            </label>
            <label class="product-filter"><span class="sr-only">Filter movements by type</span><select id="movementTypeFilter">
              <option value="">All movement types</option><option value="stock_in">Stock in</option><option value="stock_out">Stock out</option>
            </select></label>
            <label class="product-filter"><span class="sr-only">Filter movements by reason</span><select id="movementReasonFilter"><option value="">All reasons</option></select></label>
            <label class="product-filter"><span class="sr-only">Sort movement history</span><select id="movementSort">
              <option value="date-desc">Date: newest first</option><option value="date-asc">Date: oldest first</option>
            </select></label>
            <button class="button-text" id="clearMovementFilters" type="button" hidden>Clear filters</button>
          </div>
          <div class="movement-table-wrap" role="region" aria-label="Scrollable movement history" tabindex="0">
            <table class="movement-table">
              <thead><tr>
                <th scope="col">Product</th><th scope="col">Date</th><th scope="col">Type</th>
                <th scope="col">Change</th><th scope="col">Stock</th><th scope="col">Reason and notes</th>
              </tr></thead>
              <tbody id="movementTableBody"></tbody>
            </table>
            <div class="product-empty" id="movementEmpty" hidden></div>
          </div>
          <div class="orders-table-footer" id="movementTableFooter"></div>
        </div>
      </div>
    </dialog>
  </section>`;

  const stats = root.querySelector("#inventoryStats");
  const notice = root.querySelector("#inventoryNotice");
  const table = root.querySelector(".inventory-table");
  const tableBody = root.querySelector("#inventoryTableBody");
  const emptyState = root.querySelector("#inventoryEmpty");
  const tableFooter = root.querySelector("#inventoryTableFooter");
  const search = root.querySelector("#inventorySearch");
  const categoryFilter = root.querySelector("#inventoryCategory");
  const statusFilter = root.querySelector("#inventoryStatus");
  const sortSelect = root.querySelector("#inventorySort");
  const clearFiltersButton = root.querySelector("#clearInventoryFilters");
  const adjustmentDialog = root.querySelector("#stockAdjustmentDialog");
  const adjustmentForm = root.querySelector("#stockAdjustmentForm");
  const adjustmentType = root.querySelector("#adjustmentType");
  const adjustmentQuantity = root.querySelector("#adjustmentQuantity");
  const adjustmentReason = root.querySelector("#adjustmentReason");
  const adjustmentFeedback = root.querySelector("#adjustmentFeedback");
  const adjustmentSaveButton = root.querySelector("#saveStockAdjustment");
  const historyDialog = root.querySelector("#movementHistoryDialog");
  const historyTitle = root.querySelector("#movementHistoryTitle");
  const movementSearch = root.querySelector("#movementSearch");
  const movementTypeFilter = root.querySelector("#movementTypeFilter");
  const movementReasonFilter = root.querySelector("#movementReasonFilter");
  const movementSort = root.querySelector("#movementSort");
  const clearMovementFiltersButton = root.querySelector("#clearMovementFilters");
  const movementTable = root.querySelector(".movement-table");
  const movementTableBody = root.querySelector("#movementTableBody");
  const movementEmpty = root.querySelector("#movementEmpty");
  const movementTableFooter = root.querySelector("#movementTableFooter");
  let products = productRepository.getAll();
  let selectedProductId = "";
  let expectedQuantity = 0;
  let historyProductId = "";
  let isSubmitting = false;
  let hasSavedAdjustment = false;

  function showNotice(message, type = "success") {
    notice.textContent = message;
    notice.className = `product-notice product-notice--${type}`;
    notice.hidden = !message;
  }

  function updateStats() {
    const totalUnits = products.reduce((sum, product) => sum + product.quantity, 0);
    const lowStock = products.filter((product) => getStockStatus(product) === "Low Stock").length;
    const outOfStock = products.filter((product) => getStockStatus(product) === "Out of Stock").length;
    const inventoryValueCents = products.reduce((sum, product) => {
      const priceCents = Math.round((product.price + Number.EPSILON) * 100);
      return sum + priceCents * product.quantity;
    }, 0);

    stats.innerHTML = [
      renderStatCard("Total units", formatNumber(totalUnits), "Across all products", "forest"),
      renderStatCard("Low stock", formatNumber(lowStock), "At or below threshold", "amber"),
      renderStatCard("Out of stock", formatNumber(outOfStock), "Needs replenishment", "clay"),
      renderStatCard("Inventory value", formatCurrency(inventoryValueCents / 100), "Current price × stock", "sage")
    ].join("");
  }

  function updateCategories() {
    const selected = categoryFilter.value;
    const categories = [...new Set(products.map((product) => product.category))].sort((first, second) => first.localeCompare(second));
    categoryFilter.innerHTML = `<option value="">All categories</option>${categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("")}`;
    categoryFilter.value = categories.includes(selected) ? selected : "";
  }

  function getVisibleProducts() {
    const query = search.value.trim().toLocaleLowerCase();
    const category = categoryFilter.value;
    const stockStatus = statusFilter.value;
    const visible = products.filter((product) => {
      const matchesQuery = !query || `${product.name} ${product.sku}`.toLocaleLowerCase().includes(query);
      const matchesCategory = !category || product.category === category;
      const matchesStatus = !stockStatus || getStockStatus(product) === stockStatus;
      return matchesQuery && matchesCategory && matchesStatus;
    });

    const byName = (first, second) => first.name.localeCompare(second.name);
    const comparators = {
      name: byName,
      "quantity-asc": (first, second) => first.quantity - second.quantity || byName(first, second),
      "quantity-desc": (first, second) => second.quantity - first.quantity || byName(first, second),
      "value-desc": (first, second) => second.price * second.quantity - first.price * first.quantity || byName(first, second),
      "value-asc": (first, second) => first.price * first.quantity - second.price * second.quantity || byName(first, second)
    };
    return visible.sort(comparators[sortSelect.value] || byName);
  }

  function updateRows() {
    const visibleProducts = getVisibleProducts();
    tableBody.innerHTML = visibleProducts.map(renderInventoryRow).join("");
    table.hidden = visibleProducts.length === 0;
    emptyState.hidden = visibleProducts.length > 0;
    emptyState.textContent = products.length === 0
      ? "Your catalog is empty. Add products from the Products page to begin tracking inventory."
      : "No products match these filters. Try changing your search or clearing the filters.";
    tableBody.querySelectorAll(".product-thumb img").forEach((image) => {
      image.addEventListener("error", () => image.remove(), { once: true });
    });
    tableFooter.textContent = `Showing ${formatNumber(visibleProducts.length)} of ${formatNumber(products.length)} products`;
    const hasFilters = Boolean(search.value.trim() || categoryFilter.value || statusFilter.value || sortSelect.value !== "name");
    clearFiltersButton.hidden = !hasFilters;
  }

  function updateMovementReasons() {
    const reasons = [...new Set([...STOCK_IN_REASONS, ...STOCK_OUT_REASONS])];
    const selected = movementReasonFilter.value;
    movementReasonFilter.innerHTML = `<option value="">All reasons</option>${reasons.map((reason) => `<option value="${escapeHTML(reason)}">${escapeHTML(reason)}</option>`).join("")}`;
    movementReasonFilter.value = reasons.includes(selected) ? selected : "";
  }

  function getVisibleMovements() {
    const query = movementSearch.value.trim().toLocaleLowerCase();
    const type = movementTypeFilter.value;
    const reason = movementReasonFilter.value;
    const visible = movementRepository.getAll().filter((movement) => {
      const matchesProduct = !historyProductId || movement.productId === historyProductId;
      const matchesQuery = !query || `${movement.productName} ${movement.sku}`.toLocaleLowerCase().includes(query);
      return matchesProduct
        && matchesQuery
        && (!type || movement.type === type)
        && (!reason || movement.reason === reason);
    });
    return visible.sort((first, second) => movementSort.value === "date-asc"
      ? first.createdAt.localeCompare(second.createdAt)
      : second.createdAt.localeCompare(first.createdAt));
  }

  function updateMovementRows() {
    const allMovements = movementRepository.getAll();
    const visibleMovements = getVisibleMovements();
    movementTableBody.innerHTML = visibleMovements.map(renderMovementRow).join("");
    movementTable.hidden = visibleMovements.length === 0;
    movementEmpty.hidden = visibleMovements.length > 0;
    if (historyProductId) {
      const product = products.find((item) => item.id === historyProductId);
      movementEmpty.textContent = product
        ? `No stock movements have been recorded for ${product.name}.`
        : "No stock movements match these filters.";
    } else {
      movementEmpty.textContent = allMovements.length === 0
        ? "No inventory movements yet. Manual stock adjustments will appear here."
        : "No movements match these filters. Try changing your search or clearing the filters.";
    }
    movementTableFooter.textContent = `Showing ${formatNumber(visibleMovements.length)} of ${formatNumber(allMovements.length)} movements`;
    const hasFilters = Boolean(
      historyProductId
      || movementSearch.value.trim()
      || movementTypeFilter.value
      || movementReasonFilter.value
      || movementSort.value !== "date-desc"
    );
    clearMovementFiltersButton.hidden = !hasFilters;
  }

  function refreshInventory(showWarnings = true) {
    products = productRepository.getAll();
    updateStats();
    updateCategories();
    updateRows();
    updateMovementReasons();
    updateMovementRows();
    if (showWarnings) {
      const warnings = [productRepository.getWarning(), movementRepository.getWarning()].filter(Boolean);
      showNotice(warnings.join(" "), warnings.length ? "warning" : "");
    }
  }

  function clearInventoryFilters() {
    search.value = "";
    categoryFilter.value = "";
    statusFilter.value = "";
    sortSelect.value = "name";
    updateRows();
  }

  function clearMovementFilters() {
    historyProductId = "";
    historyTitle.textContent = "Inventory movement history";
    movementSearch.value = "";
    movementTypeFilter.value = "";
    movementReasonFilter.value = "";
    movementSort.value = "date-desc";
    updateMovementRows();
  }

  function updateAdjustmentPreview() {
    const preview = root.querySelector("#adjustmentPreview");
    const hint = root.querySelector("#adjustmentPreviewHint");
    const quantityText = adjustmentQuantity.value.trim();
    const quantity = Number(quantityText);
    if (!quantityText || !Number.isSafeInteger(quantity) || quantity < 1) {
      preview.textContent = "—";
      hint.textContent = "Enter a positive whole number to preview the change.";
      hint.classList.remove("inventory-preview-error");
      return;
    }

    const result = expectedQuantity + (adjustmentType.value === "stock_in" ? quantity : -quantity);
    preview.textContent = Number.isSafeInteger(result) ? formatNumber(result) : "Invalid";
    if (!Number.isSafeInteger(result) || result < 0) {
      hint.textContent = result < 0
        ? "Stock out cannot exceed the current quantity."
        : "The resulting quantity exceeds the supported range.";
      hint.classList.add("inventory-preview-error");
    } else {
      hint.textContent = `${adjustmentType.value === "stock_in" ? "Added to" : "Removed from"} the current stock of ${formatNumber(expectedQuantity)}.`;
      hint.classList.remove("inventory-preview-error");
    }
  }

  function updateAdjustmentReasons(selected = "") {
    const reasons = adjustmentType.value === "stock_in" ? STOCK_IN_REASONS : STOCK_OUT_REASONS;
    adjustmentReason.innerHTML = `<option value="">Choose a reason</option>${reasons.map((reason) => `<option value="${escapeHTML(reason)}">${escapeHTML(reason)}</option>`).join("")}`;
    adjustmentReason.value = reasons.includes(selected) ? selected : "";
  }

  function renderSelectedProduct(product) {
    root.querySelector("#adjustmentProduct").innerHTML = `<strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.sku)} · ${escapeHTML(product.category)}</small>`;
    root.querySelector("#adjustmentCurrentStock").value = formatNumber(product.quantity);
  }

  function clearAdjustmentValidation() {
    adjustmentForm.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
    adjustmentForm.querySelectorAll("[aria-invalid='true']").forEach((field) => field.removeAttribute("aria-invalid"));
    adjustmentFeedback.textContent = "";
  }

  function openAdjustment(productId) {
    products = productRepository.getAll();
    const product = products.find((item) => item.id === productId);
    if (!product) {
      showNotice("This product is no longer in the catalog.", "error");
      refreshInventory(false);
      return;
    }
    selectedProductId = product.id;
    expectedQuantity = product.quantity;
    hasSavedAdjustment = false;
    clearAdjustmentValidation();
    adjustmentForm.reset();
    adjustmentType.value = "stock_in";
    adjustmentQuantity.value = "";
    updateAdjustmentReasons();
    renderSelectedProduct(product);
    updateAdjustmentPreview();
    adjustmentSaveButton.disabled = false;
    adjustmentDialog.showModal();
    adjustmentQuantity.focus();
  }

  function openMovementHistory(productId = "") {
    historyProductId = productId;
    movementSearch.value = "";
    movementTypeFilter.value = "";
    movementReasonFilter.value = "";
    movementSort.value = "date-desc";
    const product = products.find((item) => item.id === productId);
    historyTitle.textContent = product ? `${product.name} · Movement history` : "Inventory movement history";
    updateMovementRows();
    historyDialog.showModal();
    movementSearch.focus();
  }

  function showAdjustmentError(field, errorElement, message) {
    field.setAttribute("aria-invalid", "true");
    errorElement.textContent = message;
    return field;
  }

  function refreshAdjustmentProduct() {
    products = productRepository.getAll();
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) {
      adjustmentSaveButton.disabled = true;
      adjustmentFeedback.textContent = "This product is no longer in the catalog. No stock was changed.";
      return;
    }
    expectedQuantity = product.quantity;
    renderSelectedProduct(product);
    updateAdjustmentPreview();
  }

  function handleAdjustmentSubmit(event) {
    event.preventDefault();
    if (isSubmitting || hasSavedAdjustment) return;
    clearAdjustmentValidation();

    const quantityText = adjustmentQuantity.value.trim();
    const quantity = Number(quantityText);
    const type = adjustmentType.value;
    const reason = adjustmentReason.value;
    const notes = adjustmentForm.elements.namedItem("notes").value.trim();
    const validReasons = type === "stock_in" ? STOCK_IN_REASONS : STOCK_OUT_REASONS;
    let firstInvalid = null;
    const errors = {
      type: root.querySelector("#adjustmentTypeError"),
      quantity: root.querySelector("#adjustmentQuantityError"),
      reason: root.querySelector("#adjustmentReasonError")
    };

    function addError(field, errorElement, message) {
      const invalid = showAdjustmentError(field, errorElement, message);
      if (!firstInvalid) firstInvalid = invalid;
    }

    if (type !== "stock_in" && type !== "stock_out") {
      addError(adjustmentType, errors.type, "Choose Stock In or Stock Out.");
    }
    if (!quantityText || !Number.isSafeInteger(quantity) || quantity < 1) {
      addError(adjustmentQuantity, errors.quantity, "Enter a positive whole-number quantity.");
    }
    if (!validReasons.includes(reason)) {
      addError(adjustmentReason, errors.reason, "Choose a reason for this adjustment.");
    }
    const adjustment = type === "stock_in" ? quantity : -quantity;
    if (type === "stock_out" && Number.isSafeInteger(quantity) && quantity > expectedQuantity) {
      addError(adjustmentQuantity, errors.quantity, "Stock out cannot exceed the current quantity.");
    } else if (type === "stock_in" && Number.isSafeInteger(quantity) && !Number.isSafeInteger(expectedQuantity + quantity)) {
      addError(adjustmentQuantity, errors.quantity, "The resulting quantity exceeds the supported range.");
    }
    if (notes.length > 500) {
      adjustmentFeedback.textContent = "Notes must be 500 characters or fewer.";
      return;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      updateAdjustmentPreview();
      return;
    }

    const product = products.find((item) => item.id === selectedProductId);
    if (!product) {
      adjustmentFeedback.textContent = "This product is no longer in the catalog. No stock was changed.";
      refreshInventory(false);
      return;
    }

    isSubmitting = true;
    adjustmentSaveButton.disabled = true;
    try {
      movementRepository.assertWritable();
      const createdAt = new Date().toISOString();
      const stockChange = productRepository.adjustQuantity(
        selectedProductId,
        expectedQuantity,
        adjustment,
        createdAt
      );
      const movement = {
        id: createInventoryMovementId(),
        productId: stockChange.product.id,
        productName: stockChange.product.name,
        sku: stockChange.product.sku,
        type,
        quantity,
        previousQuantity: stockChange.previousQuantity,
        newQuantity: stockChange.newQuantity,
        reason,
        notes,
        createdAt
      };

      try {
        movementRepository.append(movement);
      } catch (movementError) {
        try {
          productRepository.adjustQuantity(
            stockChange.product.id,
            stockChange.newQuantity,
            -adjustment,
            stockChange.previousUpdatedAt
          );
        } catch (rollbackError) {
          throw new Error(`${movementError.message} Stock rollback also failed: ${rollbackError.message}`);
        }
        throw movementError;
      }

      hasSavedAdjustment = true;
      refreshInventory(false);
      onDataChanged();
      adjustmentDialog.close();
      showNotice(`${stockChange.product.name} stock updated to ${formatNumber(stockChange.newQuantity)}.`);
    } catch (error) {
      adjustmentFeedback.textContent = error.message;
      refreshInventory(false);
      refreshAdjustmentProduct();
      onDataChanged();
    } finally {
      isSubmitting = false;
      if (adjustmentDialog.open) adjustmentSaveButton.disabled = !products.some((item) => item.id === selectedProductId);
    }
  }

  function closeOnEscape(dialog) {
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
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

  adjustmentType.addEventListener("change", () => {
    updateAdjustmentReasons();
    updateAdjustmentPreview();
  });
  adjustmentQuantity.addEventListener("input", updateAdjustmentPreview);
  adjustmentForm.addEventListener("input", (event) => {
    const field = event.target;
    if (field.id) {
      const error = root.querySelector(`#${field.id}Error`);
      if (error) error.textContent = "";
      field.removeAttribute("aria-invalid");
    }
    if (field === adjustmentQuantity) adjustmentFeedback.textContent = "";
  });
  adjustmentReason.addEventListener("change", () => {
    adjustmentReason.removeAttribute("aria-invalid");
    root.querySelector("#adjustmentReasonError").textContent = "";
  });
  adjustmentForm.addEventListener("submit", handleAdjustmentSubmit);
  root.querySelector("#closeStockAdjustment").addEventListener("click", () => adjustmentDialog.close());
  root.querySelector("#cancelStockAdjustment").addEventListener("click", () => adjustmentDialog.close());
  adjustmentDialog.addEventListener("close", () => {
    adjustmentForm.reset();
    clearAdjustmentValidation();
    selectedProductId = "";
    expectedQuantity = 0;
  });
  closeOnEscape(adjustmentDialog);

  root.querySelector("#viewAllMovements").addEventListener("click", () => openMovementHistory());
  root.querySelector("#closeMovementHistory").addEventListener("click", () => historyDialog.close());
  historyDialog.addEventListener("close", () => {
    historyProductId = "";
    historyTitle.textContent = "Inventory movement history";
  });
  closeOnEscape(historyDialog);

  search.addEventListener("input", updateRows);
  categoryFilter.addEventListener("change", updateRows);
  statusFilter.addEventListener("change", updateRows);
  sortSelect.addEventListener("change", updateRows);
  clearFiltersButton.addEventListener("click", clearInventoryFilters);
  movementSearch.addEventListener("input", updateMovementRows);
  movementTypeFilter.addEventListener("change", updateMovementRows);
  movementReasonFilter.addEventListener("change", updateMovementRows);
  movementSort.addEventListener("change", updateMovementRows);
  clearMovementFiltersButton.addEventListener("click", clearMovementFilters);

  tableBody.addEventListener("click", (event) => {
    const adjustButton = event.target.closest("[data-adjust-stock]");
    const historyButton = event.target.closest("[data-view-movements]");
    if (adjustButton) {
      openAdjustment(adjustButton.dataset.adjustStock);
      return;
    }
    if (historyButton) openMovementHistory(historyButton.dataset.viewMovements);
  });

  refreshInventory();
  return () => {
    if (adjustmentDialog.open) adjustmentDialog.close();
    if (historyDialog.open) historyDialog.close();
  };
}
