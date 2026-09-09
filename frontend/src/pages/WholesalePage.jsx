import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Boxes, Plus, Trash2, CreditCard, User, Building, StickyNote, AlertTriangle, ShieldCheck, History } from 'lucide-react';
import AddCustomerModal from '../components/AddCustomerModal';
import WholesaleReceipt from '../components/WholesaleReceipt';
import WholesaleProductSearch from '../components/WholesaleProductSearch';
import PreviousWholesalesModal from '../components/PreviousWholesalesModal';
import { useToast } from '../context/ToastContext';
import { db, decrementLocalWholesaleStock, queueWholesale } from '../db/dexieDb';
import { pullMasterData, pushPendingWholesales } from '../services/syncService';

const WholesalePage = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [banks, setBanks] = useState([]);
  const [required, setRequired] = useState(false);
  const [shopDetails, setShopDetails] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [isPreviousSalesOpen, setIsPreviousSalesOpen] = useState(false);
  const { user } = useOutletContext() || {};

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Wholesale Cart state
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

  // Load initial master data from Dexie
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

  // Customer Search in Dexie
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
    const stockUnits = Number(item.total_quantity_in_stock || 0);
    const multiplier = Math.max(1, Number(item.wholesale_multiplier || 1));
    const wsUnit = item.wholesale_unit || 'Pack';

    if (stockUnits <= 0) {
      showToast('error', 'Item is completely out of stock.');
      return 'error';
    }

    if (stockUnits < multiplier) {
      showToast('error', `Insufficient base units for 1 ${wsUnit}. Required: ${multiplier}, Available: ${stockUnits}.`);
      return 'error';
    }

    const itemId = item.item_id || item.id;
    const exists = cart.find(i => (i.item_id || i.id) === itemId);
    if (!exists) {
      const wholesalePrice = parseFloat(item.wholesale_price || item.unit_selling_price || 0);
      setCart([
        ...cart,
        {
          ...item,
          item_id: itemId,
          item_name: item.item_name || item.name,
          wholesale_unit: wsUnit,
          wholesale_multiplier: multiplier,
          unit_name: item.unit_name || item.unit || 'units',
          quantity: 1, // 1 wholesale package
          selling_price: wholesalePrice
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
      if (itemInCart && newQuantity !== '') {
        const multiplier = Math.max(1, Number(itemInCart.wholesale_multiplier || 1));
        const totalBaseRequired = Number(newQuantity) * multiplier;
        const availableStock = Number(itemInCart.total_quantity_in_stock || 0);

        if (totalBaseRequired > availableStock) {
          const maxPacks = Math.floor(availableStock / multiplier);
          showToast('error', `Cannot sell more than available stock (${availableStock} base units = max ${maxPacks} ${itemInCart.wholesale_unit}s).`);
          return;
        }
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
    if (cart.length === 0) return showToast('error', 'Wholesale cart is empty');
    if (!paymentRoute) return showToast('error', 'Select a payment route');
    if ((paymentRoute === 'Transfer' || paymentRoute === 'POS') && !selectedBank) return showToast('error', `Select a bank for ${paymentRoute}`);
    if (paymentRoute === 'Credit' && !selectedCustomer) return showToast('error', 'Select a registered customer for Credit sales');
    if (required && !selectedCustomer) return showToast('error', 'Select a customer');

    const invalidItem = cart.find(item => item.quantity === '' || Number(item.quantity) < 1);
    if (invalidItem) {
      return showToast('error', `Please enter a valid package quantity for ${invalidItem.item_name}`);
    }

    setProcessing(true);

    const payload = {
      items: cart.map(item => ({
        productId: item.item_id || item.id,
        quantity: Number(item.quantity),
        unitMultiplier: Number(item.wholesale_multiplier || 1),
        wholesaleUnit: item.wholesale_unit || 'Pack',
        wholesalePrice: item.selling_price,
        sellPrice: item.selling_price,
        itemName: item.item_name,
        unit_name: item.unit_name
      })),
      payRoute: paymentRoute,
      bank: selectedBank || null,
      customerId: selectedCustomer?.id || null,
      totalDiscount: discountAmount,
      totalAmount: amountPayable
    };

    try {
      // 1. Immediately decrement local stock in Dexie
      await decrementLocalWholesaleStock(payload.items);

      // 2. Queue or process wholesale
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      let onlineSuccess = false;

      if (isOnline) {
        try {
          const res = await axios.post('/api/process-wholesale', payload);
          if (res.data && res.data.success) {
            onlineSuccess = true;
          }
        } catch (serverErr) {
          console.warn('Online process-wholesale failed, queueing for background sync:', serverErr);
        }
      }

      if (!onlineSuccess) {
        await queueWholesale(payload);
        showToast('info', 'Wholesale transaction recorded offline. Will sync automatically when online.');
      } else {
        showToast('success', 'Wholesale sale completed successfully!');
      }

      // 3. Prepare Wholesale Receipt
      const receipt = {
        shopDetails,
        date: new Date().toLocaleString(),
        items: cart.map(item => ({
          ...item,
          itemName: item.item_name,
          wholesalePrice: item.selling_price,
          wholesaleUnit: item.wholesale_unit,
          unitMultiplier: item.wholesale_multiplier
        })),
        totalAmount: total,
        totalDiscount: discountAmount,
        amountPaid: amountPayable,
        payRoute: paymentRoute,
        salesRep: user?.username || 'Wholesale Rep',
        customerName: selectedCustomer?.name || customerName || null
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

      // Trigger background sync
      if (isOnline) {
        pushPendingWholesales().catch(e => console.warn('Background sync push:', e));
      }
    } catch (err) {
      console.error('Wholesale checkout error:', err);
      showToast('error', err.message || 'Failed to complete wholesale sale.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedCustomer || isSavingNotes) return;
    setIsSavingNotes(true);
    try {
      const customerId = selectedCustomer.id;
      await db.customers.update(customerId, { customer_notes: customerNotes });
      setSelectedCustomer({ ...selectedCustomer, customer_notes: customerNotes });

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
      {/* 1. High-Visibility Wholesale Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 rounded-2xl shadow-lg p-5 sm:p-7 text-white">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-6 pointer-events-none">
          <Boxes size={140} />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-amber-900/40 backdrop-blur-md text-amber-200 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-2 border border-amber-400/30">
              <Boxes size={14} /> Wholesale Portal Mode
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              WHOLESALE SALES & DISTRIBUTION
            </h1>
            <p className="text-sm sm:text-base text-amber-100/90 mt-1 max-w-2xl">
              Bulk packaging sales mode. Pack quantities are multiplied by their unit equivalents and deducted automatically from inventory.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!navigator.onLine) {
                  showToast('error', 'Cannot connect to server while offline. Previous sales require a network connection.');
                }
                setIsPreviousSalesOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-900/50 hover:bg-amber-900/70 border border-amber-400/40 text-amber-100 rounded-xl text-xs sm:text-sm font-semibold transition backdrop-blur-md shadow-xs active:scale-95 cursor-pointer"
              title="View previous wholesale sales records"
            >
              <History size={16} className="text-amber-300" />
              <span>Previous Sales</span>
            </button>
            <div className="hidden sm:block bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 text-right">
              <span className="text-[11px] uppercase tracking-wider text-amber-200 block font-semibold">Pricing Mode</span>
              <span className="text-sm font-bold text-white">Wholesale / Pack Rates</span>
            </div>
          </div>
        </div>
      </div>

      <WholesaleProductSearch categories={categories} onAddToCart={addToCart} />

      {/* Cart and Checkout Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cart Table with Unit Equivalent Display */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-amber-200/70 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-amber-100 flex flex-wrap gap-2 justify-between items-center bg-amber-50/40">
              <h2 className="text-base sm:text-lg font-bold text-amber-950 flex items-center gap-2">
                <Boxes size={20} className="text-amber-600" />
                Wholesale Order Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.onLine) {
                      showToast('error', 'Cannot connect to server while offline. Previous sales require a network connection.');
                    }
                    setIsPreviousSalesOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1.5 rounded-lg transition shadow-2xs active:scale-95 cursor-pointer"
                  title="View previous wholesale sales records"
                >
                  <History size={14} className="text-amber-700" />
                  <span>Previous Sales</span>
                </button>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs active:scale-95"
                  >
                    Clear Cart
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[620px]">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="px-4 py-3 font-semibold">Product Name</th>
                    <th className="px-4 py-3 font-semibold text-center">Package Qty</th>
                    {/* Unit Equivalent Column displayed clearly by the side */}
                    <th className="px-4 py-3 font-semibold text-center text-amber-800 bg-amber-50/50">Unit Equivalent (Base)</th>
                    <th className="px-4 py-3 font-semibold text-right">Price / Pack</th>
                    <th className="px-4 py-3 font-semibold text-right">Subtotal</th>
                    <th className="px-4 py-3 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {cart.length > 0 ? (
                    cart.map((item) => {
                      const itemId = item.item_id || item.id;
                      const isHighlighted = highlightedCartRow === itemId;
                      const multiplier = Math.max(1, Number(item.wholesale_multiplier || 1));
                      const qty = Number(item.quantity || 0);
                      const totalBaseUnits = qty * multiplier;
                      const wsUnit = item.wholesale_unit || 'Pack';
                      const baseUnitName = item.unit_name || item.unit || 'units';

                      return (
                        <tr
                          key={itemId}
                          className={`transition-colors ${
                            isHighlighted ? 'bg-amber-100 animate-pulse' : 'hover:bg-amber-50/40'
                          }`}
                        >
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-slate-900">{item.item_name}</div>
                            <div className="text-xs text-slate-500">
                              Stock: {item.total_quantity_in_stock} {baseUnitName}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                className="w-16 h-9 px-2 text-center bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-semibold text-slate-800 text-sm"
                                value={item.quantity}
                                onChange={(e) => updateCartQuantity(itemId, e.target.value)}
                              />
                              <span className="text-xs font-semibold text-amber-800">{wsUnit}{qty > 1 ? 's' : ''}</span>
                            </div>
                          </td>
                          {/* Unit equivalent displayed by the side */}
                          <td className="px-4 py-3.5 text-center bg-amber-50/30">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-full text-xs border border-amber-300/60">
                                {totalBaseUnits} {baseUnitName}
                              </span>
                              {multiplier > 1 && (
                                <span className="text-[10px] text-amber-700 mt-0.5">
                                  1 {wsUnit} = {multiplier} {baseUnitName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-slate-700">
                            ₦{formatMoney(item.selling_price)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-amber-800">
                            ₦{formatMoney(item.selling_price * qty)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => removeFromCart(itemId)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                        <Boxes size={36} className="mx-auto mb-2 opacity-40 text-amber-600" />
                        <p className="font-medium">Your wholesale cart is empty.</p>
                        <p className="text-xs text-slate-400 mt-1">Use the search bar above to add bulk products.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Base Units Summary Bar */}
            {cart.length > 0 && (
              <div className="p-3 bg-amber-50/80 border-t border-amber-200/80 flex flex-wrap justify-between items-center text-xs text-amber-900 font-medium px-4">
                <span>
                  Total Packages in Cart: <strong>{cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} packs</strong>
                </span>
                <span>
                  Total Inventory Units Deducted: <strong className="text-amber-800 underline">{cart.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.wholesale_multiplier || 1)), 0)} base units</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Checkout Sidebar Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-amber-200/70 p-5 space-y-5">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Wholesale Summary</span>
              <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">BULK RATE</span>
            </h2>

            {/* Subtotal & Discount */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Subtotal:</span>
                <span className="font-bold text-slate-800">₦{formatMoney(total)}</span>
              </div>

              {/* Discount inputs */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Discount (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Percent %"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      value={discountPercent}
                      onChange={(e) => {
                        setDiscountPercent(e.target.value);
                        setDiscountValue('');
                      }}
                    />
                    <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-semibold">%</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Fixed ₦"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      value={discountValue}
                      onChange={(e) => {
                        setDiscountValue(e.target.value);
                        setDiscountPercent('');
                      }}
                    />
                    <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-semibold">₦</span>
                  </div>
                </div>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600 font-medium text-xs">
                  <span>Discount Applied:</span>
                  <span>-₦{formatMoney(discountAmount)}</span>
                </div>
              )}

              {/* Amount Payable */}
              <div className="pt-3 border-t-2 border-dashed border-slate-200 flex justify-between items-center">
                <span className="text-base font-bold text-slate-900">Total Payable:</span>
                <span className="text-xl font-extrabold text-amber-700">₦{formatMoney(amountPayable)}</span>
              </div>
            </div>

            {/* Customer Search / Selection */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <User size={14} className="text-slate-400" /> Customer
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(true)}
                  className="text-xs text-amber-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <Plus size={12} /> New Customer
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search wholesale customer..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                      setSelectedCustomer(null);
                    }
                  }}
                />

                {customerResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {customerResults.map((c) => (
                      <div
                        key={c.id || c.local_id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerName(c.name);
                          setCustomerNotes(c.customer_notes || '');
                          setCustomerResults([]);
                        }}
                        className="p-2.5 hover:bg-amber-50 cursor-pointer text-xs"
                      >
                        <div className="font-bold text-slate-800">{c.name}</div>
                        <div className="text-slate-400">{c.phone_number || 'No phone'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedCustomer && (
                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-amber-900 block">{selectedCustomer.name}</span>
                    <span className="text-slate-500">{selectedCustomer.phone_number || 'Registered Customer'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotesModalOpen(true)}
                    className="p-1.5 bg-white text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-100 transition cursor-pointer"
                    title="Customer Notes"
                  >
                    <StickyNote size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Payment Route */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <CreditCard size={14} className="text-slate-400" /> Payment Route
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Cash', 'Transfer', 'POS', 'Credit'].map((route) => (
                  <button
                    key={route}
                    type="button"
                    onClick={() => {
                      setPaymentRoute(route);
                      if (route === 'Credit') setRequired(true);
                      else setRequired(false);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      paymentRoute === route
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {route}
                  </button>
                ))}
              </div>

              {/* Bank Selection for Transfer or POS */}
              {(paymentRoute === 'Transfer' || paymentRoute === 'POS') && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                    <Building size={12} /> Select Receiving Bank
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500"
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                  >
                    <option value="">Select Bank...</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} {b.account_number ? `(${b.account_number})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {paymentRoute === 'Credit' && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 text-red-600 mt-0.5" />
                  <span>
                    Credit sale will be automatically attached to <strong>{selectedCustomer?.name || 'the selected customer'}</strong>'s debt profile.
                  </span>
                </div>
              )}
            </div>

            {/* Checkout Action Button */}
            <button
              onClick={handleCheckout}
              disabled={processing || cart.length === 0}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 hover:from-amber-700 hover:to-orange-800 text-white font-bold rounded-xl shadow-lg shadow-amber-300/50 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer flex items-center justify-center gap-2 text-sm"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing Wholesale Sale...</span>
                </>
              ) : (
                <>
                  <Boxes size={18} />
                  <span>Complete Wholesale Checkout (₦{formatMoney(amountPayable)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Customer Notes Modal */}
      {isNotesModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <StickyNote size={18} className="text-amber-600" />
                Notes: {selectedCustomer.name}
              </h3>
              <button onClick={() => setIsNotesModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                rows="4"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 font-medium resize-none"
                placeholder="Add customer wholesale preference, delivery instructions, or notes..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNotesModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingNotes}
                  onClick={handleSaveNotes}
                  className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer transition shadow-xs"
                >
                  {isSavingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        onCustomerAdded={handleCustomerAdded}
      />

      {/* Previous Wholesales Modal */}
      <PreviousWholesalesModal
        isOpen={isPreviousSalesOpen}
        onClose={() => setIsPreviousSalesOpen(false)}
        shopDetails={shopDetails}
        user={user}
      />

      {/* Wholesale Printable Receipt */}
      <WholesaleReceipt receiptData={receiptData} />
    </div>
  );
};

export default WholesalePage;
