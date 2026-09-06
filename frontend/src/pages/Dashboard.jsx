import { useState, useEffect, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { TrendingUp, Users, DollarSign, Package, Settings, Save, LayoutDashboard, Store, Receipt, Landmark, Tags, Info } from 'lucide-react';
import DashboardExpenses from '../components/Dashboard/DashboardExpenses';
import DashboardBanks from '../components/Dashboard/DashboardBanks';
import Labels from '../components/Labels';
import { useToast } from '../context/ToastContext';

const Dashboard = () => {
  const { showToast } = useToast();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [data, setData] = useState({ users: [], recentSales: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [shopDetails, setShopDetails] = useState({ shopName: '', shopAddress: '', shopPhone: '', shopEmail: '', shopLogo: '' });
  const [saving, setSaving] = useState(false);
  const [stockInfoOpen, setStockInfoOpen] = useState(false);
  const stockInfoRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (stockInfoRef.current && !stockInfoRef.current.contains(e.target)) {
        setStockInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatMoney = (amount) => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    if (activeTab === 'shopInfo') {
      axios.get('/api/shopDetails').then(res => setShopDetails(res.data)).catch(console.error);
    }
  }, [activeTab]);

  const handleSaveShopDetails = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/shopDetails', shopDetails);
      showToast('success', 'Shop details updated successfully!');
    } catch (err) {
      showToast('error', 'Failed to update shop details.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      if (user?.role !== 'administrator') {
        navigate('/home');
        return;
      }

      try {
        const response = await axios.get('/api/dashboard');
        setData(response.data);
      } catch (err) {
        setError('Failed to load dashboard data. Are you logged in?');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
        {error}
      </div>
    );
  }

  const statCards = [
    { title: 'Total Sales', value: data.recentSales.length, icon: <TrendingUp size={24} className="text-emerald-500" />, bg: 'bg-emerald-50' },
    { title: 'Registered Users', value: data.users.length, icon: <Users size={24} className="text-blue-500" />, bg: 'bg-blue-50' },
    { title: 'Registered Customers', value: data.totalCustomers || 0, icon: <Users size={24} className="text-amber-500" />, bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back. Manage your shop and view metrics.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          <button onClick={() => setActiveTab('overview')} className={`px-3.5 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 cursor-pointer ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><LayoutDashboard size={16} /> Overview</button>
          <button onClick={() => setActiveTab('shopInfo')} className={`px-3.5 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 cursor-pointer ${activeTab === 'shopInfo' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Store size={16} /> Shop Info</button>
          <button onClick={() => setActiveTab('expenses')} className={`px-3.5 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 cursor-pointer ${activeTab === 'expenses' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Receipt size={16} /> Expenses</button>
          <button onClick={() => setActiveTab('banks')} className={`px-3.5 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 cursor-pointer ${activeTab === 'banks' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Landmark size={16} /> Banks</button>
          <button onClick={() => setActiveTab('labels')} className={`px-3.5 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 cursor-pointer ${activeTab === 'labels' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Tags size={16} /> Labels</button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-10 gap-4 sm:gap-6">
            {statCards.map((stat, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6 col-span-1 sm:col-span-1 lg:col-span-2 flex items-center gap-4 transition-transform hover:-translate-y-1 hover:shadow-md duration-200">
                <div className={`p-3.5 sm:p-4 rounded-lg ${stat.bg} shrink-0`}>
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{stat.title}</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">{stat.value}</h3>
                </div>
              </div>
            ))}
            <div ref={stockInfoRef} className="relative bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6 col-span-1 sm:col-span-2 lg:col-span-4 flex items-center gap-4 transition-transform hover:-translate-y-1 hover:shadow-md duration-200">
              <div className="p-3.5 sm:p-4 rounded-lg bg-indigo-50 shrink-0">
                <DollarSign size={24} className="text-indigo-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Stock Value</p>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5 break-words">₦{formatMoney(data.totalStockValue)}</h3>
              </div>
              {/* Info button */}
              <button
                onClick={() => setStockInfoOpen(o => !o)}
                className="absolute top-3 right-3 text-gray-400 hover:text-indigo-500 transition-colors p-1"
                title="Stock value breakdown"
              >
                <Info size={16} />
              </button>
              {/* Popover */}
              {stockInfoOpen && (
                <div className="absolute top-12 right-0 sm:right-3 z-50 w-72 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Stock Value Breakdown</p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="py-2 text-gray-500">Cost Value</td>
                        <td className="py-2 text-right font-semibold text-gray-800">₦{formatMoney(data.totalStockValue)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-500">Sell Value</td>
                        <td className="py-2 text-right font-semibold text-gray-800">₦{formatMoney(data.totalStockSellValue)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-500 font-medium">Expected Profit</td>
                        <td className={`py-2 text-right font-bold ${(data.totalStockSellValue - data.totalStockValue) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          ₦{formatMoney(data.totalStockSellValue - data.totalStockValue)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">Recent Sales</h2>
                <button className="text-sm text-indigo-600 font-medium hover:text-indigo-800">View All</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                      <th className="px-6 py-3 font-medium">Product</th>
                      <th className="px-6 py-3 font-medium">Quantity</th>
                      <th className="px-6 py-3 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recentSales.length > 0 ? data.recentSales.slice(0, 5).map((sale, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{sale.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{Math.abs(sale.quantity_change)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">₦{formatMoney(sale.unit_selling_price)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="3" className="px-6 py-8 text-center text-gray-500">No recent sales found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">System Users</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                      <th className="px-6 py-3 font-medium">Username</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.users.length > 0 ? data.users.map((u, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          {u.username}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'administrator' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                            {u.role}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="2" className="px-6 py-8 text-center text-gray-500">No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>)}

      {activeTab === 'shopInfo' && (
        <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Settings size={20} className="text-indigo-500" /> Shop Settings
          </h2>
          <form onSubmit={handleSaveShopDetails} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
              <input type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={shopDetails.shopName || ''} onChange={e => setShopDetails({ ...shopDetails, shopName: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Address</label>
              <textarea className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={shopDetails.shopAddress || ''} onChange={e => setShopDetails({ ...shopDetails, shopAddress: e.target.value })} required rows="2"></textarea>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={shopDetails.shopPhone || ''} onChange={e => setShopDetails({ ...shopDetails, shopPhone: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={shopDetails.shopEmail || ''} onChange={e => setShopDetails({ ...shopDetails, shopEmail: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Logo URL</label>
              <input type="url" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={shopDetails.shopLogo || ''} onChange={e => setShopDetails({ ...shopDetails, shopLogo: e.target.value })} />
            </div>
            <div className="pt-4 border-t border-gray-100">
              <button type="submit" disabled={saving} className="bg-indigo-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2">
                <Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'expenses' && <DashboardExpenses />}

      {activeTab === 'banks' && <DashboardBanks />}

      {activeTab === 'labels' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
          <Labels />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
