const currencyNames = {
  USD: "US Dollar (USD)",
  EUR: "Euro (EUR)",
  GBP: "British Pound (GBP)"
};
const dateFormatNames = {
  mdy: "Month / day / year",
  dmy: "Day / month / year",
  iso: "Year-month-day (ISO)"
};
const dateLocales = {
  mdy: "en-US",
  dmy: "en-GB",
  iso: "sv-SE"
};
const rangeNames = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  year: "This year",
  all: "All time"
};

function isValidPhone(value) {
  if (!value) return true;
  const digits = value.replace(/\D/g, "");
  return /^\+?[0-9\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
}

function showFeedback(element, message, isError = false) {
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle("settings-feedback--error", isError);
  element.setAttribute("role", isError ? "alert" : "status");
}

function readFormValues(form) {
  return [...form.elements]
    .filter((element) => element.name)
    .reduce((values, element) => {
      values[element.name] = element.type === "checkbox" ? element.checked : element.value.trim();
      return values;
    }, {});
}

function setFormValues(form, values) {
  [...form.elements].forEach((element) => {
    if (!element.name || !(element.name in values)) return;
    if (element.type === "checkbox") element.checked = values[element.name];
    else element.value = values[element.name];
  });
}

export function initSettings(root, repository, onSettingsSaved = () => {}, onBusinessDataReset = () => {}) {
  root.innerHTML = `<section class="settings-page" aria-labelledby="settingsIntroTitle">
    <header class="settings-intro">
      <div><h2 id="settingsIntroTitle">Settings</h2><p>Manage your store identity, workspace preferences, and local data.</p></div>
    </header>
    <div class="product-notice settings-storage-warning" id="settingsStorageWarning" role="status" hidden></div>
    <div class="settings-grid">
      <article class="panel settings-card settings-card--wide">
        <header class="settings-card-heading">
          <div><h3>Business information</h3><p>These details identify your store across Nova Dashboard.</p></div>
        </header>
        <form class="settings-form" id="businessSettingsForm" novalidate>
          <div class="product-form-fields settings-fields">
            <label class="product-form-field">
              <span>Store / business name <span aria-hidden="true">*</span></span>
              <input name="name" type="text" maxlength="100" autocomplete="organization" required>
            </label>
            <label class="product-form-field">
              <span>Business email</span>
              <input name="email" type="email" maxlength="160" autocomplete="email">
            </label>
            <label class="product-form-field">
              <span>Business phone</span>
              <input name="phone" type="tel" maxlength="40" autocomplete="tel">
            </label>
            <label class="product-form-field">
              <span>Business address</span>
              <input name="address" type="text" maxlength="300" autocomplete="street-address">
            </label>
            <label class="product-form-field product-form-field--full">
              <span>Short business description</span>
              <textarea name="description" rows="3" maxlength="280"></textarea>
            </label>
          </div>
          <p class="settings-feedback" id="businessSettingsFeedback" role="status" aria-live="polite" hidden></p>
          <footer class="settings-actions">
            <button class="button-text" id="cancelBusinessSettings" type="button">Cancel</button>
            <button class="button-text" id="restoreBusinessDefaults" type="button">Reset business details</button>
            <button class="button-primary" type="submit">Save business details</button>
          </footer>
        </form>
      </article>

      <article class="panel settings-card">
        <header class="settings-card-heading">
          <div><h3>Preferences</h3><p>Choose how Nova displays dates and numbers.</p></div>
        </header>
        <form class="settings-form" id="preferencesForm">
          <div class="product-form-fields settings-fields">
            <label class="product-form-field">
              <span>Preferred currency</span>
              <select name="currency">
                ${Object.entries(currencyNames).map(([code, name]) => `<option value="${code}">${name}</option>`).join("")}
              </select>
            </label>
            <label class="product-form-field">
              <span>Date format</span>
              <select name="dateFormat">
                ${Object.entries(dateFormatNames).map(([value, name]) => `<option value="${value}">${name}</option>`).join("")}
              </select>
            </label>
            <label class="product-form-field">
              <span>Number formatting</span>
              <select name="numberFormat">
                <option value="en-US">1,234.56 (English - US)</option>
                <option value="en-GB">1,234.56 (English - UK)</option>
                <option value="de-DE">1.234,56 (German)</option>
              </select>
            </label>
            <label class="product-form-field">
              <span>Default Analytics range</span>
              <select name="defaultAnalyticsRange">
                ${Object.entries(rangeNames).map(([value, name]) => `<option value="${value}">${name}</option>`).join("")}
              </select>
            </label>
          </div>
          <p class="settings-preview" id="settingsFormatPreview" aria-live="polite"></p>
          <p class="settings-help">Currency selection is saved and previewed here, but product, order, inventory, customer, and analytics amounts remain USD. No conversion or currency relabeling is applied.</p>
          <p class="settings-feedback" id="preferencesFeedback" role="status" aria-live="polite" hidden></p>
          <footer class="settings-actions">
            <button class="button-text" id="cancelPreferences" type="button">Cancel</button>
            <button class="button-primary" type="submit">Save preferences</button>
          </footer>
        </form>
      </article>

      <article class="panel settings-card">
        <header class="settings-card-heading">
          <div><h3>Appearance</h3><p>Adjust table spacing while keeping the Nova light theme consistent.</p></div>
        </header>
        <form class="settings-form" id="appearanceForm">
          <div class="product-form-fields settings-fields">
            <label class="product-form-field">
              <span>Table density</span>
              <select name="tableDensity">
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
          </div>
          <p class="settings-feedback" id="appearanceFeedback" role="status" aria-live="polite" hidden></p>
          <footer class="settings-actions">
            <button class="button-text" id="cancelAppearance" type="button">Cancel</button>
            <button class="button-primary" type="submit">Save appearance</button>
          </footer>
        </form>
      </article>

      <article class="panel settings-card">
        <header class="settings-card-heading">
          <div><h3>Notifications</h3><p>Choose which in-app alert preferences are enabled.</p></div>
        </header>
        <form class="settings-form" id="notificationsForm">
          <div class="settings-toggle-list">
            <label class="settings-toggle">
              <span><strong>Low-stock alerts</strong><small>Show the inventory attention indicator in navigation.</small></span>
              <input name="lowStockAlerts" type="checkbox">
            </label>
            <label class="settings-toggle">
              <span><strong>Order updates</strong><small>Preference for future in-app order alerts.</small></span>
              <input name="orderUpdates" type="checkbox">
            </label>
            <label class="settings-toggle">
              <span><strong>Customer updates</strong><small>Preference for future in-app customer alerts.</small></span>
              <input name="customerUpdates" type="checkbox">
            </label>
          </div>
          <p class="settings-help">These are saved preferences only. Nova does not send email, push, or browser notifications.</p>
          <p class="settings-feedback" id="notificationsFeedback" role="status" aria-live="polite" hidden></p>
          <footer class="settings-actions">
            <button class="button-text" id="cancelNotifications" type="button">Cancel</button>
            <button class="button-primary" type="submit">Save notifications</button>
          </footer>
        </form>
      </article>

      <article class="panel settings-card settings-card--data">
        <header class="settings-card-heading">
          <div><h3>Data management</h3><p>Download a local backup of your Nova Dashboard data.</p></div>
        </header>
        <div class="settings-data-content">
          <p>Backup includes products, orders, customers, inventory movements, and settings. Missing storage entries are included as <code>null</code>.</p>
          <div class="settings-actions">
            <button class="button-secondary" id="exportBackup" type="button">Export JSON backup</button>
          </div>
          <p class="settings-feedback" id="backupFeedback" role="status" aria-live="polite" hidden></p>
          <p class="settings-help">Import is not available yet. Keep this backup file somewhere safe; it cannot currently be restored from Settings.</p>
        </div>
      </article>

      <article class="settings-danger-zone">
        <div><h3>Danger zone</h3><p>Remove saved products, orders, customers, and inventory movements. Settings are retained; demo records will be seeded again after the application reloads.</p></div>
        <button class="button-danger" id="openBusinessReset" type="button">Reset business data</button>
      </article>
    </div>

    <dialog class="product-dialog settings-confirm-dialog" id="businessDefaultsDialog" aria-labelledby="businessDefaultsTitle">
      <div class="settings-dialog-shell">
        <header class="product-dialog-header"><div><span class="dialog-eyebrow">Business information</span><h2 id="businessDefaultsTitle">Restore default business details?</h2></div>
          <button class="icon-button dialog-close" type="button" data-close-business-defaults aria-label="Close dialog">×</button></header>
        <div class="settings-dialog-content"><p>Your saved business name, email, phone, address, and description will be replaced by the Nova demo defaults. Preferences and business data will not change.</p>
          <div class="settings-actions"><button class="button-secondary" type="button" data-close-business-defaults>Cancel</button><button class="button-danger" id="confirmBusinessDefaults" type="button">Restore defaults</button></div>
        </div>
      </div>
    </dialog>

    <dialog class="product-dialog settings-confirm-dialog" id="businessResetDialog" aria-labelledby="businessResetTitle">
      <form class="product-dialog-shell settings-reset-form" id="businessResetForm" novalidate>
        <header class="product-dialog-header"><div><span class="dialog-eyebrow">Permanent action</span><h2 id="businessResetTitle">Reset business data?</h2></div>
          <button class="icon-button dialog-close" type="button" data-close-business-reset aria-label="Close dialog">×</button></header>
        <div class="settings-dialog-content">
          <p>This removes saved products, orders, customers, and inventory movements. Your Settings remain untouched. Demo data will be restored after reloading the application.</p>
          <label class="product-form-field"><span>Type <strong>RESET</strong> to confirm</span><input id="businessResetConfirmation" type="text" autocomplete="off"></label>
          <p class="settings-feedback" id="businessResetFeedback" role="alert" aria-live="assertive" hidden></p>
          <div class="settings-actions"><button class="button-secondary" type="button" data-close-business-reset>Cancel</button><button class="button-danger" type="submit">Reset business data</button></div>
        </div>
      </form>
    </dialog>
  </section>`;

  const businessForm = root.querySelector("#businessSettingsForm");
  const preferencesForm = root.querySelector("#preferencesForm");
  const appearanceForm = root.querySelector("#appearanceForm");
  const notificationsForm = root.querySelector("#notificationsForm");
  const businessFeedback = root.querySelector("#businessSettingsFeedback");
  const preferencesFeedback = root.querySelector("#preferencesFeedback");
  const appearanceFeedback = root.querySelector("#appearanceFeedback");
  const notificationsFeedback = root.querySelector("#notificationsFeedback");
  const backupFeedback = root.querySelector("#backupFeedback");
  const resetDialog = root.querySelector("#businessResetDialog");
  const resetForm = root.querySelector("#businessResetForm");
  const resetFeedback = root.querySelector("#businessResetFeedback");

  function populateForms() {
    const settings = repository.getAll();
    setFormValues(businessForm, settings.business);
    setFormValues(preferencesForm, settings.preferences);
    setFormValues(appearanceForm, settings.appearance);
    setFormValues(notificationsForm, settings.notifications);
    renderFormatPreview();
  }

  function renderFormatPreview() {
    const values = readFormValues(preferencesForm);
    const currency = new Intl.NumberFormat(values.numberFormat, {
      style: "currency",
      currency: values.currency,
      maximumFractionDigits: 2
    }).format(1234.56);
    const number = new Intl.NumberFormat(values.numberFormat).format(1234.56);
    const date = new Intl.DateTimeFormat(dateLocales[values.dateFormat], {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(2025, 0, 2, 12));
    root.querySelector("#settingsFormatPreview").textContent =
      `Preview: ${currency} · ${number} · ${date} · Analytics opens to ${rangeNames[values.defaultAnalyticsRange]}.`;
  }

  const storageWarning = root.querySelector("#settingsStorageWarning");
  const warningMessage = repository.getWarning();
  storageWarning.textContent = warningMessage;
  storageWarning.hidden = !warningMessage;
  populateForms();

  businessForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = readFormValues(businessForm);
    const email = values.email.trim();
    const phone = values.phone.trim();
    if (!values.name.trim()) {
      showFeedback(businessFeedback, "Enter a business name before saving.", true);
      businessForm.elements.namedItem("name").focus();
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFeedback(businessFeedback, "Enter a valid business email address or leave the field blank.", true);
      businessForm.elements.namedItem("email").focus();
      return;
    }
    if (!isValidPhone(phone)) {
      showFeedback(businessFeedback, "Enter a phone number with 7 to 15 digits, or leave the field blank.", true);
      businessForm.elements.namedItem("phone").focus();
      return;
    }
    try {
      repository.updateSection("business", { ...values, name: values.name.trim(), email, phone });
      onSettingsSaved();
      showFeedback(businessFeedback, "Business details saved.");
    } catch (error) {
      showFeedback(businessFeedback, error.message, true);
    }
  });

  root.querySelector("#cancelBusinessSettings").addEventListener("click", () => {
    setFormValues(businessForm, repository.getBusiness());
    showFeedback(businessFeedback, "");
  });

  const defaultsDialog = root.querySelector("#businessDefaultsDialog");
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const activeDialog = [defaultsDialog, resetDialog].find((dialog) => dialog.open);
    if (!activeDialog) return;
    event.preventDefault();
    activeDialog.close();
  });
  root.querySelector("#restoreBusinessDefaults").addEventListener("click", () => defaultsDialog.showModal());
  root.querySelectorAll("[data-close-business-defaults]").forEach((button) => {
    button.addEventListener("click", () => defaultsDialog.close());
  });
  root.querySelector("#confirmBusinessDefaults").addEventListener("click", () => {
    try {
      repository.resetSection("business");
      defaultsDialog.close();
      setFormValues(businessForm, repository.getBusiness());
      onSettingsSaved();
      showFeedback(businessFeedback, "Business details restored to defaults.");
    } catch (error) {
      defaultsDialog.close();
      showFeedback(businessFeedback, error.message, true);
    }
  });

  preferencesForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      repository.updateSection("preferences", readFormValues(preferencesForm));
      onSettingsSaved();
      renderFormatPreview();
      showFeedback(preferencesFeedback, "Preferences saved. Business amounts continue to display in USD.");
    } catch (error) {
      showFeedback(preferencesFeedback, error.message, true);
    }
  });
  root.querySelector("#cancelPreferences").addEventListener("click", () => {
    setFormValues(preferencesForm, repository.getPreferences());
    renderFormatPreview();
    showFeedback(preferencesFeedback, "");
  });
  preferencesForm.addEventListener("change", renderFormatPreview);

  appearanceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      repository.updateSection("appearance", readFormValues(appearanceForm));
      onSettingsSaved();
      showFeedback(appearanceFeedback, "Appearance saved.");
    } catch (error) {
      showFeedback(appearanceFeedback, error.message, true);
    }
  });
  root.querySelector("#cancelAppearance").addEventListener("click", () => {
    setFormValues(appearanceForm, repository.getAppearance());
    showFeedback(appearanceFeedback, "");
  });

  notificationsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      repository.updateSection("notifications", readFormValues(notificationsForm));
      onSettingsSaved();
      showFeedback(notificationsFeedback, "Notification preferences saved.");
    } catch (error) {
      showFeedback(notificationsFeedback, error.message, true);
    }
  });
  root.querySelector("#cancelNotifications").addEventListener("click", () => {
    setFormValues(notificationsForm, repository.getNotifications());
    showFeedback(notificationsFeedback, "");
  });

  root.querySelector("#exportBackup").addEventListener("click", () => {
    try {
      const backup = repository.createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const downloadURL = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadURL;
      link.download = `nova-dashboard-backup-${backup.createdAt.slice(0, 10)}.json`;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadURL), 1000);
      showFeedback(backupFeedback, "Backup download started.");
    } catch (error) {
      showFeedback(backupFeedback, error.message, true);
    }
  });

  const openResetButton = root.querySelector("#openBusinessReset");
  openResetButton.addEventListener("click", () => {
    root.querySelector("#businessResetConfirmation").value = "";
    showFeedback(resetFeedback, "");
    resetDialog.showModal();
  });
  root.querySelectorAll("[data-close-business-reset]").forEach((button) => {
    button.addEventListener("click", () => resetDialog.close());
  });
  resetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const confirmation = root.querySelector("#businessResetConfirmation");
    if (confirmation.value.trim() !== "RESET") {
      showFeedback(resetFeedback, "Type RESET exactly to confirm. No data has been changed.", true);
      confirmation.focus();
      return;
    }
    try {
      repository.resetBusinessData();
      resetDialog.close();
      onBusinessDataReset();
    } catch (error) {
      showFeedback(resetFeedback, error.message, true);
    }
  });

  return () => {};
}
