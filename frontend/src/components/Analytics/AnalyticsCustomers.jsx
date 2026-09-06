import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search, Users, Tag, Package, X } from 'lucide-react';

const AnalyticsCustomers = ({ startDate, endDate }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const observer = useRef();
  
  const lastCustomerElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  useEffect(() => {
    setPage(1);
    setCustomers([]);
  }, [startDate, endDate]);

  // Fetch all paginated customers
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/analytics/customers', {
          params: { page, startDate, endDate }
        });
        if (res.data.success) {
          setCustomers(prev => page === 1 ? res.data.customers : [...prev, ...res.data.customers]);
          setHasMore(res.data.customers.length === 15); // limit is 15
        }
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCustomers();
  }, [page, startDate, endDate]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    try {
      const res = await axios.get('/api/analytics/customers', {
        params: { search: searchQuery, page: 1, startDate, endDate }
      });
      if (res.data.success) {
        setSearchResults(res.data.customers || []);
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const formatMoney = (val) => `₦${parseFloat(val || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  const CustomerCard = ({ customer, innerRef }) => (
    <div ref={innerRef} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
          {customer.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="font-bold text-gray-900 capitalize">{customer.name}</h3>
          {customer.phone_number && <p className="text-xs text-gray-500">{customer.phone_number}</p>}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Tag size={12}/> Amount Spent</p>
          <p className="font-bold text-emerald-600">{formatMoney(customer.amount_spent)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Tag size={12}/> Total Discounts</p>
          <p className="font-semibold text-orange-500">{formatMoney(customer.total_discounts)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Package size={12}/> Items Bought</p>
          <p className="font-semibold text-gray-800">{customer.items_bought} items across {customer.total_transactions} transactions</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-indigo-500" /> Customer Insights
          </h2>
          
          <form onSubmit={handleSearch} className="w-full md:w-96 relative">
            <input 
              type="text" 
              placeholder="Search customers by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <button type="submit" className="hidden">Search</button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map((customer, index) => {
            if (customers.length === index + 1) {
              return <CustomerCard innerRef={lastCustomerElementRef} key={customer.id} customer={customer} />
            } else {
              return <CustomerCard key={customer.id} customer={customer} />
            }
          })}
        </div>
        
        {loading && (
          <div className="py-6 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}
        
        {!hasMore && customers.length > 0 && (
          <div className="py-6 text-center text-gray-400 text-sm">
            You've reached the end of the customer list.
          </div>
        )}
      </div>

      {/* Search Results Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Search size={18} className="text-indigo-500" /> Search Results for "{searchQuery}"
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
              {searchLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map(customer => (
                    <CustomerCard key={customer.id} customer={customer} />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400">
                  No customers found matching your search.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsCustomers;
