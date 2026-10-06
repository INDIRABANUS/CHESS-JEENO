import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ExternalLink, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Footer = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Info (2 columns wide on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <Link
              to="/"
              className="inline-flex items-center space-x-2 font-bold text-lg text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
            >
              <Trophy className="h-6 w-6 text-amber-500" />
              <span className="tracking-tight text-slate-900 dark:text-white font-extrabold">CHESS JEENO</span>
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
              A tournament operations platform built around Lichess for organizing, managing, and competing in chess events.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Lichess is the chess engine; CHESS JEENO is the tournament experience.
            </p>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Product
            </h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/tournaments"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                >
                  Tournaments
                </Link>
              </li>
              <li>
                <Link
                  to="/help"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                >
                  Help & How It Works
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Project Links */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Project
            </h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/about"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                >
                  Contact
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/INDIRABANUS/CHESS-JEENO"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                >
                  <span>GitHub</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            </ul>
          </div>

          {/* Account Contextual Links */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Account
            </h2>
            <ul className="space-y-2 text-sm">
              {isAuthenticated ? (
                <>
                  <li>
                    <Link
                      to="/dashboard"
                      className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/profile"
                      className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                    >
                      Profile
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/tournaments/create"
                      className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                    >
                      Create Tournament
                    </Link>
                  </li>
                  {user?.role === 'ADMIN' && (
                    <li>
                      <Link
                        to="/admin"
                        className="inline-flex items-center space-x-1 text-amber-600 dark:text-amber-400 hover:underline font-medium transition"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        <span>Admin Console</span>
                      </Link>
                    </li>
                  )}
                </>
              ) : (
                <>
                  <li>
                    <Link
                      to="/login"
                      className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                    >
                      Sign In
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/register"
                      className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                    >
                      Register
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>© 2026 CHESS JEENO</p>
          <p className="text-center sm:text-right">
            Independent chess tournament management platform powered by Lichess.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
