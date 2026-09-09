import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Search, Calendar, FileText, ChevronDown, ChevronUp, DollarSign, TrendingUp, Percent, Boxes, User, CreditCard, Printer, RefreshCw, WifiOff } from 'lucide-react';
import { CSVLink } from 'react-csv';
import WholesaleReceipt from './WholesaleReceipt';
import { db } from '../db/dexieDb';

const PreviousWholesalesModal = ({ isOpen, onClose, shopDetails, user }) => {
  const [searchParams, setSearchParams] = useState({
    startDate: '',
    endDate: '',
    customerId: '',
    userId: '',
  });

  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [wholesales, setWholesales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [expandedWholesaleId, setExpandedWholesaleId] = useState(null);
  const [receiptData, setReceiptData] = useState(null);

  const isAdmin = user?.role === 'administrator';
  const showProfit = isAdmin;

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // KPI Statistics (Admin only)
  const [stats, setStats] = useState({
    totalCount: 0,
    totalRevenue: 0,
    totalDiscount: 0,
    totalCost: 0,
    totalProfit: 0,
    profitMargin: 0
  });

  const calculateStats = (wholesaleList) => {
    if (!isAdmin) return;
    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalCost = 0;

    wholesaleList.forEach(w => {
      totalRevenue += parseFloat(w.total_amount) || 0;
      totalDiscount += parseFloat(w.discount_applied) || 0;

      const orderCost = (w.items || []).reduce((sum, item) => sum + (parseFloat(item.cost_at_sale) || 0), 0);
      totalCost += orderCost;
    });

    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    setStats({
      totalCount: wholesaleList.length,
      totalRevenue,
      totalDiscount,
      totalCost,
      totalProfit,
      profitMargin
    });
  };

  const resetStats = () => {
    setStats({
      totalCount: 0,
      totalRevenue: 0,
      totalDiscount: 0,
      totalCost: 0,
      totalProfit: 0,
      profitMargin: 0
    });
  };

  const fetchWholesales = async (paramsToUse) => {
    if (!navigator.onLine) {
      setLoading(false);
      setWholesales([]);
      setError('You are currently offline. An active network connection is required to fetch previous wholesale sales.');
      resetStats();
      return;
    }

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const res = await axios.post('/api/previous-wholesales', paramsToUse);
      if (res.data && res.data.success) {
        const fetched = res.data.wholesales || [];
        setWholesales(fetched);
        calculateStats(fetched);
      } else {
        setWholesales([]);
        setError(res.data?.message || 'No wholesale sales found for this period.');
        resetStats();
      }
    } catch (err) {
      setWholesales([]);
      const isConnectionError = !navigator.onLine || !err.response || err.code === 'ERR_NETWORK';
      const errMsg = isConnectionError
        ? 'Cannot connect to server. Please check your network connection and ensure the server is reachable.'
        : (err.response?.data?.message || err.response?.data?.error || 'Failed to fetch previous wholesale sales.');
      setError(errMsg);
      resetStats();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const fetchFilterData = async () => {
      try {
        if (navigator.onLine) {
          const [salesRes, transRes] = await Promise.all([
            axios.get('/api/salesPage').catch(() => ({ data: {} })),
            axios.get('/api/transactionPage').catch(() => ({ data: {} }))
          ]);
          if (salesRes.data.customers) setCustomers(salesRes.data.customers);
          if (transRes.data.users) setUsers(transRes.data.users);
        } else {
          const localCustomers = await db.customers.toArray().catch(() => []);
          setCustomers(localCustomers || []);
        }
      } catch (err) {
        console.error('Failed to load filters', err);
      }
    };
    fetchFilterData();

    const today = new Date();
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const initialParams = {
      startDate: todayStr,
      endDate: todayStr,
      customerId: '',
      userId: '',
    };

    setSearchParams(initialParams);
    fetchWholesales(initialParams);
  }, [isOpen]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    fetchWholesales(searchParams);
  };

  const setQuickRange = (type) => {
    const today = new Date();
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    let start = todayStr;
    let end = todayStr;

    if (type === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      start = new Date(yest.getTime() - (yest.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      end = start;
    } else if (type === 'week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(today.setDate(diff));
      start = new Date(mon.getTime() - (mon.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      end = todayStr;
    } else if (type === 'month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      start = new Date(first.getTime() - (first.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      end = todayStr;
    }

    const newParams = { ...searchParams, startDate: start, endDate: end };
    setSearchParams(newParams);
    fetchWholesales(newParams);
  };

  const toggleExpandRow = (id) => {
    setExpandedWholesaleId(expandedWholesaleId === id ? null : id);
  };

  const handleReprint = (wholesale) => {
    setReceiptData({
      shopDetails,
      date: new Date(wholesale.wholesale_date).toLocaleString(),
      items: wholesale.items?.map(item => ({
        itemName: item.product_name,
        quantity: item.quantity_sold,
        wholesaleUnit: item.wholesale_unit_name,
        unitMultiplier: item.unit_multiplier,
        totalBaseUnits: item.total_base_units,
        sellPrice: parseFloat(item.selling_price_per_unit)
      })) || [],
      totalAmount: parseFloat(wholesale.total_amount) + parseFloat(wholesale.discount_applied),
      totalDiscount: parseFloat(wholesale.discount_applied),
      amountPaid: parseFloat(wholesale.total_amount),
      payRoute: wholesale.pay_route,
      salesRep: wholesale.cashier_name,
      customerName: wholesale.customer_name
    });

    setTimeout(() => {
      window.print();
      setTimeout(() => setReceiptData(null), 1000);
    }, 500);
  };

  // CSV Export configuration
  const csvHeaders = [
    { label: 'Wholesale ID', key: 'wholesaleId' },
    { label: 'Date', key: 'date' },
    { label: 'Customer', key: 'customer' },
    { label: 'Cashier', key: 'cashier' },
    { label: 'Payment Route', key: 'payRoute' },
    { label: 'Bank Name', key: 'bankName' },
    { label: 'Product Name', key: 'productName' },
    { label: 'Packaging Unit', key: 'wholesaleUnit' },
    { label: 'Package Qty', key: 'packageQty' },
    { label: 'Unit Multiplier', key: 'unitMultiplier' },
    { label: 'Total Base Units', key: 'totalBaseUnits' },
    { label: 'Selling Price/Pack', key: 'sellingPricePack' },
    ...(isAdmin ? [{ label: 'Cost at Sale', key: 'costAtSale' }] : []),
    { label: 'Line Net Price', key: 'lineNetPrice' },
    { label: 'Discount Applied', key: 'discountApplied' },
    { label: 'Wholesale Net Total', key: 'wholesaleNetTotal' },
  ];

  const csvData = wholesales.flatMap(w => {
    const common = {
      wholesaleId: `WS-${w.wholesale_id}`,
      date: new Date(w.wholesale_date).toLocaleString(),
      customer: w.customer_name || 'Walk-in Wholesale Customer',
      cashier: w.cashier_name || 'System',
      payRoute: w.pay_route,
      bankName: w.bank_name || 'N/A',
      discountApplied: w.discount_applied,
      wholesaleNetTotal: w.total_amount
    };

    if (!w.items || w.items.length === 0) {
      return [{
        ...common,
        productName: 'N/A',
        wholesaleUnit: 'N/A',
        packageQty: 0,
        unitMultiplier: 1,
        totalBaseUnits: 0,
        sellingPricePack: 0,
        ...(isAdmin ? { costAtSale: 0 } : {}),
        lineNetPrice: 0
      }];
    }

    return w.items.map(item => ({
      ...common,
      productName: item.product_name,
      wholesaleUnit: item.wholesale_unit_name || 'Pack',
      packageQty: item.quantity_sold,
      unitMultiplier: item.unit_multiplier || 1,
      totalBaseUnits: item.total_base_units || (item.quantity_sold * (item.unit_multiplier || 1)),
      sellingPricePack: item.selling_price_per_unit,
      ...(isAdmin ? { costAtSale: item.cost_at_sale || 0 } : {}),
      lineNetPrice: (item.quantity_sold * parseFloat(item.selling_price_per_unit)).toFixed(2)
    }));
  });

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-amber-200">
          {/* Header */}
          <div className="px-5 sm:px-7 py-4 border-b border-amber-200 bg-amber-50/70 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                <Boxes size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-amber-950 flex items-center gap-2">
                  Previous Wholesale Orders
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-white text-amber-800 border border-amber-300 rounded-full">
                    {wholesales.length} {wholesales.length === 1 ? 'order' : 'orders'}
                  </span>
                </h2>
                <p className="text-xs text-amber-700">Audit bulk distribution sales and reprint wholesale invoices</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {wholesales.length > 0 && (
                <CSVLink
                  data={csvData}
                  headers={csvHeaders}
                  filename={`wholesale_report_${searchParams.startDate}_to_${searchParams.endDate}.csv`}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                >
                  <FileText size={14} />
                  Export CSV
                </CSVLink>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-amber-100/60 rounded-xl transition cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
            {/* Filter Controls */}
            <form onSubmit={handleSearch} className="bg-amber-50/30 p-4 rounded-2xl border border-amber-200/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-amber-600" /> Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={searchParams.startDate}
                    onChange={e => setSearchParams({ ...searchParams, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-amber-600" /> End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={searchParams.endDate}
                    onChange={e => setSearchParams({ ...searchParams, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <User size={13} className="text-amber-600" /> Customer
                  </label>
                  <select
                    value={searchParams.customerId}
                    onChange={e => setSearchParams({ ...searchParams, customerId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  >
                    <option value="">All Customers</option>
                    {customers.map(c => (
                      <option key={c.id || c.local_id} value={c.id || c.local_id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <CreditCard size={13} className="text-amber-600" /> Cashier / User
                  </label>
                  <select
                    value={searchParams.userId}
                    onChange={e => setSearchParams({ ...searchParams, userId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  >
                    <option value="">All Cashiers</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Filter Buttons & Submit */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200/80">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick Range:</span>
                  <button
                    type="button"
                    onClick={() => setQuickRange('today')}
                    className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg transition cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRange('yesterday')}
                    className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg transition cursor-pointer"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRange('week')}
                    className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg transition cursor-pointer"
                  >
                    This Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRange('month')}
                    className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg transition cursor-pointer"
                  >
                    This Month
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Search size={14} />
                  {loading ? 'Searching...' : 'Filter Orders'}
                </button>
              </div>
            </form>

            {/* KPI Statistics (Admin Only) */}
            {isAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                    <Boxes size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Total Wholesales</p>
                    <p className="text-lg font-bold text-slate-900">{stats.totalCount}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Gross Revenue</p>
                    <p className="text-lg font-bold text-emerald-700">₦{formatMoney(stats.totalRevenue)}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                    <Percent size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Discounts Given</p>
                    <p className="text-lg font-bold text-rose-700">₦{formatMoney(stats.totalDiscount)}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Net Profit (Margin)</p>
                    <p className="text-lg font-bold text-indigo-700">
                      ₦{formatMoney(stats.totalProfit)}{' '}
                      <span className="text-xs font-semibold text-emerald-600">
                        ({stats.profitMargin.toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error / Disconnected Banner */}
            {error && (
              <div className="p-4 bg-amber-50 text-amber-900 text-xs font-medium rounded-2xl border border-amber-300 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <WifiOff size={18} className="text-amber-700 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchWholesales(searchParams)}
                  className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold transition cursor-pointer shrink-0"
                >
                  <RefreshCw size={13} />
                  Retry Connection
                </button>
              </div>
            )}

            {/* Wholesale Transactions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
                      <th className="px-4 py-3">Order / Date</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Cashier</th>
                      <th className="px-4 py-3 text-right">Items</th>
                      <th className="px-4 py-3 text-right">Total (₦)</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-amber-600">
                          <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                          <span className="font-medium">Loading wholesale orders...</span>
                        </td>
                      </tr>
                    ) : wholesales.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-slate-400">
                          <Boxes size={32} className="mx-auto mb-2 opacity-40 text-amber-500" />
                          <span className="font-medium">{searched ? 'No wholesale transactions found for this filter.' : 'Search wholesale records above.'}</span>
                        </td>
                      </tr>
                    ) : (
                      wholesales.map(w => {
                        const isExpanded = expandedWholesaleId === w.wholesale_id;
                        const itemsCount = (w.items || []).reduce((acc, it) => acc + Number(it.quantity_sold || 0), 0);

                        return (
                          <div key={w.wholesale_id} className="contents">
                            <tr
                              onClick={() => toggleExpandRow(w.wholesale_id)}
                              className={`hover:bg-amber-50/40 transition cursor-pointer ${isExpanded ? 'bg-amber-50/60' : ''}`}
                            >
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  {isExpanded ? <ChevronUp size={14} className="text-amber-600" /> : <ChevronDown size={14} className="text-slate-400" />}
                                  <span>WS-{w.wholesale_id}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {new Date(w.wholesale_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                              </td>

                              <td className="px-4 py-3 font-semibold text-slate-800">
                                {w.customer_name || <span className="text-slate-400 font-normal">Walk-in Customer</span>}
                              </td>

                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                                  w.pay_route === 'Cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  w.pay_route === 'Credit' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {w.pay_route}
                                </span>
                                {w.bank_name && (
                                  <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{w.bank_name}</div>
                                )}
                              </td>

                              <td className="px-4 py-3 text-slate-600">
                                {w.cashier_name || 'Admin'}
                              </td>

                              <td className="px-4 py-3 text-right font-medium text-slate-700">
                                {itemsCount} <span className="text-slate-400 text-[11px]">packs</span>
                              </td>

                              <td className="px-4 py-3 text-right">
                                <div className="font-bold text-slate-900 text-sm">
                                  ₦{formatMoney(w.total_amount)}
                                </div>
                                {parseFloat(w.discount_applied) > 0 && (
                                  <div className="text-[10px] text-rose-600 font-medium">
                                    -₦{formatMoney(w.discount_applied)} disc.
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleReprint(w)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg transition text-xs font-semibold shadow-2xs cursor-pointer"
                                  title="Reprint Wholesale Invoice"
                                >
                                  <Printer size={13} />
                                  <span>Reprint</span>
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Line Items */}
                            {isExpanded && (
                              <tr className="bg-slate-50/90">
                                <td colSpan="7" className="px-5 py-3.5 border-b border-amber-100">
                                  <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs space-y-2">
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-700 border-b border-slate-100 pb-1.5">
                                      <span className="flex items-center gap-1.5 text-amber-900">
                                        <Boxes size={14} className="text-amber-600" /> Line Items Breakdown
                                      </span>
                                      <span className="text-slate-500 font-normal text-[11px]">
                                        Ordered: {(w.items || []).length} line items
                                      </span>
                                    </div>

                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="text-[11px] text-slate-500 uppercase border-b border-slate-100">
                                          <th className="py-1">Product</th>
                                          <th className="py-1 text-center">Package Unit</th>
                                          <th className="py-1 text-center">Pack Qty</th>
                                          <th className="py-1 text-center">Base Equiv.</th>
                                          <th className="py-1 text-right">Price / Pack</th>
                                          {showProfit && <th className="py-1 text-right">Cost</th>}
                                          <th className="py-1 text-right">Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                        {(w.items || []).map((item, idx) => {
                                          const itemSubtotal = item.quantity_sold * parseFloat(item.selling_price_per_unit || 0);
                                          const itemCost = parseFloat(item.cost_at_sale || 0);

                                          return (
                                            <tr key={item.line_item_id || idx} className="hover:bg-slate-50/80">
                                              <td className="py-1.5 font-semibold text-slate-800">
                                                {item.product_name}
                                              </td>
                                              <td className="py-1.5 text-center text-slate-600 font-medium">
                                                <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                                                  {item.wholesale_unit_name || 'Pack'}
                                                </span>
                                              </td>
                                              <td className="py-1.5 text-center font-bold text-slate-900">
                                                {item.quantity_sold}
                                              </td>
                                              <td className="py-1.5 text-center text-slate-500 font-medium">
                                                {item.total_base_units || (item.quantity_sold * (item.unit_multiplier || 1))} units
                                              </td>
                                              <td className="py-1.5 text-right font-medium text-slate-700">
                                                ₦{formatMoney(item.selling_price_per_unit)}
                                              </td>
                                              {showProfit && (
                                                <td className="py-1.5 text-right text-slate-500 font-mono text-[11px]">
                                                  ₦{formatMoney(itemCost)}
                                                </td>
                                              )}
                                              <td className="py-1.5 text-right font-bold text-slate-900">
                                                ₦{formatMoney(itemSubtotal)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </div>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-7 py-3 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Hidden print receipt portal */}
      {receiptData && <WholesaleReceipt receiptData={receiptData} />}
    </>
  );
};

export default PreviousWholesalesModal;
