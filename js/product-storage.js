export const PRODUCT_STORAGE_KEY = "nova-dashboard.products.v1";
const STOCK_STATUS = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock"
};
export const DEFAULT_PRODUCT_CATEGORIES = ["Ceramics", "Fragrance", "Home decor", "Lighting", "Textiles"];

const demoProducts = [
  { id: "prd_nova_001", name: "Ribbed Ceramic Vase", sku: "NOVA-CER-001", category: "Ceramics", price: 54, quantity: 18, lowStockThreshold: 5, image: "", description: "A hand-finished stoneware vase with a softly ribbed silhouette.", createdAt: "2026-10-28T10:00:00.000Z", updatedAt: "2026-11-12T09:30:00.000Z" },
  { id: "prd_nova_002", name: "Linen Table Runner", sku: "NOVA-TEX-014", category: "Textiles", price: 55, quantity: 4, lowStockThreshold: 6, image: "", description: "Washed flax linen with a relaxed, natural drape.", createdAt: "2026-10-22T11:15:00.000Z", updatedAt: "2026-11-18T14:10:00.000Z" },
  { id: "prd_nova_003", name: "Solstice Candle Set", sku: "NOVA-FRG-006", category: "Fragrance", price: 38, quantity: 7, lowStockThreshold: 8, image: "", description: "A pair of small-batch candles in cedar and fig.", createdAt: "2026-10-18T08:45:00.000Z", updatedAt: "2026-11-16T13:00:00.000Z" },
  { id: "prd_nova_004", name: "Hand-thrown Mug", sku: "NOVA-CER-023", category: "Ceramics", price: 28, quantity: 32, lowStockThreshold: 10, image: "", description: "A tactile everyday mug, individually shaped by hand.", createdAt: "2026-10-13T12:20:00.000Z", updatedAt: "2026-11-10T10:15:00.000Z" },
  { id: "prd_nova_005", name: "Arc Table Lamp", sku: "NOVA-LGT-002", category: "Lighting", price: 164, quantity: 0, lowStockThreshold: 3, image: "", description: "A compact sculptural lamp with a warm, diffused glow.", createdAt: "2026-10-09T15:40:00.000Z", updatedAt: "2026-11-19T08:25:00.000Z" },
  { id: "prd_nova_006", name: "Woven Market Tote", sku: "NOVA-TEX-009", category: "Textiles", price: 42.5, quantity: 16, lowStockThreshold: 4, image: "", description: "A sturdy woven carryall made for everyday errands.", createdAt: "2026-10-06T09:05:00.000Z", updatedAt: "2026-11-08T11:40:00.000Z" },
  { id: "prd_nova_007", name: "Botanical Room Mist", sku: "NOVA-FRG-011", category: "Fragrance", price: 32, quantity: 23, lowStockThreshold: 6, image: "", description: "A fresh botanical room spray in a reusable glass bottle.", createdAt: "2026-10-02T13:30:00.000Z", updatedAt: "2026-11-14T16:20:00.000Z" },
  { id: "prd_nova_008", name: "Sculpted Oak Tray", sku: "NOVA-HOM-005", category: "Home decor", price: 68, quantity: 5, lowStockThreshold: 5, image: "", description: "A solid oak catchall tray with softly rounded edges.", createdAt: "2026-09-28T10:50:00.000Z", updatedAt: "2026-11-17T12:05:00.000Z" }
];

function cloneProducts(products) {
  return products.map((product) => ({ ...product }));
}

function isProductRecord(product) {
  return product !== null
    && typeof product === "object"
    && typeof product.id === "string" && product.id.trim() !== ""
    && typeof product.name === "string" && product.name.trim() !== ""
    && typeof product.sku === "string" && product.sku.trim() !== ""
    && typeof product.category === "string" && product.category.trim() !== ""
    && typeof product.price === "number" && Number.isFinite(product.price) && product.price >= 0
    && Number.isInteger(product.quantity) && product.quantity >= 0
    && Number.isInteger(product.lowStockThreshold) && product.lowStockThreshold >= 1
    && typeof product.image === "string"
    && typeof product.description === "string"
    && typeof product.createdAt === "string" && !Number.isNaN(Date.parse(product.createdAt))
    && typeof product.updatedAt === "string" && !Number.isNaN(Date.parse(product.updatedAt));
}

