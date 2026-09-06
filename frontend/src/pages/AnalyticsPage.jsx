import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AnalyticsMain from '../components/Analytics/AnalyticsMain';
import AnalyticsStaff from '../components/Analytics/AnalyticsStaff';
import AnalyticsCustomers from '../components/Analytics/AnalyticsCustomers';
import AnalyticsProducts from '../components/Analytics/AnalyticsProducts';
import DateRangeFilter from '../components/Analytics/DateRangeFilter';
import { ChartNoAxesCombined, Users, User, LayoutDashboard, Package } from 'lucide-react';

const AnalyticsPage = () => {
  const { user } = useOutletContext();
  const [activeTab, setActiveTab] = useState('main');
  
  // Default to current date
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const tabs = [
    { id: 'main', label: 'Overview', icon: LayoutDashboard },
    { id: 'staff', label: 'Staff Performance', icon: User },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'products', label: 'Product Performance', icon: Package },
  ];

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ChartNoAxesCombined className="text-indigo-600" /> Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track your business performance and insights.</p>
        </div>
        
        {/* Date filter applies to all tabs */}
        <DateRangeFilter 
          startDate={startDate} 
          setStartDate={setStartDate} 
          endDate={endDate} 
          setEndDate={setEndDate} 
        />
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.id 
                ? 'border-indigo-500 text-indigo-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
        {activeTab === 'main' && <AnalyticsMain startDate={startDate} endDate={endDate} />}
        {activeTab === 'staff' && <AnalyticsStaff startDate={startDate} endDate={endDate} />}
        {activeTab === 'customers' && <AnalyticsCustomers startDate={startDate} endDate={endDate} />}
        {activeTab === 'products' && <AnalyticsProducts startDate={startDate} endDate={endDate} />}
      </div>
    </div>
  );
};

export default AnalyticsPage;
