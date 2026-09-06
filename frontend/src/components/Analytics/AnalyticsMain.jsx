import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BanknoteArrowDown, Banknote, Package, User, Users, Truck } from 'lucide-react';

const MetricCard = ({ title, value, icon: Icon, colorClass, subtitle }) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-start gap-4">
    <div className={`p-4 rounded-xl ${colorClass} bg-opacity-10 shrink-0`}>
      <Icon className={colorClass.split(' ')[0].replace('text-', 'text-')} size={24} />
    </div>
    <div>
      <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  </div>
);

const AnalyticsMain = ({ startDate, endDate }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/analytics/main', {
          params: {
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd')
          }
        });
        if (res.data.success) {
          setMetrics(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetrics();
  }, [startDate, endDate]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>;
  }

  if (!metrics) return <div className="text-gray-500 text-center py-8">Failed to load metrics.</div>;

  const formatMoney = (val) => `₦${parseFloat(val || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Net Profit" 
          value={formatMoney(metrics.netProfit)} 
          icon={BanknoteArrowDown} 
          colorClass="text-emerald-600 bg-emerald-100" 
        />
        <MetricCard 
          title="Gross Profit" 
          value={formatMoney(metrics.grossProfit)} 
          icon={BanknoteArrowDown} 
          colorClass="text-blue-600 bg-blue-100" 
        />
        <MetricCard 
          title="Total Sales" 
          value={formatMoney(metrics.totalSales)} 
          icon={Banknote} 
          colorClass="text-indigo-600 bg-indigo-100" 
        />
        <MetricCard 
          title="Items Sold" 
          value={metrics.itemsSold.toLocaleString()} 
          icon={Package} 
          colorClass="text-orange-600 bg-orange-100" 
        />
      </div>

      {/* Highlights Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <User size={20} />
            </div>
            <h3 className="font-semibold text-gray-800">Best Staff in Sales</h3>
          </div>
          {metrics.bestStaff ? (
            <div>
              <p className="text-xl font-bold text-gray-900 capitalize">{metrics.bestStaff.username}</p>
              <p className="text-sm text-gray-500 mt-1">Generated {formatMoney(metrics.bestStaff.total_sales)} in revenue</p>
            </div>
          ) : <p className="text-sm text-gray-400">No data for selected period</p>}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-pink-100 text-pink-600">
              <Users size={20} />
            </div>
            <h3 className="font-semibold text-gray-800">Best Customer</h3>
          </div>
          {metrics.bestCustomer ? (
            <div>
              <p className="text-xl font-bold text-gray-900 capitalize">{metrics.bestCustomer.name}</p>
              <p className="text-sm text-gray-500 mt-1">Spent {formatMoney(metrics.bestCustomer.total_sales)}</p>
            </div>
          ) : <p className="text-sm text-gray-400">No data for selected period</p>}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-teal-100 text-teal-600">
              <Truck size={20} />
            </div>
            <h3 className="font-semibold text-gray-800">Top Supplier</h3>
          </div>
          {metrics.topSupplier ? (
            <div>
              <p className="text-xl font-bold text-gray-900 capitalize">{metrics.topSupplier.name}</p>
              <p className="text-sm text-gray-500 mt-1">Purchased {formatMoney(metrics.topSupplier.total_purchased)} from</p>
            </div>
          ) : <p className="text-sm text-gray-400">No data for selected period</p>}
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-96">
        <h3 className="font-semibold text-gray-800 mb-6">Sales Trend</h3>
        {metrics.chartData && metrics.chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#9ca3af', fontSize: 12}} 
                tickFormatter={(value) => `₦${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => [formatMoney(value), 'Sales']}
                labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
              />
              <Line type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">No sales data for the selected period.</div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsMain;
