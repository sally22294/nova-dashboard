export const CUSTOMER_STORAGE_KEY = "nova-dashboard.customers.v1";

const demoCustomers = [
  {
    id: "cus_demo_001",
    name: "Maya Chen",
    email: "maya.chen@example.com",
    phone: "",
    address: "",
    notes: "",
    createdAt: "2026-10-28T10:00:00.000Z",
    updatedAt: "2026-10-28T10:00:00.000Z"
  },
  {
    id: "cus_demo_002",
    name: "Theo Martin",
    email: "theo.martin@example.com",
    phone: "",
    address: "",
    notes: "",
    createdAt: "2026-10-24T11:15:00.000Z",
    updatedAt: "2026-10-24T11:15:00.000Z"
  },
  {
    id: "cus_demo_003",
    name: "Amara Okafor",
    email: "amara.okafor@example.com",
    phone: "",
    address: "",
    notes: "",
    createdAt: "2026-10-18T08:45:00.000Z",
    updatedAt: "2026-10-18T08:45:00.000Z"
  },
  {
    id: "cus_demo_004",
    name: "Sofia Laurent",
    email: "sofia.laurent@example.com",
    phone: "",
    address: "",
    notes: "",
    createdAt: "2026-10-12T12:20:00.000Z",
    updatedAt: "2026-10-12T12:20:00.000Z"
  },
  {
    id: "cus_demo_005",
    name: "Daniel Rivera",
    email: "daniel.rivera@example.com",
    phone: "",
    address: "",
    notes: "",
    createdAt: "2026-10-09T15:40:00.000Z",
    updatedAt: "2026-10-09T15:40:00.000Z"
  }
];

