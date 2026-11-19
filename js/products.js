import { DEFAULT_PRODUCT_CATEGORIES, createProductId, getStockStatus } from "./product-storage.js";
import { formatCurrency, formatNumber } from "./formatting.js";

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
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

function getInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function renderStatusBadge(product) {
  const status = getStockStatus(product);
  return `<span class="product-stock-badge product-stock-badge--${statusClass(status)}">${status}</span>`;
}

function renderTableRow(product) {
  const imageURL = safeImageURL(product.image);
  const thumbnail = `<span class="product-thumb__fallback" aria-hidden="true">${escapeHTML(getInitials(product.name))}</span>${imageURL
    ? `<img src="${escapeHTML(imageURL)}" alt="" loading="lazy">`
    : ""}`;

  return `<tr>
    <td><span class="product-table-name"><span class="product-thumb">${thumbnail}</span><span class="product-name-copy"><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.description || "No description")}</small></span></span></td>
    <td class="product-sku">${escapeHTML(product.sku)}</td>
    <td>${escapeHTML(product.category)}</td>
    <td class="product-price">${formatCurrency(product.price)}</td>
    <td class="product-quantity">${formatNumber(product.quantity)}</td>
    <td>${renderStatusBadge(product)}</td>
    <td><span class="product-row-actions">
      <button class="product-action-button" type="button" data-edit-product="${escapeHTML(product.id)}" aria-label="Edit ${escapeHTML(product.name)}" title="Edit product">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l4.3-.9L19 8.4a2.1 2.1 0 0 0-3-3L5.3 16.1 4 20Z"/></svg>
      </button>
      <button class="product-action-button product-action-button--delete" type="button" data-delete-product="${escapeHTML(product.id)}" aria-label="Delete ${escapeHTML(product.name)}" title="Delete product">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>
      </button>
    </span></td>
  </tr>`;
}

function renderStatCard(label, value, note, tone) {
  return `<article class="product-stat-card">
    <div class="product-stat-heading"><span>${label}</span><span class="product-stat-mark product-stat-mark--${tone}" aria-hidden="true"></span></div>
    <strong>${value}</strong>
    <small>${note}</small>
  </article>`;
}

function normalizeImageURL(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return "";
  }
  return "";
}

