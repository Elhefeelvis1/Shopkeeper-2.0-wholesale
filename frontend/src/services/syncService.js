import axios from 'axios';
import { db } from '../db/dexieDb';

let isSyncing = false;
const syncListeners = new Set();

export function onSyncStatusChange(callback) {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
}

function notifySyncStatus(status) {
  syncListeners.forEach(listener => listener(status));
}

/**
 * Pull all master data from server and refresh local Dexie database
 */
export async function pullMasterData() {
  const res = await axios.get('/api/sync/master-data');
  if (!res.data || !res.data.success) {
    throw new Error(res.data?.error || 'Failed to fetch master data from server');
  }

  const { products, categories, banks, customers, shopDetails, syncedAt } = res.data;

  await db.transaction('rw', [db.products, db.categories, db.banks, db.customers, db.shopDetails, db.syncMeta], async () => {
    // 1. Refresh products
    if (Array.isArray(products)) {
      await db.products.clear();
      await db.products.bulkPut(products);
    }

    // 2. Refresh categories
    if (Array.isArray(categories)) {
      await db.categories.clear();
      await db.categories.bulkPut(categories);
    }

    // 3. Refresh banks
    if (Array.isArray(banks)) {
      await db.banks.clear();
      await db.banks.bulkPut(banks);
    }

    // 4. Update customers without overwriting pending local changes
    if (Array.isArray(customers)) {
      const pendingLocalCustomers = await db.customers
        .filter(c => c.sync_status === 'pending_insert' || c.sync_status === 'pending_update')
        .toArray();

      await db.customers.clear();
      const mappedCustomers = customers.map(c => ({ ...c, sync_status: 'synced' }));
      await db.customers.bulkPut(mappedCustomers);

      // Re-insert pending local customer records
      for (const pending of pendingLocalCustomers) {
        await db.customers.put(pending);
      }
    }

    // 5. Update shop details
    if (shopDetails) {
      await db.shopDetails.put({ id: 1, ...shopDetails });
    }

    // 6. Record sync timestamp
    await db.syncMeta.put({ key: 'lastSyncTimestamp', value: syncedAt || new Date().toISOString() });
  });

  return { productCount: products?.length || 0, customerCount: customers?.length || 0 };
}

/**
 * Push pending offline-created customers and customer updates to server
 */
export async function pushPendingCustomers() {
  let syncedCustomerCount = 0;
  const pendingCustomers = await db.customers
    .filter(c => c.sync_status === 'pending_insert' || c.sync_status === 'pending_update')
    .toArray();

  for (const customer of pendingCustomers) {
    try {
      if (customer.sync_status === 'pending_insert') {
        const payload = {
          name: customer.name,
          phone_number: customer.phone_number,
          address: customer.address,
          email: customer.email,
          customer_notes: customer.customer_notes
        };
        const res = await axios.post('/api/addCustomer', payload);
        if (res.data && res.data.success && res.data.customer) {
          const serverCustomer = res.data.customer;
          const oldLocalId = customer.id;

          // Replace temporary local record with real server ID
          await db.transaction('rw', [db.customers, db.salesQueue], async () => {
            await db.customers.delete(oldLocalId);
            await db.customers.put({
              ...serverCustomer,
              sync_status: 'synced'
            });

            // Update any queued sales referencing the temporary customer ID
            const queuedSales = await db.salesQueue.toArray();
            for (const sale of queuedSales) {
              if (sale.payload && sale.payload.customerId === oldLocalId) {
                sale.payload.customerId = serverCustomer.id;
                await db.salesQueue.put(sale);
              }
            }
          });
          syncedCustomerCount++;
        }
      } else if (customer.sync_status === 'pending_update' && typeof customer.id === 'number') {
        const payload = {
          id: customer.id,
          name: customer.name,
          phone_number: customer.phone_number,
          address: customer.address,
          email: customer.email,
          customer_notes: customer.customer_notes
        };
        const res = await axios.put('/api/updateCustomer', payload);
        if (res.data && res.data.success) {
          await db.customers.update(customer.id, { sync_status: 'synced' });
          syncedCustomerCount++;
        }
      }
    } catch (err) {
      console.error('Error syncing customer:', customer.name, err);
    }
  }

  // Also push any customer notes queue items
  const pendingNotes = await db.customerNotesQueue.filter(n => n.status === 'pending').toArray();
  for (const item of pendingNotes) {
    try {
      await axios.put('/api/updateCustomerNotes', { id: item.customer_id, notes: item.notes });
      await db.customerNotesQueue.delete(item.id);
    } catch (err) {
      console.error('Error syncing customer notes:', item, err);
    }
  }

  return syncedCustomerCount;
}

