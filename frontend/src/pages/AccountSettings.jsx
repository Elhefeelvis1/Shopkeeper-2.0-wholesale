import { useState } from 'react';
import axios from 'axios';
import { Settings, Lock, CheckCircle, XCircle } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

const UserSettings = () => {
  const { user } = useOutletContext() || {};
  const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

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
        <h1 className="text-3xl font-bold text-gray-900">User Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account preferences and security.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center gap-2">
          <Settings className="text-indigo-500" size={20} />
          <h2 className="text-lg font-bold text-gray-800">Account Security</h2>
        </div>
        
        <div className="p-6">
          <div className="mb-6 pb-6 border-b border-gray-100">
             <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Profile Info</h3>
             <div className="flex items-center gap-4">
                 <div className="h-16 w-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-2xl font-bold">
                    {user?.username ? user.username.substring(0,2).toUpperCase() : 'U'}
                 </div>
                 <div>
                    <p className="text-lg font-semibold text-gray-900">{user?.username}</p>
                    <p className="text-sm text-gray-500 capitalize">Role: {user?.role}</p>
                 </div>
             </div>
          </div>

          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Lock size={16} /> Change Password
          </h3>

          {status.message && (
            <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {status.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
              <span className="font-medium">{status.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                value={passwords.oldPassword}
                onChange={(e) => setPasswords({...passwords, oldPassword: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                required
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
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

export default UserSettings;
