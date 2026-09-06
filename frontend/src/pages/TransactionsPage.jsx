import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Calendar, FileText, Filter, Download } from 'lucide-react';


const TransactionsPage = () => {
  const [users, setUsers] = useState([]);
  const [searchParams, setSearchParams] = useState({
    startDate: '',
    endDate: '',
    transactionType: 'all',
    userId: 'all',
  });

  const [results, setResults] = useState([]);
  const [totals, setTotals] = useState({ salesRevenue: '0.00', discount: '0.00' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fetchTransactions = async (paramsToUse) => {
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const res = await axios.post('/api/searchTransactions', paramsToUse);
      if (res.data.success) {
        setResults(res.data.contents || []);
        const totalRev = parseFloat(res.data.totalSalesRevenue) || 0;
        const totalDisc = parseFloat(res.data.totalDiscount) || 0;
        setTotals({
          totalRevenue: totalRev.toFixed(2),
          discount: totalDisc.toFixed(2),
          salesRevenue: (totalRev - totalDisc).toFixed(2),
          payRouteTotals: res.data.payRouteTotals || {}
        });
      } else {
        setResults([]);
        setError(res.data.message || 'No transactions found.');
      }
    } catch (err) {
      setResults([]);
      setError(err.response?.data?.message || 'Failed to search transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/transactionPage');
        setUsers(res.data.users || []);
      } catch (err) {
        console.error('Failed to load users', err);
      }
    };
    fetchUsers();

    const today = new Date();
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    setSearchParams(prev => ({
      ...prev,
      startDate: todayStr,
      endDate: todayStr
    }));
  }, []);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    fetchTransactions(searchParams);
  };

  const handleExportCSV = async () => {
    try {
      const allItems = results;
      if (allItems.length === 0) return;

      const headers = ["Date", "Item", "Type", "Qty Change", "Unit Price", "Total Price", "User", "Customer", "Pay Route"];
      const rows = allItems.map(row => [
        new Date(row.transaction_date || row.change_date).toLocaleDateString(),
        row.product_name || row.name,
        row.change_type,
        row.quantity_change,
        row.selling_price_per_unit || row.unit_selling_price || 0,
        row.gross_revenue_impact || 0,
        row.username || 'N/A',
        row.customer_name || 'N/A',
        row.pay_route || 'N/A'
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `transactions-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export CSV", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Transaction History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review sales, purchases, returns, and adjustments.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm font-medium cursor-pointer text-sm"
        >
          <Download size={16} className="text-gray-500" /> Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-500" /> Start Date
            </label>
            <input
              type="date"
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              value={searchParams.startDate}
              onChange={e => setSearchParams({ ...searchParams, startDate: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-500" /> End Date
            </label>
            <input
              type="date"
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              value={searchParams.endDate}
              onChange={e => setSearchParams({ ...searchParams, endDate: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Filter size={16} className="text-indigo-500" /> Type
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              value={searchParams.transactionType}
              onChange={e => setSearchParams({ ...searchParams, transactionType: e.target.value })}
            >
              <option value="all">All Types</option>
              <option value="Sales">Sales</option>
              <option value="Return">Return</option>
              <option value="Purchase">Purchase</option>
              <option value="Adjustment">Manual Adjustment</option>
              <option value="Office Use">Office Use</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">User</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              value={searchParams.userId}
              onChange={e => setSearchParams({ ...searchParams, userId: e.target.value })}
            >
              <option value="all">All Users</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <Search size={18} /> {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileText size={20} className="text-indigo-500" /> Results
          </h2>
          <span className="text-sm font-medium text-gray-500">{results.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Item</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium text-right">Qty Change</th>
                <th className="px-6 py-3 font-medium text-right">Unit Price</th>
                <th className="px-6 py-3 font-medium text-right">Total Price</th>
                <th className="px-6 py-3 font-medium">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {results.length > 0 ? results.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-gray-600">{new Date(row.transaction_date || row.change_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{row.product_name || row.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${row.change_type === 'Sales' ? 'bg-green-100 text-green-700' :
                      row.change_type === 'Purchase' ? 'bg-blue-100 text-blue-700' :
                        row.change_type === 'Return' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                      }`}>
                      {row.change_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-700">{row.quantity_change}</td>
                  <td className="px-6 py-4 text-right text-gray-600">₦{formatMoney(row.selling_price_per_unit || row.unit_selling_price)}</td>
                  <td className="px-6 py-4 text-right font-medium text-indigo-600">₦{formatMoney(row.gross_revenue_impact)}</td>
                  <td className="px-6 py-4 text-gray-600 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                      {(row.transacted_by || row.username || 'U').substring(0, 2).toUpperCase()}
                    </div>
                    {row.transacted_by || row.username}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    {searched ? 'No transactions match your criteria.' : 'Enter search criteria to view transactions.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {results.length > 0 && searchParams.transactionType === 'Sales' && (
          <div className="bg-gray-50 p-6 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex-1 relative group cursor-help">
              <p className="text-sm text-gray-500 font-medium">Total Sales Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₦{formatMoney(totals.salesRevenue)}</p>

              {totals.payRouteTotals && Object.keys(totals.payRouteTotals).length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-200 shadow-xl rounded-lg p-3 hidden group-hover:block z-10 transition-all opacity-0 group-hover:opacity-100">
                  <p className="text-xs font-bold text-gray-700 border-b border-gray-100 pb-2 mb-2 uppercase tracking-wider">Pay Routes</p>
                  <div className="space-y-2">
                    {Object.entries(totals.payRouteTotals).map(([route, amount]) => (
                      <div key={route} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 capitalize">{route}</span>
                        <span className="font-semibold text-gray-900">₦{formatMoney(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex-1">
              <p className="text-sm text-gray-500 font-medium">Total Discount Given</p>
              <p className="text-2xl font-bold text-gray-900">₦{formatMoney(totals.discount)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsPage;
