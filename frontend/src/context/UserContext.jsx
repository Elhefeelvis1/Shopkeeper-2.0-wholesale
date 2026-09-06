import { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { cacheUserAuth, verifyUserOffline, db } from '../db/dexieDb';
import { syncAll } from '../services/syncService';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check authentication status on startup
  useEffect(() => {
    const checkAuth = async () => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (isOnline) {
        try {
          const res = await axios.get('/api/me');
          if (res.data && res.data.authenticated) {
            setUser(res.data.user);
            localStorage.setItem('shopkeeper_user', JSON.stringify(res.data.user));
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
        } else {
          setUser(null);
          navigate('/login');
        }
      } catch (e) {
        setUser(null);
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  const login = async (username, password) => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isOnline) {
      try {
        const res = await axios.post('/api/login', { username, password });
        if (res.data && res.data.success) {
          const userData = res.data.user;
          setUser(userData);
          localStorage.setItem('shopkeeper_user', JSON.stringify(userData));
          // Cache offline credentials
          await cacheUserAuth(userData, password);
          // Trigger initial sync
          syncAll().catch(e => console.warn('Sync on login:', e));
          return { success: true };
        }
        return { success: false, message: res.data?.message || 'Login failed' };
      } catch (err) {
        // If network failed during login attempt, try offline login
        if (!err.response) {
          return await offlineLogin(username, password);
        }
        return { success: false, message: err.response?.data?.message || 'Login failed' };
      }
    } else {
      return await offlineLogin(username, password);
    }
  };

  const offlineLogin = async (username, password) => {
    const verification = await verifyUserOffline(username, password);
    if (verification && verification.success) {
      setUser(verification.user);
      localStorage.setItem('shopkeeper_user', JSON.stringify(verification.user));
      return { success: true, offline: true };
    }
    return {
      success: false,
      message: verification?.message || 'Offline login failed. Check username and password.'
    };
  };

  const logout = async () => {
    try {
      if (navigator.onLine) {
        await axios.post('/api/logout');
      }
    } catch (e) {
      console.warn('Logout server request error:', e);
    } finally {
      setUser(null);
      localStorage.removeItem('shopkeeper_user');
      navigate('/login');
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};
