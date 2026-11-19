export const ORDER_STORAGE_KEY = "nova-dashboard.orders.v1";
export const ORDER_STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
export const PAYMENT_STATUSES = ["Unpaid", "Paid", "Refunded"];
export const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer"];

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function hasCentPrecision(value) {
  return Math.abs(value * 100 - Math.round(value * 100)) <= 1e-8;
}

function makeItem(productId, productName, sku, unitPrice, quantity) {
  return {
    productId,
    productName,
    sku,
    unitPrice,
    quantity,
    lineTotal: roundMoney(unitPrice * quantity)
  };
}

function makeDemoOrder(orderNumber, customerName, customerEmail, customerPhone, items, discount, paymentMethod, paymentStatus, orderStatus, createdAt) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  return {
    id: `ord_demo_${orderNumber.slice(3)}`,
    orderNumber,
    customerName,
    customerEmail,
    customerPhone,
    items,
    subtotal,
    discount,
    total: roundMoney(subtotal - discount),
    paymentMethod,
    paymentStatus,
    orderStatus,
    inventoryApplied: false,
    notes: "",
    createdAt,
    updatedAt: createdAt
  };
}

const demoOrders = [
  makeDemoOrder("NV-1008", "Maya Chen", "maya.chen@example.com", "", [
    makeItem("prd_nova_001", "Ribbed Ceramic Vase", "NOVA-CER-001", 54, 2),
    makeItem("prd_nova_006", "Woven Market Tote", "NOVA-TEX-009", 42.5, 1)
  ], 5, "Card", "Paid", "Processing", "2026-11-19T13:15:00.000Z"),
  makeDemoOrder("NV-1007", "Theo Martin", "theo.martin@example.com", "", [
    makeItem("prd_nova_004", "Hand-thrown Mug", "NOVA-CER-023", 28, 2),
    makeItem("prd_nova_003", "Solstice Candle Set", "NOVA-FRG-006", 38, 1)
  ], 0, "Cash", "Paid", "Shipped", "2026-11-19T10:40:00.000Z"),
  makeDemoOrder("NV-1006", "Amara Okafor", "amara.okafor@example.com", "", [
    makeItem("prd_nova_008", "Sculpted Oak Tray", "NOVA-HOM-005", 68, 1),
    makeItem("prd_nova_001", "Ribbed Ceramic Vase", "NOVA-CER-001", 54, 1)
  ], 0, "Bank Transfer", "Paid", "Delivered", "2026-11-18T16:20:00.000Z"),
  makeDemoOrder("NV-1005", "Oliver James", "", "", [
    makeItem("prd_nova_002", "Linen Table Runner", "NOVA-TEX-014", 55, 2)
  ], 0, "Card", "Unpaid", "Processing", "2026-11-18T12:05:00.000Z"),
  makeDemoOrder("NV-1004", "Sofia Laurent", "sofia.laurent@example.com", "", [
    makeItem("prd_nova_007", "Botanical Room Mist", "NOVA-FRG-011", 32, 2),
    makeItem("prd_nova_003", "Solstice Candle Set", "NOVA-FRG-006", 38, 1)
  ], 0, "Card", "Refunded", "Delivered", "2026-11-17T14:50:00.000Z"),
  makeDemoOrder("NV-1003", "Leah Kim", "", "", [
    makeItem("prd_nova_004", "Hand-thrown Mug", "NOVA-CER-023", 28, 1)
  ], 0, "Cash", "Unpaid", "Pending", "2026-11-17T09:30:00.000Z"),
  makeDemoOrder("NV-1002", "Daniel Rivera", "daniel.rivera@example.com", "", [
    makeItem("prd_nova_005", "Arc Table Lamp", "NOVA-LGT-002", 164, 1),
    makeItem("prd_nova_003", "Solstice Candle Set", "NOVA-FRG-006", 38, 1)
  ], 10, "Bank Transfer", "Paid", "Shipped", "2026-11-16T17:10:00.000Z"),
  makeDemoOrder("NV-1001", "Aisha Patel", "", "", [
    makeItem("prd_nova_006", "Woven Market Tote", "NOVA-TEX-009", 42.5, 1)
  ], 0, "Card", "Refunded", "Cancelled", "2026-11-16T11:25:00.000Z")
];

