import React, { useState } from 'react';
import { Search, Package, Boxes } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { searchLocalWholesaleProducts } from '../db/dexieDb';

const WholesaleProductSearch = ({ categories, onAddToCart }) => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState({ itemName: '', category: '', minPrice: '', maxPrice: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchResultsModalOpen, setIsSearchResultsModalOpen] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    try {
      const results = await searchLocalWholesaleProducts(searchQuery);
      setSearchResults(results || []);
      setIsSearchResultsModalOpen(true);
    } catch (err) {
      console.error('Local wholesale product search error:', err);
      setSearchResults([]);
      showToast('error', 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-amber-200/70 p-4 sm:p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h2 className="text-lg font-bold text-amber-950 flex items-center gap-2">
              <Boxes size={22} className="text-amber-600" /> Wholesale Product Search
            </h2>
            <select
              className="text-sm w-full sm:w-auto h-9 px-4 bg-amber-50/40 border border-amber-200 rounded-xl focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-slate-700 font-medium"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              placeholder="Search wholesale product name or barcode..."
              className="w-full px-4 h-10 bg-amber-50/30 border border-amber-200 rounded-xl focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 text-sm font-medium"
              value={searchQuery.itemName}
              onChange={(e) => setSearchQuery({ ...searchQuery, itemName: e.target.value })}
            />
            <button
              type="submit"
              disabled={isSearching}
              className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold py-2 rounded-xl transition shadow-md shadow-amber-200/50 disabled:opacity-70 cursor-pointer text-sm"
            >
              {isSearching ? 'Searching...' : 'Search Wholesale Items'}
            </button>
          </div>
        </form>
      </div>

      {isSearchResultsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-amber-100">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
              <h3 className="text-base sm:text-xl font-bold text-amber-950 flex items-center gap-2">
                <Boxes size={22} className="text-amber-600" />
                Wholesale Search Results ({searchResults.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsSearchResultsModalOpen(false);
                  setSearchQuery({ itemName: '', category: '', minPrice: '', maxPrice: '' });
                }}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer text-2xl font-bold leading-none p-1"
              >
                &times;
              </button>
            </div>

            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold">Packaging Unit</th>
                        <th className="px-4 py-3 font-semibold text-right">Available Stock</th>
                        <th className="px-4 py-3 font-semibold text-right">Wholesale Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {searchResults.map((item, idx) => {
                        const wsUnit = item.wholesale_unit || 'Pack';
                        const multiplier = Number(item.wholesale_multiplier || 1);
                        const wsPrice = Number(item.wholesale_price || item.unit_selling_price || 0);
                        const stockUnits = Number(item.total_quantity_in_stock || 0);
                        const maxPacks = multiplier > 0 ? Math.floor(stockUnits / multiplier) : stockUnits;

                        return (
                          <tr
                            key={item.item_id || item.id || idx}
                            onClick={() => {
                              const added = onAddToCart(item);
                              setIsSearchResultsModalOpen(false);
                              setSearchQuery({ itemName: '', category: '', minPrice: '', maxPrice: '' });
                              if (added === false) {
                                showToast('error', `${item.item_name} is already in the wholesale cart!`);
                              }
                            }}
                            className="hover:bg-amber-50/80 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{item.item_name || item.name}</div>
                              <div className="text-xs text-slate-500">{item.category_name}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 font-medium bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200/80 text-xs">
                                1 {wsUnit} = {multiplier} {item.unit_name || 'units'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="font-semibold text-slate-800">{stockUnits} {item.unit_name || 'units'}</div>
                              <div className="text-[11px] text-amber-700 font-medium">({maxPacks} {wsUnit}{maxPacks === 1 ? '' : 's'})</div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-amber-700">
                              ₦{wsPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              <span className="text-[11px] font-normal text-slate-500 block">per {wsUnit}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Package size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No wholesale products found matching your search.</p>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsSearchResultsModalOpen(false);
                  setSearchQuery({ itemName: '', category: '', minPrice: '', maxPrice: '' });
                }}
                className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-xl transition shadow-xs cursor-pointer text-sm"
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

export default WholesaleProductSearch;
