import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserCog, Plus, Trash2, Edit, Key, AlertCircle } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const UserSettingsPage = () => {
  const { showToast } = useToast();
  const { user } = useOutletContext() || {};
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [multipleAdmin, setMultipleAdmin] = useState(false);

  // Modals state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Loading states
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);

  // Forms state
  const [addForm, setAddForm] = useState({ username: '', password: '', role: 'sales' });
  const [editForm, setEditForm] = useState({ username: '', role: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', adminPassword: '' });

  useEffect(() => {
    if (user && user.role !== 'administrator') {
      navigate('/dashboard'); // Kick non-admins out
    } else {
      fetchUsers();
    }
  }, [user, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users');
      setUsers(res.data.users);
      const adminCount = res.data.users.filter(u => u.role === 'administrator').length;
      setMultipleAdmin(adminCount > 1);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch users. Ensure you have Admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (isAddingUser) return;
    setIsAddingUser(true);
    try {
      const res = await axios.post('/api/users', addForm);
      if (res.data.success) {
        showToast('success', res.data.message);
        setIsAddUserModalOpen(false);
        setAddForm({ username: '', password: '', role: 'sales' });
        fetchUsers();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to add user');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (isEditingUser) return;
    setIsEditingUser(true);
    try {
      const res = await axios.put(`/api/users/${selectedUser.id}`, editForm);
      if (res.data.success) {
        showToast('success', res.data.message);
        setIsEditUserModalOpen(false);

        if (selectedUser.id === user.id) {
          showToast('success', "You updated your own account. Please log in again if your username or role changed.");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          fetchUsers();
        }
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to edit user');
    } finally {
      setIsEditingUser(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (isChangingPassword) return;
    setIsChangingPassword(true);
    try {
      const res = await axios.put(`/api/users/${selectedUser.id}/password`, passwordForm);
      if (res.data.success) {
        showToast('success', res.data.message);
        setIsPasswordModalOpen(false);
        setPasswordForm({ newPassword: '', adminPassword: '' });
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteUser = async () => {
    if (isDeletingUser) return;
    setIsDeletingUser(true);
    try {
      const res = await axios.delete(`/api/users/${selectedUser.id}`);
      if (res.data.success) {
        showToast('success', res.data.message);
        setIsDeleteModalOpen(false);
        fetchUsers();
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to delete user');
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserCog className="text-indigo-600" size={28} />
            User Settings
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage system users, roles, and credentials (Admin Only).</p>
        </div>
        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition shadow-sm cursor-pointer text-sm"
        >
          <Plus size={18} /> Add New User
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/50 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider">ID</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider">Username</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 text-gray-500">#{u.id}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {u.username}
                      {user && u.id === user.id && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full font-bold">You</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${u.role === 'administrator' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                        {u.role === 'administrator' ? 'Admin' : 'Cashier'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setEditForm({ username: u.username, role: u.role });
                            setIsEditUserModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                          title="Edit User"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setIsPasswordModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          title="Change Password"
                        >
                          <Key size={18} />
                        </button>
                        <button
                          onClick={() => {
                            if (u.id === user.id) {
                              showToast('error', "You cannot delete your own account.");
                              return;
                            }
                            setSelectedUser(u);
                            setIsDeleteModalOpen(true);
                          }}
                          disabled={u.id === user.id}
                          className={`p-2 rounded-lg transition ${u.id === user.id
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                            }`}
                          title="Delete User"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Plus size={20} className="text-indigo-500" />
                Add New User
              </h3>
              <button onClick={() => setIsAddUserModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none cursor-pointer">&times;</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  >
                    <option value="sales">Sales Rep</option>
                    <option value="administrator">Admin</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                <button type="button" disabled={isAddingUser} onClick={() => setIsAddUserModalOpen(false)} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                <button type="submit" disabled={isAddingUser} className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {isAddingUser ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Edit size={20} className="text-indigo-500" />
                Edit User
              </h3>
              <button onClick={() => setIsEditUserModalOpen(false)} disabled={isEditingUser} className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none cursor-pointer disabled:opacity-50">&times;</button>
            </div>
            <form onSubmit={handleEditUser}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    disabled={!multipleAdmin || isEditingUser}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="sales">Sales Rep</option>
                    <option value="administrator">Admin</option>
                  </select>
                  {!multipleAdmin ? (<p className="text-red-500 text-sm">Only one admin exists, Cannot edit Admin</p>) : null}
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                <button type="button" disabled={isEditingUser} onClick={() => setIsEditUserModalOpen(false)} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                <button type="submit" disabled={isEditingUser} className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {isEditingUser ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Key size={20} className="text-amber-500" />
                Change Password for {selectedUser?.username}
              </h3>
              <button onClick={() => { setIsPasswordModalOpen(false); setPasswordForm({ newPassword: '', adminPassword: '' }); }} disabled={isChangingPassword} className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none cursor-pointer disabled:opacity-50">&times;</button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="p-6 space-y-5">
                <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-sm border border-amber-200">
                  <strong>Security Requirement:</strong> You must enter your current admin password to authorize changing another user's password.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password for {selectedUser?.username}</label>
                  <input
                    type="password"
                    required
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  />
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-red-600">Your Admin Password (Confirmation)</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your password..."
                    className="w-full px-4 py-2 bg-red-50 border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-red-900 placeholder:text-red-300"
                    value={passwordForm.adminPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, adminPassword: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                <button type="button" disabled={isChangingPassword} onClick={() => { setIsPasswordModalOpen(false); setPasswordForm({ newPassword: '', adminPassword: '' }); }} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                <button type="submit" disabled={isChangingPassword} className="px-5 py-2 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center">
            <div className="p-6 pt-8 space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Delete User?</h3>
              <p className="text-gray-500">
                Are you sure you want to delete the user <strong>{selectedUser?.username}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="p-6 bg-gray-50/50 flex justify-center gap-3">
              <button disabled={isDeletingUser} onClick={() => setIsDeleteModalOpen(false)} className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
              <button disabled={isDeletingUser} onClick={handleDeleteUser} className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {isDeletingUser ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettingsPage;
