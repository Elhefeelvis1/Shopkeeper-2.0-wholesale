import React, { createContext, useContext, useState, useRef } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = (status, message) => {
    setToast({ status, message });
    startTimer();
  };

  const clearToast = () => {
    setToast(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setToast(null);
    }, 1500);
  };

  const pauseTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div 
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            toast.status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}
          style={{ minWidth: '320px', maxWidth: '90vw' }}
          onMouseEnter={pauseTimer}
          onMouseLeave={startTimer}
        >
          {toast.status === 'success' ? (
            <CheckCircle className="text-emerald-500 shrink-0" size={20} />
          ) : (
            <AlertCircle className="text-red-500 shrink-0" size={20} />
          )}
          <span className="flex-1 font-medium text-sm pr-2">{toast.message}</span>
          <button 
            onClick={clearToast}
            className={`p-1.5 rounded-md transition-colors cursor-pointer shrink-0 ${
              toast.status === 'success' ? 'hover:bg-emerald-100 text-emerald-600' : 'hover:bg-red-100 text-red-600'
            }`}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
};
