import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Package, Plus, Edit, Search, AlertTriangle, Tag, Scale, DollarSign, Percent, AlertCircle, FileText, Barcode, Download, List, AlertOctagon, Upload } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import StockItemModal from '../components/StockItemModal';

const StockPage = () => {
  const { showToast } = useToast();
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '', genericName: '', barcode: '', category: '', company: '', unit: '',
    cost: '', markup: '', price: '', reorderLevel: '', description: '', quantity: ''
  });
  const [ItemOnEdit, setItemOnEdit] = useState(null);

  const fetchInventory = async (pageNumber = 1, searchQuery = search, append = false, tab = activeTab) => {
    if (pageNumber === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const limit = 10;
      const res = await axios.get('/api/all-inventory', {
        params: { page: pageNumber, limit, search: searchQuery, filter: tab === 'all' ? '' : tab }
      }).catch(() => ({ data: { contents: [], totalCount: 0 } }));

      const newItems = res.data.contents || [];
      const total = res.data.totalCount || 0;

      if (append) {
        setInventory(prev => [...prev, ...newItems]);
      } else {
        setInventory(newItems);
      }
      setTotalItems(total);
      setHasMore(newItems.length === limit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const optsRes = await axios.get('/api/stockPage').catch(() => ({ data: { categories: [], units: [], companies: [] } }));
      setCategories(optsRes.data.categories || []);
      setUnits(optsRes.data.units || []);
      setCompanies(optsRes.data.companies || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = () => {
    setPage(1);
    fetchInventory(1, search, false, activeTab);
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    setPage(1);
    fetchInventory(1, search, false, activeTab);
  }, [activeTab]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(1);
      fetchInventory(1, search, false, activeTab);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      if (hasMore && !loading && !loadingMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchInventory(nextPage, search, true, activeTab);
      }
    }
  };

  const handlePricingChange = (field, value) => {
    const newData = { ...formData, [field]: value };
    const cost = parseFloat(newData.cost) || 0;
    const markup = parseFloat(newData.markup) || 0;
    const price = parseFloat(newData.price) || 0;

    if (field === 'markup') {
      if (cost > 0) {
        newData.price = (cost + (cost * markup / 100)).toFixed(2);
      }
    } else if (field === 'cost' || field === 'price') {
      if (cost > 0 && price > 0) {
        newData.markup = (((price - cost) / cost) * 100).toFixed(1);
      }
    }
    setFormData(newData);
  };

  const handleAddNewClick = () => {
    setItemOnEdit(null);
    setFormData({
      name: '', genericName: '', barcode: '', category: '', company: '', unit: '',
      cost: '', markup: '', price: '', reorderLevel: '', description: '', quantity: ''
    });
    setShowAddModal(true);
  };

  const handleEditClick = (item) => {
    setItemOnEdit(item);
    const cost = parseFloat(item.last_cost_price) || 0;
    const price = parseFloat(item.unit_selling_price) || 0;
    const markup = cost > 0 ? (((price - cost) / cost) * 100).toFixed(1) : '0';

    setFormData({
      name: item.name || '',
      genericName: item.generic_name || '',
      barcode: item.barcode || '',
      category: item.category || '',
      company: item.company || '',
      unit: item.unit || '',
      cost: cost || '',
      markup: markup || '',
      price: price || '',
      reorderLevel: item.reorder_level || '',
      description: item.description || '',
      quantity: item.total_quantity_in_stock || ''
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setItemOnEdit(null);
    setFormData({
      name: '', genericName: '', barcode: '', category: '', company: '', unit: '',
      cost: '', markup: '', price: '', reorderLevel: '', description: '', quantity: ''
    });
  };

  const confirmDelete = () => {
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      if (ItemOnEdit) {
        const response = await axios.delete(`/api/delete-item/${ItemOnEdit.id}`);
        setShowDeleteModal(false);
        closeModal();
        showToast('success', response.data.message || 'Product deleted successfully!');
        fetchData();
      }
    } catch (err) {
      console.error(err);
      showToast('error', err.response?.data?.message || 'Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (ItemOnEdit) {
        const response = await axios.put('/api/update-item', { id: ItemOnEdit.id, ...formData });
        showToast('success', response.data.message || 'Product updated successfully!');
      } else {
        const response = await axios.post('/api/addStock', formData);
        showToast('success', response.data.message || 'Product saved successfully!');
      }
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('error', err.response?.data?.message || (ItemOnEdit ? 'Failed to update product' : 'Failed to save product'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handled via backend

  const tabs = [
    { id: 'all', label: 'All Stocks', icon: List },
    { id: 'reorder', label: 'Reorder Stocks', icon: AlertTriangle },
    { id: 'zero', label: 'Zero Stocks', icon: AlertOctagon }
  ];

  const handleExportCSV = async () => {
    try {
      const res = await axios.get('/api/all-inventory', {
        params: { limit: 'all', search, filter: activeTab === 'all' ? '' : activeTab }
      });
      const allItems = res.data.contents || [];

      const headers = ["Name", "Generic Name", "Barcode", "Category", "Unit", "In Stock", "Cost", "Price", "Reorder Level"];
      const rows = allItems.map(item => [
        item.name,
        item.generic_name || '',
        item.barcode || '',
        item.category,
        item.unit,
        item.total_quantity_in_stock,
        item.last_cost_price,
        item.unit_selling_price,
        item.reorder_level
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `inventory-report-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export CSV", err);
      showToast('error', 'Failed to export CSV');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">View, track, and register stock items.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link
            to="/import-csv?table=all_stocks"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm font-medium text-sm"
          >
            <Upload size={16} className="text-gray-500" /> Import CSV
          </Link>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm font-medium cursor-pointer text-sm"
          >
            <Download size={16} className="text-gray-500" /> Export CSV
          </button>
          <button
            onClick={handleAddNewClick}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium cursor-pointer text-sm"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm font-medium text-gray-500">{totalItems} items total</span>
        </div>

        <div className="max-h-[500px] overflow-y-auto custom-scrollbar overflow-x-auto" onScroll={handleScroll}>
          {loading && page === 1 ? (
            <div className="py-12 flex justify-center text-indigo-600"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Product Name</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium text-right">In Stock</th>
                  <th className="px-6 py-3 font-medium text-right">Cost</th>
                  <th className="px-6 py-3 font-medium text-right">Price</th>
                  <th className="px-6 py-3 font-medium text-center">Status</th>
                  <th className="px-6 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {inventory.length > 0 ? inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.generic_name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="bg-gray-100 px-2.5 py-1 rounded-md text-xs">{item.category}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-right text-gray-700">
                      {item.total_quantity_in_stock} <span className="text-gray-400 text-xs">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">₦{formatMoney(item.last_cost_price)}</td>
                    <td className="px-6 py-4 text-right font-medium text-indigo-600">₦{formatMoney(item.unit_selling_price)}</td>
                    <td className="px-6 py-4 text-center">
                      {item.total_quantity_in_stock <= item.reorder_level ? (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-xs font-medium border border-red-100">
                          <AlertTriangle size={12} /> Low Stock
                        </span>
                      ) : (
                        <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-medium border border-green-100">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-indigo-600 transition p-1 cursor-pointer">
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      <Package size={32} className="mx-auto mb-3 opacity-30" />
                      <p>No products found in inventory.</p>
                    </td>
                  </tr>
                )}
                {loadingMore && (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-indigo-600">
                      <div className="animate-spin inline-block rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                      <span className="ml-2 text-sm font-medium">Loading more...</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <StockItemModal
        isOpen={showAddModal}
        onClose={closeModal}
        ItemOnEdit={ItemOnEdit}
        formData={formData}
        setFormData={setFormData}
        categories={categories}
        units={units}
        companies={companies}
        handlePricingChange={handlePricingChange}
        handleSubmit={handleSubmit}
        onDeleteClick={confirmDelete}
        isSubmitting={isSubmitting}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemName={ItemOnEdit?.name}
        itemType="Product"
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default StockPage;
