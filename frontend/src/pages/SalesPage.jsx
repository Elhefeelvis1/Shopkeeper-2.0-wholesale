import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Search, Plus, Trash2, ShoppingBag, CreditCard, User, Building, StickyNote, History } from 'lucide-react';
import AddCustomerModal from '../components/AddCustomerModal';
import Receipt from '../components/Receipt';
import ProductSearch from '../components/ProductSearch';
import PreviousSalesModal from '../components/PreviousSalesModal';
import { useToast } from '../context/ToastContext';
import { db, decrementLocalStock, revertLocalStock, queueSale } from '../db/dexieDb';
import { pullMasterData, pushPendingSales } from '../services/syncService';

const SalesPage = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [banks, setBanks] = useState([]);
  const [required, setRequired] = useState(false);
  const [shopDetails, setShopDetails] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [isPreviousSalesOpen, setIsPreviousSalesOpen] = useState(false);
  const { user } = useOutletContext() || {};
  const isSubmittingRef = useRef(false);

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Cart state
  const [cart, setCart] = useState([]);
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [highlightedCartRow, setHighlightedCartRow] = useState(null);

  // Checkout state
  const [paymentRoute, setPaymentRoute] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Customer notes state
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isNotesEditMode, setIsNotesEditMode] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);

  // Load initial data from Dexie and refresh if online
  const loadLocalMasterData = useCallback(async () => {
    try {
      const [cats, bks, sDetails] = await Promise.all([
        db.categories.toArray(),
        db.banks.toArray(),
        db.shopDetails.get(1)
      ]);
      setCategories(cats || []);
      setBanks(bks || []);
      if (sDetails) setShopDetails(sDetails);

      // If empty and online, pull from server
      if ((!cats || cats.length === 0) && navigator.onLine) {
        await pullMasterData();
        const [freshCats, freshBks, freshDetails] = await Promise.all([
          db.categories.toArray(),
          db.banks.toArray(),
          db.shopDetails.get(1)
        ]);
        setCategories(freshCats || []);
        setBanks(freshBks || []);
        if (freshDetails) setShopDetails(freshDetails);
      }
    } catch (err) {
      console.error('Failed to load initial data from Dexie', err);
    }
  }, []);

  useEffect(() => {
    loadLocalMasterData();
  }, [loadLocalMasterData]);

  // Offline-first customer search in Dexie
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!customerName || (selectedCustomer && customerName === selectedCustomer.name)) {
        setCustomerResults([]);
        return;
      }
      try {
        const query = customerName.trim().toLowerCase();
        const results = await db.customers
          .filter(c => c.name && c.name.toLowerCase().includes(query))
          .limit(10)
          .toArray();
        setCustomerResults(results || []);
      } catch (err) {
        console.error('Customer search error in Dexie', err);
        setCustomerResults([]);
      }
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [customerName, selectedCustomer]);

  const addToCart = (item) => {
    const stock = Number(item.total_quantity_in_stock || 0);
    if (stock <= 0) {
      showToast('error', 'Item is out of stock.');
      return 'error';
    }
    const itemId = item.item_id || item.id;
    const exists = cart.find(i => (i.item_id || i.id) === itemId);
    if (!exists) {
      setCart([
        ...cart,
        {
          ...item,
          item_id: itemId,
          item_name: item.item_name || item.name,
          quantity: 1,
          selling_price: parseFloat(item.unit_selling_price || 0)
        }
      ]);
      return true;
    }
    setHighlightedCartRow(itemId);
    setTimeout(() => setHighlightedCartRow(null), 2000);
    return false;
  };

  const updateCartQuantity = (id, newQuantity) => {
    if (newQuantity === '' || Number(newQuantity) >= 1) {
      const itemInCart = cart.find(i => (i.item_id || i.id) === id);
      if (itemInCart && Number(newQuantity) > Number(itemInCart.total_quantity_in_stock)) {
        showToast('error', `Cannot sell more than available stock (${itemInCart.total_quantity_in_stock}).`);
        return;
      }
      setCart(cart.map(i => (i.item_id || i.id) === id ? { ...i, quantity: newQuantity } : i));
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(i => (i.item_id || i.id) !== id));
  };

  const total = cart.reduce((acc, item) => acc + (item.selling_price * Number(item.quantity || 0)), 0);

  // Calculate discount
  let discountAmount = 0;
  if (discountValue) {
    discountAmount = parseFloat(discountValue) || 0;
  } else if (discountPercent) {
    discountAmount = total * ((parseFloat(discountPercent) || 0) / 100);
  }

  const amountPayable = Math.max(0, total - discountAmount);

  const handleCheckout = async () => {
    if (isSubmittingRef.current) return;
    if (cart.length === 0) return showToast('error', 'Cart is empty');
    if (!paymentRoute) return showToast('error', 'Select a payment route');
    if ((paymentRoute === 'Transfer' || paymentRoute === 'POS') && !selectedBank) return showToast('error', `Select a bank for ${paymentRoute}`);
    if (required && !selectedCustomer) return showToast('error', 'Select a customer');

    const invalidItem = cart.find(item => item.quantity === '' || Number(item.quantity) < 1);
    if (invalidItem) {
      return showToast('error', `Please enter a valid quantity for ${invalidItem.item_name}`);
    }

    isSubmittingRef.current = true;
    setProcessing(true);

    const clientSaleId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `sale_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      clientSaleId,
      items: cart.map(item => ({
        productId: item.item_id || item.id,
        quantity: Number(item.quantity),
        sellPrice: item.selling_price
      })),
      payRoute: paymentRoute,
      bank: selectedBank || null,
      customerId: selectedCustomer?.id || null,
      totalDiscount: discountAmount,
      totalAmount: amountPayable
    };

    try {
      // 1. Immediately decrement local stock in Dexie so POS remains accurate offline
      await decrementLocalStock(payload.items);

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      let onlineSuccess = false;

      if (isOnline) {
        try {
          const res = await axios.post('/api/process-sale', payload);
          if (res.data && res.data.success) {
            onlineSuccess = true;
            showToast('success', 'Sale processed successfully!');
          } else {
            throw new Error(res.data?.message || 'Failed to process sale on server.');
          }
        } catch (serverErr) {
          // If server explicitly returned an error response (HTTP 4xx/5xx), this is a server rejection, NOT offline.
          if (serverErr.response) {
            // Revert local stock deduction since sale was rejected
            await revertLocalStock(payload.items);
            throw new Error(serverErr.response.data?.message || serverErr.message || 'Server rejected sale.');
          }

          // Genuinely offline / network dropped during request
          console.warn('Network unreachable, queueing sale for offline sync:', serverErr);
        }
      }

      if (!onlineSuccess) {
        // Save to offline sales queue
        await queueSale(payload);
        showToast('info', 'Operating offline: Sale recorded in queue. Will sync automatically when online.');
      }

      // 3. Prepare Receipt
      const receipt = {
        shopDetails,
        date: new Date().toLocaleString(),
        items: cart.map(item => ({ ...item, itemName: item.item_name })),
        totalAmount: total,
        totalDiscount: discountAmount,
        amountPaid: amountPayable,
        payRoute: paymentRoute,
        salesRep: user?.username || 'Cashier'
      };
      setReceiptData(receipt);

      // Reset form state
      setCart([]);
      setDiscountPercent('');
      setDiscountValue('');
      setPaymentRoute('');
      setRequired(false);
      setSelectedBank('');
      setCustomerName('');
      setCustomerResults([]);
      setSelectedCustomer(null);
      setCustomerNotes('');

      // Auto trigger print
      setTimeout(() => {
        window.print();
        setTimeout(() => setReceiptData(null), 1000);
      }, 500);

      // Trigger background sync if online
      if (isOnline && onlineSuccess) {
        pushPendingSales().catch(e => console.warn('Background sync push:', e));
      }
    } catch (err) {
      console.error('Checkout error:', err);
      showToast('error', err.message || 'Failed to complete sale.');
    } finally {
      isSubmittingRef.current = false;
      setProcessing(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedCustomer || isSavingNotes) return;
    setIsSavingNotes(true);
    try {
      const customerId = selectedCustomer.id;
      // Update Dexie customer table
      await db.customers.update(customerId, { customer_notes: customerNotes });
      setSelectedCustomer({ ...selectedCustomer, customer_notes: customerNotes });

      // Queue notes update
      await db.customerNotesQueue.add({
        customer_id: customerId,
        notes: customerNotes,
        created_at: new Date().toISOString(),
        status: 'pending'
      });

      if (navigator.onLine && typeof customerId === 'number') {
        try {
          await axios.put('/api/updateCustomerNotes', { id: customerId, notes: customerNotes });
        } catch (e) {
          console.warn('Failed to sync customer note online immediately:', e);
        }
      }

      showToast('success', 'Customer notes saved!');
      setIsNotesEditMode(false);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update customer notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCustomerAdded = (newCustomer) => {
    setSelectedCustomer(newCustomer);
    setCustomerName(newCustomer.name);
    setCustomerNotes(newCustomer.customer_notes || '');
    setCustomerResults([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-sm text-gray-500 mt-0.5">Offline-first checkout and instant receipt generation.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!navigator.onLine) {
              showToast('error', 'Cannot connect to server while offline. Previous sales require a network connection.');
            }
            setIsPreviousSalesOpen(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold transition shadow-xs active:scale-95 cursor-pointer"
          title="View previous sales records"
        >
          <History size={16} className="text-indigo-600" />
          <span>Previous Sales</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Results */}
        <div className="lg:col-span-6 space-y-4">
          <ProductSearch categories={categories} onAddToCart={addToCart} />

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
              <div className="space-y-4 col-span-1 xl:col-span-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                    <CreditCard size={16} /> Payment Route
                  </label>
                  <select
                    className="w-full px-4 h-9 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
                    value={paymentRoute}
                    onChange={(e) => {
                      setPaymentRoute(e.target.value);
                      setRequired(e.target.value === "Credit");
                    }}
                  >
                    <option value="">Select Route</option>
                    <option value="Cash">Cash</option>
                    <option value="Transfer">Transfer</option>
                    <option value="POS">POS</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>
                {(paymentRoute === 'Transfer' || paymentRoute === 'POS') && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                      <Building size={16} /> Bank
                    </label>
                    <select
                      className="w-full px-4 h-9 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                    >
                      <option value="">Select Bank</option>
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} - {b.account_number}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                    <User size={16} /> Customer {required ? <span className="text-red-500">(Required)</span> : <span className="text-gray-500">(Optional)</span>}
                  </label>
                  <div className="flex gap-2">
                    <div className="w-full relative">
                      <div className="flex justify-start items-center">
                        <input
                          type="text"
                          placeholder="Search customer..."
                          className="w-[80%] flex-1 px-4 h-9 bg-gray-50/50 border border-gray-200 rounded-l-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            if (selectedCustomer) setSelectedCustomer(null);
                          }}
                        />
                        <button
                          type="button"
                          disabled={!customerName || customerName === "Walk in customer"}
                          onClick={() => { setIsNotesModalOpen(true); setIsNotesEditMode(false); }}
                          className={`${!customerName || customerName === "Walk in customer" ? 'cursor-not-allowed bg-gray-300' : 'bg-indigo-700 hover:shadow-md cursor-pointer'} flex justify-center items-center w-[20%] h-9 px-3 py-2 rounded-r-xl transition text-sm font-medium`}
                          title="Customer Notes"
                        >
                          <StickyNote size={16} className={`${!customerName || customerName === "Walk in customer" ? 'text-gray-700' : 'text-white'}`} />
                        </button>
                      </div>

                      {customerResults.length > 0 && !selectedCustomer && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg max-h-[140px] overflow-y-auto shadow-xl z-50">
                          {customerResults.map(c => (
                            <div
                              key={c.id || c.local_id}
                              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm transition whitespace-nowrap border-b border-gray-50 last:border-b-0"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setCustomerName(c.name);
                                setCustomerNotes(c.customer_notes || '');
                                setCustomerResults([]);
                              }}
                            >
                              <span className="font-semibold text-gray-800">{c.name}</span>
                              {c.phone_number && <span className="text-gray-500 text-xs ml-2">({c.phone_number})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setIsAddCustomerModalOpen(true)}
                      className="w-full px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 border-dashed rounded-lg transition text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus size={16} /> Add New Customer
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 px-4 py-3 col-span-1 xl:col-span-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium">₦{formatMoney(total)}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        placeholder="Disc %"
                        className="w-full px-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                        value={discountPercent}
                        onChange={(e) => { setDiscountPercent(e.target.value); setDiscountValue(''); }}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        placeholder="Disc ₦"
                        className="w-full px-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                        value={discountValue}
                        onChange={(e) => { setDiscountValue(e.target.value); setDiscountPercent(''); }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-indigo-600">
                    <span>Discount</span>
                    <span className="font-medium">-₦{formatMoney(discountAmount)}</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-200 flex justify-between items-center mt-2">
                  <span className="text-lg font-bold text-gray-800">Total</span>
                  <span className="text-2xl font-black text-gray-900">₦{formatMoney(amountPayable)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCart([])}
                className="w-full sm:w-auto px-6 py-3 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition cursor-pointer"
              >
                Clear Cart
              </button>
              <button
                type="button"
                disabled={processing || cart.length === 0}
                onClick={handleCheckout}
                className={`w-full flex-1 px-6 py-3 text-white font-bold rounded-xl transition shadow-lg ${processing || cart.length === 0 ? "bg-indigo-400 cursor-not-allowed opacity-70" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 cursor-pointer"}`}
              >
                {processing ? "Processing Sale..." : "Complete Sale & Print Receipt"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Cart & Items */}
        <div className="lg:col-span-6 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[360px] lg:h-[calc(100vh-140px)]">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-wrap gap-2 justify-between items-center bg-gray-50/30">
            <div className="flex items-center gap-2">
              <ShoppingBag size={20} className="text-indigo-500" />
              <h2 className="text-lg font-bold text-gray-800">Current Order</h2>
              <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2.5 rounded-full text-xs font-semibold">
                {cart.length} {cart.length === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                <ShoppingBag size={48} className="mb-4 opacity-20" />
                <p className="font-medium">Your cart is empty.</p>
                <p className="text-xs text-gray-400 mt-1">Search and click products on the left to add items.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium text-center">Qty</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cart.map((item) => {
                      const itemId = item.item_id || item.id;
                      return (
                        <tr key={itemId} className={`transition-colors ${highlightedCartRow === itemId ? 'bg-yellow-100' : 'bg-white hover:bg-gray-50'}`}>
                          <td className="px-4 py-3 font-semibold text-gray-800">{item.item_name}</td>
                          <td className="px-4 py-3 text-gray-600">₦{formatMoney(item.selling_price)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center">
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50 w-max">
                                <button
                                  type="button"
                                  className="px-2 py-1 hover:bg-gray-200 text-gray-600 transition cursor-pointer font-bold"
                                  onClick={() => updateCartQuantity(itemId, Number(item.quantity || 1) - 1)}
                                >-</button>
                                <input
                                  type="number"
                                  required
                                  min="1"
                                  className="px-2 py-1 bg-white font-medium w-16 text-center border-x border-gray-200 outline-none appearance-none m-0"
                                  value={item.quantity}
                                  onChange={(e) => updateCartQuantity(itemId, e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                />
                                <button
                                  type="button"
                                  className="px-2 py-1 hover:bg-gray-200 text-gray-600 transition cursor-pointer font-bold"
                                  onClick={() => updateCartQuantity(itemId, Number(item.quantity || 1) + 1)}
                                >+</button>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">₦{formatMoney(item.selling_price * Number(item.quantity || 0))}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeFromCart(itemId)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddCustomerModal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        onSuccess={handleCustomerAdded}
      />

      {/* Customer Notes Modal */}
      {isNotesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <User size={20} className="text-indigo-500" />
                Customer Notes: {selectedCustomer ? selectedCustomer.name : customerName}
              </h3>
              <button
                type="button"
                onClick={() => setIsNotesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {isNotesEditMode ? (
                <textarea
                  className="w-full h-48 p-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-gray-400"
                  placeholder="Enter customer notes, prescriptions, preferences, etc..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                />
              ) : (
                <div className="bg-gray-50 p-4 rounded-xl min-h-[12rem] whitespace-pre-wrap text-gray-700 border border-gray-100">
                  {customerNotes || <span className="text-gray-400 italic">No notes available for this customer.</span>}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsNotesModalOpen(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                Close
              </button>
              {isNotesEditMode ? (
                <button
                  type="button"
                  disabled={isSavingNotes}
                  onClick={handleSaveNotes}
                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsNotesEditMode(true)}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium rounded-lg hover:bg-indigo-100 transition shadow-sm cursor-pointer"
                >
                  Edit Notes
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Receipt receiptData={receiptData} />

      {/* Previous Sales Modal */}
      <PreviousSalesModal
        isOpen={isPreviousSalesOpen}
        onClose={() => setIsPreviousSalesOpen(false)}
        shopDetails={shopDetails}
        user={user}
      />
    </div>
  );
};

export default SalesPage;
