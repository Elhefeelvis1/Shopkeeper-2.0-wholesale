import { useState, useContext } from 'react';
import axios from 'axios';
import { Settings, Lock, CheckCircle, XCircle, Sun, Moon, Palette, Check } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { useToast } from '../context/ToastContext';

const AccountSettings = () => {
  const { user } = useOutletContext() || {};
  const { theme, changeTheme } = useContext(UserContext);
  const { showToast } = useToast();
  
  const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [updatingTheme, setUpdatingTheme] = useState(false);

  const handleThemeChange = async (newTheme) => {
    if (newTheme === theme || updatingTheme) return;
    setUpdatingTheme(true);
    try {
      await changeTheme(newTheme);
      showToast('success', `${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode enabled.`);
    } catch (err) {
      showToast('error', 'Failed to update theme preference.');
    } finally {
      setUpdatingTheme(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      setStatus({ type: 'error', message: 'New passwords do not match' });
      return;
    }
    
    if (passwords.newPassword.length < 6) {
      setStatus({ type: 'error', message: 'New password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await axios.post('/api/change-password', {
        oldPassword: passwords.oldPassword,
        newPassword: passwords.newPassword
      });
      
      setStatus({ type: 'success', message: response.data.message || 'Password updated successfully' });
      setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account preferences, theme, and security settings.</p>
      </div>

      {/* 1. Theme Preferences Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="text-indigo-500" size={20} />
            <h2 className="text-lg font-bold text-gray-800">Appearance & Theme</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full capitalize">
            Active: {theme} Mode
          </span>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Choose your preferred color theme. Your preference is saved to your user account and applied automatically on all devices.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Light Mode Option */}
            <div
              onClick={() => handleThemeChange('light')}
              className={`relative rounded-2xl p-4 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                theme === 'light'
                  ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              {theme === 'light' && (
                <div className="absolute top-3 right-3 bg-indigo-600 text-white rounded-full p-1 shadow-xs">
                  <Check size={14} />
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <Sun size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Light Mode</h3>
                  <p className="text-xs text-gray-500">Clean, bright interface</p>
                </div>
              </div>

              {/* Visual Preview Box */}
              <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 space-y-2 select-none">
                <div className="h-3.5 bg-white rounded-md w-3/4 border border-slate-200"></div>
                <div className="h-2 bg-slate-300 rounded w-1/2"></div>
                <div className="flex gap-1.5 pt-1">
                  <div className="h-4 w-12 bg-indigo-600 rounded"></div>
                  <div className="h-4 w-8 bg-white border border-slate-300 rounded"></div>
                </div>
              </div>
            </div>

            {/* Dark Mode Option */}
            <div
              onClick={() => handleThemeChange('dark')}
              className={`relative rounded-2xl p-4 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                theme === 'dark'
                  ? 'border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/20 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              {theme === 'dark' && (
                <div className="absolute top-3 right-3 bg-indigo-600 text-white rounded-full p-1 shadow-xs">
                  <Check size={14} />
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-indigo-900/40 text-indigo-400 rounded-xl">
                  <Moon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Dark Mode</h3>
                  <p className="text-xs text-gray-500">Sleek, low-light aesthetic</p>
                </div>
              </div>

              {/* Visual Preview Box */}
              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-2 select-none">
                <div className="h-3.5 bg-slate-800 rounded-md w-3/4 border border-slate-700"></div>
                <div className="h-2 bg-slate-700 rounded w-1/2"></div>
                <div className="flex gap-1.5 pt-1">
                  <div className="h-4 w-12 bg-indigo-500 rounded"></div>
                  <div className="h-4 w-8 bg-slate-800 border border-slate-700 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Account Security Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center gap-2">
          <Settings className="text-indigo-500" size={20} />
          <h2 className="text-lg font-bold text-gray-800">Account Security</h2>
        </div>
        
        <div className="p-6">
          <div className="mb-6 pb-6 border-b border-gray-100">
             <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Profile Info</h3>
             <div className="flex items-center gap-4">
                 <div className="h-14 w-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-xl font-bold">
                    {user?.username ? user.username.substring(0,2).toUpperCase() : 'U'}
                 </div>
                 <div>
                    <p className="text-base font-bold text-gray-900">{user?.username}</p>
                    <p className="text-xs text-gray-500 capitalize">Role: {user?.role}</p>
                 </div>
             </div>
          </div>

          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Lock size={14} /> Change Password
          </h3>

          {status.message && (
            <div className={`p-4 rounded-xl mb-6 flex items-center gap-2 text-xs font-semibold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {status.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
              <span>{status.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-colors"
                value={passwords.oldPassword}
                onChange={(e) => setPasswords({...passwords, oldPassword: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-colors"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-colors"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                required
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 text-white font-semibold text-xs sm:text-sm py-2.5 px-6 rounded-xl hover:bg-indigo-700 transition shadow-sm flex items-center gap-2 disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed active:scale-95"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
