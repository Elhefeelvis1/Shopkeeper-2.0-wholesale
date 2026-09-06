import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, itemName, itemType = 'Item', isDeleting = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={24} className="text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Delete {itemType}</h3>
          <p className="text-sm text-slate-500 mb-6">
            Are you sure you want to delete <span className="font-semibold">{itemName}</span>? This action cannot be undone.
          </p>
          <div className="flex w-full gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold hover:bg-red-700 rounded-xl transition-colors text-sm shadow-sm shadow-red-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Proceed'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
