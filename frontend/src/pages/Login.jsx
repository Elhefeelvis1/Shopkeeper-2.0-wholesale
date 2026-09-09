import { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, LogIn, Wifi, WifiOff } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { useToast } from '../context/ToastContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(UserContext);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Determine redirect destination if previously attempted (e.g. /wholesale)
  const from = location.state?.from?.pathname || location.state?.from || '/sales';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(username, password);
      if (result.success) {
        if (result.offline) {
          showToast('info', 'Logged in in offline mode.');
        } else {
          showToast('success', 'Logged in successfully!');
        }
        navigate(from === '/login' ? '/sales' : from, { replace: true });
      } else {
        setError(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <ShieldCheck
            className="text-indigo-600 animate-draw-stroke"
            size={68}
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to ShopKeeper POS
        </h2>
        <div className="mt-2 flex justify-center">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isOnline ? 'Online Ready' : 'Offline Mode Active'}
          </span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-100">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : (
                  <span className="flex items-center gap-2">
                    <LogIn size={18} /> Sign In to POS
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="mt-8 text-center">
        <p className="text-slate-500 text-xs sm:text-sm font-semibold font-mono">-- Developed By ELVIS 07049476348 / 08137328131 --</p>
      </div>
    </div>
  );
};

export default Login;
