import { useNavigate, useOutletContext } from 'react-router-dom';
import { ShoppingCart, ArrowRightLeft } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const Home = () => {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-6">
      <div className="w-full flex flex-col items-center justify-center space-y-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-12 text-center">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 mb-2 sm:mb-4 tracking-tight">
            Welcome to ShopKeeper{user ? <>, <span className="capitalize">{user.username}</span></> : ''}
          </h1>
          <p className="text-sm sm:text-lg text-gray-500">Select a portal to continue</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full justify-center items-center max-w-md sm:max-w-none">
          <button
            onClick={() => navigate('/sales')}
            className="w-full sm:w-64 flex flex-col items-center gap-4 p-6 sm:p-8 bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition group cursor-pointer"
          >
            <div className="p-4 sm:p-5 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
              <ShoppingCart size={40} className="sm:w-12 sm:h-12" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-gray-800">Sales Portal</span>
          </button>

          <button
            onClick={() => navigate('/purchases')}
            className="w-full sm:w-64 flex flex-col items-center gap-4 p-6 sm:p-8 bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg hover:border-emerald-100 transition group cursor-pointer"
          >
            <div className="p-4 sm:p-5 bg-emerald-50 text-emerald-600 rounded-full group-hover:scale-110 transition-transform">
              <ArrowRightLeft size={40} className="sm:w-12 sm:h-12" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-gray-800">Purchases Portal</span>
          </button>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-slate-500 text-xs sm:text-sm font-semibold font-mono">-- Developed By Elvis 08149476348 --</p>
      </div>
    </div>
  );
};

export default Home;
