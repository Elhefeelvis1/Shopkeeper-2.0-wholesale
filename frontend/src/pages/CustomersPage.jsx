import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Users, Plus, Edit2, Search, AlertCircle,
  CreditCard, Building, CheckCircle2, Clock,
  ChevronDown, CalendarDays, X
} from 'lucide-react';
import AddCustomerModal from '../components/AddCustomerModal';

import { useToast } from '../context/ToastContext';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const formatMoney = (v) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─────────────────────────────────────────────
// Clear Debt Modal
// ─────────────────────────────────────────────
const ClearDebtModal = ({ debt, banks, onClose, onSuccess }) => {
  const [payRoute, setPayRoute] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const needsBank = payRoute === 'Transfer' || payRoute === 'POS';

  const handleSubmit = async () => {
    if (!payRoute) { setError('Please select a payment route.'); return; }
    if (needsBank && !selectedBank) { setError('Please select a bank.'); return; }
    setLoading(true);
    setError('');
    try {
      await axios.patch(`/api/customer-debts/${debt.id}/clear`, {
        payRoute,
        bankId: selectedBank || null,
      });
      onSuccess(debt.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear debt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-green-500" />
              Clear Debt
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {debt.customer_name} — <span className="font-semibold text-gray-700">₦{formatMoney(debt.amount)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1.5">
              <CreditCard size={15} /> Payment Route
            </label>
            <div className="relative">
              <select
                className="w-full appearance-none px-4 h-10 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
                value={payRoute}
                onChange={(e) => { setPayRoute(e.target.value); setSelectedBank(''); setError(''); }}
              >
                <option value="">Select route</option>
                <option value="Cash">Cash</option>
                <option value="Transfer">Transfer</option>
                <option value="POS">POS</option>
              </select>
              <ChevronDown size={15} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {needsBank && (
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1.5">
                <Building size={15} /> Bank
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none px-4 h-10 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
                  value={selectedBank}
                  onChange={(e) => { setSelectedBank(e.target.value); setError(''); }}
                >
                  <option value="">Select bank</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>{b.bank_name}{b.account_number ? ` — ${b.account_number}` : ''}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            This will mark the debt as <strong>cleared</strong> and update the linked sale's payment route.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`px-5 py-2 font-semibold rounded-lg text-sm transition shadow-sm ${loading
              ? 'bg-green-300 text-white cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
              }`}
          >
            {loading ? 'Clearing…' : 'Confirm Clear'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Debts Tab
// ─────────────────────────────────────────────
const DebtsTab = () => {
  const { showToast } = useToast();
  const [debtStatus, setDebtStatus] = useState('pending'); // 'pending' | 'cleared'
  const [debts, setDebts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [banks, setBanks] = useState([]);

  // Filters
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerNameFilter, setCustomerNameFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Clear debt modal
  const [clearingDebt, setClearingDebt] = useState(null);

  // Sentinel ref for infinite scroll
  const sentinelRef = useRef(null);
  const offsetRef = useRef(0);

  // Debounce customer name filter
  useEffect(() => {
    const t = setTimeout(() => setCustomerNameFilter(customerNameInput), 400);
    return () => clearTimeout(t);
  }, [customerNameInput]);

  // Fetch banks once
  useEffect(() => {
    axios.get('/api/banks').then(r => setBanks(r.data.banks || [])).catch(() => { });
  }, []);

  // Reset + fetch when filters or status tab change
  useEffect(() => {
    offsetRef.current = 0;
    setDebts([]);
    fetchDebts(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtStatus, customerNameFilter, startDate, endDate]);

  const buildParams = (offset) => {
    const p = { status: debtStatus, offset, limit: 15 };
    if (customerNameFilter) p.customerName = customerNameFilter;
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    return p;
  };

  const fetchDebts = useCallback(async (offset, isReset = false) => {
    if (isReset) setLoadingInitial(true);
    else setLoadingMore(true);
    try {
      const res = await axios.get('/api/customer-debts', { params: buildParams(offset) });
      const { debts: newDebts, hasMore: more, total: tot } = res.data;
      setDebts(prev => isReset ? newDebts : [...prev, ...newDebts]);
      setHasMore(more);
      setTotal(tot);
      offsetRef.current = offset + newDebts.length;
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to load debts.');
    } finally {
      if (isReset) setLoadingInitial(false);
      else setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtStatus, customerNameFilter, startDate, endDate]);

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loadingInitial) {
          fetchDebts(offsetRef.current);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadingInitial, fetchDebts]);

  const handleClearSuccess = (debtId) => {
    setClearingDebt(null);
    showToast('success', 'Debt cleared successfully!');
    // Optimistic removal from pending list (status won't match anymore)
    setDebts(prev => prev.filter(d => d.id !== debtId));
    setTotal(t => t - 1);
  };

  const statusBadge = (status) =>
    status === 'pending'
      ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700"><Clock size={11} /> Pending</span>
      : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700"><CheckCircle2 size={11} /> Cleared</span>;

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2">
        {['pending', 'cleared'].map(s => (
          <button
            key={s}
            onClick={() => setDebtStatus(s)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${debtStatus === s
              ? s === 'pending'
                ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                : 'bg-green-500 text-white shadow-sm shadow-green-200'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
          >
            {s === 'pending' ? '⏳ Pending' : '✅ Cleared'}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400 font-medium">{total} record{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 sm:px-5 py-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          {/* Customer name */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by customer name…"
              value={customerNameInput}
              onChange={e => setCustomerNameInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 bg-gray-50 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          {/* Date range */}
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays size={16} className="text-gray-400 shrink-0" />
            <div className="w-full xs:w-36 flex-1 sm:flex-initial">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <span className="text-gray-400 text-sm">to</span>
            <div className="w-full xs:w-36 flex-1 sm:flex-initial">
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
                title="Clear dates"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loadingInitial ? (
          <div className="p-10 flex flex-col items-center justify-center text-gray-400 gap-3">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm">Loading debts…</p>
          </div>
        ) : debts.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400">
            {debtStatus === 'pending'
              ? <Clock size={44} className="text-amber-200 mb-3" />
              : <CheckCircle2 size={44} className="text-green-200 mb-3" />}
            <p className="text-base font-semibold text-gray-500">No {debtStatus} debts found</p>
            <p className="text-sm mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Customer</th>
                  <th className="px-6 py-4 font-semibold">Phone</th>
                  <th className="px-6 py-4 font-semibold">Sale_ID</th>
                  <th className="px-6 py-4 font-semibold">Amount</th>
                  <th className="px-6 py-4 font-semibold">Last Updated</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  {debtStatus === 'pending' && (
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {debts.map(debt => (
                  <tr key={debt.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-800">{debt.customer_name}</td>
                    <td className="px-6 py-4 text-gray-500">{debt.customer_phone || '—'}</td>
                    <td className="px-6 py-4 text-gray-500">#{debt.sale_id}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">₦{formatMoney(debt.amount)}</td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(debt.last_updated)}</td>
                    <td className="px-6 py-4">{statusBadge(debt.status)}</td>
                    {debtStatus === 'pending' && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setClearingDebt(debt)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition cursor-pointer"
                        >
                          <CheckCircle2 size={13} /> Clear Debt
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4" />

            {loadingMore && (
              <div className="py-4 flex justify-center">
                <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            )}

            {!hasMore && debts.length > 0 && (
              <p className="text-center text-xs text-gray-400 py-3">All {total} records loaded.</p>
            )}
          </div>
        )}
      </div>

      {/* Clear Debt Modal */}
      {clearingDebt && (
        <ClearDebtModal
          debt={clearingDebt}
          banks={banks}
          onClose={() => setClearingDebt(null)}
          onSuccess={handleClearSuccess}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Customers Tab (existing, unchanged layout)
// ─────────────────────────────────────────────
const CustomersTab = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/allCustomers');
      if (res.data.success) {
        setCustomers(res.data.contents);
        setFilteredCustomers(res.data.contents);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredCustomers(
        customers.filter(c =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.phone_number && String(c.phone_number).includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
        )
      );
    }
  }, [searchQuery, customers]);

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search customers…"
            className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-white rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        </div>
        <button
          onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
          className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer text-sm"
        >
          <Plus size={18} /> Add New Customer
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading customers…</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center">
            <Users size={48} className="text-gray-300 mb-4" />
            <p className="text-lg font-medium">No customers found</p>
            <p className="text-sm">Try adding a new customer or changing your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Phone Number</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Address</th>
                  <th className="px-6 py-4 font-semibold">Notes</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{customer.name}</td>
                    <td className="px-6 py-4 text-gray-600">{customer.phone_number || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{customer.email || '—'}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-[150px]" title={customer.address}>{customer.address || '—'}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-[150px]" title={customer.customer_notes}>{customer.customer_notes || '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => { setEditingCustomer(customer); setIsModalOpen(true); }}
                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                        title="Edit Customer"
                      >
                        <Edit2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { fetchCustomers(); setIsModalOpen(false); }}
        initialData={editingCustomer}
        customers={customers}
      />
    </>
  );
};

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
const CustomersPage = () => {
  const [activeTab, setActiveTab] = useState('customers');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers &amp; Debts</h1>
          <p className="text-gray-500 mt-1">Manage your customer database and credit debts.</p>
        </div>
      </div>

      {/* Top-level tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === 'customers'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Users size={16} /> Customers
        </button>
        <button
          onClick={() => setActiveTab('debts')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === 'debts'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <CreditCard size={16} /> Debts
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'customers' ? (
        <CustomersTab />
      ) : (
        <DebtsTab />
      )}
    </div>
  );
};

export default CustomersPage;
