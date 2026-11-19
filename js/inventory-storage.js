export const INVENTORY_MOVEMENT_STORAGE_KEY = "nova-dashboard.inventory-movements.v1";
export const STOCK_IN_REASONS = ["Supplier Restock", "Returned Items", "Opening Stock", "Other"];
export const STOCK_OUT_REASONS = ["Damaged Items", "Lost Items", "Internal Use", "Correction", "Other"];

function cloneMovement(movement) {
  return { ...movement };
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isValidMovement(movement) {
  if (!movement || typeof movement !== "object") return false;
  if (typeof movement.id !== "string" || !movement.id.trim()) return false;
  if (typeof movement.productId !== "string" || !movement.productId.trim()) return false;
  if (typeof movement.productName !== "string" || !movement.productName.trim()) return false;
  if (typeof movement.sku !== "string" || !movement.sku.trim()) return false;
  if (movement.type !== "stock_in" && movement.type !== "stock_out") return false;
  if (!Number.isSafeInteger(movement.quantity) || movement.quantity < 1) return false;
  if (!Number.isSafeInteger(movement.previousQuantity) || movement.previousQuantity < 0) return false;
  if (!Number.isSafeInteger(movement.newQuantity) || movement.newQuantity < 0) return false;
  const expectedQuantity = movement.type === "stock_in"
    ? movement.previousQuantity + movement.quantity
    : movement.previousQuantity - movement.quantity;
  if (!Number.isSafeInteger(expectedQuantity) || movement.newQuantity !== expectedQuantity) return false;
  const reasons = movement.type === "stock_in" ? STOCK_IN_REASONS : STOCK_OUT_REASONS;
  if (!reasons.includes(movement.reason)) return false;
  return typeof movement.notes === "string" && isValidDate(movement.createdAt);
}

function validateMovements(movements) {
  if (!Array.isArray(movements) || !movements.every(isValidMovement)) {
    throw new Error("Inventory movement data does not match the expected format.");
  }
  const ids = new Set();
  for (const movement of movements) {
    if (ids.has(movement.id)) throw new Error("Inventory movement IDs must be unique.");
    ids.add(movement.id);
  }
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStoredMovements() {
  const storage = getStorage();
  if (!storage) throw new Error("Browser storage is unavailable. The movement was not saved.");

  let savedData;
  try {
    savedData = storage.getItem(INVENTORY_MOVEMENT_STORAGE_KEY);
  } catch {
    throw new Error("Saved inventory history could not be read. The movement was not saved.");
  }
  if (savedData === null) return [];

  try {
    const movements = JSON.parse(savedData);
    validateMovements(movements);
    return movements.map(cloneMovement);
  } catch {
    throw new Error("Saved inventory history is invalid. No history or stock was changed.");
  }
}

function readInitialMovements() {
  const storage = getStorage();
  if (!storage) {
    return {
      movements: [],
      warning: "Browser storage is unavailable. Inventory movement history cannot be saved."
    };
  }

  let savedData;
  try {
    savedData = storage.getItem(INVENTORY_MOVEMENT_STORAGE_KEY);
  } catch {
    return {
      movements: [],
      warning: "Saved inventory history could not be read. Inventory movement history cannot be saved."
    };
  }

  if (savedData === null) {
    try {
      storage.setItem(INVENTORY_MOVEMENT_STORAGE_KEY, "[]");
      return { movements: [], warning: "" };
    } catch {
      return {
        movements: [],
        warning: "Browser storage is unavailable. Inventory movement history cannot be saved."
      };
    }
  }

  try {
    const movements = JSON.parse(savedData);
    validateMovements(movements);
    return { movements: movements.map(cloneMovement), warning: "" };
  } catch {
    return {
      movements: [],
      warning: "Saved inventory history is invalid. It has not been changed."
    };
  }
}

export function createInventoryMovementId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `mov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createInventoryMovementRepository() {
  const initialState = readInitialMovements();
  let movements = initialState.movements;
  let warning = initialState.warning;

  return {
    getAll() {
      return movements.map(cloneMovement);
    },
    getWarning() {
      return warning;
    },
    assertWritable() {
      readStoredMovements();
    },
    append(movement) {
      if (!isValidMovement(movement)) {
        throw new Error("Inventory movement data is invalid.");
      }

      const currentMovements = readStoredMovements();
      if (currentMovements.some((item) => item.id === movement.id)) {
        throw new Error("This inventory movement has already been recorded.");
      }
      const nextMovements = [...currentMovements, cloneMovement(movement)];
      validateMovements(nextMovements);
      const storage = getStorage();
      try {
        storage.setItem(INVENTORY_MOVEMENT_STORAGE_KEY, JSON.stringify(nextMovements));
      } catch {
        throw new Error("Inventory movement history could not be saved.");
      }

      movements = nextMovements.map(cloneMovement);
      warning = "";
      return cloneMovement(movement);
    }
  };
}
