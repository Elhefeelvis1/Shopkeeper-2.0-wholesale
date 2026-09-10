import { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { cacheUserAuth, verifyUserOffline, db } from '../db/dexieDb';
import { syncAll } from '../services/syncService';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('shopkeeper_theme') || 'light';
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Apply theme to html root element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('shopkeeper_theme', theme);
  }, [theme]);

  // Sync theme whenever user object loads with a saved theme
  useEffect(() => {
    if (user?.theme && (user.theme === 'light' || user.theme === 'dark')) {
      setTheme(user.theme);
    }
  }, [user?.theme]);

  // Axios response interceptor for 401 Unauthorized responses
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          const currentPath = window.location.pathname;
          if (currentPath !== '/login') {
            setUser(null);
            localStorage.removeItem('shopkeeper_user');
            navigate('/login', { state: { from: currentPath } });
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [navigate]);

  // Check authentication status on startup
  useEffect(() => {
    const checkAuth = async () => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (isOnline) {
        try {
          const res = await axios.get('/api/me');
          if (res.data && res.data.authenticated) {
            const userData = res.data.user;
            setUser(userData);
            if (userData.theme) setTheme(userData.theme);
            localStorage.setItem('shopkeeper_user', JSON.stringify(userData));
            // Trigger background sync
            syncAll().catch(e => console.warn('Background sync on auth init:', e));
          } else {
            handleOfflineFallback();
          }
        } catch (err) {
          handleOfflineFallback();
        } finally {
          setLoading(false);
        }
      } else {
        handleOfflineFallback();
        setLoading(false);
      }
    };

    const handleOfflineFallback = () => {
      try {
        const stored = localStorage.getItem('shopkeeper_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
          if (parsed.theme) setTheme(parsed.theme);
        } else {
          setUser(null);
          if (location.pathname !== '/login') {
            navigate('/login', { state: { from: location.pathname } });
          }
        }
      } catch (e) {
        setUser(null);
        if (location.pathname !== '/login') {
          navigate('/login', { state: { from: location.pathname } });
        }
      }
    };

    checkAuth();
  }, [navigate, location.pathname]);

  const changeTheme = async (newTheme) => {
    if (newTheme !== 'light' && newTheme !== 'dark') return;
    setTheme(newTheme);
    localStorage.setItem('shopkeeper_theme', newTheme);

    if (user) {
      const updatedUser = { ...user, theme: newTheme };
      setUser(updatedUser);
      localStorage.setItem('shopkeeper_user', JSON.stringify(updatedUser));

      if (navigator.onLine) {
        try {
          await axios.post('/api/change-theme', { theme: newTheme });
        } catch (err) {
          console.warn('Failed to sync theme preference to backend:', err);
        }
      }
    }
  };

  const login = async (username, password) => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isOnline) {
      let res;
      try {
        res = await axios.post('/api/login', { username, password });
      } catch (err) {
        // If network is down or server is unreachable, attempt offline login fallback
        if (!err.response && (err.code === 'ERR_NETWORK' || !navigator.onLine)) {
          return await offlineLogin(username, password);
        }
        return { success: false, message: err.response?.data?.message || 'Login failed' };
      }

      if (res.data && res.data.success) {
        const userData = res.data.user;
        setUser(userData);
        if (userData.theme) setTheme(userData.theme);
        localStorage.setItem('shopkeeper_user', JSON.stringify(userData));

        // Cache offline credentials safely (does not block or fail online login)
        cacheUserAuth(userData, password).catch(e => console.warn('Offline auth cache warning:', e));

        // Trigger initial background sync
        syncAll().catch(e => console.warn('Sync on login:', e));

        return { success: true };
      }

      return { success: false, message: res.data?.message || 'Login failed' };
    } else {
      return await offlineLogin(username, password);
    }
  };

  const offlineLogin = async (username, password) => {
    const verification = await verifyUserOffline(username, password);
    if (verification && verification.success) {
      const userData = verification.user;
      setUser(userData);
      if (userData.theme) setTheme(userData.theme);
      localStorage.setItem('shopkeeper_user', JSON.stringify(userData));
      return { success: true, offline: true };
    }
    return {
      success: false,
      message: verification?.message || 'Offline login failed. Check username and password.'
    };
  };

  const logout = async () => {
    const currentPath = location.pathname;
    try {
      if (navigator.onLine) {
        await axios.post('/api/logout');
      }
    } catch (e) {
      console.warn('Logout server request error:', e);
    } finally {
      setUser(null);
      localStorage.removeItem('shopkeeper_user');
      navigate('/login', { state: { from: currentPath } });
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser, theme, changeTheme, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};
