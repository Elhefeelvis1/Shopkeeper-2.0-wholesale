import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Search, Calendar, FileText, ChevronDown, ChevronUp, DollarSign, TrendingUp, Percent, ShoppingBag, User, CreditCard, Printer, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';
import { CSVLink } from 'react-csv';
import Receipt from './Receipt';
import { db } from '../db/dexieDb';

const PreviousSalesModal = ({ isOpen, onClose, shopDetails, user }) => {
  const [searchParams, setSearchParams] = useState({
    startDate: '',
    endDate: '',
    customerId: '',
    userId: '',
  });

  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
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

  const calculateStats = (salesList) => {
    if (!isAdmin) return;
    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalCost = 0;

    salesList.forEach(sale => {
      totalRevenue += parseFloat(sale.total_amount) || 0;
      totalDiscount += parseFloat(sale.discount_applied) || 0;

      const saleCost = (sale.items || []).reduce((sum, item) => sum + (parseFloat(item.cost_at_sale) || 0), 0);
      totalCost += saleCost;
    });

    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    setStats({
      totalCount: salesList.length,
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

  const fetchSales = async (paramsToUse) => {
    if (!navigator.onLine) {
      setLoading(false);
      setSales([]);
      setError('You are currently offline. An active network connection is required to fetch previous sales.');
      resetStats();
      return;
    }

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const res = await axios.post('/api/searchSales', paramsToUse);
      if (res.data && res.data.success) {
        const fetchedSales = res.data.sales || [];
        setSales(fetchedSales);
        calculateStats(fetchedSales);
      } else {
        setSales([]);
        setError(res.data?.message || 'No sales found for this period.');
        resetStats();
      }
    } catch (err) {
      setSales([]);
      const isConnectionError = !navigator.onLine || !err.response || err.code === 'ERR_NETWORK';
      const errMsg = isConnectionError
        ? 'Cannot connect to server. Please check your network connection and ensure the server is running.'
        : (err.response?.data?.message || err.response?.data?.error || 'Failed to fetch previous sales.');
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
          // Fallback to local Dexie customers
          const localCustomers = await db.customers.toArray().catch(() => []);
          setCustomers(localCustomers || []);
        }
      } catch (err) {
        console.error('Failed to load filter metadata', err);
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
    fetchSales(initialParams);
  }, [isOpen]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    fetchSales(searchParams);
  };

  const setQuickRange = (range) => {
    const today = new Date();
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    let startStr = todayStr;
    let endStr = todayStr;

    if (range === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      startStr = new Date(y.getTime() - (y.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      endStr = startStr;
    } else if (range === 'week') {
      const w = new Date(today);
      w.setDate(w.getDate() - 7);
      startStr = new Date(w.getTime() - (w.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    } else if (range === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      startStr = new Date(firstDay.getTime() - (firstDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }

    const newParams = { ...searchParams, startDate: startStr, endDate: endStr };
    setSearchParams(newParams);
    fetchSales(newParams);
  };

  const toggleExpandRow = (saleId) => {
    setExpandedSaleId(prev => (prev === saleId ? null : saleId));
  };

  const handleReprint = (sale, e) => {
    if (e) e.stopPropagation();
    setReceiptData({
      shopDetails,
      date: new Date(sale.sale_date).toLocaleString(),
      items: sale.items?.map(item => ({
        itemName: item.product_name,
        quantity: item.quantity_sold,
        sellPrice: parseFloat(item.selling_price_per_unit)
      })) || [],
      totalAmount: parseFloat(sale.total_amount) + parseFloat(sale.discount_applied || 0),
      totalDiscount: parseFloat(sale.discount_applied || 0),
      amountPaid: parseFloat(sale.total_amount),
      payRoute: sale.pay_route,
      salesRep: sale.cashier_name || user?.username || 'Cashier',
      isReprint: true
    });

    setTimeout(() => {
      window.print();
      setTimeout(() => setReceiptData(null), 1000);
    }, 500);
  };

  // Prepare CSV download data
  const csvHeaders = [
    { label: 'Sale ID', key: 'saleId' },
    { label: 'Date', key: 'date' },
    { label: 'Customer', key: 'customer' },
    { label: 'Cashier', key: 'cashier' },
    { label: 'Pay Route', key: 'payRoute' },
    { label: 'Bank Name', key: 'bankName' },
    { label: 'Product Name', key: 'productName' },
    { label: 'Quantity Sold', key: 'qtySold' },
    { label: 'Selling Price/Unit', key: 'sellingPriceUnit' },
    ...(isAdmin ? [{ label: 'Cost at Sale', key: 'costAtSale' }] : []),
    { label: 'Line Net Price', key: 'lineNetPrice' },
    { label: 'Discount Applied', key: 'discountApplied' },
    { label: 'Sale Net Total', key: 'saleNetTotal' },
  ];

  const csvData = sales.flatMap(sale => {
    const common = {
      saleId: `SALE-${sale.sale_id}`,
      date: new Date(sale.sale_date).toLocaleString(),
      customer: sale.customer_name || 'Walk-in Customer',
      cashier: sale.cashier_name || 'System',
      payRoute: sale.pay_route,
      bankName: sale.bank_name || 'N/A',
      discountApplied: sale.discount_applied || 0,
      saleNetTotal: sale.total_amount
    };

    if (!sale.items || sale.items.length === 0) {
      return [{
        ...common,
        productName: 'N/A',
        qtySold: 0,
        sellingPriceUnit: 0,
        ...(isAdmin ? { costAtSale: 0 } : {}),
        lineNetPrice: 0
      }];
    }

    return sale.items.map(item => ({
      ...common,
      productName: item.product_name,
      qtySold: item.quantity_sold,
      sellingPriceUnit: item.selling_price_per_unit,
      ...(isAdmin ? { costAtSale: item.cost_at_sale || 0 } : {}),
      lineNetPrice: (item.quantity_sold * parseFloat(item.selling_price_per_unit || 0)).toFixed(2)
    }));
  });

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-indigo-200">
          {/* Header */}
          <div className="px-5 sm:px-7 py-4 border-b border-indigo-100 bg-indigo-50/70 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <ShoppingBag size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  Previous Sales
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-white text-indigo-800 border border-indigo-200 rounded-full">
                    {sales.length} {sales.length === 1 ? 'sale' : 'sales'}
                  </span>
                </h2>
                <p className="text-xs text-gray-500">Audit sales records, view item breakdown, and reprint receipts</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sales.length > 0 && (
                <CSVLink
                  data={csvData}
                  headers={csvHeaders}
                  filename={`sales_report_${searchParams.startDate}_to_${searchParams.endDate}.csv`}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                >
                  <FileText size={14} />
                  Export CSV
                </CSVLink>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-indigo-100/60 rounded-xl transition cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
            {/* Filter Controls */}
            <form onSubmit={handleSearch} className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-indigo-600" /> Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={searchParams.startDate}
                    onChange={e => setSearchParams({ ...searchParams, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-indigo-600" /> End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={searchParams.endDate}
                    onChange={e => setSearchParams({ ...searchParams, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <User size={13} className="text-indigo-600" /> Customer
                  </label>
                  <select
                    value={searchParams.customerId}
                    onChange={e => setSearchParams({ ...searchParams, customerId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <CreditCard size={13} className="text-indigo-600" /> Cashier / User
                  </label>
                  <select
                    value={searchParams.userId}
                    onChange={e => setSearchParams({ ...searchParams, userId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-100">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-gray-500 mr-1">Quick Range:</span>
                  <button
                    type="button"
                    onClick={() => setQuickRange('today')}
                    className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg transition cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRange('yesterday')}
                    className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg transition cursor-pointer"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRange('week')}
                    className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg transition cursor-pointer"
                  >
                    This Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRange('month')}
                    className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg transition cursor-pointer"
                  >
                    This Month
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Search size={14} />
                  {loading ? 'Searching...' : 'Filter Sales'}
                </button>
              </div>
            </form>

            {/* KPI Statistics (Admin Only) */}
            {isAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Total Sales Count</p>
                    <p className="text-lg font-bold text-gray-900">{stats.totalCount}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Gross Revenue</p>
                    <p className="text-lg font-bold text-emerald-700">₦{formatMoney(stats.totalRevenue)}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                    <Percent size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Discounts Given</p>
                    <p className="text-lg font-bold text-rose-700">₦{formatMoney(stats.totalDiscount)}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Net Profit (Margin)</p>
                    <p className="text-lg font-bold text-gray-900">
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
              <div className="p-4 bg-red-50 text-red-800 text-xs font-medium rounded-2xl border border-red-200 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <WifiOff size={18} className="text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchSales(searchParams)}
                  className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-lg font-semibold transition cursor-pointer shrink-0"
                >
                  <RefreshCw size={13} />
                  Retry Connection
                </button>
              </div>
            )}

            {/* Sales Transactions Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 uppercase tracking-wider">
                      <th className="px-4 py-3">Sale / Date</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Cashier</th>
                      <th className="px-4 py-3 text-right">Items</th>
                      <th className="px-4 py-3 text-right">Total (₦)</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-indigo-600">
                          <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                          <span className="font-medium">Loading sales records...</span>
                        </td>
                      </tr>
                    ) : sales.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-gray-400">
                          <ShoppingBag size={32} className="mx-auto mb-2 opacity-30 text-indigo-500" />
                          <span className="font-medium">{searched ? 'No sales records found for this filter.' : 'Search sales records above.'}</span>
                        </td>
                      </tr>
                    ) : (
                      sales.map(sale => {
                        const isExpanded = expandedSaleId === sale.sale_id;
                        const itemsCount = (sale.items || []).reduce((acc, it) => acc + Number(it.quantity_sold || 0), 0);

                        return (
                          <div key={sale.sale_id} className="contents">
                            <tr
                              onClick={() => toggleExpandRow(sale.sale_id)}
                              className={`hover:bg-indigo-50/40 transition cursor-pointer ${isExpanded ? 'bg-indigo-50/60' : ''}`}
                            >
                              <td className="px-4 py-3">
                                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                  {isExpanded ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-gray-400" />}
                                  <span>SALE-{sale.sale_id}</span>
                                </div>
                                <div className="text-[11px] text-gray-500 font-mono">
                                  {new Date(sale.sale_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                              </td>

                              <td className="px-4 py-3 font-semibold text-gray-800">
                                {sale.customer_name || <span className="text-gray-400 font-normal italic">Walk-in</span>}
                              </td>

                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  sale.pay_route === 'Cash' ? 'bg-emerald-100 text-emerald-800' :
                                  sale.pay_route === 'POS' ? 'bg-blue-100 text-blue-800' :
                                  sale.pay_route === 'Transfer' ? 'bg-purple-100 text-purple-800' :
                                  'bg-rose-100 text-rose-800'
                                }`}>
                                  {sale.pay_route}
                                </span>
                                {sale.bank_name && (
                                  <div className="text-[10px] text-gray-400 mt-0.5">{sale.bank_name}</div>
                                )}
                              </td>

                              <td className="px-4 py-3 text-gray-600">
                                {sale.cashier_name || 'System'}
                              </td>

                              <td className="px-4 py-3 text-right font-medium text-gray-700">
                                {itemsCount}
                              </td>

                              <td className="px-4 py-3 text-right font-bold text-gray-900">
                                ₦{formatMoney(sale.total_amount)}
                                {parseFloat(sale.discount_applied || 0) > 0 && (
                                  <div className="text-[10px] text-rose-500 font-normal">
                                    -₦{formatMoney(sale.discount_applied)} disc
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(e) => handleReprint(sale, e)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition border border-indigo-200 cursor-pointer"
                                  title="Reprint POS Receipt"
                                >
                                  <Printer size={12} />
                                  <span>Reprint</span>
                                </button>
                              </td>
                            </tr>

                            {/* Line Item Expansion */}
                            {isExpanded && (
                              <tr className="bg-indigo-50/20 border-y border-indigo-100">
                                <td colSpan="7" className="p-3 sm:p-4">
                                  <div className="bg-white rounded-xl border border-indigo-100 p-3 shadow-2xs space-y-2">
                                    <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                      <ShoppingBag size={14} className="text-indigo-600" />
                                      <span>Items in Sale #{sale.sale_id}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-[11px] text-left border-collapse">
                                        <thead>
                                          <tr className="border-b border-gray-100 text-gray-500 bg-gray-50 font-semibold">
                                            <th className="py-1.5 px-3">Product Name</th>
                                            <th className="py-1.5 px-3 text-center">Qty Sold</th>
                                            <th className="py-1.5 px-3 text-right">Unit Price</th>
                                            {showProfit && <th className="py-1.5 px-3 text-right">Cost Price</th>}
                                            <th className="py-1.5 px-3 text-right">Line Total</th>
                                            {showProfit && <th className="py-1.5 px-3 text-right">Profit</th>}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                          {(sale.items || []).map((item, idx) => {
                                            const lineTotal = item.quantity_sold * parseFloat(item.selling_price_per_unit || 0);
                                            const cost = parseFloat(item.cost_at_sale || 0);
                                            const profit = lineTotal - cost;

                                            return (
                                              <tr key={idx} className="hover:bg-gray-50/50">
                                                <td className="py-2 px-3 font-medium text-gray-900">{item.product_name}</td>
                                                <td className="py-2 px-3 text-center font-bold text-gray-800">
                                                  {item.quantity_sold}
                                                </td>
                                                <td className="py-2 px-3 text-right text-gray-700">
                                                  ₦{formatMoney(item.selling_price_per_unit)}
                                                </td>
                                                {showProfit && (
                                                  <td className="py-2 px-3 text-right text-gray-500">
                                                    ₦{formatMoney(cost)}
                                                  </td>
                                                )}
                                                <td className="py-2 px-3 text-right font-bold text-gray-900">
                                                  ₦{formatMoney(lineTotal)}
                                                </td>
                                                {showProfit && (
                                                  <td className={`py-2 px-3 text-right font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    ₦{formatMoney(profit)}
                                                  </td>
                                                )}
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
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
        </div>
      </div>

      <Receipt receiptData={receiptData} />
    </>
  );
};

export default PreviousSalesModal;
