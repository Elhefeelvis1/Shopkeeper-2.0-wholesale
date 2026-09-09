import { useState, useContext, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  LayoutDashboard, Package, Users, FileText, LogOut, RefreshCw,
  Wrench, History, ChevronLeft, ChevronRight, Settings, UserCog, Locate, ChartNoAxesCombined, Home, Menu, X, ClipboardCheck, Wifi, WifiOff, CheckCircle2, Sun, Moon
} from 'lucide-react';

const Sidebar = ({ user, isCollapsed, setIsCollapsed, mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const { logout } = useContext(UserContext);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, setMobileOpen]);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Analytics', path: '/analytics', icon: <ChartNoAxesCombined size={20} /> },
    { name: 'Transactions', path: '/transactions', icon: <FileText size={20} /> },
    { name: 'Internal Updates', path: '/internal-updates', icon: <Wrench size={20} /> },
    { name: 'Stock', path: '/stock', icon: <Package size={20} /> },
    { name: 'Inventory Count', path: '/inventory-count', icon: <ClipboardCheck size={20} /> },
    { name: 'Product Tracker', path: '/tracker', icon: <Locate size={20} /> },
    { name: 'Previous Sales', path: '/previous-sales', icon: <History size={20} /> },
    { name: 'Customers & Debts', path: '/customers', icon: <Users size={20} /> },
    { name: 'User Settings', path: '/user-settings', icon: <UserCog size={20} /> },
  ];

  return (
    <>
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 min-h-screen bg-[#1e293b] text-white flex flex-col shadow-2xl transition-all duration-300 z-40
          ${mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        `}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-5 bg-indigo-600 rounded-full p-1 shadow-lg text-white hover:bg-indigo-500 transition-colors border border-indigo-700 cursor-pointer items-center justify-center"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-gray-700 bg-[#0f172a]">
          <Link
            to="/home"
            className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-400 truncate"
          >
            {isCollapsed ? <span className="hidden md:inline">SK</span> : null}
            <span className={isCollapsed ? 'md:hidden' : ''}>ShopKeeper</span>
          </Link>

          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600">
          <Link
            key="home"
            to="/home"
            title={isCollapsed ? "Home" : undefined}
            className={`flex items-center gap-3 py-3 rounded-lg transition-colors ${isCollapsed ? 'md:px-0 md:justify-center px-4' : 'px-4'
              } ${location.pathname === "/home"
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
          >
            <div className="flex-shrink-0"><Home size={20} /></div>
            <span className={`font-medium whitespace-nowrap ${isCollapsed ? 'md:hidden' : ''}`}>Home</span>
          </Link>

          {navItems.filter(item => {
            if (user?.role === 'administrator') return true;
            return item.path === '/sales' || item.path === '/purchases' || item.path === '/wholesale';
          }).map((item) => (
            <Link
              key={item.name}
              to={item.path}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center gap-3 py-3 rounded-lg transition-colors ${isCollapsed ? 'md:px-0 md:justify-center px-4' : 'px-4'
                } ${location.pathname === item.path
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <div className="shrink-0">{item.icon}</div>
              <span className={`font-medium whitespace-nowrap ${isCollapsed ? 'md:hidden' : ''}`}>{item.name}</span>
            </Link>
          ))}

          <Link
            key="account-settings"
            to="/account-settings"
            title={isCollapsed ? "Account Settings" : undefined}
            className={`flex items-center gap-3 py-3 rounded-lg transition-colors ${isCollapsed ? 'md:px-0 md:justify-center px-4' : 'px-4'
              } ${location.pathname === "/account-settings"
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
          >
            <div className="flex-shrink-0"><Settings size={20} /></div>
            <span className={`font-medium whitespace-nowrap ${isCollapsed ? 'md:hidden' : ''}`}>Account Settings</span>
          </Link>

          <button
            onClick={logout}
            className={`w-full flex items-center gap-3 py-3 mt-4 rounded-lg transition-colors bg-red-500 hover:bg-red-600 text-white shadow-md cursor-pointer ${isCollapsed ? 'md:px-0 md:justify-center px-4' : 'px-4'
              }`}
          >
            <div className="flex-shrink-0"><LogOut size={20} /></div>
            <span className={`font-medium whitespace-nowrap ${isCollapsed ? 'md:hidden' : ''}`}>Logout</span>
          </button>
        </nav>
      </aside>
    </>
  );
};

const Navbar = ({ user, showSidebar, isCollapsed, setMobileOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, theme, changeTheme } = useContext(UserContext);
  const { isOnline, isSyncing, pendingSalesCount, triggerSync } = useNetworkStatus();

  return (
    <header
      className={`h-16 bg-white/95 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 shadow-xs fixed top-0 right-0 z-20 transition-all duration-300 ${showSidebar ? (isCollapsed ? 'left-0 md:left-20' : 'left-0 md:left-64') : 'left-0'
        }`}
    >
      <div className="flex items-center gap-3 sm:gap-6">
        {showSidebar && (
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu size={22} />
          </button>
        )}
        {location.pathname === '/wholesale' ? (
          <div className="flex items-center gap-2 select-none">
            <span className="text-lg sm:text-xl font-bold text-gray-800 tracking-tight">ShopKeeper</span>
          </div>
        ) : (
          <Link to="/home" className="text-lg sm:text-xl font-bold text-gray-800 truncate">ShopKeeper</Link>
        )}
        {user?.role === "administrator" && (location.pathname === '/sales' || location.pathname === '/purchases') && (
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer bg-indigo-50 sm:bg-transparent px-2.5 py-1.5 sm:p-0 rounded-lg"
          >
            &larr; <span className="hidden xs:inline">Back to</span> Dashboard
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Theme Toggle Button */}
        <button
          type="button"
          onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun size={18} className="text-amber-400" />
          ) : (
            <Moon size={18} className="text-indigo-600" />
          )}
        </button>

        {/* Network & Sync Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          title={isOnline ? 'Connected to server' : 'Operating offline'}
        >
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="hidden xs:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {pendingSalesCount > 0 ? (
          <button
            type="button"
            onClick={triggerSync}
            disabled={!isOnline || isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-75"
            title="Click to sync pending offline sales"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>{pendingSalesCount} Queued</span>
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span>Synced</span>
          </div>
        )}

        {isOnline && (
          <button
            type="button"
            onClick={triggerSync}
            disabled={isSyncing}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
            title="Sync latest master data with server"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin text-indigo-600' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1.5 text-gray-600 hover:text-red-600 transition-colors px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-red-50 text-sm font-medium cursor-pointer"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

const Layout = () => {
  const { user, loading } = useContext(UserContext);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isSales = location.pathname === '/sales';
  const isPurchase = location.pathname === '/purchases';
  const isWholesale = location.pathname === '/wholesale';
  const showSidebar = !isSales && !isPurchase && !isWholesale;

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {showSidebar && (
        <Sidebar
          user={user}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
      )}

      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden transition-all duration-300 ${showSidebar ? (isCollapsed ? 'md:pl-20' : 'md:pl-64') : ''
          }`}
      >
        <Navbar
          user={user}
          showSidebar={showSidebar}
          isCollapsed={isCollapsed}
          setMobileOpen={setMobileOpen}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 px-4 sm:px-6 lg:px-8 pb-8 pt-20">
          <div className="mx-auto w-full">
            <Outlet context={{ user }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
