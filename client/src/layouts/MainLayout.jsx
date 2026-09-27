import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Trophy, PlusCircle, LogIn, List, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { checkApiHealth } from '../services/healthService';

const MainLayout = () => {
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking', // 'connected', 'error', 'checking'
    message: 'Checking API health...'
  });

  const verifyHealth = async () => {
    setBackendHealth({ status: 'checking', message: 'Checking API health...' });
    try {
      const data = await checkApiHealth();
      if (data && data.success) {
        setBackendHealth({
          status: 'connected',
          message: data.message || 'API Connected'
        });
      } else {
        setBackendHealth({
          status: 'error',
          message: 'API returned unexpected response'
        });
      }
    } catch (err) {
      setBackendHealth({
        status: 'error',
        message: err.message || 'Cannot reach API server'
      });
    }
  };

  useEffect(() => {
    document.title = 'CHESS JEENO';
    verifyHealth();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <Link to="/" className="flex items-center space-x-2 font-bold text-xl text-indigo-600 hover:text-indigo-700">
                <Trophy className="h-6 w-6 text-amber-500" />
                <span>CHESS JEENO</span>
              </Link>
            </div>

            {/* Nav Links */}
            <nav className="flex items-center space-x-1 sm:space-x-4">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                Home
              </NavLink>

              <NavLink
                to="/tournaments"
                end
                className={({ isActive }) =>
                  `flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                <List className="h-4 w-4" />
                <span>Tournaments</span>
              </NavLink>

              <NavLink
                to="/tournaments/create"
                className={({ isActive }) =>
                  `flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create</span>
              </NavLink>

              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                <LogIn className="h-4 w-4" />
                <span>Login</span>
              </NavLink>
            </nav>

            {/* Backend Health Badge */}
            <div className="hidden md:flex items-center space-x-2">
              <button
                onClick={verifyHealth}
                title="Click to re-check API health"
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition ${
                  backendHealth.status === 'connected'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : backendHealth.status === 'error'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
              >
                {backendHealth.status === 'connected' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : backendHealth.status === 'error' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                ) : (
                  <Activity className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                )}
                <span>
                  {backendHealth.status === 'connected'
                    ? 'API Online'
                    : backendHealth.status === 'error'
                    ? 'API Offline'
                    : 'Checking API'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet context={{ backendHealth, verifyHealth }} />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p>CHESS JEENO &bull; Foundation Layer</p>
      </footer>
    </div>
  );
};

export default MainLayout;
