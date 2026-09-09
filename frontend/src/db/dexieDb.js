import Dexie from 'dexie';

export class ShopKeeperDB extends Dexie {
  constructor() {
    super('ShopKeeperDB');
    this.version(1).stores({
      products: 'item_id, item_name, barcode, category_name, unit_selling_price',
      categories: 'id, name',
      banks: 'id, bank_name',
      customers: 'id, local_id, name, phone_number, sync_status',
      salesQueue: '++id, status, created_at',
      wholesaleQueue: '++id, status, created_at',
      customerNotesQueue: '++id, customer_id, status',
      shopDetails: 'id',
      authCache: 'username, lastLogin',
      syncMeta: 'key'
    });
  }
}

export const db = new ShopKeeperDB();

/**
 * SHA-256 password hashing using Web Crypto API for secure offline authentication
 */
export async function hashPassword(password, salt = 'shopkeeper_salt_key') {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cache user credentials for offline login
 */
export async function cacheUserAuth(user, password) {
  if (!user || !user.username) return;
  const username = user.username.toLowerCase();
  const passwordHash = password ? await hashPassword(password) : null;
  
  await db.authCache.put({
    username,
    userObj: user,
    passwordHash,
    lastLogin: new Date().toISOString()
  });
}

/**
 * Verify user credentials offline
 */
export async function verifyUserOffline(username, password) {
  if (!username) return null;
  const cached = await db.authCache.get(username.toLowerCase());
  if (!cached) return { success: false, message: 'No offline credentials found for this user. Please log in online first.' };

  if (password && cached.passwordHash) {
    const inputHash = await hashPassword(password);
    if (inputHash !== cached.passwordHash) {
      return { success: false, message: 'Invalid password.' };
    }
  }

  return { success: true, user: cached.userObj };
}

/**
 * Fast client-side product search across Dexie IndexedDB
 */
export async function searchLocalProducts({ itemName = '', category = '', minPrice = '', maxPrice = '' }) {
  let collection = db.products.toCollection();

  const lowerName = itemName ? itemName.trim().toLowerCase() : '';
  const min = minPrice ? parseFloat(minPrice) : null;
  const max = maxPrice ? parseFloat(maxPrice) : null;

  return await collection.filter(product => {
    // Name, Generic Name or Barcode filter
    if (lowerName) {
      const matchName = product.item_name && product.item_name.toLowerCase().includes(lowerName);
      const matchGeneric = product.generic_name && product.generic_name.toLowerCase().includes(lowerName);
      const matchBarcode = product.barcode && product.barcode.toLowerCase().includes(lowerName);
      if (!matchName && !matchGeneric && !matchBarcode) return false;
    }

    // Category filter
    if (category) {
      if (!product.category_name || product.category_name.toLowerCase() !== category.toLowerCase()) {
        return false;
      }
    }

    // Price range filters
    const price = parseFloat(product.unit_selling_price || 0);
    if (min !== null && !isNaN(min) && price < min) return false;
    if (max !== null && !isNaN(max) && price > max) return false;

    return true;
  }).toArray();
}

/**
 * Fast client-side wholesale product search across Dexie IndexedDB
 */
export async function searchLocalWholesaleProducts({ itemName = '', category = '', minPrice = '', maxPrice = '' }) {
  let collection = db.products.toCollection();

  const lowerName = itemName ? itemName.trim().toLowerCase() : '';
  const min = minPrice ? parseFloat(minPrice) : null;
  const max = maxPrice ? parseFloat(maxPrice) : null;

  return await collection.filter(product => {
    // Name, Generic Name or Barcode filter
    if (lowerName) {
      const matchName = product.item_name && product.item_name.toLowerCase().includes(lowerName);
      const matchGeneric = product.generic_name && product.generic_name.toLowerCase().includes(lowerName);
      const matchBarcode = product.barcode && product.barcode.toLowerCase().includes(lowerName);
      if (!matchName && !matchGeneric && !matchBarcode) return false;
    }

    // Category filter
    if (category) {
      if (!product.category_name || product.category_name.toLowerCase() !== category.toLowerCase()) {
        return false;
      }
    }

    // Wholesale Price range filters
    const price = parseFloat(product.wholesale_price || product.unit_selling_price || 0);
    if (min !== null && !isNaN(min) && price < min) return false;
    if (max !== null && !isNaN(max) && price > max) return false;

    return true;
  }).toArray();
}

/**
 * Atomically decrement local stock in Dexie when completing a retail sale
 */
export async function decrementLocalStock(items) {
  await db.transaction('rw', db.products, async () => {
    for (const item of items) {
      const productId = item.productId || item.item_id;
      const quantity = Number(item.quantity);
      const product = await db.products.get(productId);
      if (product) {
        const newStock = Math.max(0, (Number(product.total_quantity_in_stock) || 0) - quantity);
        await db.products.update(productId, { total_quantity_in_stock: newStock });
      }
    }
  });
}

/**
 * Atomically decrement local stock in Dexie when completing a wholesale sale (units = quantity * multiplier)
 */
export async function decrementLocalWholesaleStock(items) {
  await db.transaction('rw', db.products, async () => {
    for (const item of items) {
      const productId = item.productId || item.item_id;
      const quantity = Number(item.quantity);
      const multiplier = Math.max(1, Number(item.unitMultiplier || item.wholesale_multiplier || 1));
      const totalBaseUnits = quantity * multiplier;

      const product = await db.products.get(productId);
      if (product) {
        const newStock = Math.max(0, (Number(product.total_quantity_in_stock) || 0) - totalBaseUnits);
        await db.products.update(productId, { total_quantity_in_stock: newStock });
      }
    }
  });
}

/**
 * Queue a sale for background or immediate sync
 */
export async function queueSale(payload) {
  return await db.salesQueue.add({
    payload,
    status: 'pending',
    sync_attempts: 0,
    created_at: new Date().toISOString()
  });
}

/**
 * Queue a wholesale sale for background or immediate sync
 */
export async function queueWholesale(payload) {
  return await db.wholesaleQueue.add({
    payload,
    status: 'pending',
    sync_attempts: 0,
    created_at: new Date().toISOString()
  });
}

/**
 * Add or update local customer
 */
export async function saveLocalCustomer(customerData) {
  const isEditing = !!customerData.id && typeof customerData.id === 'number';
  const localId = customerData.local_id || (isEditing ? customerData.id : `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);

  const record = {
    ...customerData,
    id: customerData.id || localId,
    local_id: localId,
    sync_status: isEditing ? 'pending_update' : (customerData.sync_status || 'pending_insert')
  };

  await db.customers.put(record);
  return record;
}
