import { CUSTOMER_STORAGE_KEY } from "./customer-storage.js";
import { INVENTORY_MOVEMENT_STORAGE_KEY } from "./inventory-storage.js";
import { ORDER_STORAGE_KEY } from "./order-storage.js";
import { PRODUCT_STORAGE_KEY } from "./product-storage.js";

export const SETTINGS_STORAGE_KEY = "nova-dashboard.settings.v1";

const businessDataEntries = [
  { name: "products", key: PRODUCT_STORAGE_KEY },
  { name: "orders", key: ORDER_STORAGE_KEY },
  { name: "customers", key: CUSTOMER_STORAGE_KEY },
  { name: "inventoryMovements", key: INVENTORY_MOVEMENT_STORAGE_KEY }
];
const allBackupEntries = [
  ...businessDataEntries,
  { name: "settings", key: SETTINGS_STORAGE_KEY }
];
const currencyCodes = ["USD", "EUR", "GBP"];
const dateFormats = ["mdy", "dmy", "iso"];
const numberFormats = ["en-US", "en-GB", "de-DE"];
const analyticsRanges = ["7", "30", "90", "year", "all"];
const tableDensities = ["comfortable", "compact"];

const defaultSettings = Object.freeze({
  schemaVersion: 1,
  business: Object.freeze({
    name: "Studio Sol",
    email: "",
    phone: "",
    address: "",
    description: "Thoughtfully chosen pieces for everyday living."
  }),
  preferences: Object.freeze({
    currency: "USD",
    dateFormat: "mdy",
    numberFormat: "en-US",
    defaultAnalyticsRange: "30"
  }),
  appearance: Object.freeze({
    tableDensity: "comfortable"
  }),
  notifications: Object.freeze({
    lowStockAlerts: true,
    orderUpdates: true,
    customerUpdates: true
  })
});

function cloneSettings(settings) {
  return {
    schemaVersion: settings.schemaVersion,
    business: { ...settings.business },
    preferences: { ...settings.preferences },
    appearance: { ...settings.appearance },
    notifications: { ...settings.notifications }
  };
}

