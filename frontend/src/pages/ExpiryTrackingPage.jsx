import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  CalendarClock, AlertTriangle, AlertOctagon, ShieldAlert, Clock, 
  Search, Filter, Download, RefreshCw, CheckCircle2, ChevronRight, 
  Trash2, X, DollarSign, Package, Tag, ArrowUpDown, Calendar, HelpCircle,
  Pencil
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useOutletContext } from 'react-router-dom';

const ExpiryTrackingPage = () => {
  const { showToast } = useToast();
  const { user } = useOutletContext() || {};
  const isAdmin = user?.role === 'administrator';
  const canEdit = isAdmin || Boolean(user?.permissions?.can_purchase);

  // Filters & query state
  const [activeRange, setActiveRange] = useState('1m'); // 'expired', '1m', '3m', '6m', '1y', 'all'
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('expiry_asc');

  // Data & loading states
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({
    expiredCount: 0,
    expiredCostValue: 0,
    oneMonthCount: 0,
    oneMonthCostValue: 0,
    threeMonthCount: 0,
    threeMonthCostValue: 0,
    sixMonthCount: 0,
    sixMonthCostValue: 0,
    oneYearCount: 0,
    oneYearCostValue: 0,
    totalLotsCount: 0,
    totalAtRiskCostValue: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selection for bulk write-off
  const [selectedLots, setSelectedLots] = useState([]);

  // Confirmation Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState(null); // null for bulk, or specific lot object
  const [writeOffQuantity, setWriteOffQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Expiry Date Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTargetLot, setEditTargetLot] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editHasNoExpiry, setEditHasNoExpiry] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Fetch Categories for dropdown
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('/api/stockPage').catch(() => ({ data: { categories: [] } }));
        setCategories(res.data.categories || []);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch Expiry Data
  const fetchExpiryData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await axios.get('/api/expiry-tracking', {
        params: {
          range: activeRange,
          category: selectedCategory,
          search: search.trim(),
          sortBy
        }
      });

      if (res.data.success) {
        setItems(res.data.items || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      } else {
        setItems([]);
        showToast('error', res.data.message || 'Failed to load expiry data');
      }
    } catch (err) {
      console.error(err);
      setItems([]);
      showToast('error', err.response?.data?.message || 'Error communicating with server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Trigger search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpiryData();
      setSelectedLots([]); // Clear selections on filter change
    }, 300);
    return () => clearTimeout(timer);
  }, [activeRange, selectedCategory, search, sortBy]);

  // Handle select-all checkbox
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLots(items.map(item => item.lot_id));
    } else {
      setSelectedLots([]);
    }
  };

  // Handle single item selection toggle
  const toggleSelectLot = (lotId) => {
    setSelectedLots(prev => 
      prev.includes(lotId) ? prev.filter(id => id !== lotId) : [...prev, lotId]
    );
  };

  // Open Edit Expiry Date Modal
  const openEditModal = (lot) => {
    setEditTargetLot(lot);
    setEditDate(lot.expiry_date || '');
    setEditHasNoExpiry(!lot.expiry_date);
    setEditModalOpen(true);
  };

  // Save updated expiry date
  const handleSaveExpiryDate = async (e) => {
    if (e) e.preventDefault();
    if (!editTargetLot || isSavingEdit) return;

    const newDateValue = editHasNoExpiry ? null : (editDate ? editDate.trim() : null);

    if (!editHasNoExpiry && !newDateValue) {
      return showToast('error', 'Please enter a valid expiry date or select "Non-perishable item".');
    }

    setIsSavingEdit(true);
    try {
      const res = await axios.patch(`/api/expiry/lot/${editTargetLot.lot_id}`, {
        expiryDate: newDateValue
      });

      if (res.data.success) {
        showToast('success', res.data.message || 'Expiry date updated successfully!');
        setEditModalOpen(false);
        setEditTargetLot(null);
        fetchExpiryData(true);
      } else {
        showToast('error', res.data.message || 'Failed to update expiry date');
      }
    } catch (err) {
      console.error(err);
      showToast('error', err.response?.data?.message || 'Server error while updating expiry date');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Write-Off Modal for single item
  const openSingleWriteOff = (lot) => {
    setModalTarget(lot);
    setWriteOffQuantity(lot.quantity_in_lot);
    setModalOpen(true);
  };

  // Open Write-Off Modal for bulk selection
  const openBulkWriteOff = () => {
    if (selectedLots.length === 0) return;
    setModalTarget(null);
    setModalOpen(true);
  };

  // Execute Write-Off
  const handleConfirmWriteOff = async () => {
    if (isSubmitting) return;

    let payloadItems = [];
    if (modalTarget) {
      const qtyNum = parseFloat(writeOffQuantity);
      if (isNaN(qtyNum) || qtyNum <= 0 || qtyNum > parseFloat(modalTarget.quantity_in_lot)) {
        return showToast('error', `Please enter a valid quantity between 1 and ${modalTarget.quantity_in_lot}`);
      }
      payloadItems = [{
        lotId: modalTarget.lot_id,
        productId: modalTarget.product_id,
        quantity: qtyNum
      }];
    } else {
      // Bulk write off selected items (full quantity)
      const selectedItemObjects = items.filter(i => selectedLots.includes(i.lot_id));
      payloadItems = selectedItemObjects.map(i => ({
        lotId: i.lot_id,
        productId: i.product_id,
        quantity: i.quantity_in_lot
      }));
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('/api/expiry/write-off', { items: payloadItems });
      if (res.data.success) {
        showToast('success', res.data.message || 'Expired stock written off successfully!');
        setModalOpen(false);
        setModalTarget(null);
        setSelectedLots([]);
        fetchExpiryData(true);
      } else {
        showToast('error', res.data.message || 'Failed to process write-off');
      }
    } catch (err) {
      console.error(err);
      showToast('error', err.response?.data?.message || 'Server error while writing off stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (items.length === 0) {
      return showToast('error', 'No items to export.');
    }

    const headers = [
      "Product Name", "Generic Name", "Barcode", "Category", "Company/Supplier",
      "Lot ID", "Quantity", "Unit", "Cost Price", "Selling Price",
      "Total Cost Value", "Expiry Date", "Days Remaining", "Status"
    ];

    const rows = items.map(item => {
      let statusText = 'Valid';
      if (item.days_until_expiry < 0) statusText = `Expired (${Math.abs(item.days_until_expiry)} days ago)`;
      else if (item.days_until_expiry === 0) statusText = 'Expires Today';
      else if (item.days_until_expiry <= 30) statusText = `Critical (${item.days_until_expiry} days left)`;
      else if (item.days_until_expiry <= 90) statusText = `Warning (${item.days_until_expiry} days left)`;
      else statusText = `Safe (${item.days_until_expiry} days left)`;

      return [
        `"${(item.product_name || '').replace(/"/g, '""')}"`,
        `"${(item.generic_name || '').replace(/"/g, '""')}"`,
        `"${item.barcode || ''}"`,
        `"${item.category_name || ''}"`,
        `"${item.company_name || ''}"`,
        item.lot_id,
        item.quantity_in_lot,
        `"${item.unit_name || ''}"`,
        item.cost_per_unit,
        item.unit_selling_price,
        item.total_cost_value,
        item.expiry_date,
        item.days_until_expiry,
        `"${statusText}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expiry_Audit_Report_${activeRange}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Expiry audit report exported successfully!');
  };

  // Helper for Status Badge
  const renderStatusBadge = (days) => {
    const d = parseInt(days, 10);
    if (d < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertOctagon size={13} className="text-rose-600" />
          Expired {Math.abs(d)}d ago
        </span>
      );
    }
    if (d === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500 text-white animate-pulse">
          <AlertTriangle size={13} />
          Expires Today!
        </span>
      );
    }
    if (d <= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle size={13} className="text-amber-600" />
          {d} {d === 1 ? 'day' : 'days'} left
        </span>
      );
    }
    if (d <= 90) {
      const months = Math.ceil(d / 30);
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-800 border border-yellow-200">
          <Clock size={13} className="text-yellow-600" />
          ~{months} {months === 1 ? 'month' : 'months'} left
        </span>
      );
    }
    if (d <= 180) {
      const months = Math.ceil(d / 30);
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Calendar size={13} className="text-blue-500" />
          ~{months} months left
        </span>
      );
    }
    const months = Math.ceil(d / 30);
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 size={13} className="text-emerald-500" />
        ~{months} months left
      </span>
    );
  };

  // Presets definition with badges
  const rangeButtons = [
    { id: 'expired', label: 'Already Expired', count: summary.expiredCount, color: 'text-rose-600', activeBg: 'bg-rose-600 text-white', badgeBg: 'bg-rose-100 text-rose-800' },
    { id: '1m', label: '1 Month (≤30d)', count: summary.oneMonthCount, color: 'text-amber-600', activeBg: 'bg-amber-600 text-white', badgeBg: 'bg-amber-100 text-amber-800' },
    { id: '3m', label: '3 Months (≤90d)', count: summary.threeMonthCount, color: 'text-yellow-600', activeBg: 'bg-indigo-600 text-white', badgeBg: 'bg-indigo-100 text-indigo-800' },
    { id: '6m', label: '6 Months (≤180d)', count: summary.sixMonthCount, color: 'text-blue-600', activeBg: 'bg-blue-600 text-white', badgeBg: 'bg-blue-100 text-blue-800' },
    { id: '1y', label: '1 Year (≤365d)', count: summary.oneYearCount, color: 'text-emerald-600', activeBg: 'bg-emerald-600 text-white', badgeBg: 'bg-emerald-100 text-emerald-800' },
    { id: 'all', label: 'All Lots', count: summary.totalLotsCount, color: 'text-gray-600', activeBg: 'bg-gray-800 text-white', badgeBg: 'bg-gray-100 text-gray-800' },
  ];

  // Calculate selected total loss value
  const selectedCostTotal = useMemo(() => {
    return items
      .filter(i => selectedLots.includes(i.lot_id))
      .reduce((sum, i) => sum + (parseFloat(i.total_cost_value) || 0), 0);
  }, [items, selectedLots]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl inline-flex">
              <CalendarClock size={28} />
            </span>
            Expiry Tracking
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor batch shelf lives, prevent product spoilage, and write off expired lots.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => fetchExpiryData(true)}
            disabled={refreshing}
            className="p-2.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-xl transition cursor-pointer border border-gray-200"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-sm shadow-xs transition cursor-pointer"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Top Metric / KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Already Expired */}
        <div 
          onClick={() => setActiveRange('expired')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeRange === 'expired' 
              ? 'bg-rose-50/70 border-rose-300 shadow-sm ring-2 ring-rose-400' 
              : 'bg-white border-gray-100 hover:border-rose-200 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Already Expired</span>
            <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
              <AlertOctagon size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-gray-900">{summary.expiredCount} <span className="text-xs font-semibold text-gray-500">lots</span></h3>
            <p className="text-xs font-medium text-rose-700 mt-1">
              Loss Value: <span className="font-bold">₦{formatMoney(summary.expiredCostValue)}</span>
            </p>
          </div>
        </div>

        {/* Card 2: Critical <= 30 Days */}
        <div 
          onClick={() => setActiveRange('1m')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeRange === '1m' 
              ? 'bg-amber-50/70 border-amber-300 shadow-sm ring-2 ring-amber-400' 
              : 'bg-white border-gray-100 hover:border-amber-200 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Expiring in ≤ 30 Days</span>
            <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-gray-900">{summary.oneMonthCount} <span className="text-xs font-semibold text-gray-500">lots</span></h3>
            <p className="text-xs font-medium text-amber-700 mt-1">
              At-Risk Cost: <span className="font-bold">₦{formatMoney(summary.oneMonthCostValue)}</span>
            </p>
          </div>
        </div>

        {/* Card 3: Warning <= 90 Days */}
        <div 
          onClick={() => setActiveRange('3m')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeRange === '3m' 
              ? 'bg-indigo-50/70 border-indigo-300 shadow-sm ring-2 ring-indigo-400' 
              : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Expiring in 3 Months</span>
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-gray-900">{summary.threeMonthCount} <span className="text-xs font-semibold text-gray-500">lots</span></h3>
            <p className="text-xs font-medium text-indigo-700 mt-1">
              At-Risk Cost: <span className="font-bold">₦{formatMoney(summary.threeMonthCostValue)}</span>
            </p>
          </div>
        </div>

        {/* Card 4: Total Tracked Value */}
        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Tracked Value</span>
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-gray-900">₦{formatMoney(summary.totalAtRiskCostValue)}</h3>
            <p className="text-xs font-medium text-gray-500 mt-1">
              Across <span className="font-bold text-gray-800">{summary.totalLotsCount}</span> total active batches
            </p>
          </div>
        </div>
      </div>

      {/* Preset Range Selector Buttons */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Calendar size={14} /> Filter By Expiry Range:
          </span>
          <span className="text-xs text-gray-400">
            Click any button below to filter lots expiring within that timeframe
          </span>
        </div>

        {/* 4 Range Buttons + Expired + All */}
        <div className="flex flex-wrap items-center gap-2">
          {rangeButtons.map(btn => {
            const isActive = activeRange === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setActiveRange(btn.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs cursor-pointer ${
                  isActive 
                    ? `${btn.activeBg} shadow-md scale-[1.02]` 
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>{btn.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                  isActive ? 'bg-white/20 text-white' : btn.badgeBg
                }`}>
                  {btn.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Category, and Sorting Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-gray-100">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by item name, generic name, barcode, or lot ID..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="md:col-span-4 relative">
            <Tag size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition appearance-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((c, i) => (
                <option key={i} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="md:col-span-3 relative">
            <ArrowUpDown size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition appearance-none cursor-pointer"
            >
              <option value="expiry_asc">Expiry: Soonest First</option>
              <option value="expiry_desc">Expiry: Furthest First</option>
              <option value="qty_desc">Quantity: High to Low</option>
              <option value="value_desc">Value at Risk: High to Low</option>
              <option value="name_asc">Product Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar when items selected */}
      {selectedLots.length > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center font-black">
              {selectedLots.length}
            </span>
            <div>
              <p className="font-bold text-sm">
                {selectedLots.length} {selectedLots.length === 1 ? 'batch' : 'batches'} selected
              </p>
              <p className="text-xs text-slate-400">
                Total at-risk cost impact: <span className="font-semibold text-rose-300">₦{formatMoney(selectedCostTotal)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setSelectedLots([])}
              className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              Clear Selection
            </button>

            {isAdmin && (
              <button
                onClick={openBulkWriteOff}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-md transition cursor-pointer"
              >
                <Trash2 size={16} />
                <span>Write Off Selected as Expired</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Batch Lots Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="text-sm font-medium text-gray-500">Scanning inventory lots...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">No batches found for this criteria</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              {activeRange === 'expired' 
                ? 'Great news! There are currently no expired product lots in your active stock.'
                : `No product lots expiring in this selected date range (${activeRange.toUpperCase()}).`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-600">
                  <th className="py-3.5 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedLots.length === items.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-4">Item Details</th>
                  <th className="py-3.5 px-4">Batch / Lot</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">In Stock</th>
                  <th className="py-3.5 px-4 text-right">Unit Cost</th>
                  <th className="py-3.5 px-4 text-right">Total Cost Value</th>
                  <th className="py-3.5 px-4">Expiry Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  {(isAdmin || canEdit) && <th className="py-3.5 px-4 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {items.map((item) => {
                  const isSelected = selectedLots.includes(item.lot_id);
                  const isPast = item.days_until_expiry < 0;

                  return (
                    <tr 
                      key={item.lot_id} 
                      className={`transition-colors hover:bg-gray-50/70 ${
                        isSelected ? 'bg-indigo-50/50' : isPast ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLot(item.lot_id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </td>

                      {/* Item Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                          {item.generic_name && <span>{item.generic_name}</span>}
                          {item.barcode && (
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-600">
                              {item.barcode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Lot ID */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-semibold text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">
                          LOT-{item.lot_id}
                        </span>
                        {item.entry_date && (
                          <div className="text-[11px] text-gray-400 mt-1">In: {item.entry_date}</div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">
                          {item.category_name}
                        </span>
                      </td>

                      {/* In Stock Qty */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-gray-900">
                          {Number(item.quantity_in_lot).toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">
                          {item.unit_name}
                        </span>
                      </td>

                      {/* Cost Per Unit */}
                      <td className="py-3.5 px-4 text-right font-medium text-gray-600">
                        ₦{formatMoney(item.cost_per_unit)}
                      </td>

                      {/* Total Cost Value */}
                      <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                        ₦{formatMoney(item.total_cost_value)}
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 group">
                          <span className="font-bold text-gray-800">
                            {item.expiry_date || <span className="text-gray-400 font-normal italic">None</span>}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => openEditModal(item)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-all cursor-pointer"
                              title="Edit expiry date"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status Urgency Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(item.days_until_expiry)}
                      </td>

                      {/* Actions: Edit Date & Write Off */}
                      {(isAdmin || canEdit) && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canEdit && (
                              <button
                                onClick={() => openEditModal(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition cursor-pointer"
                                title="Correct mistake in expiry date"
                              >
                                <Pencil size={12} />
                                <span>Edit Date</span>
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => openSingleWriteOff(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                                title="Write off this batch as expired"
                              >
                                <Trash2 size={12} />
                                <span>Write Off</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer */}
        <div className="bg-gray-50/70 border-t border-gray-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <span>Showing {items.length} matching batch {items.length === 1 ? 'lot' : 'lots'}</span>
          <span>Tip: Active sales automatically dispatch oldest batches first via FEFO.</span>
        </div>
      </div>

      {/* Confirmation Modal for Write-Off */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs">
                  <AlertOctagon size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Confirm Expired Stock Write-Off</h3>
                  <p className="text-xs text-rose-700 font-medium mt-0.5">
                    {modalTarget ? 'Remove single batch from inventory' : `Remove ${selectedLots.length} selected batches`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {modalTarget ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Item</p>
                    <p className="text-base font-bold text-gray-900">{modalTarget.product_name}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
                      <span>Batch: <strong className="font-mono">LOT-{modalTarget.lot_id}</strong></span>
                      <span>Expiry: <strong>{modalTarget.expiry_date}</strong></span>
                      <span>Unit Cost: <strong>₦{formatMoney(modalTarget.cost_per_unit)}</strong></span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                      Quantity to Write Off (Available: {modalTarget.quantity_in_lot} {modalTarget.unit_name})
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={modalTarget.quantity_in_lot}
                      value={writeOffQuantity}
                      onChange={(e) => setWriteOffQuantity(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Writing off <strong>{writeOffQuantity || 0} {modalTarget.unit_name}</strong> will record a financial loss of <strong>₦{formatMoney((parseFloat(writeOffQuantity) || 0) * parseFloat(modalTarget.cost_per_unit))}</strong> under 'Expired' stock transactions.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4">
                    <p className="text-sm text-gray-700">
                      You are about to write off <strong className="text-rose-700 font-bold">{selectedLots.length} product batches</strong>.
                    </p>
                    <p className="text-base font-bold text-gray-900 mt-2">
                      Total Loss Impact: <span className="text-rose-600">₦{formatMoney(selectedCostTotal)}</span>
                    </p>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {items.filter(i => selectedLots.includes(i.lot_id)).map(item => (
                      <div key={item.lot_id} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                          <span className="font-bold text-gray-800">{item.product_name}</span>
                          <span className="text-gray-400 font-mono ml-2">(LOT-{item.lot_id})</span>
                        </div>
                        <div className="font-semibold text-gray-700">
                          {item.quantity_in_lot} {item.unit_name} &bull; ₦{formatMoney(item.total_cost_value)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500">
                    This action will reduce available stock counts to zero for these lots and permanently log each write-off into the stock changes ledger.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWriteOff}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Confirm & Write Off</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Editing Expiry Date */}
      {editModalOpen && editTargetLot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-indigo-50/80 border-b border-indigo-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Calendar size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Edit Expiry Date</h3>
                  <p className="text-xs text-indigo-700 font-medium mt-0.5">
                    Correct purchase mistake for LOT-{editTargetLot.lot_id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveExpiryDate}>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Product</p>
                  <p className="text-base font-bold text-gray-900">{editTargetLot.product_name}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-2">
                    <span>Batch: <strong className="font-mono">LOT-{editTargetLot.lot_id}</strong></span>
                    <span>In Stock: <strong>{Number(editTargetLot.quantity_in_lot).toLocaleString()} {editTargetLot.unit_name}</strong></span>
                    <span>Current Expiry: <strong>{editTargetLot.expiry_date || 'None'}</strong></span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                    New Expiry Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    disabled={editHasNoExpiry}
                    onChange={(e) => setEditDate(e.target.value)}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      editHasNoExpiry 
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700 font-medium select-none">
                    <input
                      type="checkbox"
                      checked={editHasNoExpiry}
                      onChange={(e) => {
                        setEditHasNoExpiry(e.target.checked);
                        if (e.target.checked) setEditDate('');
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>Non-perishable item (Remove expiration date)</span>
                  </label>
                  <p className="text-[11px] text-gray-500 ml-6.5 mt-1">
                    Check this if this batch was recorded with an expiry date by mistake.
                  </p>
                </div>

                <p className="text-xs text-gray-500 italic">
                  Note: Updating the date automatically recalculates urgency badges, alert banners, and sales FEFO dispatch priority.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  disabled={isSavingEdit}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpiryTrackingPage;
