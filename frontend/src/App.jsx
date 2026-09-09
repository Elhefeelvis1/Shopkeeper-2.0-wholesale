import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

import SalesPage from './pages/SalesPage';
import WholesalePage from './pages/WholesalePage';
import StockPage from './pages/StockPage';
import TransactionsPage from './pages/TransactionsPage';
import PurchasesPage from './pages/PurchasesPage';
import ProductTrackerPage from './pages/ProductTrackerPage';
import InternalUpdatesPage from './pages/InternalUpdatesPage';
import PreviousSales from './pages/PreviousSales';
import CustomersPage from './pages/CustomersPage';
import AccountSettings from './pages/AccountSettings';
import UserSettingsPage from './pages/UserSettingsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ImportCsvPage from './pages/ImportCsvPage';
import InventoryCountPage from './pages/InventoryCountPage';
import { ToastProvider } from './context/ToastContext';
import { UserProvider } from './context/UserContext';

function AppContent() {
  return (
    <Router>
      <UserProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected Routes inside Layout */}
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/wholesale" element={<WholesalePage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/tracker" element={<ProductTrackerPage />} />
            <Route path="/internal-updates" element={<InternalUpdatesPage />} />
            <Route path="/previous-sales" element={<PreviousSales />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/account-settings" element={<AccountSettings />} />
            <Route path="/user-settings" element={<UserSettingsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/import-csv" element={<ImportCsvPage />} />
            <Route path="/inventory-count" element={<InventoryCountPage />} />
          </Route>
        </Routes>
      </UserProvider>
    </Router>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
