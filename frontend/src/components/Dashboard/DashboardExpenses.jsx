import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Plus, Trash2, Banknote } from 'lucide-react';
import DateRangeFilter from '../Analytics/DateRangeFilter';


const DashboardExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState(new Date());

  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, [startDate, endDate]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/expenses', {
        params: {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd')
        }
      });
      if (res.data.success) {
        setExpenses(res.data.expenses);
      }
    } catch (err) {
      console.error("Failed to fetch expenses", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newAmount || !newDescription || !newDate) return;
    setAdding(true);
    try {
      const res = await axios.post('/api/expenses', {
        amount: newAmount,
        description: newDescription,
        date: newDate
      });
      if (res.data.success) {
        setNewAmount('');
        setNewDescription('');
        setNewDate(format(new Date(), 'yyyy-MM-dd'));
        fetchExpenses();
      }
    } catch (err) {
      console.error("Failed to add expense", err);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await axios.delete(`/api/expenses/${id}`);
      if (res.data.success) {
        setExpenses(expenses.filter(e => e.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete expense", err);
    }
  };

  const formatMoney = (val) => `₦${parseFloat(val || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Banknote className="text-indigo-500" /> Expenses Management
        </h2>
        <DateRangeFilter 
            startDate={startDate} 
            setStartDate={setStartDate} 
            endDate={endDate} 
            setEndDate={setEndDate} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-fit">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Plus size={18} className="text-emerald-500" /> Add New Expense
          </h3>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input 
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea 
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                required
                placeholder="What was this expense for?"
                rows="3"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none"
              />
            </div>
            <button 
              type="submit" 
              disabled={adding}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add Expense'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Expense History</h3>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar p-0">
            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : expenses.length === 0 ? (
              <div className="py-12 text-center text-gray-400">No expenses found for this period.</div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Description</th>
                    <th className="px-6 py-3 font-medium">Recorded By</th>
                    <th className="px-6 py-3 font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map(expense => (
                    <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">{expense.date}</td>
                      <td className="px-6 py-4 text-gray-900">{expense.description}</td>
                      <td className="px-6 py-4 text-gray-500 capitalize">{expense.username || 'System'}</td>
                      <td className="px-6 py-4 font-semibold text-gray-800">{formatMoney(expense.amount)}</td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors cursor-pointer"
                          title="Delete Expense"
                        >
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

export default DashboardExpenses;
