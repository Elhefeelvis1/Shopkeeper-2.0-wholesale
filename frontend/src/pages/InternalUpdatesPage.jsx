import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, PackageMinus, Trash2, RotateCcw, AlertOctagon, Building, PackageX } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const InternalUpdatesPage = () => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [updateType, setUpdateType] = useState('Return'); // Return, Expired, Office Use, Damaged

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [cart, setCart] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

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
  }, []);

  useEffect(() => {
    const fetchSearch = async () => {
      setIsSearching(true);
      try {
        const res = await axios.get('/api/all-inventory', {
          params: { page, limit: 10, search: searchQuery }
        });
        const items = (res.data.contents || []).map(item => ({
          ...item,
          item_id: item.id,
          item_name: item.name,
          unit_name: item.unit
        }));

        if (page === 1) {
          setSearchResults(items);
        } else {
          setSearchResults(prev => [...prev, ...items]);
        }
        setTotalPages(Math.ceil((res.data.totalCount || 0) / 10));
      } catch (err) {
        if (page === 1) setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSearch();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, page]);

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (Math.ceil(scrollTop + clientHeight) >= scrollHeight - 10 && page < totalPages) {
      setPage(prev => prev + 1);
    }
  };

  const addToCart = (item) => {
    const exists = cart.find(i => i.item_id === item.item_id);
    if (!exists) {
      setCart([...cart, {
        ...item,
        productId: item.item_id,
        quantity: 1,
        expiryDate: ''
      }]);
    }
  };

  const updateCartItem = (id, field, value) => {
    setCart(cart.map(i => i.item_id === id ? { ...i, [field]: value } : i));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(i => i.item_id !== id));
  };

  const handleSubmit = async () => {
    if (isProcessing) return;
    if (cart.length === 0) return showToast('error', 'No items selected.');

    let endpoint = '';
    switch (updateType) {
      case 'Return': endpoint = '/api/process-return'; break;
      case 'Expired': endpoint = '/api/process-expired'; break;
      case 'Office Use': endpoint = '/api/process-office-use'; break;
      case 'Damaged': endpoint = '/api/process-damaged'; break;
      default: return showToast('error', 'Invalid update type.');
    }

    setIsProcessing(true);
    try {
      await axios.post(endpoint, { items: cart });
      showToast('success', `${updateType} processed successfully!`);
      setCart([]);
    } catch (err) {
      console.error(err);
      showToast('error', `Failed to process ${updateType}: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getTypeIcon = () => {
    switch (updateType) {
      case 'Return': return <RotateCcw size={20} className="text-indigo-500" />;
      case 'Expired': return <AlertOctagon size={20} className="text-red-500" />;
      case 'Office Use': return <Building size={20} className="text-blue-500" />;
      case 'Damaged': return <PackageX size={20} className="text-orange-500" />;
      default: return <PackageMinus size={20} className="text-gray-500" />;
    }
  };

  const getTypeColor = () => {
    switch (updateType) {
      case 'Return': return 'bg-indigo-600 hover:bg-indigo-700';
      case 'Expired': return 'bg-red-600 hover:bg-red-700';
      case 'Office Use': return 'bg-blue-600 hover:bg-blue-700';
      case 'Damaged': return 'bg-orange-600 hover:bg-orange-700';
      default: return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Internal Stock Updates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage returns, expired items, office use, and damages.</p>
        </div>
        <div className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-1 w-full sm:w-auto overflow-x-auto">
          {['Return', 'Expired', 'Office Use', 'Damaged'].map(type => (
            <button
              key={type}
              onClick={() => { setUpdateType(type); setCart([]); }}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${updateType === type ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex flex-col min-h-[320px] lg:h-[calc(100vh-160px)] lg:max-h-[700px]">
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by Item Name, Generic Name or Barcode..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none text-sm"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                />
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2" onScroll={handleScroll}>
              {searchResults.length > 0 ? searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => addToCart(item)}
                  className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-indigo-50 transition bg-white shadow-sm cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="font-semibold text-gray-800 text-sm truncate">{item.item_name}</h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{item.total_quantity_in_stock} {item.unit_name} in stock</span>
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

        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[350px] lg:h-[calc(100vh-160px)] lg:max-h-[700px]">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
            {getTypeIcon()}
            <h2 className="text-base sm:text-lg font-bold text-gray-800">Process {updateType}</h2>
            <span className="ml-auto bg-gray-200 text-gray-700 py-1 px-3 rounded-full text-xs sm:text-sm font-semibold">
              {cart.length} items
            </span>
          </div>

          <div className="flex-1 overflow-x-auto p-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <PackageMinus size={48} className="mb-4 opacity-20" />
                <p>Add items to process {updateType.toLowerCase()}.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-3 font-medium">Item</th>
                    <th className="px-6 py-3 font-medium w-32">Qty</th>
                    {updateType === 'Return' && <th className="px-6 py-3 font-medium w-48">Exp Date (Lot ID)</th>}
                    <th className="px-6 py-3 font-medium text-center w-20">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {cart.map((item) => (
                    <tr key={item.item_id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.item_name}</td>
                      <td className="px-6 py-4">
                        <input type="number" min="1" className="w-full px-3 py-1.5 border border-gray-200 rounded-md outline-none focus:border-gray-400" value={item.quantity} onChange={(e) => updateCartItem(item.item_id, 'quantity', e.target.value)} />
                      </td>
                      {updateType === 'Return' && (
                        <td className="px-6 py-4 min-w-[150px]">
                          <input
                            type="date"
                            value={item.expiryDate || ''}
                            onChange={(e) => updateCartItem(item.item_id, 'expiryDate', e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-md outline-none focus:border-gray-400 bg-white"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => removeFromCart(item.item_id)} className="text-gray-400 hover:text-red-500 p-1 transition cursor-pointer">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center">
            <button
              disabled={isProcessing}
              onClick={() => setCart([])}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            <button
              disabled={isProcessing || cart.length === 0}
              onClick={handleSubmit}
              className={`px-8 py-2 text-white font-bold rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isProcessing ? 'bg-gray-400 cursor-not-allowed' : `${getTypeColor()} cursor-pointer`
              }`}
            >
              {isProcessing ? 'Processing...' : `Confirm ${updateType}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalUpdatesPage;
