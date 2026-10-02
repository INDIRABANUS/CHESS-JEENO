import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Trophy,
  PlusCircle,
  LogIn,
  UserPlus,
  LogOut,
  List,
  Activity,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { checkApiHealth } from '../services/healthService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const MainLayout = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking', // 'connected', 'error', 'checking'
    message: 'Checking API health...',
  });

  const verifyHealth = async () => {
    setBackendHealth({ status: 'checking', message: 'Checking API health...' });
    try {
      const data = await checkApiHealth();
      if (data && data.success) {
        setBackendHealth({
          status: 'connected',
          message: data.message || 'API Connected',
        });
      } else {
        setBackendHealth({
          status: 'error',
          message: 'API returned unexpected response',
        });
      }
    } catch (err) {
      setBackendHealth({
        status: 'error',
        message: err.message || 'Cannot reach API server',
      });
    }
  };

  useEffect(() => {
    document.title = 'CHESS JEENO';
    verifyHealth();
  }, []);

  // Close mobile menu on route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-150">
      {/* Navigation Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <Link
                to="/"
                className="flex items-center space-x-2 font-bold text-lg sm:text-xl text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
              >
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
                <span>CHESS JEENO</span>
              </Link>
            </div>

            {/* Desktop Nav Links (hidden on mobile, visible on md and up) */}
            <nav className="hidden md:flex items-center space-x-1 sm:space-x-2">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                Home
              </NavLink>

              <NavLink
                to="/tournaments"
                end
                className={({ isActive }) =>
                  `flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <List className="h-4 w-4" />
                <span>Tournaments</span>
              </NavLink>

              <NavLink
                to="/tournaments/create"
                className={({ isActive }) =>
                  `flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create</span>
              </NavLink>

              {/* Theme Toggle (Desktop) */}
              <button
                type="button"
                onClick={toggleTheme}
                id="theme-toggle-desktop"
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-600" />
                )}
              </button>

              {/* Authentication Status Area */}
              {isAuthenticated && user ? (
                <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <Link
                    to="/profile"
                    id="user-profile-badge"
                    className="flex items-center space-x-2 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 font-medium transition cursor-pointer"
                    title={`View profile (${user.email})`}
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name || 'User avatar'}
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-3 w-3" />}
                      </div>
                    )}
                    <span className="max-w-[120px] truncate">{user.name}</span>
                  </Link>

                  <button
                    onClick={logout}
                    id="logout-button"
                    title="Log Out"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <NavLink
                    to="/login"
                    className={({ isActive }) =>
                      `flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Login</span>
                  </NavLink>

                  <NavLink
                    to="/register"
                    className={({ isActive }) =>
                      `flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                      }`
                    }
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Register</span>
                  </NavLink>
                </div>
              )}
            </nav>

            {/* Mobile Header Actions (Theme Toggle + Menu Button) */}
            <div className="flex items-center space-x-1.5 md:hidden">
              <button
                type="button"
                onClick={toggleTheme}
                id="theme-toggle-mobile-header"
                className="inline-flex items-center justify-center p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer min-h-[44px] min-w-[44px]"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <Sun className="h-5 w-5 text-amber-400" />
                ) : (
                  <Moon className="h-5 w-5 text-slate-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="inline-flex items-center justify-center p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer min-h-[44px] min-w-[44px]"
                aria-controls="mobile-navigation-menu"
                aria-expanded={isMobileMenuOpen}
                aria-label={isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6 text-slate-700 dark:text-slate-200" />
                ) : (
                  <Menu className="h-6 w-6 text-slate-700 dark:text-slate-200" />
                )}
              </button>
            </div>

            {/* Backend Health Badge (desktop only) */}
            <div className="hidden lg:flex items-center space-x-2">
              <button
                onClick={verifyHealth}
                title="Click to re-check API health"
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition ${
                  backendHealth.status === 'connected'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                    : backendHealth.status === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                }`}
              >
                {backendHealth.status === 'connected' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : backendHealth.status === 'error' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                ) : (
                  <Activity className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
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

        {/* Mobile Navigation Dropdown Menu */}
        {isMobileMenuOpen && (
          <div
            id="mobile-navigation-menu"
            className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-3 pb-4 space-y-1 shadow-lg"
          >
            <NavLink
              to="/"
              end
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <span>Home</span>
            </NavLink>

            <NavLink
              to="/tournaments"
              end
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <List className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Tournaments</span>
            </NavLink>

            <NavLink
              to="/tournaments/create"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <PlusCircle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Create Tournament</span>
            </NavLink>

            {/* Mobile Theme Toggle Item */}
            <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={toggleTheme}
                id="theme-toggle-mobile-drawer"
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px]"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <div className="flex items-center space-x-2.5">
                  {isDark ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  )}
                  <span>Appearance</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold capitalize border border-slate-200 dark:border-slate-700">
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </span>
              </button>
            </div>

            {/* Mobile Authentication Area */}
            {isAuthenticated && user ? (
              <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 font-medium transition cursor-pointer"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name || 'User avatar'}
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-3.5 w-3.5" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate text-sm">
                      {user.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition text-left cursor-pointer min-h-[44px]"
                >
                  <LogOut className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                  <span>Log Out</span>
                </button>
              </div>
            ) : (
              <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                <NavLink
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border min-h-[44px] ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`
                  }
                >
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </NavLink>

                <NavLink
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      isActive
                        ? 'bg-indigo-700 text-white font-semibold'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`
                  }
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Register</span>
                </NavLink>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet context={{ backendHealth, verifyHealth }} />
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-sm sm:text-xs text-slate-500 dark:text-slate-400">
        <p>CHESS JEENO &bull; Foundation Layer</p>
      </footer>
    </div>
  );
};

export default MainLayout;
