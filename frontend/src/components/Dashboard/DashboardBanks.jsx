import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, X, Landmark } from 'lucide-react';

const DashboardBanks = () => {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add state
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editBankName, setEditBankName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/banks');
      if (res.data.success) {
        setBanks(res.data.banks);
      }
    } catch (err) {
      console.error("Failed to fetch banks", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBank = async (e) => {
    e.preventDefault();
    if (!newBankName) return;
    setAdding(true);
    try {
      const res = await axios.post('/api/banks', {
        bankName: newBankName,
        accountNumber: newAccountNumber
      });
      if (res.data.success) {
        setNewBankName('');
        setNewAccountNumber('');
        fetchBanks();
      }
    } catch (err) {
      console.error("Failed to add bank", err);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteBank = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bank?")) return;
    try {
      const res = await axios.delete(`/api/banks/${id}`);
      if (res.data.success) {
        setBanks(banks.filter(b => b.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete bank", err);
    }
  };

  const startEditing = (bank) => {
    setEditingId(bank.id);
    setEditBankName(bank.bank_name);
    setEditAccountNumber(bank.account_number || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditBankName('');
    setEditAccountNumber('');
  };

  const saveEditing = async (id) => {
    if (!editBankName) return;
    try {
      const res = await axios.put(`/api/banks/${id}`, {
        bankName: editBankName,
        accountNumber: editAccountNumber
      });
      if (res.data.success) {
        setBanks(banks.map(b => b.id === id ? { ...b, bank_name: editBankName, account_number: editAccountNumber } : b));
        setEditingId(null);
      }
    } catch (err) {
      console.error("Failed to update bank", err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-2">
        <Landmark className="text-indigo-500" />
        <h2 className="text-lg font-bold text-gray-800">Banks Management</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-fit">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Plus size={18} className="text-emerald-500" /> Add New Bank
          </h3>
          <form onSubmit={handleAddBank} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                required
                placeholder="e.g. First Bank"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number <span className="text-gray-400 font-normal italic">(Optional)</span>
              </label>
              <input
                type="text"
                value={newAccountNumber}
                onChange={(e) => setNewAccountNumber(e.target.value)}
                placeholder="0000000000"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add Bank'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Bank Accounts</h3>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar p-0">
            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : banks.length === 0 ? (
              <div className="py-12 text-center text-gray-400">No banks added yet.</div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 font-medium">Bank Name</th>
                    <th className="px-6 py-3 font-medium">Account Number</th>
                    <th className="px-6 py-3 font-medium text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {banks.map(bank => (
                    <tr key={bank.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer">
                      {editingId === bank.id ? (
                        <>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={editBankName}
                              onChange={(e) => setEditBankName(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500/50 outline-none"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={editAccountNumber}
                              onChange={(e) => setEditAccountNumber(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500/50 outline-none"
                            />
                          </td>
                          <td className="px-6 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => saveEditing(bank.id)} className="text-emerald-500 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded transition-colors" title="Save">
                                <Check size={16} />
                              </button>
                              <button onClick={cancelEditing} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded transition-colors" title="Cancel">
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 font-medium text-gray-900">{bank.bank_name}</td>
                          <td className="px-6 py-4 text-gray-600">{bank.account_number || <span className="text-gray-400 italic">Not set</span>}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-4">
                              <button
                                onClick={() => startEditing(bank)}
                                className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors cursor-pointer"
                                title="Edit Bank"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteBank(bank.id)}
                                className="text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors cursor-pointer"
                                title="Delete Bank"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardBanks;