function cloneOrder(order) {
  return { ...order, items: order.items.map((item) => ({ ...item })) };
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isOrderItem(item) {
  if (!item || typeof item !== "object") return false;
  if (typeof item.productId !== "string" || !item.productId.trim()) return false;
  if (typeof item.productName !== "string" || !item.productName.trim()) return false;
  if (typeof item.sku !== "string" || !item.sku.trim()) return false;
  if (typeof item.unitPrice !== "number" || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) return false;
  if (!hasCentPrecision(item.unitPrice)) return false;
  if (!Number.isInteger(item.quantity) || item.quantity < 1) return false;
  return typeof item.lineTotal === "number"
    && Number.isFinite(item.lineTotal)
    && hasCentPrecision(item.lineTotal)
    && Math.round(item.lineTotal * 100) === Math.round(roundMoney(item.unitPrice * item.quantity) * 100);
}

function isOrderRecord(order) {
  if (!order || typeof order !== "object") return false;
  if (typeof order.id !== "string" || !order.id.trim()) return false;
  if (typeof order.orderNumber !== "string" || !/^NV-\d{4,}$/.test(order.orderNumber)) return false;
  if (typeof order.customerName !== "string" || !order.customerName.trim()) return false;
  if (typeof order.customerEmail !== "string" || typeof order.customerPhone !== "string") return false;
  if (order.customerId !== undefined && (typeof order.customerId !== "string" || !order.customerId.trim())) return false;
  if (!Array.isArray(order.items) || order.items.length === 0 || !order.items.every(isOrderItem)) return false;
  if (new Set(order.items.map((item) => item.productId)).size !== order.items.length) return false;

  const subtotal = roundMoney(order.items.reduce((sum, item) => sum + item.lineTotal, 0));
  if (typeof order.subtotal !== "number" || !hasCentPrecision(order.subtotal) || Math.round(order.subtotal * 100) !== Math.round(subtotal * 100)) return false;
  if (typeof order.discount !== "number" || !Number.isFinite(order.discount) || !hasCentPrecision(order.discount) || order.discount < 0 || order.discount > subtotal) return false;
  if (typeof order.total !== "number" || !hasCentPrecision(order.total) || Math.round(order.total * 100) !== Math.round(roundMoney(subtotal - order.discount) * 100)) return false;
  if (!PAYMENT_METHODS.includes(order.paymentMethod)) return false;
  if (!PAYMENT_STATUSES.includes(order.paymentStatus)) return false;
  if (!ORDER_STATUSES.includes(order.orderStatus)) return false;
  if (typeof order.inventoryApplied !== "boolean") return false;
  if (typeof order.notes !== "string" || !isValidDate(order.createdAt) || !isValidDate(order.updatedAt)) return false;
  return true;
}

function validateOrders(orders) {
  if (!Array.isArray(orders) || !orders.every(isOrderRecord)) {
    throw new Error("Order data does not match the expected format.");
  }

  const ids = new Set();
  const orderNumbers = new Set();
  for (const order of orders) {
    const number = order.orderNumber.toLocaleLowerCase();
    if (ids.has(order.id) || orderNumbers.has(number)) {
      throw new Error("Order IDs and order numbers must be unique.");
    }
    ids.add(order.id);
    orderNumbers.add(number);
  }
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function persistOrders(orders) {
  validateOrders(orders);
  const storage = getStorage();
  if (!storage) throw new Error("Browser storage is unavailable. Order changes were not saved.");

  try {
    storage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    throw new Error("Order changes could not be saved to browser storage.");
  }
}

function readInitialOrders() {
  const storage = getStorage();
  if (!storage) {
    return {
      orders: demoOrders.map(cloneOrder),
      warning: "Browser storage is unavailable. Order changes cannot be saved."
    };
  }

  let savedData;
  try {
    savedData = storage.getItem(ORDER_STORAGE_KEY);
  } catch {
    return {
      orders: demoOrders.map(cloneOrder),
      warning: "Saved orders could not be read. Order changes cannot be saved."
    };
  }

  if (savedData === null) {
    const orders = demoOrders.map(cloneOrder);
    try {
      persistOrders(orders);
      return { orders, warning: "" };
    } catch {
      return { orders, warning: "Browser storage is unavailable. Order changes cannot be saved." };
    }
  }

  try {
    const orders = JSON.parse(savedData);
    validateOrders(orders);
    return { orders: orders.map(cloneOrder), warning: "" };
  } catch {
    return {
      orders: demoOrders.map(cloneOrder),
      warning: "Saved order data is invalid. Demo orders are shown and the saved value has not been changed."
    };
  }
}

export function createOrderRepository() {
  const initialState = readInitialOrders();
  let orders = initialState.orders;
  let warning = initialState.warning;

  return {
    getAll() {
      return orders.map(cloneOrder);
    },
    getWarning() {
      return warning;
    },
    save(nextOrders) {
      persistOrders(nextOrders);
      orders = nextOrders.map(cloneOrder);
      warning = "";
    }
  };
}

export function createOrderId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createOrderNumber(orders) {
  const highestNumber = orders.reduce((highest, order) => {
    const match = order.orderNumber.match(/^NV-(\d+)$/i);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 1000);
  return `NV-${highestNumber + 1}`;
}

export function commitOrderAndInventory(productRepository, orderRepository, nextProducts, nextOrders) {
  const previousProducts = productRepository.getAll();
  let inventorySaved = false;

  try {
    productRepository.save(nextProducts);
    inventorySaved = true;
    orderRepository.save(nextOrders);
  } catch (error) {
    if (inventorySaved) {
      try {
        productRepository.save(previousProducts);
      } catch (rollbackError) {
        throw new Error(`${error.message} Inventory rollback also failed: ${rollbackError.message}`);
      }
    }
    throw error;
  }
}
