import React, { useState } from 'react';
import { Search, Package } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { searchLocalProducts } from '../db/dexieDb';

const ProductSearch = ({ categories, onAddToCart }) => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState({ itemName: '', category: '', minPrice: '', maxPrice: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchResultsModalOpen, setIsSearchResultsModalOpen] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    try {
      const results = await searchLocalProducts(searchQuery);
      setSearchResults(results || []);
      setIsSearchResultsModalOpen(true);
    } catch (err) {
      console.error('Local product search error:', err);
      setSearchResults([]);
      showToast('error', 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Search size={20} className="text-indigo-500" /> Product Search
            </h2>
            <select
              className="text-sm w-full sm:w-auto h-9 px-4 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
              value={searchQuery.category}
              onChange={(e) => setSearchQuery({ ...searchQuery, category: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.map((c, i) => (
                <option key={c.id || i} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Item Name or Barcode..."
              className="w-full px-4 h-10 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
              value={searchQuery.itemName}
              onChange={(e) => setSearchQuery({ ...searchQuery, itemName: e.target.value })}
            />
            <button
              type="submit"
              disabled={isSearching}
              className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 transition shadow-md disabled:opacity-70 cursor-pointer"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {isSearchResultsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Search size={20} className="text-indigo-500" />
                Search Results ({searchResults.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsSearchResultsModalOpen(false);
                  setSearchQuery({ itemName: '', category: '', minPrice: '', maxPrice: '' });
                }}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Stock</th>
                        <th className="px-4 py-3 font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {searchResults.map((item, idx) => (
                        <tr
                          key={item.item_id || item.id || idx}
                          onClick={() => {
                            const added = onAddToCart(item);
                            setIsSearchResultsModalOpen(false);
                            setSearchQuery({ itemName: '', category: '', minPrice: '', maxPrice: '' });
                            if (added === false) {
                              showToast('error', `${item.item_name} is already in the cart!`);
                            }
                          }}
                          className="hover:bg-indigo-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-semibold text-gray-800">{item.item_name || item.name}</td>
                          <td className="px-4 py-3 text-gray-500">{item.category_name}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {item.total_quantity_in_stock} {item.unit_name || 'units'} left
                          </td>
                          <td className="px-4 py-3 font-bold text-indigo-600">₦{Number(item.unit_selling_price || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <Package size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No products found matching your search.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsSearchResultsModalOpen(false);
                  setSearchQuery({ itemName: '', category: '', minPrice: '', maxPrice: '' });
                }}
                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductSearch;