function cloneDefaults() {
  return cloneSettings(defaultSettings);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidBusinessPhone(value) {
  if (!value) return true;
  const digits = value.replace(/\D/g, "");
  return /^\+?[0-9\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
}

export function validateSettings(settings) {
  if (!isRecord(settings) || settings.schemaVersion !== 1) {
    throw new Error("Settings data does not match the supported format.");
  }
  const { business, preferences, appearance, notifications } = settings;
  if (!isRecord(business)
    || typeof business.name !== "string"
    || !business.name.trim()
    || business.name.length > 100
    || typeof business.email !== "string"
    || business.email.length > 160
    || (business.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.email.trim()))
    || typeof business.phone !== "string"
    || business.phone.length > 40
    || !isValidBusinessPhone(business.phone.trim())
    || typeof business.address !== "string"
    || business.address.length > 300
    || typeof business.description !== "string"
    || business.description.length > 280) {
    throw new Error("Business settings are invalid. Check the name, email, phone, and field lengths.");
  }
  if (!isRecord(preferences)
    || !currencyCodes.includes(preferences.currency)
    || !dateFormats.includes(preferences.dateFormat)
    || !numberFormats.includes(preferences.numberFormat)
    || !analyticsRanges.includes(preferences.defaultAnalyticsRange)) {
    throw new Error("One or more preferences are unsupported.");
  }
  if (!isRecord(appearance) || !tableDensities.includes(appearance.tableDensity)) {
    throw new Error("Appearance settings are unsupported.");
  }
  if (!isRecord(notifications)
    || typeof notifications.lowStockAlerts !== "boolean"
    || typeof notifications.orderUpdates !== "boolean"
    || typeof notifications.customerUpdates !== "boolean") {
    throw new Error("Notification preferences are invalid.");
  }
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function persistSettings(settings) {
  validateSettings(settings);
  const storage = getStorage();
  if (!storage) throw new Error("Browser storage is unavailable. Settings were not saved.");
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    throw new Error("Settings could not be saved to browser storage.");
  }
}

function readInitialSettings() {
  const storage = getStorage();
  if (!storage) {
    return {
      settings: cloneDefaults(),
      warning: "Browser storage is unavailable. Settings cannot be saved."
    };
  }

  let savedData;
  try {
    savedData = storage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return {
      settings: cloneDefaults(),
      warning: "Saved settings could not be read. Settings cannot be saved."
    };
  }

  if (savedData === null) {
    const settings = cloneDefaults();
    try {
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      return { settings, warning: "" };
    } catch {
      return {
        settings,
        warning: "Browser storage is unavailable. Settings cannot be saved."
      };
    }
  }

  try {
    const settings = JSON.parse(savedData);
    validateSettings(settings);
    return { settings: cloneSettings(settings), warning: "" };
  } catch {
    return {
      settings: cloneDefaults(),
      warning: "Saved settings are invalid. Defaults are shown and the saved value has not been changed."
    };
  }
}

function readBackupValue(storage, entry) {
  let savedData;
  try {
    savedData = storage.getItem(entry.key);
  } catch {
    throw new Error(`Saved ${entry.name} data could not be read. No backup was created.`);
  }
  if (savedData === null) return null;
  try {
    return JSON.parse(savedData);
  } catch {
    throw new Error(`Saved ${entry.name} data is not valid JSON. No backup was created.`);
  }
}

function createBackup() {
  const storage = getStorage();
  if (!storage) throw new Error("Browser storage is unavailable. No backup was created.");
  const data = {};
  allBackupEntries.forEach((entry) => {
    data[entry.name] = readBackupValue(storage, entry);
  });
  return {
    format: "nova-dashboard-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    data
  };
}

function resetBusinessData() {
  const storage = getStorage();
  if (!storage) throw new Error("Browser storage is unavailable. Business data was not reset.");

  const snapshot = businessDataEntries.map((entry) => {
    try {
      return { key: entry.key, value: storage.getItem(entry.key) };
    } catch {
      throw new Error(`Saved ${entry.name} data could not be read. Nothing was reset.`);
    }
  });

  try {
    businessDataEntries.forEach((entry) => storage.removeItem(entry.key));
  } catch (error) {
    const rollbackErrors = [];
    snapshot.forEach(({ key, value }) => {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        rollbackErrors.push(key);
      }
    });
    if (rollbackErrors.length) {
      throw new Error(`Data reset failed and rollback could not restore: ${rollbackErrors.join(", ")}.`);
    }
    throw new Error(`Data reset failed. Existing business data was restored. ${error.message}`);
  }
}

export function getDefaultSettings() {
  return cloneDefaults();
}

export function createSettingsRepository() {
  const initialState = readInitialSettings();
  let settings = initialState.settings;
  let warning = initialState.warning;

  function save(nextSettings) {
    persistSettings(nextSettings);
    settings = cloneSettings(nextSettings);
    warning = "";
    return cloneSettings(settings);
  }

  return {
    getAll() {
      return cloneSettings(settings);
    },
    getBusiness() {
      return { ...settings.business };
    },
    getPreferences() {
      return { ...settings.preferences };
    },
    getAppearance() {
      return { ...settings.appearance };
    },
    getNotifications() {
      return { ...settings.notifications };
    },
    getWarning() {
      return warning;
    },
    save,
    updateSection(section, values) {
      if (!["business", "preferences", "appearance", "notifications"].includes(section) || !isRecord(values)) {
        throw new Error("The requested settings section is invalid.");
      }
      const nextSettings = cloneSettings(settings);
      nextSettings[section] = { ...nextSettings[section], ...values };
      return save(nextSettings);
    },
    resetSection(section) {
      if (!["business", "preferences", "appearance", "notifications"].includes(section)) {
        throw new Error("The requested settings section is invalid.");
      }
      const defaults = cloneDefaults();
      const nextSettings = cloneSettings(settings);
      nextSettings[section] = defaults[section];
      return save(nextSettings);
    },
    createBackup,
    resetBusinessData
  };
}