export function initProducts(root, repository, onDataChanged = () => {}) {
  root.innerHTML = `<section class="products-page" aria-labelledby="productsIntroTitle">
    <header class="products-intro">
      <div><h2 id="productsIntroTitle">Your catalog</h2><p>Manage product details and keep an eye on available stock.</p></div>
      <button class="button-primary" id="addProductButton" type="button">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Add product
      </button>
    </header>

    <section class="product-stats" id="productStats" aria-label="Product summary"></section>
    <p class="product-notice" id="productNotice" role="status" aria-live="polite" hidden></p>
    <section class="panel products-panel" aria-label="Product catalog">
      <div class="products-toolbar">
        <label class="product-search">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
          <span class="sr-only">Search products by name or SKU</span>
          <input id="productSearch" type="search" placeholder="Search products or SKU..." autocomplete="off">
        </label>
        <label class="product-filter"><span class="sr-only">Filter by category</span><select id="categoryFilter"><option value="">All categories</option></select></label>
        <label class="product-filter"><span class="sr-only">Filter by stock status</span><select id="stockFilter">
          <option value="">All stock statuses</option>
          <option value="In Stock">In stock</option>
          <option value="Low Stock">Low stock</option>
          <option value="Out of Stock">Out of stock</option>
        </select></label>
        <label class="product-filter product-sort"><span class="sr-only">Sort products</span><select id="productSort">
          <option value="name">Name (A–Z)</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="quantity-asc">Quantity: low to high</option>
          <option value="quantity-desc">Quantity: high to low</option>
        </select></label>
        <button class="button-text" id="clearProductFilters" type="button" hidden>Clear filters</button>
      </div>
      <div class="product-table-wrap">
        <table class="products-table">
          <thead><tr>
            <th scope="col">Product</th><th scope="col">SKU</th><th scope="col">Category</th>
            <th scope="col">Price</th><th scope="col">Quantity</th><th scope="col">Status</th><th scope="col">Actions</th>
          </tr></thead>
          <tbody id="productTableBody"></tbody>
        </table>
        <div class="product-empty" id="productEmpty" hidden></div>
      </div>
    </section>

    <dialog class="product-dialog" id="productDialog" aria-labelledby="productDialogTitle">
      <form class="product-form" id="productForm" novalidate>
        <header class="product-dialog-header">
          <div><span class="eyebrow">PRODUCT CATALOG</span><h2 id="productDialogTitle">Add product</h2></div>
          <button class="icon-button product-dialog-close" id="closeProductDialog" type="button" aria-label="Close product form">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="product-form-fields">
          <div class="product-form-field">
            <label for="productName">Product name <span aria-hidden="true">*</span></label>
            <input id="productName" name="name" type="text" maxlength="100" autocomplete="off" required aria-describedby="productNameError">
            <p class="field-error" id="productNameError"></p>
          </div>
          <div class="product-form-field">
            <label for="productSku">SKU <span aria-hidden="true">*</span></label>
            <input id="productSku" name="sku" type="text" maxlength="48" autocomplete="off" required aria-describedby="productSkuError">
            <p class="field-error" id="productSkuError"></p>
          </div>
          <div class="product-form-field">
            <label for="productCategory">Category <span aria-hidden="true">*</span></label>
            <input id="productCategory" name="category" type="text" list="productCategoryOptions" maxlength="60" required aria-describedby="productCategoryError">
            <datalist id="productCategoryOptions"></datalist>
            <p class="field-error" id="productCategoryError"></p>
          </div>
          <div class="product-form-field">
            <label for="productPrice">Price (USD) <span aria-hidden="true">*</span></label>
            <input id="productPrice" name="price" type="number" min="0" step="0.01" inputmode="decimal" required aria-describedby="productPriceError">
            <p class="field-error" id="productPriceError"></p>
          </div>
          <div class="product-form-field">
            <label for="productQuantity">Quantity <span aria-hidden="true">*</span></label>
            <input id="productQuantity" name="quantity" type="number" min="0" step="1" inputmode="numeric" required aria-describedby="productQuantityError">
            <p class="field-error" id="productQuantityError"></p>
          </div>
          <div class="product-form-field">
            <label for="productThreshold">Low stock threshold <span aria-hidden="true">*</span></label>
            <input id="productThreshold" name="lowStockThreshold" type="number" min="1" step="1" inputmode="numeric" required aria-describedby="productThresholdError">
            <p class="field-error" id="productThresholdError"></p>
          </div>
          <div class="product-form-field product-form-field--full">
            <label for="productImage">Image URL <span>Optional</span></label>
            <input id="productImage" name="image" type="url" inputmode="url" placeholder="https://example.com/product.jpg" aria-describedby="productImageError">
            <p class="field-error" id="productImageError"></p>
          </div>
          <div class="product-form-field product-form-field--full">
            <label for="productDescription">Description <span>Optional</span></label>
            <textarea id="productDescription" name="description" rows="3" maxlength="500" aria-describedby="productDescriptionError"></textarea>
            <p class="field-error" id="productDescriptionError"></p>
          </div>
        </div>
        <p class="product-form-feedback" id="productFormFeedback" role="alert"></p>
        <footer class="product-form-actions">
          <button class="button-secondary" id="cancelProductDialog" type="button">Cancel</button>
          <button class="button-primary" id="saveProductButton" type="submit">Save product</button>
        </footer>
      </form>
    </dialog>
  </section>`;

  const stats = root.querySelector("#productStats");
  const table = root.querySelector(".products-table");
  const tableBody = root.querySelector("#productTableBody");
  const emptyState = root.querySelector("#productEmpty");
  const search = root.querySelector("#productSearch");
  const categoryFilter = root.querySelector("#categoryFilter");
  const stockFilter = root.querySelector("#stockFilter");
  const sortSelect = root.querySelector("#productSort");
  const clearFiltersButton = root.querySelector("#clearProductFilters");
  const notice = root.querySelector("#productNotice");
  const dialog = root.querySelector("#productDialog");
  const form = root.querySelector("#productForm");
  const formFeedback = root.querySelector("#productFormFeedback");
  let products = repository.getAll();

  function showNotice(message, type) {
    notice.textContent = message;
    notice.className = `product-notice product-notice--${type}`;
    notice.hidden = !message;
  }

  function updateStats() {
    const lowStock = products.filter((product) => getStockStatus(product) === "Low Stock").length;
    const outOfStock = products.filter((product) => getStockStatus(product) === "Out of Stock").length;
    stats.innerHTML = [
      renderStatCard("Total products", products.length, "Across your catalog", "forest"),
      renderStatCard("Active products", products.length, "Currently listed", "sage"),
      renderStatCard("Low stock", lowStock, "At or below threshold", "amber"),
      renderStatCard("Out of stock", outOfStock, "Needs replenishment", "clay")
    ].join("");
  }

  function updateCategories() {
    const selected = categoryFilter.value;
    const categories = [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b));
    categoryFilter.innerHTML = `<option value="">All categories</option>${categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("")}`;
    categoryFilter.value = categories.includes(selected) ? selected : "";

    const datalistCategories = [...new Set([...DEFAULT_PRODUCT_CATEGORIES, ...categories])].sort((a, b) => a.localeCompare(b));
    root.querySelector("#productCategoryOptions").innerHTML = datalistCategories.map((category) => `<option value="${escapeHTML(category)}"></option>`).join("");
  }

  function getVisibleProducts() {
    const query = search.value.trim().toLocaleLowerCase();
    const category = categoryFilter.value;
    const stockStatus = stockFilter.value;
    const visible = products.filter((product) => {
      const matchesQuery = !query || `${product.name} ${product.sku}`.toLocaleLowerCase().includes(query);
      const matchesCategory = !category || product.category === category;
      const matchesStock = !stockStatus || getStockStatus(product) === stockStatus;
      return matchesQuery && matchesCategory && matchesStock;
    });

    const byName = (first, second) => first.name.localeCompare(second.name);
    const comparators = {
      name: byName,
      "price-asc": (first, second) => first.price - second.price || byName(first, second),
      "price-desc": (first, second) => second.price - first.price || byName(first, second),
      "quantity-asc": (first, second) => first.quantity - second.quantity || byName(first, second),
      "quantity-desc": (first, second) => second.quantity - first.quantity || byName(first, second)
    };
    return visible.sort(comparators[sortSelect.value] || byName);
  }

  function updateRows() {
    const visibleProducts = getVisibleProducts();
    tableBody.innerHTML = visibleProducts.map(renderTableRow).join("");
    table.hidden = visibleProducts.length === 0;
    emptyState.hidden = visibleProducts.length > 0;
    emptyState.textContent = products.length === 0
      ? "Your catalog is empty. Add your first product to get started."
      : "No products match these filters. Try changing your search or clearing the filters.";

    tableBody.querySelectorAll(".product-thumb img").forEach((image) => {
      image.addEventListener("error", () => image.remove(), { once: true });
    });

    const hasFilters = Boolean(search.value.trim() || categoryFilter.value || stockFilter.value || sortSelect.value !== "name");
    clearFiltersButton.hidden = !hasFilters;
  }

  function refreshProducts() {
    products = repository.getAll();
    updateStats();
    updateCategories();
    updateRows();
    showNotice(repository.getWarning(), "warning");
    onDataChanged();
  }

  function clearValidation() {
    root.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
    form.querySelectorAll("[aria-invalid='true']").forEach((field) => field.removeAttribute("aria-invalid"));
    formFeedback.textContent = "";
  }

  function setFieldError(fieldName, message) {
    const field = form.elements.namedItem(fieldName);
    const error = root.querySelector(`#${field.id}Error`);
    field.setAttribute("aria-invalid", "true");
    error.textContent = message;
    return field;
  }

  function openProductDialog(product) {
    clearValidation();
    form.reset();
    const editing = Boolean(product);
    root.querySelector("#productDialogTitle").textContent = editing ? "Edit product" : "Add product";
    root.querySelector("#saveProductButton").textContent = editing ? "Save changes" : "Save product";

    if (product) {
      form.elements.namedItem("name").value = product.name;
      form.elements.namedItem("sku").value = product.sku;
      form.elements.namedItem("category").value = product.category;
      form.elements.namedItem("price").value = String(product.price);
      form.elements.namedItem("quantity").value = String(product.quantity);
      form.elements.namedItem("lowStockThreshold").value = String(product.lowStockThreshold);
      form.elements.namedItem("image").value = product.image;
      form.elements.namedItem("description").value = product.description;
    }

    dialog.showModal();
    root.querySelector("#productName").focus();
  }

  function resetProductFilters() {
    search.value = "";
    categoryFilter.value = "";
    stockFilter.value = "";
    sortSelect.value = "name";
    updateRows();
  }

  function handleProductSubmit(event) {
    event.preventDefault();
    clearValidation();

    const name = form.elements.namedItem("name").value.trim();
    const sku = form.elements.namedItem("sku").value.trim();
    const category = form.elements.namedItem("category").value.trim();
    const priceText = form.elements.namedItem("price").value.trim();
    const quantityText = form.elements.namedItem("quantity").value.trim();
    const thresholdText = form.elements.namedItem("lowStockThreshold").value.trim();
    const imageText = form.elements.namedItem("image").value.trim();
    const description = form.elements.namedItem("description").value.trim();
    const editingId = form.dataset.editingId || "";
    let firstInvalid = null;

    function addError(fieldName, message) {
      const field = setFieldError(fieldName, message);
      if (!firstInvalid) firstInvalid = field;
    }

    const price = Number(priceText);
    const quantity = Number(quantityText);
    const lowStockThreshold = Number(thresholdText);
    const image = normalizeImageURL(imageText);

    if (!name) addError("name", "Enter a product name.");
    if (!sku) addError("sku", "Enter a SKU.");
    else if (products.some((product) => product.id !== editingId && product.sku.trim().toLocaleLowerCase() === sku.toLocaleLowerCase())) {
      addError("sku", "This SKU is already in use.");
    }
    if (!category) addError("category", "Choose or enter a category.");
    if (!priceText || !Number.isFinite(price)) addError("price", "Enter a valid price.");
    else if (price < 0) addError("price", "Price cannot be negative.");
    else if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-8) addError("price", "Use no more than two decimal places.");
    if (!quantityText || !Number.isInteger(quantity)) addError("quantity", "Enter a whole-number quantity.");
    else if (quantity < 0) addError("quantity", "Quantity cannot be negative.");
    if (!thresholdText || !Number.isInteger(lowStockThreshold)) addError("lowStockThreshold", "Enter a whole-number threshold.");
    else if (lowStockThreshold < 1) addError("lowStockThreshold", "Threshold must be at least 1.");
    if (imageText && !image) addError("image", "Enter a valid HTTP or HTTPS image URL.");

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const existing = editingId ? products.find((product) => product.id === editingId) : null;
    const now = new Date().toISOString();
    const nextProduct = {
      id: existing ? existing.id : createProductId(),
      name,
      sku,
      category,
      price,
      quantity,
      lowStockThreshold,
      image,
      description,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
    const nextProducts = existing
      ? products.map((product) => product.id === existing.id ? nextProduct : product)
      : [nextProduct, ...products];

    try {
      repository.save(nextProducts);
    } catch (error) {
      formFeedback.textContent = error.message;
      return;
    }

    if (!existing) resetProductFilters();
    refreshProducts();
    showNotice(existing ? "Product updated." : "Product added.", "success");
    dialog.close();
  }

  root.querySelector("#addProductButton").addEventListener("click", () => {
    form.dataset.editingId = "";
    openProductDialog(null);
  });
  root.querySelector("#closeProductDialog").addEventListener("click", () => dialog.close());
  root.querySelector("#cancelProductDialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    form.reset();
    delete form.dataset.editingId;
    clearValidation();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  form.addEventListener("submit", handleProductSubmit);
  form.addEventListener("input", (event) => {
    const field = event.target;
    if (!field.id) return;
    const error = root.querySelector(`#${field.id}Error`);
    if (error) error.textContent = "";
    field.removeAttribute("aria-invalid");
    formFeedback.textContent = "";
  });

  search.addEventListener("input", updateRows);
  categoryFilter.addEventListener("change", updateRows);
  stockFilter.addEventListener("change", updateRows);
  sortSelect.addEventListener("change", updateRows);
  clearFiltersButton.addEventListener("click", resetProductFilters);

  tableBody.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-product]");
    const deleteButton = event.target.closest("[data-delete-product]");
    if (editButton) {
      const product = products.find((item) => item.id === editButton.dataset.editProduct);
      if (product) {
        form.dataset.editingId = product.id;
        openProductDialog(product);
      }
      return;
    }
    if (!deleteButton) return;

    const product = products.find((item) => item.id === deleteButton.dataset.deleteProduct);
    if (!product || !window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;

    try {
      repository.save(products.filter((item) => item.id !== product.id));
      refreshProducts();
      showNotice(`${product.name} was deleted.`, "success");
    } catch (error) {
      showNotice(error.message, "error");
    }
  });

  updateCategories();
  refreshProducts();
  return () => {
    if (dialog.open) dialog.close();
  };
}
