import React, { useState, useEffect } from 'react';
import { db } from '../db/dexieDb';
import { syncAll } from '../services/syncService';
import { useToast } from '../context/ToastContext';
import { X, RefreshCw, AlertCircle, ShoppingBag, Boxes, CheckCircle2, Clock } from 'lucide-react';

const OfflineQueueModal = ({ isOpen, onClose, onQueueUpdated }) => {
  const [salesQueue, setSalesQueue] = useState([]);
  const [wholesaleQueue, setWholesaleQueue] = useState([]);
  const [activeTab, setActiveTab] = useState('sales');
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();

  const loadQueues = async () => {
    try {
      const sales = await db.salesQueue.toArray();
      const wholesales = await db.wholesaleQueue.toArray();
      setSalesQueue(sales);
      setWholesaleQueue(wholesales);
    } catch (err) {
      console.error('Failed to load queues:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadQueues();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    if (!navigator.onLine) {
      showToast('error', 'Cannot sync while offline. Please connect to internet/server first.');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncAll();
      await loadQueues();
      if (onQueueUpdated) onQueueUpdated();
      showToast('success', `Sync completed! ${result?.uploadedSales || 0} sales uploaded.`);
    } catch (err) {
      showToast('error', `Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const totalCount = salesQueue.length + wholesaleQueue.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Offline Transaction Queue</h2>
              <p className="text-xs text-gray-500">
                {totalCount === 0 ? 'All transactions are synchronized' : `${totalCount} pending offline record(s)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={isSyncing || totalCount === 0 || !navigator.onLine}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 pt-2 bg-white">
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'sales'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShoppingBag size={14} />
            <span>Retail Sales ({salesQueue.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('wholesale')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'wholesale'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Boxes size={14} />
            <span>Wholesale Sales ({wholesaleQueue.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {activeTab === 'sales' && salesQueue.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-2 opacity-80" />
              <p className="text-sm font-medium text-gray-600">No pending retail sales</p>
              <p className="text-xs text-gray-400 mt-1">All retail sales have been successfully sent to the main database.</p>
            </div>
          )}

          {activeTab === 'wholesale' && wholesaleQueue.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-2 opacity-80" />
              <p className="text-sm font-medium text-gray-600">No pending wholesale sales</p>
              <p className="text-xs text-gray-400 mt-1">All wholesale transactions have been successfully sent to the main database.</p>
            </div>
          )}

          {activeTab === 'sales' && salesQueue.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition ${
                item.error_message
                  ? 'border-red-200 bg-red-50/40'
                  : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-800">
                    Amount: ₦{Number(item.payload?.totalAmount || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                    {item.payload?.payRoute || 'Cash'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                    {item.payload?.items?.length || 0} item(s)
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Recorded: {new Date(item.created_at).toLocaleString()} • Attempts: {item.sync_attempts || 0}
                </p>
                {item.error_message && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 mt-2 bg-red-100/60 px-2.5 py-1.5 rounded-lg">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{item.error_message}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {activeTab === 'wholesale' && wholesaleQueue.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition ${
                item.error_message
                  ? 'border-red-200 bg-red-50/40'
                  : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-800">
                    Amount: ₦{Number(item.payload?.totalAmount || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                    {item.payload?.payRoute || 'Cash'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                    {item.payload?.items?.length || 0} wholesale item(s)
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Recorded: {new Date(item.created_at).toLocaleString()} • Attempts: {item.sync_attempts || 0}
                </p>
                {item.error_message && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 mt-2 bg-red-100/60 px-2.5 py-1.5 rounded-lg">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{item.error_message}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineQueueModal;