function validateProductList(products) {
  if (!Array.isArray(products) || !products.every(isProductRecord)) {
    throw new Error("Product data does not match the expected format.");
  }

  const ids = new Set();
  const skus = new Set();
  for (const product of products) {
    const sku = product.sku.trim().toLowerCase();
    if (ids.has(product.id) || skus.has(sku)) {
      throw new Error("Product IDs and SKUs must be unique.");
    }
    ids.add(product.id);
    skus.add(sku);
  }
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readInitialProducts() {
  const storage = getStorage();
  if (!storage) {
    return {
      products: cloneProducts(demoProducts),
      warning: "Browser storage is unavailable. Product changes cannot be saved."
    };
  }

  let savedData;
  try {
    savedData = storage.getItem(PRODUCT_STORAGE_KEY);
  } catch {
    return {
      products: cloneProducts(demoProducts),
      warning: "Saved products could not be read. Product changes cannot be saved."
    };
  }

  if (savedData === null) {
    const products = cloneProducts(demoProducts);
    try {
      storage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
      return { products, warning: "" };
    } catch {
      return {
        products,
        warning: "Browser storage is unavailable. Product changes cannot be saved."
      };
    }
  }

  try {
    const products = JSON.parse(savedData);
    validateProductList(products);
    return { products: cloneProducts(products), warning: "" };
  } catch {
    return {
      products: cloneProducts(demoProducts),
      warning: "Saved product data is invalid. Demo products are shown and the saved value has not been changed."
    };
  }
}

function persistProducts(products) {
  validateProductList(products);
  const storage = getStorage();
  if (!storage) {
    throw new Error("Browser storage is unavailable. Product changes were not saved.");
  }

  try {
    storage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
  } catch {
    throw new Error("Product changes could not be saved to browser storage.");
  }
}

function readSavedProducts() {
  const storage = getStorage();
  if (!storage) throw new Error("Browser storage is unavailable. Stock was not changed.");

  let savedData;
  try {
    savedData = storage.getItem(PRODUCT_STORAGE_KEY);
  } catch {
    throw new Error("Saved products could not be read. Stock was not changed.");
  }
  if (savedData === null) {
    throw new Error("Saved products are no longer available. Reload the page before adjusting stock.");
  }

  try {
    const savedProducts = JSON.parse(savedData);
    validateProductList(savedProducts);
    return cloneProducts(savedProducts);
  } catch {
    throw new Error("Saved product data is invalid. Stock was not changed.");
  }
}

export function createProductRepository() {
  const initialState = readInitialProducts();
  let products = initialState.products;
  let warning = initialState.warning;

  return {
    getAll() {
      return cloneProducts(products);
    },
    getWarning() {
      return warning;
    },
    save(nextProducts) {
      persistProducts(nextProducts);
      products = cloneProducts(nextProducts);
      warning = "";
    },
    adjustQuantity(productId, expectedQuantity, adjustment, updatedAt) {
      if (typeof productId !== "string" || !productId.trim()) {
        throw new Error("Choose a valid product before adjusting stock.");
      }
      if (!Number.isSafeInteger(expectedQuantity) || expectedQuantity < 0) {
        throw new Error("The current stock quantity is invalid.");
      }
      if (!Number.isSafeInteger(adjustment) || adjustment === 0) {
        throw new Error("Stock adjustment must be a non-zero whole number.");
      }

      const currentProducts = readSavedProducts();
      const currentProduct = currentProducts.find((product) => product.id === productId);
      products = cloneProducts(currentProducts);
      warning = "";
      if (!currentProduct) throw new Error("This product is no longer in the catalog.");
      if (currentProduct.quantity !== expectedQuantity) {
        throw new Error(`Stock changed while this form was open. The latest quantity is ${currentProduct.quantity}; review it and try again.`);
      }

      const nextQuantity = expectedQuantity + adjustment;
      if (!Number.isSafeInteger(nextQuantity) || nextQuantity < 0) {
        throw new Error("This adjustment cannot result in a negative or invalid stock quantity.");
      }

      const nextProducts = currentProducts.map((product) => product.id === productId
        ? { ...product, quantity: nextQuantity, updatedAt }
        : product);
      persistProducts(nextProducts);
      products = cloneProducts(nextProducts);
      return {
        product: products.find((product) => product.id === productId),
        previousQuantity: currentProduct.quantity,
        previousUpdatedAt: currentProduct.updatedAt,
        newQuantity: nextQuantity
      };
    }
  };
}

export function getStockStatus(product) {
  if (product.quantity === 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (product.quantity <= product.lowStockThreshold) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
}

export function createProductId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `prd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