let isPushingSales = false;

/**
 * Push pending sales queue to server
 */
export async function pushPendingSales() {
  if (isPushingSales) return 0;
  isPushingSales = true;
  let uploadedSalesCount = 0;

  try {
    const pendingSales = await db.salesQueue.filter(s => s.status === 'pending').sortBy('id');

    for (const sale of pendingSales) {
      // Mark as syncing to prevent concurrent duplicate pick-up
      await db.salesQueue.update(sale.id, { status: 'syncing' });

      try {
        const res = await axios.post('/api/process-sale', sale.payload);
        if (res.data && res.data.success) {
          // Successfully processed on server, remove from queue
          await db.salesQueue.delete(sale.id);
          uploadedSalesCount++;
        } else {
          await db.salesQueue.update(sale.id, {
            status: 'pending',
            sync_attempts: (sale.sync_attempts || 0) + 1,
            error_message: res.data?.message || 'Server rejected sale'
          });
        }
      } catch (err) {
        console.error('Failed to sync sale id', sale.id, err);
        await db.salesQueue.update(sale.id, {
          status: 'pending',
          sync_attempts: (sale.sync_attempts || 0) + 1,
          error_message: err.response?.data?.message || err.message
        });
        // Break on fatal network failure to prevent repeating on bad connection
        if (!err.response) {
          break;
        }
      }
    }
  } finally {
    isPushingSales = false;
  }

  return uploadedSalesCount;
}

let isPushingWholesales = false;

/**
 * Push pending wholesale sales queue to server
 */
export async function pushPendingWholesales() {
  if (isPushingWholesales) return 0;
  isPushingWholesales = true;
  let uploadedWholesalesCount = 0;

  try {
    const pendingWholesales = await db.wholesaleQueue.filter(s => s.status === 'pending').sortBy('id');

    for (const item of pendingWholesales) {
      // Mark as syncing to prevent concurrent duplicate pick-up
      await db.wholesaleQueue.update(item.id, { status: 'syncing' });

      try {
        const res = await axios.post('/api/process-wholesale', item.payload);
        if (res.data && res.data.success) {
          // Successfully processed on server, remove from queue
          await db.wholesaleQueue.delete(item.id);
          uploadedWholesalesCount++;
        } else {
          await db.wholesaleQueue.update(item.id, {
            status: 'pending',
            sync_attempts: (item.sync_attempts || 0) + 1,
            error_message: res.data?.message || 'Server rejected wholesale'
          });
        }
      } catch (err) {
        console.error('Failed to sync wholesale id', item.id, err);
        await db.wholesaleQueue.update(item.id, {
          status: 'pending',
          sync_attempts: (item.sync_attempts || 0) + 1,
          error_message: err.response?.data?.message || err.message
        });
        // Break on fatal network failure to prevent repeating on bad connection
        if (!err.response) {
          break;
        }
      }
    }
  } finally {
    isPushingWholesales = false;
  }

  return uploadedWholesalesCount;
}

/**
 * Run full synchronization: Push local changes then Pull latest master data
 */
export async function syncAll(options = {}) {
  if (isSyncing) {
    return { skipped: true, message: 'Sync already in progress' };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { skipped: true, message: 'Offline, sync skipped' };
  }

  isSyncing = true;
  notifySyncStatus({ isSyncing: true });

  try {
    // 1. Push local changes first
    const syncedCustomers = await pushPendingCustomers();
    const uploadedSales = await pushPendingSales();
    const uploadedWholesales = await pushPendingWholesales();

    // 2. Pull fresh data from server
    const pullStats = await pullMasterData();

    const result = {
      success: true,
      uploadedSales,
      uploadedWholesales,
      syncedCustomers,
      productCount: pullStats.productCount,
      timestamp: new Date()
    };

    notifySyncStatus({ isSyncing: false, lastResult: result });
    return result;
  } catch (err) {
    console.error('Sync failed:', err);
    notifySyncStatus({ isSyncing: false, error: err.message });
    throw err;
  } finally {
    isSyncing = false;
  }
}
