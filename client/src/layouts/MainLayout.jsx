import React, { useState, useEffect, useRef } from 'react';
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
  Shield,
  Users,
  BarChart3,
  Info,
  HelpCircle,
  FileQuestion,
  Mail,
  ChevronDown,
  LayoutDashboard,
} from 'lucide-react';
import { checkApiHealth } from '../services/healthService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Footer from '../components/Footer';

const MainLayout = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
  const adminDropdownRef = useRef(null);
  const moreDropdownRef = useRef(null);

  const [backendHealth, setBackendHealth] = useState({
    status: 'checking', // 'connected', 'error', 'checking'
    message: 'Checking API health...',
  });

  // Determine active route state for dropdown triggers
  const isAdminActive = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const isMoreActive = ['/about', '/help', '/faq', '/contact'].some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
  );

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

  // Close all menus on route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsAdminDropdownOpen(false);
    setIsMoreDropdownOpen(false);
  }, [location.pathname]);

  // Handle click outside and Escape key for dropdown menus and mobile drawer
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(e.target)) {
        setIsAdminDropdownOpen(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(e.target)) {
        setIsMoreDropdownOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsAdminDropdownOpen(false);
        setIsMoreDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-150">
      {/* Navigation Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              <Link
                to="/"
                className="flex items-center space-x-2 font-bold text-base sm:text-lg lg:text-xl text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
              >
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 shrink-0" />
                <span>CHESS JEENO</span>
              </Link>
            </div>

            {/* Desktop / Tablet Nav Links (hidden on mobile < 768px, compact on tablet 768-1199px, full on 1200px+) */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5 flex-nowrap whitespace-nowrap min-w-0">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-2.5 lg:px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                Home
              </NavLink>

              {/* Dashboard: top-level on large desktop (1200px+), accessible in More dropdown on tablet (768-1199px) */}
              {isAuthenticated && (
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `hidden xl:inline-flex items-center px-2.5 lg:px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  Dashboard
                </NavLink>
              )}

              <NavLink
                to="/tournaments"
                end
                className={({ isActive }) =>
                  `flex items-center space-x-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <List className="h-4 w-4 shrink-0" />
                <span>Tournaments</span>
              </NavLink>

              <NavLink
                to="/tournaments/create"
                className={({ isActive }) =>
                  `flex items-center space-x-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span>Create</span>
              </NavLink>

              {/* Platform Admin Dropdown Menu (Visible only to authenticated ADMINs) */}
              {isAuthenticated && user?.role === 'ADMIN' && (
                <div className="relative" ref={adminDropdownRef}>
                  <button
                    type="button"
                    id="admin-dropdown-trigger"
                    aria-haspopup="true"
                    aria-expanded={isAdminDropdownOpen}
                    aria-controls="admin-dropdown-menu"
                    onClick={() => {
                      setIsAdminDropdownOpen((prev) => !prev);
                      setIsMoreDropdownOpen(false);
                    }}
                    className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer select-none ${
                      isAdminActive
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold ring-1 ring-amber-300/70 dark:ring-amber-800/80'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Shield className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>Admin</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-150 shrink-0 ${
                        isAdminDropdownOpen ? 'rotate-180 text-amber-600 dark:text-amber-400' : 'text-slate-400'
                      }`}
                    />
                  </button>

                  {isAdminDropdownOpen && (
                    <div
                      id="admin-dropdown-menu"
                      role="menu"
                      aria-label="Admin Navigation"
                      className="absolute left-0 mt-1.5 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1 z-50 space-y-0.5"
                    >
                      <NavLink
                        to="/admin"
                        end
                        id="admin-nav-link-desktop"
                        role="menuitem"
                        onClick={() => setIsAdminDropdownOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`
                        }
                      >
                        <Shield className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>Overview</span>
                      </NavLink>

                      <NavLink
                        to="/admin/users"
                        id="admin-users-nav-link-desktop"
                        role="menuitem"
                        onClick={() => setIsAdminDropdownOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`
                        }
                      >
                        <Users className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>Users</span>
                      </NavLink>

                      <NavLink
                        to="/admin/tournaments"
                        id="admin-tournaments-nav-link-desktop"
                        role="menuitem"
                        onClick={() => setIsAdminDropdownOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`
                        }
                      >
                        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>Tournaments</span>
                      </NavLink>

                      <NavLink
                        to="/admin/analytics"
                        id="admin-analytics-nav-link-desktop"
                        role="menuitem"
                        onClick={() => setIsAdminDropdownOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`
                        }
                      >
                        <BarChart3 className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>Analytics</span>
                      </NavLink>
                    </div>
                  )}
                </div>
              )}

              {/* Public Informational Dropdown Menu (More) */}
              <div className="relative" ref={moreDropdownRef}>
                <button
                  type="button"
                  id="more-dropdown-trigger"
                  aria-haspopup="true"
                  aria-expanded={isMoreDropdownOpen}
                  aria-controls="more-dropdown-menu"
                  onClick={() => {
                    setIsMoreDropdownOpen((prev) => !prev);
                    setIsAdminDropdownOpen(false);
                  }}
                  className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer select-none ${
                    isMoreActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-200 dark:ring-indigo-800/80'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>More</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-150 shrink-0 ${
                      isMoreDropdownOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                    }`}
                  />
                </button>

                {isMoreDropdownOpen && (
                  <div
                    id="more-dropdown-menu"
                    role="menu"
                    aria-label="More Navigation"
                    className="absolute left-0 mt-1.5 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1 z-50 space-y-0.5"
                  >
                    {/* Tablet/Small-Desktop Dashboard access (< 1200px) */}
                    {isAuthenticated && (
                      <NavLink
                        to="/dashboard"
                        id="more-dashboard-nav-link-tablet"
                        role="menuitem"
                        onClick={() => setIsMoreDropdownOpen(false)}
                        className={({ isActive }) =>
                          `xl:hidden flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`
                        }
                      >
                        <LayoutDashboard className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span>Dashboard</span>
                      </NavLink>
                    )}

                    <NavLink
                      to="/about"
                      id="more-about-nav-link-desktop"
                      role="menuitem"
                      onClick={() => setIsMoreDropdownOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`
                      }
                    >
                      <Info className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span>About</span>
                    </NavLink>

                    <NavLink
                      to="/help"
                      id="more-help-nav-link-desktop"
                      role="menuitem"
                      onClick={() => setIsMoreDropdownOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`
                      }
                    >
                      <HelpCircle className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span>Help & How It Works</span>
                    </NavLink>

                    <NavLink
                      to="/faq"
                      id="more-faq-nav-link-desktop"
                      role="menuitem"
                      onClick={() => setIsMoreDropdownOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`
                      }
                    >
                      <FileQuestion className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span>FAQ</span>
                    </NavLink>

                    <NavLink
                      to="/contact"
                      id="more-contact-nav-link-desktop"
                      role="menuitem"
                      onClick={() => setIsMoreDropdownOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`
                      }
                    >
                      <Mail className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span>Contact</span>
                    </NavLink>
                  </div>
                )}
              </div>

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
                    <span className="max-w-[70px] lg:max-w-[120px] truncate">{user.name}</span>
                  </Link>

                  <button
                    onClick={logout}
                    id="logout-button"
                    title="Log Out"
                    aria-label="Log Out"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span className="hidden xl:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-1 sm:space-x-1.5 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0">
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

            {/* Backend Health Badge (desktop only, shown on xl screens to maintain clean spacing) */}
            <div className="hidden xl:flex items-center space-x-2 shrink-0">
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

            {isAuthenticated && (
              <NavLink
                to="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <span>Dashboard</span>
              </NavLink>
            )}

            {/* Platform Admin Links (Visible only to authenticated ADMINs) */}
            {isAuthenticated && user?.role === 'ADMIN' && (
              <>
                <NavLink
                  to="/admin"
                  end
                  id="admin-nav-link-mobile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Shield className="h-4 w-4 text-amber-500" />
                  <span>Admin Dashboard</span>
                </NavLink>

                <NavLink
                  to="/admin/users"
                  id="admin-users-nav-link-mobile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Users className="h-4 w-4 text-amber-500" />
                  <span>User Management</span>
                </NavLink>

                <NavLink
                  to="/admin/tournaments"
                  id="admin-tournaments-nav-link-mobile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span>Tournament Management</span>
                </NavLink>

                <NavLink
                  to="/admin/analytics"
                  id="admin-analytics-nav-link-mobile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <BarChart3 className="h-4 w-4 text-amber-500" />
                  <span>Platform Analytics</span>
                </NavLink>
              </>
            )}

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

            <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <NavLink
                to="/about"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Info className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>About</span>
              </NavLink>

              <NavLink
                to="/help"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <HelpCircle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>Help & How It Works</span>
              </NavLink>

              <NavLink
                to="/faq"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <FileQuestion className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>FAQ</span>
              </NavLink>

              <NavLink
                to="/contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Mail className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>Contact</span>
              </NavLink>
            </div>

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
      <Footer />
    </div>
  );
};

export default MainLayout;
