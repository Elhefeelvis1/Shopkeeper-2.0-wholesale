import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ClipboardCheck, Trash2, CheckCircle, History, AlertCircle, Download } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { format } from 'date-fns';

const InventoryCountPage = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('count'); // 'count' or 'history'

  // Stock Count State
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cart, setCart] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // History State
  const [history, setHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState({
    excess_item_count: 0,
    excess_item_value: 0,
    excess_item_sell_value: 0,
    shorting_item_count: 0,
    shorting_item_value: 0,
    shorting_item_sell_value: 0,
  });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  // Fetch Inventory for Count
  useEffect(() => {
    if (activeTab === 'count') {
      fetchInventory();
    } else {
      fetchHistory();
    }
  }, [activeTab, page, historyPage, searchQuery, historyStartDate, historyEndDate]);

  const fetchInventory = async () => {
    try {
      const res = await axios.get('/api/all-inventory', {
        params: { page, limit: 10, search: searchQuery }
      });
      if (page === 1) {
        setInventory(res.data.contents || []);
      } else {
        setInventory(prev => [...prev, ...(res.data.contents || [])]);
      }
      setTotalPages(Math.ceil((res.data.totalCount || 0) / 10));
    } catch (err) {
      console.error(err);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (Math.ceil(scrollTop + clientHeight) >= scrollHeight - 10 && page < totalPages) {
      setPage(prev => prev + 1);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/inventory-count-history', {
        params: {
          page: historyPage,
          limit: 15,
          startDate: historyStartDate || undefined,
          endDate: historyEndDate || undefined
        }
      });
      if (res.data.success) {
        setHistory(res.data.history || []);
        setHistoryTotalPages(Math.ceil((res.data.total || 0) / 15));
        setHistoryStats(res.data.stats || {});
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      showToast('Preparing CSV...', 'info');
      const res = await axios.get('/api/inventory-count-history', {
        params: {
          all: true,
          startDate: historyStartDate || undefined,
          endDate: historyEndDate || undefined
        }
      });

      if (res.data.success && res.data.history) {
        const records = res.data.history;
        if (records.length === 0) {
          showToast('No records to download', 'error');
          return;
        }

        const headers = ['Date', 'Item Name', 'Recorded By', 'Previous Qty', 'Counted Qty', 'Variance', 'Cost Impact'];
        const csvRows = [];
        csvRows.push(headers.join(','));

        records.forEach(row => {
          const date = format(new Date(row.created_at), 'dd MMM yyyy hh:mm a');
          const variance = Number(row.quantity_change) > 0 ? `+${row.quantity_change}` : row.quantity_change;
          const impact = Number(row.cost_impact) > 0 ? `+${row.cost_impact}` : row.cost_impact;
          const values = [
            `"${date}"`,
            `"${row.item_name.replace(/"/g, '""')}"`,
            `"${row.username}"`,
            row.old_quantity,
            row.new_quantity,
            `"${variance}"`,
            `"${impact}"`
          ];
          csvRows.push(values.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `Inventory_Count_History_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to download CSV', 'error');
    }
  };

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Cart Functions
  const addToCart = (item) => {
    const exists = cart.find(i => i.item_id === item.id);
    if (!exists) {
      setCart([...cart, {
        item_id: item.id,
        item_name: item.name,
        category: item.category,
        current_qty: item.total_quantity_in_stock,
        last_cost_price: item.last_cost_price,
        counted_qty: item.total_quantity_in_stock // default to current
      }]);
    }
  };

  const updateCountedQty = (id, val) => {
    setCart(cart.map(i => i.item_id === id ? { ...i, counted_qty: val } : i));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(i => i.item_id !== id));
  };

  const handleSaveCount = async () => {
    if (cart.length === 0) return showToast('error', 'No items selected to count.');

    // Validate inputs
    for (const item of cart) {
      if (item.counted_qty === '' || isNaN(item.counted_qty) || Number(item.counted_qty) < 0) {
        return showToast('error', `Invalid count for ${item.item_name}. Must be a non-negative number.`);
      }
    }

    setIsProcessing(true);
    try {
      const res = await axios.post('/api/inventory-count', { items: cart });
      if (res.data.success) {
        showToast('success', res.data.message || 'Inventory count saved!');
        setCart([]);
        fetchInventory(); // refresh inventory list
      } else {
        showToast('error', res.data.message || 'Failed to save count.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', err.response?.data?.message || 'Failed to process inventory count.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="text-indigo-600" size={32} />
            Inventory Count
          </h1>
          <p className="text-gray-500 mt-1">Audit and update stock levels directly.</p>
        </div>
        <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 inline-flex">
          <button
            onClick={() => setActiveTab('count')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition cursor-pointer ${activeTab === 'count' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            Stock Count
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition cursor-pointer ${activeTab === 'history' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            History
          </button>
        </div>
      </div>

      {activeTab === 'count' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side: All Stocks */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-[calc(100vh-160px)] max-h-[700px]">
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by Item Name, Generic Name or Barcode..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-2" onScroll={handleScroll}>
                {inventory.length > 0 ? inventory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-indigo-50 transition bg-white shadow-sm cursor-pointer"
                  >
                    <div>
                      <h4 className="font-semibold text-gray-800 text-sm">{item.name}</h4>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{item.total_quantity_in_stock} {item.unit} in stock</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 text-gray-400">No items found</div>
                )}
                {page < totalPages && (
                  <div className="text-center py-2 text-sm text-gray-500">Loading more...</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Selected Items */}
          <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-160px)] max-h-[700px]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <CheckCircle size={20} className="text-indigo-500" /> Selected Items
              </h2>
              <span className="bg-white text-indigo-700 py-1 px-3 rounded-full text-sm font-semibold shadow-sm border border-indigo-100">
                {cart.length} items to count
              </span>
            </div>

            <div className="flex-1 overflow-x-auto p-0">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <ClipboardCheck size={48} className="mb-4 opacity-20" />
                  <p>Add items from the list to start counting.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                      <th className="px-6 py-3 font-medium">Item</th>
                      <th className="px-6 py-3 font-medium">Category</th>
                      <th className="px-6 py-3 font-medium text-center">System Qty</th>
                      <th className="px-6 py-3 font-medium w-40 text-center">Counted Qty</th>
                      <th className="px-6 py-3 font-medium text-center w-20">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cart.map((item) => (
                      <tr key={item.item_id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-medium text-gray-800 text-sm">{item.item_name}</td>
                        <td className="px-6 py-4 text-gray-500 text-sm">{item.category}</td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-gray-600">{item.current_qty}</td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-center"
                            value={item.counted_qty}
                            onChange={(e) => updateCountedQty(item.item_id, e.target.value)}
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => removeFromCart(item.item_id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setCart([])}
                className="px-6 py-2.5 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCount}
                disabled={isProcessing || cart.length === 0}
                className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? 'Processing...' : 'Save Count'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-green-600 tracking-wider text-sm font-bold uppercase flex items-center gap-1.5">
                  <CheckCircle size={16} className="text-green-500" /> Excess Inventory
                </span>
                <span className="bg-green-50 text-green-700 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  {historyStats.excess_item_count || 0} items
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs font-medium mb-0.5">Total Cost Price</span>
                  <span className="text-lg sm:text-xl font-bold text-green-600">₦{formatMoney(historyStats.excess_item_value)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs font-medium mb-0.5">Total Sell Price</span>
                  <span className="text-lg sm:text-xl font-bold text-green-600">₦{formatMoney(historyStats.excess_item_sell_value)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-red-600 tracking-wider text-sm font-bold uppercase flex items-center gap-1.5">
                  <AlertCircle size={16} className="text-red-500" /> Shortage Inventory
                </span>
                <span className="bg-red-50 text-red-700 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  {historyStats.shorting_item_count || 0} items
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs font-medium mb-0.5">Total Cost Price</span>
                  <span className="text-lg sm:text-xl font-bold text-red-600">₦{formatMoney(historyStats.shorting_item_value)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs font-medium mb-0.5">Total Sell Price</span>
                  <span className="text-lg sm:text-xl font-bold text-red-600">₦{formatMoney(historyStats.shorting_item_sell_value)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <History size={20} className="text-gray-500" />
                <h2 className="text-lg font-bold text-gray-800">Past Counts</h2>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-gray-500">From:</span>
                  <div className="w-full xs:w-32 flex-1 sm:flex-initial">
                    <input
                      type="date"
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-300 bg-white text-sm"
                      value={historyStartDate}
                      onChange={(e) => { setHistoryStartDate(e.target.value); setHistoryPage(1); }}
                    />
                  </div>
                  <span className="text-gray-500">To:</span>
                  <div className="w-full xs:w-32 flex-1 sm:flex-initial">
                    <input
                      type="date"
                      className="w-full border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-300 bg-white text-sm"
                      value={historyEndDate}
                      onChange={(e) => { setHistoryEndDate(e.target.value); setHistoryPage(1); }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleDownloadCSV}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition justify-center text-sm font-medium cursor-pointer"
                >
                  <Download size={16} /> CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Item Name</th>
                    <th className="px-6 py-3 font-medium text-center">Previous Qty</th>
                    <th className="px-6 py-3 font-medium text-center">Counted Qty</th>
                    <th className="px-6 py-3 font-medium text-center">Variance</th>
                    <th className="px-6 py-3 font-medium text-right">Cost Impact</th>
                    <th className="px-6 py-3 font-medium">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.length > 0 ? history.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition text-sm">
                      <td className="px-6 py-4 text-gray-600">{format(new Date(record.created_at), 'dd MMM yyyy, hh:mm a')}</td>
                      <td className="px-6 py-4 font-medium text-gray-800">{record.item_name}</td>
                      <td className="px-6 py-4 text-center text-gray-600">{record.old_quantity}</td>
                      <td className="px-6 py-4 text-center text-gray-600">{record.new_quantity}</td>
                      <td className="px-6 py-4 text-center font-semibold">
                        <span className={`px-2 py-1 rounded text-xs ${Number(record.quantity_change) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {Number(record.quantity_change) > 0 ? '+' : ''}{record.quantity_change}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-medium ${Number(record.cost_impact) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(record.cost_impact) > 0 ? '+' : ''}₦{formatMoney(Math.abs(record.cost_impact))}
                      </td>
                      <td className="px-6 py-4 text-gray-600 capitalize">{record.username}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-10 text-center text-gray-500">
                        No history found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {historyTotalPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-white">
                <button
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(historyPage - 1)}
                  className="px-4 py-2 border rounded text-sm disabled:opacity-50 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">Page {historyPage} of {historyTotalPages}</span>
                <button
                  disabled={historyPage === historyTotalPages}
                  onClick={() => setHistoryPage(historyPage + 1)}
                  className="px-4 py-2 border rounded text-sm disabled:opacity-50 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryCountPage;
