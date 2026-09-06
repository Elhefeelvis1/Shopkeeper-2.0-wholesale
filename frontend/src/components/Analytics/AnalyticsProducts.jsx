import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Download, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const AnalyticsProducts = ({ startDate, endDate }) => {
  const { showToast } = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);
  const [limitInput, setLimitInput] = useState(50);
  const [sort, setSort] = useState('best');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/analytics/products', {
          params: {
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd'),
            limit,
            sort
          }
        });
        if (res.data.success) {
          setData(res.data.data || []);
        } else {
          showToast('error', res.data.message || 'Failed to fetch data');
        }
      } catch (err) {
        console.error("Failed to fetch product analytics:", err);
        showToast('error', 'Failed to fetch product analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, limit, sort]);

  const handleExportCSV = () => {
    try {
      if (data.length === 0) return;
      
      const headers = ["Product Name", "Number Sold", "Total Amount", "Profit", "Last Sold", "Remaining in Stock"];
      const rows = data.map(item => [
        item.product_name,
        item.number_sold,
        item.total_amount,
        item.profit,
        item.last_sold ? new Date(item.last_sold).toLocaleDateString() : 'N/A',
        item.remaining_in_stock
      ]);
      
      const csvContent = [
        headers.join(","),
        ...rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `product-performance-${sort}-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export CSV", err);
      showToast('error', 'Failed to export CSV');
    }
  };

  const handleLimitSubmit = (e) => {
    e.preventDefault();
    if (limitInput && limitInput > 0) {
      setLimit(parseInt(limitInput));
    }
  };

  const formatMoney = (val) => `₦${parseFloat(val || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setSort('best')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                sort === 'best' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowUpRight size={16} /> Best Selling
            </button>
            <button
              onClick={() => setSort('worst')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                sort === 'worst' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowDownRight size={16} /> Worst Selling
            </button>
          </div>

          <form onSubmit={handleLimitSubmit} className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Max Items:</label>
            <input 
              type="number" 
              min="1"
              required
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              type="submit"
              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors border border-indigo-100"
            >
              Apply
            </button>
          </form>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={data.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={18} className="text-gray-500" /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Package size={20} className="text-indigo-500" /> 
            {sort === 'best' ? 'Top Selling Products' : 'Lowest Selling Products'}
          </h2>
          <span className="text-sm font-medium text-gray-500">{data.length} items listed</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
             <div className="py-12 flex justify-center text-indigo-600"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No product sales found for this period.</div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Product</th>
                  <th className="px-6 py-3 font-medium text-right">Number Sold</th>
                  <th className="px-6 py-3 font-medium text-right">Total Amount</th>
                  <th className="px-6 py-3 font-medium text-right">Profit</th>
                  <th className="px-6 py-3 font-medium text-center">Last Sold</th>
                  <th className="px-6 py-3 font-medium text-right">Remaining Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.product_name}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-700">{row.number_sold}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{formatMoney(row.total_amount)}</td>
                    <td className="px-6 py-4 text-right font-medium text-green-600">{formatMoney(row.profit)}</td>
                    <td className="px-6 py-4 text-center text-gray-500">{row.last_sold ? new Date(row.last_sold).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-4 text-right text-gray-600">
                       <span className={`px-2 py-1 rounded text-xs font-medium ${row.remaining_in_stock <= 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                         {row.remaining_in_stock}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsProducts;
