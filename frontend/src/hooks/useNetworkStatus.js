import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { syncAll, onSyncStatusChange } from '../services/syncService';
import { db } from '../db/dexieDb';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const { showToast } = useToast();

  // Update pending sales count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await db.salesQueue.where('status').equals('pending').count();
      setPendingSalesCount(count);
    } catch (err) {
      console.error('Failed to get pending sales count', err);
    }
  }, []);

  const handleManualSync = useCallback(async (showManualToasts = true) => {
    if (!navigator.onLine) {
      if (showManualToasts) showToast('error', 'Cannot sync while offline. Check your internet connection.');
      return;
    }

    try {
      setIsSyncing(true);
      const result = await syncAll();
      await refreshPendingCount();
      if (result && result.success && showManualToasts) {
        let msg = 'Sync complete! Catalog updated.';
        if (result.uploadedSales > 0) {
          msg = `Sync complete: ${result.uploadedSales} offline sale(s) uploaded successfully!`;
        }
        showToast('success', msg);
      }
    } catch (err) {
      if (showManualToasts) {
        showToast('error', `Sync failed: ${err.response?.data?.message || err.message}`);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [showToast, refreshPendingCount]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      showToast('success', 'Internet connection restored. Synchronizing data...');
      try {
        await handleManualSync(true);
      } catch (e) {
        console.error('Auto sync error on online event:', e);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('error', 'Internet connection lost. Working in offline mode.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check and interval to keep pending count fresh
    refreshPendingCount();
    const countInterval = setInterval(refreshPendingCount, 4000);

    const unsubscribeSync = onSyncStatusChange((status) => {
      if (typeof status.isSyncing === 'boolean') {
        setIsSyncing(status.isSyncing);
      }
      refreshPendingCount();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(countInterval);
      unsubscribeSync();
    };
  }, [showToast, handleManualSync, refreshPendingCount]);

  return {
    isOnline,
    isSyncing,
    pendingSalesCount,
    triggerSync: () => handleManualSync(true),
    refreshPendingCount
  };
}
