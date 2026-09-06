import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Phone, MapPin, Mail, FileText, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { saveLocalCustomer, db } from '../db/dexieDb';
import { pushPendingCustomers } from '../services/syncService';

const AddCustomerModal = ({ isOpen, onClose, onSuccess, initialData = null, customers = [] }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    address: '',
    email: '',
    customer_notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          phone_number: initialData.phone_number || '',
          address: initialData.address || '',
          email: initialData.email || '',
          customer_notes: initialData.customer_notes || ''
        });
      } else {
        setFormData({
          name: '',
          phone_number: '',
          address: '',
          email: '',
          customer_notes: ''
        });
      }
      setError('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Name is required');
      return;
    }

    const trimmedName = formData.name.trim();
    // Check for duplicate names locally
    const nameExists = customers.some(
      c => c.name && c.name.toLowerCase() === trimmedName.toLowerCase() && c.id !== initialData?.id
    );
    if (nameExists) {
      showToast('error', 'Customer name already exists!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const isEditing = !!initialData;
      let savedCustomer;

      if (isOnline) {
        try {
          const url = isEditing ? '/api/updateCustomer' : '/api/addCustomer';
          const payload = isEditing ? { ...formData, id: initialData.id } : { ...formData, name: trimmedName };
          const method = isEditing ? 'put' : 'post';
          const response = await axios[method](url, payload);

          if (response.data && response.data.success) {
            savedCustomer = response.data.customer;
            // Update local Dexie record as synced
            await db.customers.put({ ...savedCustomer, sync_status: 'synced' });
          }
        } catch (serverErr) {
          console.warn('Server addCustomer failed, saving locally:', serverErr);
        }
      }

      // If offline or server request failed, save to Dexie
      if (!savedCustomer) {
        savedCustomer = await saveLocalCustomer({
          ...(initialData || {}),
          ...formData,
          name: trimmedName
        });
        if (isOnline) {
          pushPendingCustomers().catch(e => console.warn('Customer push error:', e));
        }
      }

      showToast('success', isEditing ? 'Customer updated successfully!' : 'Customer added successfully!');
      onSuccess(savedCustomer);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || `An error occurred while ${initialData ? 'updating' : 'adding'} the customer.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <User size={20} className="text-indigo-500" />
            {initialData ? 'Edit Customer' : 'Add New Customer'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer text-xl font-bold"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="add-customer-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <User size={16} /> Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <Phone size={16} /> Phone Number
              </label>
              <input
                type="text"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="08012345678"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <Mail size={16} /> Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <MapPin size={16} /> Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="123 Main St"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <FileText size={16} /> Customer Notes
              </label>
              <textarea
                name="customer_notes"
                value={formData.customer_notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"
                placeholder="Prescriptions, preferences, etc..."
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-customer-form"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[100px] cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              initialData ? 'Update Customer' : 'Save Customer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCustomerModal;
