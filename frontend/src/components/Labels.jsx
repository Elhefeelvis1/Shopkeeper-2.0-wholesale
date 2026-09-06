import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Tag, Check, X, Edit, Trash2, Plus, AlertCircle } from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const LabelsPage = () => {
  const [activeTab, setActiveTab] = useState('categories');
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditing, setIsEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState(null);

  const tabs = [
    { id: 'categories', label: 'Categories' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'units', label: 'Units' },
    { id: 'companies', label: 'Companies' }
  ];

  useEffect(() => {
    fetchLabels();
    setIsEditing(null);
    setIsAdding(false);
    setError(null);
  }, [activeTab]);

  const fetchLabels = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/labels/${activeTab}`);
      setLabels(res.data.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch labels');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newValue.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await axios.post(`/api/labels/${activeTab}`, { name: newValue });
      setNewValue('');
      setIsAdding(false);
      fetchLabels();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add label');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (id) => {
    if (!editValue.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await axios.put(`/api/labels/${activeTab}/${id}`, { name: editValue });
      setIsEditing(null);
      fetchLabels();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to edit label');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await axios.delete(`/api/labels/${activeTab}/${id}`);
      setDeleteModalOpen(false);
      setLabelToDelete(null);
      fetchLabels();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete label');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="text-indigo-600" /> Label Management
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Manage categories, suppliers, units, and companies</p>
        </div>
      </div>

      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 sm:py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border border-red-100">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800 capitalize">{activeTab} List</h2>
          <button
            onClick={() => {
              setIsAdding(true);
              setNewValue('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Add New
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {isAdding && (
            <div className="p-4 flex items-center gap-3 bg-indigo-50/30">
              <input
                type="text"
                autoFocus
                className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={`Enter new ${activeTab.slice(0, -1)} name...`}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <button
                disabled={isSaving}
                onClick={handleAdd}
                className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                title="Save"
              >
                <Check size={18} />
              </button>
              <button
                disabled={isSaving}
                onClick={() => setIsAdding(false)}
                className="p-2 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                title="Cancel"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : labels.length === 0 && !isAdding ? (
            <div className="p-8 text-center text-gray-500">No records found.</div>
          ) : (
            labels.map((label) => (
              <div key={label.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                {isEditing === label.id ? (
                  <div className="flex-1 flex items-center gap-3 mr-4">
                    <input
                      type="text"
                      autoFocus
                      className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleEdit(label.id)}
                    />
                    <button
                      disabled={isSaving}
                      onClick={() => handleEdit(label.id)}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Save"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      disabled={isSaving}
                      onClick={() => setIsEditing(null)}
                      className="p-2 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                      title="Cancel"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-gray-700">{label.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setIsEditing(label.id);
                          setEditValue(label.name);
                        }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setLabelToDelete(label);
                          setDeleteModalOpen(true);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setLabelToDelete(null);
        }}
        onConfirm={() => handleDelete(labelToDelete?.id)}
        itemName={labelToDelete?.name}
        itemType="Label"
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default LabelsPage;
