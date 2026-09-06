import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import SalesPage from './pages/SalesPage';
import { ToastProvider } from './context/ToastContext';
import { UserProvider } from './context/UserContext';

function AppContent() {
  return (
    <Router>
      <UserProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* POS Layout - Login and Sales are the only functional pages */}
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/sales" replace />} />
            <Route path="/sales" element={<SalesPage />} />
            {/* Redirect any other legacy route directly to /sales */}
            <Route path="*" element={<Navigate to="/sales" replace />} />
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
