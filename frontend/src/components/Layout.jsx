import { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { LogOut, RefreshCw, Wifi, WifiOff, CheckCircle2, ShoppingBag, Shield } from 'lucide-react';

const Layout = () => {
  const { user, loading, logout } = useContext(UserContext);
  const { isOnline, isSyncing, pendingSalesCount, triggerSync } = useNetworkStatus();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      {/* Top POS Header */}
      <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          {/* Brand and Active Page */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <ShoppingBag size={20} />
            </div>
            <div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">ShopKeeper</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                POS
              </span>
            </div>
          </div>

          {/* Sync Status & Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Online / Offline Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={isOnline ? 'Internet connection available' : 'Operating in offline mode'}
            >
              {isOnline ? <Wifi size={14} className="text-emerald-600" /> : <WifiOff size={14} className="text-amber-600" />}
              <span className="hidden xs:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Sync Status Indicator */}
            {pendingSalesCount > 0 ? (
              <button
                type="button"
                disabled={!isOnline || isSyncing}
                onClick={triggerSync}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                title="Click to sync pending sales"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                <span>{pendingSalesCount} Queued</span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>Synced</span>
              </div>
            )}

            {/* Manual Sync Button */}
            {isOnline && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={triggerSync}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
                title="Synchronize catalog and sales with server"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin text-indigo-600' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            )}

            {/* Cashier Info */}
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-gray-200 text-xs text-gray-600">
              <Shield size={14} className="text-indigo-500" />
              <span className="font-medium text-gray-800">{user?.username || 'Cashier'}</span>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition cursor-pointer border border-transparent hover:border-red-100"
              title="Sign Out"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main POS Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
};

export default Layout;