function cloneCustomers(customers) {
  return customers.map((customer) => ({ ...customer }));
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function normalizeCustomerEmail(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

export function normalizeCustomerPhone(value) {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : "";
}

export function isValidCustomerEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidCustomerPhone(value) {
  if (!value) return true;
  return /^\+?[0-9\s().-]+$/.test(value.trim()) && Boolean(normalizeCustomerPhone(value));
}

function isCustomerRecord(customer) {
  if (!customer || typeof customer !== "object") return false;
  if (typeof customer.id !== "string" || !customer.id.trim()) return false;
  if (typeof customer.name !== "string" || !customer.name.trim() || customer.name.length > 100) return false;
  if (typeof customer.email !== "string" || customer.email.length > 160 || !isValidCustomerEmail(customer.email)) return false;
  if (typeof customer.phone !== "string" || customer.phone.length > 40 || !isValidCustomerPhone(customer.phone)) return false;
  if (customer.address !== undefined && (typeof customer.address !== "string" || customer.address.length > 300)) return false;
  if (customer.notes !== undefined && (typeof customer.notes !== "string" || customer.notes.length > 1000)) return false;
  return isValidDate(customer.createdAt) && isValidDate(customer.updatedAt);
}

function validateCustomers(customers) {
  if (!Array.isArray(customers) || !customers.every(isCustomerRecord)) {
    throw new Error("Customer data does not match the expected format.");
  }

  const ids = new Set();
  const emails = new Set();
  const phones = new Set();
  for (const customer of customers) {
    const email = normalizeCustomerEmail(customer.email);
    const phone = normalizeCustomerPhone(customer.phone);
    if (ids.has(customer.id) || (email && emails.has(email)) || (phone && phones.has(phone))) {
      throw new Error("Customer IDs, email addresses, and phone numbers must be unique.");
    }
    ids.add(customer.id);
    if (email) emails.add(email);
    if (phone) phones.add(phone);
  }
}

export function findDuplicateCustomer(customers, candidate, excludeId = "") {
  const email = normalizeCustomerEmail(candidate.email);
  const phone = normalizeCustomerPhone(candidate.phone);
  if (email && customers.some((customer) => customer.id !== excludeId && normalizeCustomerEmail(customer.email) === email)) {
    return { field: "email", message: "A customer with this email address already exists." };
  }
  if (phone && customers.some((customer) => customer.id !== excludeId && normalizeCustomerPhone(customer.phone) === phone)) {
    return { field: "phone", message: "A customer with this phone number already exists." };
  }
  return null;
}

export function findMatchingCustomer(customers, emailValue, phoneValue) {
  const email = normalizeCustomerEmail(emailValue);
  const phone = normalizeCustomerPhone(phoneValue);
  const emailMatches = email
    ? customers.filter((customer) => normalizeCustomerEmail(customer.email) === email)
    : [];
  const phoneMatches = phone
    ? customers.filter((customer) => normalizeCustomerPhone(customer.phone) === phone)
    : [];
  if (emailMatches.length > 1 || phoneMatches.length > 1) return null;

  const emailMatch = emailMatches[0] || null;
  const phoneMatch = phoneMatches[0] || null;
  if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) return null;
  return emailMatch || phoneMatch;
}

function createCustomerId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `cus_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function persistCustomers(customers) {
  validateCustomers(customers);
  const storage = getStorage();
  if (!storage) throw new Error("Browser storage is unavailable. Customer changes were not saved.");
  try {
    storage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customers));
  } catch {
    throw new Error("Customer changes could not be saved to browser storage.");
  }
}

function readInitialCustomers() {
  const storage = getStorage();
  if (!storage) {
    return {
      customers: cloneCustomers(demoCustomers),
      warning: "Browser storage is unavailable. Customer changes cannot be saved."
    };
  }

  let savedData;
  try {
    savedData = storage.getItem(CUSTOMER_STORAGE_KEY);
  } catch {
    return {
      customers: cloneCustomers(demoCustomers),
      warning: "Saved customers could not be read. Customer changes cannot be saved."
    };
  }

  if (savedData === null) {
    const customers = cloneCustomers(demoCustomers);
    try {
      storage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customers));
      return { customers, warning: "" };
    } catch {
      return {
        customers,
        warning: "Browser storage is unavailable. Customer changes cannot be saved."
      };
    }
  }

  try {
    const customers = JSON.parse(savedData);
    validateCustomers(customers);
    return { customers: cloneCustomers(customers), warning: "" };
  } catch {
    return {
      customers: cloneCustomers(demoCustomers),
      warning: "Saved customer data is invalid. Demo customers are shown and the saved value has not been changed."
    };
  }
}

export function createCustomerRepository() {
  const initialState = readInitialCustomers();
  let customers = initialState.customers;
  let warning = initialState.warning;

  function save(nextCustomers) {
    persistCustomers(nextCustomers);
    customers = cloneCustomers(nextCustomers);
    warning = "";
  }

  return {
    getAll() {
      return cloneCustomers(customers);
    },
    getWarning() {
      return warning;
    },
    save,
    create(values) {
      const duplicate = findDuplicateCustomer(customers, values);
      if (duplicate) throw new Error(duplicate.message);
      const now = new Date().toISOString();
      const customer = {
        id: createCustomerId(),
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        address: (values.address || "").trim(),
        notes: (values.notes || "").trim(),
        createdAt: now,
        updatedAt: now
      };
      save([...customers, customer]);
      return { ...customer };
    },
    update(customerId, values) {
      const existing = customers.find((customer) => customer.id === customerId);
      if (!existing) throw new Error("This customer is no longer available.");
      const duplicate = findDuplicateCustomer(customers, values, customerId);
      if (duplicate) throw new Error(duplicate.message);
      const updatedCustomer = {
        ...existing,
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        address: (values.address || "").trim(),
        notes: (values.notes || "").trim(),
        updatedAt: new Date().toISOString()
      };
      save(customers.map((customer) => customer.id === customerId ? updatedCustomer : customer));
      return { ...updatedCustomer };
    },
    delete(customerId) {
      if (!customers.some((customer) => customer.id === customerId)) return false;
      save(customers.filter((customer) => customer.id !== customerId));
      return true;
    }
  };
}
