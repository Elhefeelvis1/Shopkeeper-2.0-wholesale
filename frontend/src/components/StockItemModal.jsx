import React from 'react';
import { Package, Edit, FileText, Barcode, Tag, Scale, DollarSign, Percent, AlertCircle, Building } from 'lucide-react';

const StockItemModal = ({
  isOpen,
  onClose,
  ItemOnEdit,
  formData,
  setFormData,
  categories,
  units,
  companies,
  handlePricingChange,
  handleSubmit,
  onDeleteClick,
  isSubmitting = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-4 sm:px-8 py-3.5 sm:py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-base sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            {ItemOnEdit ? (
              <>
                <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <Edit size={18} />
                </div>
                <span className="truncate">Edit Product <span className="text-slate-400 font-medium">{ItemOnEdit.name}</span></span>
              </>
            ) : (
              <>
                <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <Package size={18} />
                </div>
                <span>Register New Product</span>
              </>
            )}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-4 sm:p-8 overflow-y-auto">
          <form id="addForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} className="text-slate-400" /> Brand Name
              </label>
              <div className="group">
                <input
                  type="text"
                  required
                  placeholder="e.g. Panadol"
                  className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-slate-400" /> Generic Name
              </label>
              <div className="group">
                <input
                  type="text"
                  placeholder="e.g. Paracetamol"
                  className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                  value={formData.genericName}
                  onChange={e => setFormData({ ...formData, genericName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Barcode size={14} className="text-slate-400" /> Barcode
              </label>
              <div className="group">
                <input
                  type="text"
                  placeholder="e.g. 123456789012"
                  className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium font-mono"
                  value={formData.barcode}
                  onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Tag size={14} className="text-slate-400" /> Category
              </label>
              <div className="relative group">
                <select
                  required
                  className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 text-sm font-medium appearance-none cursor-pointer"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Select Category...</option>
                  {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Building size={14} className="text-slate-400" /> Company
              </label>
              <div className="relative group">
                <select
                  required
                  className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 text-sm font-medium appearance-none cursor-pointer"
                  value={formData.company}
                  onChange={e => setFormData({ ...formData, company: e.target.value })}
                >
                  <option value="">Select Company...</option>
                  {companies?.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Scale size={14} className="text-slate-400" /> Unit Type
              </label>
              <div className="relative group">
                <select
                  required
                  className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 text-sm font-medium appearance-none cursor-pointer"
                  value={formData.unit}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                >
                  <option value="">Select Unit...</option>
                  {units.map((u, i) => <option key={i} value={u.name}>{u.name}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={14} className="text-slate-400" /> Cost per Unit
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-semibold text-sm group-focus-within:text-indigo-600 transition-colors">
                  ₦
                </div>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                  value={formData.cost}
                  onChange={e => handlePricingChange('cost', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Percent size={14} className="text-slate-400" /> Mark-up (%)
              </label>
              <div className="relative group">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full pl-4 pr-10 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                  value={formData.markup}
                  onChange={e => handlePricingChange('markup', e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 font-semibold text-sm group-focus-within:text-indigo-600 transition-colors">
                  %
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={14} className="text-slate-400" /> Selling Price
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-semibold text-sm group-focus-within:text-indigo-600 transition-colors">
                  ₦
                </div>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                  value={formData.price}
                  onChange={e => handlePricingChange('price', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle size={14} className="text-slate-400" /> Re-order Level
              </label>
              <div className="group">
                <input
                  type="number"
                  required
                  placeholder="e.g. 10"
                  className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                  value={formData.reorderLevel}
                  onChange={e => setFormData({ ...formData, reorderLevel: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} className="text-slate-400" /> Quantity
              </label>
              <div className="group">
                <input
                  type="number"
                  placeholder="e.g. 50"
                  className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
            </div>

            <div className="col-span-1 md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-slate-400" /> Description
              </label>
              <div className="relative group">
                <textarea
                  rows="3"
                  placeholder="Optional product description..."
                  className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-colors duration-200 text-slate-800 placeholder-slate-400 text-sm font-medium resize-none"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
          </form>
        </div>
        <div className="px-4 sm:px-8 py-3.5 sm:py-5 border-t border-slate-200 flex flex-wrap gap-2.5 justify-between bg-slate-50/50 items-center">
          {ItemOnEdit ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onDeleteClick}
              className="px-4 sm:px-5 py-2 sm:py-2.5 bg-red-500 text-white font-semibold hover:bg-red-700 rounded-xl transition-all duration-150 cursor-pointer text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          ) : (
            <div></div>
          )}
          <div className="flex gap-2 sm:gap-3.5 ml-auto">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 sm:px-5 py-2 sm:py-2.5 text-slate-600 font-semibold hover:bg-slate-500 hover:text-white rounded-xl transition-all duration-150 cursor-pointer text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="addForm"
              disabled={isSubmitting}
              className={`px-5 sm:px-7 py-2 sm:py-2.5 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isSubmitting ? 'cursor-not-allowed' : 'cursor-pointer'
              } ${ItemOnEdit
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200/50'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-200/50'
                }`}
            >
              {isSubmitting ? 'Processing...' : (ItemOnEdit ? 'Update Product' : 'Save Product')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockItemModal;
