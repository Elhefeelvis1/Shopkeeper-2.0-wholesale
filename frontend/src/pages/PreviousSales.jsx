import { useState, useEffect, Fragment, useContext } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { Search, Calendar, FileText, ChevronDown, ChevronUp, DollarSign, TrendingUp, Percent, ShoppingBag, ArrowRightLeft, User, CreditCard } from 'lucide-react';
import { CSVLink } from 'react-csv';
import Receipt from '../components/Receipt';


const PreviousSales = () => {
  const [searchParamsUrl] = useSearchParams();
  const isTodayOnly = searchParamsUrl.get('today') === 'true';

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
  const [shopDetails, setShopDetails] = useState(null);

  const { user } = useContext(UserContext) || {};
  const isAdmin = user?.role === 'administrator';
  const showProfit = isAdmin;

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Statistics (Admin only)
  const [stats, setStats] = useState({
    totalCount: 0,
    totalRevenue: 0,
    totalDiscount: 0,
    totalCost: 0,
    totalProfit: 0,
    profitMargin: 0
  });

  const fetchSales = async (paramsToUse) => {
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const res = await axios.post('/api/searchSales', paramsToUse);
      if (res.data.success) {
        let fetchedSales = res.data.sales || [];
        if (isTodayOnly) {
          fetchedSales = fetchedSales.slice(0, 15);
        }
        setSales(fetchedSales);
        calculateStats(fetchedSales);
      } else {
        setSales([]);
        setError(res.data.message || 'No sales found.');
        resetStats();
      }
    } catch (err) {
      setSales([]);
      setError(err.response?.data?.message || 'Failed to fetch sales.');
      resetStats();
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (salesList) => {
    if (!isAdmin) return;
    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalCost = 0;

    salesList.forEach(sale => {
      totalRevenue += parseFloat(sale.total_amount) || 0;
      totalDiscount += parseFloat(sale.discount_applied) || 0;

      // Calculate total cost for this sale from line items
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

  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [salesRes, transRes] = await Promise.all([
          axios.get('/api/salesPage'),
          axios.get('/api/transactionPage')
        ]);
        setCustomers(salesRes.data.customers || []);
        setUsers(transRes.data.users || []);
        setShopDetails(salesRes.data.shopDetails || null);
      } catch (err) {
        console.error('Failed to load filters', err);
      }
    };
    fetchFilterData();

    const today = new Date();
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    // Default to the first day of the current month
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayStr = new Date(firstDay.getTime() - (firstDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const initialParams = {
      startDate: isTodayOnly ? todayStr : firstDayStr,
      endDate: todayStr,
      customerId: '',
      userId: '',
    };

    setSearchParams(initialParams);
    fetchSales(initialParams);
  }, [isTodayOnly]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    fetchSales(searchParams);
  };

  const toggleExpandRow = (saleId) => {
    if (expandedSaleId === saleId) {
      setExpandedSaleId(null);
    } else {
      setExpandedSaleId(saleId);
    }
  };

  const handleReprint = (sale) => {
    setReceiptData({
      shopDetails,
      date: new Date(sale.sale_date).toLocaleString(),
      items: sale.items?.map(item => ({
        itemName: item.product_name,
        quantity: item.quantity_sold,
        sellPrice: parseFloat(item.selling_price_per_unit)
      })) || [],
      totalAmount: parseFloat(sale.total_amount) + parseFloat(sale.discount_applied),
      totalDiscount: parseFloat(sale.discount_applied),
      amountPaid: parseFloat(sale.total_amount),
      payRoute: sale.pay_route,
      salesRep: sale.username,
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
      discountApplied: sale.discount_applied,
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
      ...(isAdmin ? { costAtSale: item.cost_at_sale } : {}),
      lineNetPrice: (item.quantity_sold * parseFloat(item.selling_price_per_unit)).toFixed(2)
    }));
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Previous Sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">Audit, search, and view line-level breakdown of all completed sales.</p>
        </div>
        {sales.length > 0 && (
          <CSVLink
            data={csvData}
            headers={csvHeaders}
            filename={`sales_report_${searchParams.startDate}_to_${searchParams.endDate}.csv`}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-[0.98] text-sm"
          >
            <FileText size={16} />
            Export Detailed CSV
          </CSVLink>
        )}
      </div>

      {/* KPI Stats (Admin Only) */}
      {isAdmin && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isTodayOnly ? '' : 'lg:grid-cols-4'} gap-4`}>
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <ShoppingBag size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-500">Sales Count</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">{stats.totalCount}</p>
            </div>
          </div>

          {!isTodayOnly && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                <DollarSign size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Net Revenue</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">₦{formatMoney(stats.totalRevenue)}</p>
              </div>
            </div>
          )}

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
              <Percent size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-500">Discounts Given</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">₦{formatMoney(stats.totalDiscount)}</p>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
              <TrendingUp size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-500">Net Profit (Margin)</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                ₦{formatMoney(stats.totalProfit)}{' '}
                <span className="text-xs sm:text-sm font-medium text-emerald-600">
                  ({stats.profitMargin.toFixed(1)}%)
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Date & Filter Card */}
      {!isTodayOnly && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" /> Start Date
              </label>
              <input
                type="date"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                value={searchParams.startDate}
                onChange={e => setSearchParams({ ...searchParams, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" /> End Date
              </label>
              <input
                type="date"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                value={searchParams.endDate}
                onChange={e => setSearchParams({ ...searchParams, endDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <User size={16} className="text-indigo-500" /> Customer
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                value={searchParams.customerId}
                onChange={e => setSearchParams({ ...searchParams, customerId: e.target.value })}
              >
                <option value="">All Customers</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <User size={16} className="text-indigo-500" /> Cashier
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                value={searchParams.userId}
                onChange={e => setSearchParams({ ...searchParams, userId: e.target.value })}
              >
                <option value="">All Cashiers</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 active:scale-[0.99] disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
              >
                <Search size={18} /> {loading ? 'Searching...' : 'Search Sales'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-100">
          {error}
        </div>
      )}

      {/* Sales Results Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileText size={20} className="text-indigo-500" /> Sales Log
          </h2>
          <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {sales.length} Sales Found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-semibold">Sale ID</th>
                <th className="px-6 py-4 font-semibold">Date &amp; Time</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Cashier</th>
                <th className="px-6 py-4 font-semibold">Payment Route</th>
                <th className="px-6 py-4 font-semibold text-right">Discount</th>
                <th className="px-6 py-4 font-semibold text-right">Net Total</th>
                <th className="px-6 py-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {sales.length > 0 ? (
                sales.map((sale) => {
                  const isExpanded = expandedSaleId === sale.sale_id;
                  const itemCost = (sale.items || []).reduce((sum, item) => sum + (parseFloat(item.cost_at_sale) || 0), 0);
                  const saleProfit = (parseFloat(sale.total_amount) || 0) - itemCost;
                  const saleProfitMargin = parseFloat(sale.total_amount) > 0 ? (saleProfit / parseFloat(sale.total_amount)) * 100 : 0;

                  return (
                    <Fragment key={sale.sale_id}>
                      <tr className={`hover:bg-gray-50/50 transition-colors ${isExpanded ? 'bg-indigo-50/20' : ''}`}>
                        <td className="px-6 py-4 font-semibold text-gray-900">SALE-{sale.sale_id}</td>
                        <td className="px-6 py-4 text-gray-600">
                          {new Date(sale.sale_date).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </td>
                        <td className="px-6 py-4 text-gray-700 flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          {sale.customer_name || <span className="text-gray-400 italic">Walk-in Customer</span>}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          <div className="flex items-center gap-2">
                            <span className="h-5 w-5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold flex items-center justify-center">
                              {(sale.cashier_name || 'U').substring(0, 2).toUpperCase()}
                            </span>
                            <span>{sale.cashier_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${sale.pay_route === 'Cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            sale.pay_route === 'Transfer' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                              sale.pay_route === 'POS' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                            <CreditCard size={12} />
                            {sale.pay_route}
                            {sale.bank_name && <span className="text-[10px] font-medium opacity-80">({sale.bank_name})</span>}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-rose-600 font-medium">
                          {parseFloat(sale.discount_applied) > 0 ? `₦${formatMoney(sale.discount_applied)}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">₦{formatMoney(sale.total_amount)}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleExpandRow(sale.sale_id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 transition cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                Hide Items <ChevronUp size={14} />
                              </>
                            ) : (
                              <>
                                View Items ({sale.items?.length || 0}) <ChevronDown size={14} />
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleReprint(sale)}
                            className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 transition cursor-pointer"
                          >
                            Reprint
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="8" className="px-6 py-4 bg-gray-50 border-t border-b border-gray-100">
                            <div className="space-y-4">
                              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Line Items Detail</h3>
                              <div className="overflow-hidden border border-gray-200 rounded-xl bg-white shadow-sm">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                                    <tr>
                                      <th className="px-4 py-3 font-semibold">Product Name</th>
                                      <th className="px-4 py-3 text-center font-semibold">Quantity</th>
                                      <th className="px-4 py-3 text-right font-semibold">Unit Price</th>
                                      {showProfit && <th className="px-4 py-3 text-right font-semibold">Cost Price (COGS)</th>}
                                      <th className="px-4 py-3 text-right font-semibold">Selling Total</th>
                                      {showProfit && <th className="px-4 py-3 text-right font-semibold">Profit</th>}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {sale.items && sale.items.length > 0 ? (
                                      sale.items.map((item) => {
                                        const lineCost = parseFloat(item.cost_at_sale) || 0;
                                        const lineSellingTotal = item.quantity_sold * parseFloat(item.selling_price_per_unit);
                                        const lineProfit = lineSellingTotal - lineCost;

                                        return (
                                          <tr key={item.line_item_id} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-800">{item.product_name}</td>
                                            <td className="px-4 py-3 text-center font-medium text-gray-600">{item.quantity_sold}</td>
                                            <td className="px-4 py-3 text-right text-gray-600">₦{formatMoney(item.selling_price_per_unit)}</td>
                                            {showProfit && <td className="px-4 py-3 text-right text-gray-500">₦{formatMoney(lineCost)}</td>}
                                            <td className="px-4 py-3 text-right font-semibold text-gray-800">₦{formatMoney(lineSellingTotal)}</td>
                                            {showProfit && (
                                              <td className={`px-4 py-3 text-right font-semibold ${lineProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                ₦{formatMoney(lineProfit)}
                                              </td>
                                            )}
                                          </tr>
                                        );
                                      })
                                    ) : (
                                      <tr>
                                        <td colSpan="6" className="px-4 py-6 text-center text-gray-400">No item details recorded for this sale.</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {/* Expanded Row Summary Section */}
                              <div className="flex flex-wrap md:flex-nowrap gap-4 justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase">Payment Info</span>
                                  <p className="text-sm font-semibold text-gray-800">Route: <span className="font-bold text-indigo-600">{sale.pay_route}</span></p>
                                  {sale.bank_name && <p className="text-xs text-gray-500">Bank: {sale.bank_name}</p>}
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase">Customer Info</span>
                                  <p className="text-sm font-semibold text-gray-800">{sale.customer_name || 'Walk-in'}</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-right">
                                  {showProfit && (
                                    <div>
                                      <span className="text-[10px] font-bold text-gray-400 uppercase">COGS</span>
                                      <p className="text-sm font-semibold text-gray-700">₦{formatMoney(itemCost)}</p>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Discount</span>
                                    <p className="text-sm font-semibold text-rose-600">₦{formatMoney(sale.discount_applied)}</p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Net Total</span>
                                    <p className="text-sm font-bold text-gray-900">₦{formatMoney(sale.total_amount)}</p>
                                  </div>
                                  {showProfit && (
                                    <div>
                                      <span className="text-[10px] font-bold text-gray-400 uppercase">Profit (Margin)</span>
                                      <p className={`text-sm font-black ${saleProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        ₦{formatMoney(saleProfit)} ({saleProfitMargin.toFixed(1)}%)
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    {searched ? 'No sales found matching the selected range.' : 'Select a date range and click Search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Receipt receiptData={receiptData} />
    </div>
  );
};

export default PreviousSales;
