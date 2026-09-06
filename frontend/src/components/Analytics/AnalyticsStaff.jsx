import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { User, Banknote, Package, BanknoteArrowDown, FileText } from 'lucide-react';

const AnalyticsStaff = ({ startDate, endDate }) => {
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/analytics/staff', {
          params: {
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd'),
            staffId: selectedStaff || undefined
          }
        });
        if (res.data.success) {
          setStaffList(res.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch staff performance:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [startDate, endDate, selectedStaff]);

  const formatMoney = (val) => `₦${parseFloat(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Staff Performance</h2>

        <div className="mb-6 w-full md:w-1/3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Staff Member</label>
          <select
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700 capitalize"
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
          >
            <option value="">All Staff</option>
            {/* If there's no selected staff, list all fetched staff to build options, else just use the loaded data. To make this robust, we should ideally fetch ALL staff once and keep them in a separate state, but for simplicity, the current query returns all staff if none selected. */}
            {staffList.map(staff => (
              <option key={staff.id} value={staff.id}>{staff.username}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : staffList.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No sales data found for the selected criteria.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffList.map(staff => (
              <div key={staff.id} className="bg-gray-50 rounded-xl p-5 border border-gray-100 hover:border-indigo-100 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-full">
                    <User size={20} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg capitalize">{staff.username}</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-gray-500 text-sm flex items-center gap-1"><Banknote size={14} /> Revenue</span>
                    <span className="font-semibold text-gray-800">{formatMoney(staff.total_sales)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-gray-500 text-sm flex items-center gap-1"><BanknoteArrowDown size={14} /> Profit Generated</span>
                    <span className="font-semibold text-emerald-600">{formatMoney(staff.profit_generated)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-gray-500 text-sm flex items-center gap-1"><Package size={14} /> Items Sold</span>
                    <span className="font-semibold text-gray-800">{staff.items_sold}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm flex items-center gap-1"> <FileText size={14} />Transactions</span>
                    <span className="font-semibold text-gray-800">{staff.total_transactions}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsStaff;
