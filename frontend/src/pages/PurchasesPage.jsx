import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, ShoppingCart, Truck } from 'lucide-react';
import ProductSearch from '../components/ProductSearch';

import { useToast } from '../context/ToastContext';

const PurchasesPage = () => {
  const { showToast } = useToast();
  const { user } = useOutletContext();
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [cart, setCart] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [highlightedCartRow, setHighlightedCartRow] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [salesRes, purchRes] = await Promise.all([
          axios.get('/api/salesPage'),
          axios.get('/api/purchasePage')
        ]);
        setCategories(salesRes.data.categories || []);
        setSuppliers(purchRes.data.suppliers || []);
      } catch (err) {
        console.error('Failed to load initial data', err);
        showToast('error', err.response?.data?.message || 'Failed to load initial data.');
      }
    };
    fetchInitialData();
  }, []);

  const addToCart = (item) => {
    const exists = cart.find(i => i.item_id === item.item_id);
    if (!exists) {
      setCart([...cart, {
        ...item,
        quantity: '',
        unit_cost: parseFloat(item.last_cost_price || 0),
        total_cost: '',
        unit_price: parseFloat(item.unit_selling_price || 0),
        expiry_date: ''
      }]);
      return true;
    }
    setHighlightedCartRow(item.item_id);
    setTimeout(() => setHighlightedCartRow(null), 2000);
    return false;
  };

  const updateCartItem = (id, field, value) => {
    setCart(cart.map(i => {
      if (i.item_id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === 'total_cost') {
        const qty = parseFloat(updated.quantity) || 1;
        updated.unit_cost = parseFloat(value) / qty;
      } else if (field === 'unit_cost') {
        const qty = parseFloat(updated.quantity) || 1;
        updated.total_cost = parseFloat(value) * qty;
      } else if (field === 'quantity') {
        const qty = parseFloat(value) || 1;
        updated.total_cost = parseFloat(updated.unit_cost) * qty;
      }
      return updated;
    }));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(i => i.item_id !== id));
  };

  const total = cart.reduce((acc, item) => acc + (parseFloat(item.unit_cost) * parseInt(item.quantity || 0)), 0);

  const handleCheckout = async () => {
    if (isProcessing) return;
    if (cart.length === 0) return showToast('error', 'Cart is empty');
    if (!selectedSupplier) return showToast('error', 'Select a supplier');

    const emptyQtyIds = cart
      .filter(i => i.quantity === '' || i.quantity === null || i.quantity === undefined || parseFloat(i.quantity) <= 0)
      .map(i => i.item_id);

    if (emptyQtyIds.length > 0) {
      showToast('error', 'Please enter a quantity for all items.');
      setHighlightedCartRow(emptyQtyIds);
      return;
    }

    const payload = {
      supplierId: selectedSupplier,
      items: cart
    };

    setIsProcessing(true);
    try {
      await axios.post('/api/process-purchase', payload);
      showToast('success', 'Purchase processed successfully!');
      setCart([]);
      setSelectedSupplier('');
    } catch (err) {
      console.error(err);
      showToast('error', err.response?.data?.message || 'Failed to process purchase.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Purchase Order</h1>
          <p className="text-sm text-gray-500 mt-0.5">Receive new stock from suppliers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Results */}
        <div className="lg:col-span-4 space-y-6">
          <ProductSearch categories={categories} onAddToCart={addToCart} />

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Supplier</label>
              <select
                className="w-full px-4 h-9 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
              >
                <option value="">(Select Supplier)</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {user.role === "administrator" && (
              <div className="flex justify-between items-center py-4 border-y border-gray-100">
                <span className="text-sm text-gray-500 font-medium">Total Purchase</span>
                <span className="text-2xl font-black text-gray-900">₦{formatMoney(total)}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                disabled={isProcessing}
                onClick={() => setCart([])}
                className="w-full sm:w-auto px-6 py-3 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
              <button
                disabled={isProcessing}
                onClick={handleCheckout}
                className={`w-full flex-1 px-6 py-3 text-white font-bold rounded-xl transition shadow-lg ${
                  isProcessing
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 cursor-pointer'
                }`}
              >
                {isProcessing ? 'Processing...' : 'Process Purchase'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Order List & Checkout */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[360px] lg:h-[calc(100vh-120px)] lg:max-h-[800px]">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
            <ShoppingCart size={20} className="text-indigo-500" />
            <h2 className="text-lg font-bold text-gray-800">Incoming Stock</h2>
            <span className="ml-auto bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-sm font-semibold">
              {cart.length} items
            </span>
          </div>

          <div className="flex-1 overflow-x-auto p-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Truck size={48} className="mb-4 opacity-20" />
                <p>Select items to receive stock.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium w-24">Qty</th>
                    {user.role === "administrator" && (<th className="px-4 py-3 font-medium w-32">Total Cost</th>)}
                    {user.role === "administrator" && (<th className="px-4 py-3 font-medium w-32">Unit Cost</th>)}
                    {user.role === "administrator" && (<th className="px-4 py-3 font-medium w-32">Sell Price</th>)}
                    <th className="px-4 py-3 font-medium w-40">Exp Date</th>
                    {user.role === "administrator" && <th className="px-4 py-3 font-medium text-right">Total</th>}
                    <th className="px-4 py-3 font-medium text-center w-16">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {cart.map((item) => (
                    <tr key={item.item_id} className={`transition-colors ${(Array.isArray(highlightedCartRow) ? highlightedCartRow.includes(item.item_id) : highlightedCartRow === item.item_id) ? 'bg-yellow-100' : 'bg-white hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 font-semibold text-gray-800">{item.item_name}</td>
                      <td className="px-4 py-3">
                        <input type="number" min="1" placeholder="0" className="w-full px-2 py-1 border rounded" value={item.quantity} onChange={(e) => updateCartItem(item.item_id, 'quantity', e.target.value)} />
                      </td>
                      {user.role === "administrator" && (
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <span className="text-gray-500 mr-1">₦</span>
                            <input type="number" step="0.01" placeholder="0" className="w-full px-2 py-1 border rounded" value={item.total_cost} onChange={(e) => updateCartItem(item.item_id, 'total_cost', e.target.value)} />
                          </div>
                        </td>
                      )}
                      {user.role === "administrator" && (
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <span className="text-gray-500 mr-1">₦</span>
                            <input type="number" step="0.01" className="w-full px-2 py-1 border rounded" value={item.unit_cost} onChange={(e) => updateCartItem(item.item_id, 'unit_cost', e.target.value)} />
                          </div>
                        </td>
                      )}
                      {user.role === "administrator" && (
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <span className="text-gray-500 mr-1">₦</span>
                            <input type="number" step="0.01" className="w-full px-2 py-1 border rounded" value={item.unit_price} onChange={(e) => updateCartItem(item.item_id, 'unit_price', e.target.value)} />
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 min-w-[150px]">
                        <input
                          type="date"
                          value={item.expiry_date || ''}
                          onChange={(e) => updateCartItem(item.item_id, 'expiry_date', e.target.value)}
                          className="w-full px-2 py-1 border rounded bg-white text-gray-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </td>
                      {user.role === "administrator" && (
                        <td className="px-4 py-3 text-right font-medium text-indigo-600">
                          ₦{formatMoney(parseFloat(item.unit_cost || 0) * parseInt(item.quantity || 0))}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => removeFromCart(item.item_id)} className="text-red-400 hover:text-red-600 p-1 cursor-pointer">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>


        </div>
      </div>
    </div>
  );
};

export default PurchasesPage;
