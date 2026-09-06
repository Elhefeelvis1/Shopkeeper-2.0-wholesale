import React from 'react';
import { format } from 'date-fns';

const DateRangeFilter = ({ startDate, setStartDate, endDate, setEndDate }) => {
  const formatForInput = (d) => {
    if (!d) return '';
    if (d instanceof Date && !isNaN(d.getTime())) {
      return format(d, 'yyyy-MM-dd');
    }
    return String(d).split('T')[0];
  };

  return (
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 bg-white p-2 rounded-xl shadow-sm border border-gray-100 w-full sm:w-auto">
      <div className="flex items-center gap-2 flex-1 sm:flex-initial">
        <label className="text-sm font-medium text-gray-600 pl-1 sm:pl-2 shrink-0">From:</label>
        <input 
          type="date"
          value={formatForInput(startDate)}
          onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : new Date())}
          className="text-sm px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-700 w-full sm:w-36"
        />
      </div>
      <div className="flex items-center gap-2 flex-1 sm:flex-initial pr-0 sm:pr-2">
        <label className="text-sm font-medium text-gray-600 shrink-0">To:</label>
        <input 
          type="date"
          value={formatForInput(endDate)}
          onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : new Date())}
          className="text-sm px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-700 w-full sm:w-36"
        />
      </div>
    </div>
  );
};

export default DateRangeFilter;
