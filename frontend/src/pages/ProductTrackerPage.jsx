import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Calendar, FileText, CheckCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const ProductTrackerPage = () => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState({ itemName: '', category: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [trackerParams, setTrackerParams] = useState({ startDate: '', stopDate: '' });
  const [trackerData, setTrackerData] = useState([]);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('/api/salesPage');
        setCategories(res.data.categories || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCategories();

    // Default dates (first of month to today)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setTrackerParams({
      startDate: firstDay.toISOString().split('T')[0],
      stopDate: today.toISOString().split('T')[0]
    });
  }, []);

  const handleSearchItem = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    try {
      const res = await axios.get('/api/searchItems', { params: searchQuery });
      setSearchResults(res.data.contents || []);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTrackProduct = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return showToast('error', 'Please select a product first.');
    setTracking(true);
    setError('');

    try {
      const res = await axios.get('/api/track-product', {
        params: {
          productId: selectedProduct.item_id,
          ...trackerParams
        }
      });
      setTrackerData(res.data.contents || []);
      if (!res.data.contents || res.data.contents.length === 0) {
        setError('No tracking data found for the selected period.');
      }
    } catch (err) {
      setError('Failed to fetch tracking data.');
      setTrackerData([]);
    } finally {
      setTracking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Product Tracker</h1>
        <p className="text-gray-500 mt-1">Trace the complete history of a specific item.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Select */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Search size={20} className="text-indigo-500" /> Find Item
            </h2>
            <form onSubmit={handleSearchItem} className="space-y-4">
              <input
                type="text"
                placeholder="Item Name or Barcode..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={searchQuery.itemName}
                onChange={(e) => setSearchQuery({ ...searchQuery, itemName: e.target.value })}
              />
              <select
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white outline-none"
                value={searchQuery.category}
                onChange={(e) => setSearchQuery({ ...searchQuery, category: e.target.value })}
              >
                <option value="">All Categories</option>
                {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
              </select>
              <button
                type="submit"
                disabled={isSearching}
                className="w-full bg-gray-800 text-white font-medium py-2 rounded-lg hover:bg-gray-900 transition cursor-pointer disabled:cursor-not-allowed"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="mt-6 border border-gray-100 rounded-lg max-h-[300px] overflow-y-auto">
                {searchResults.map(item => (
                  <div
                    key={item.item_id}
                    onClick={() => { setSelectedProduct(item); setTrackerData([]); setError(''); }}
                    className={`p-3 cursor-pointer border-b border-gray-50 transition ${selectedProduct?.item_id === item.item_id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-gray-800 text-sm">{item.item_name}</h4>
                      {selectedProduct?.item_id === item.item_id && <CheckCircle size={16} className="text-indigo-600" />}
                    </div>
                    <p className="text-xs text-gray-500">{item.total_quantity_in_stock} {item.unit_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tracking Configuration & Results */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex flex-col md:flex-row gap-4 items-stretch md:items-end">
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium text-gray-700 block mb-1">Selected Product</label>
              <div className="px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 font-semibold truncate">
                {selectedProduct ? selectedProduct.item_name : 'None selected'}
              </div>
            </div>

            <div className="w-full md:w-auto flex-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <Calendar size={16} /> Start Date
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                value={trackerParams.startDate}
                onChange={e => setTrackerParams({ ...trackerParams, startDate: e.target.value })}
              />
            </div>

            <div className="w-full md:w-auto flex-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <Calendar size={16} /> End Date
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                value={trackerParams.stopDate}
                onChange={e => setTrackerParams({ ...trackerParams, stopDate: e.target.value })}
              />
            </div>

            <button
              onClick={handleTrackProduct}
              disabled={!selectedProduct || tracking}
              className="w-full md:w-auto bg-indigo-600 text-white font-medium py-2.5 px-6 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed text-sm"
            >
              {tracking ? 'Loading...' : 'Track'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <FileText size={20} className="text-indigo-500" />
              <h2 className="text-lg font-bold text-gray-800">
                {selectedProduct ? `History for ${selectedProduct.item_name}` : 'Tracking History'}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium text-right">Old Quantity</th>
                    <th className="px-6 py-3 font-medium text-right">Qty Change</th>
                    <th className="px-6 py-3 font-medium text-right">New Quantity</th>
                    <th className="px-6 py-3 font-medium text-right">Cost Impact</th>
                    <th className="px-6 py-3 font-medium">Lot ID</th>
                    <th className="px-6 py-3 font-medium">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {trackerData.length > 0 ? trackerData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-gray-600">{new Date(row.change_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${row.change_type === 'Sales' ? 'bg-green-100 text-green-700' :
                          row.change_type === 'Purchase' ? 'bg-blue-100 text-blue-700' :
                            row.change_type === 'Return' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                          }`}>
                          {row.change_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-800">{row.old_quantity || '-'}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-800">{row.quantity_change || '-'}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-800">{row.new_quantity || '-'}</td>
                      <td className="px-6 py-4 text-right text-gray-600">₦{formatMoney(row.cost_impact) || '-'}</td>
                      <td className="px-6 py-4 text-gray-500">{row.lot_id || '-'}</td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{row.username || 'System'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        Select a product and click Track to view its history.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductTrackerPage;
