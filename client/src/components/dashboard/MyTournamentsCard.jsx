import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Calendar,
  CheckCircle2,
  Crown,
  ChevronRight,
  PlusCircle,
  ArrowRight,
  Shield,
  Clock,
} from 'lucide-react';
import { formatTimeControl, formatDate } from '../../utils/formatters';
import { FORMAT_LABELS } from '../../utils/constants';

/**
 * MyTournamentsCard — Displays the user's tournament statistics and categorized lists:
 *
 * MY TOURNAMENTS
 * 🏆 Active   📅 Upcoming   ✓ Completed   👑 Hosted
 */
const MyTournamentsCard = ({ myTournaments = {} }) => {
  const {
    activeCount = 0,
    upcomingCount = 0,
    completedCount = 0,
    hostedCount = 0,
    active = [],
    upcoming = [],
    completed = [],
    hosted = [],
  } = myTournaments;

  // Set default tab: active if any exist, otherwise upcoming, completed, or hosted
  const [activeTab, setActiveTab] = useState(
    activeCount > 0
      ? 'active'
      : upcomingCount > 0
      ? 'upcoming'
      : hostedCount > 0
      ? 'hosted'
      : 'completed'
  );

  const currentList =
    activeTab === 'active'
      ? active
      : activeTab === 'upcoming'
      ? upcoming
      : activeTab === 'hosted'
      ? hosted
      : completed;

  return (
    <div
      id="my-tournaments-card"
      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md p-5 sm:p-6 space-y-5 transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            MY TOURNAMENTS
          </h3>
        </div>
        <Link
          to="/tournaments?view=my"
          id="view-all-my-tournaments-btn"
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center space-x-1"
        >
          <span>View All</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* 4 Metric Pills: Active, Upcoming, Completed, Hosted */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {/* Active Pill */}
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          id="tab-active-tournaments"
          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-amber-500/10 border-amber-500/50 dark:bg-amber-950/40 dark:border-amber-500/50 shadow-xs ring-1 ring-amber-500/40'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-center space-x-1 text-amber-500 font-bold text-xs sm:text-sm">
            <span className="text-sm">🏆</span>
            <span className="font-mono">{activeCount}</span>
          </div>
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5 uppercase tracking-wide">
            Active
          </div>
        </button>

        {/* Upcoming Pill */}
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          id="tab-upcoming-tournaments"
          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
            activeTab === 'upcoming'
              ? 'bg-indigo-500/10 border-indigo-500/50 dark:bg-indigo-950/40 dark:border-indigo-500/50 shadow-xs ring-1 ring-indigo-500/40'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-center space-x-1 text-indigo-600 dark:text-indigo-400 font-bold text-xs sm:text-sm">
            <span className="text-sm">📅</span>
            <span className="font-mono">{upcomingCount}</span>
          </div>
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5 uppercase tracking-wide">
            Upcoming
          </div>
        </button>

        {/* Completed Pill */}
        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          id="tab-completed-tournaments"
          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-emerald-500/10 border-emerald-500/50 dark:bg-emerald-950/40 dark:border-emerald-500/50 shadow-xs ring-1 ring-emerald-500/40'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm">
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">✓</span>
            <span className="font-mono">{completedCount}</span>
          </div>
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5 uppercase tracking-wide">
            Completed
          </div>
        </button>

        {/* Hosted Pill */}
        <button
          type="button"
          onClick={() => setActiveTab('hosted')}
          id="tab-hosted-tournaments"
          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
            activeTab === 'hosted'
              ? 'bg-purple-500/10 border-purple-500/50 dark:bg-purple-950/40 dark:border-purple-500/50 shadow-xs ring-1 ring-purple-500/40'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-center space-x-1 text-purple-600 dark:text-purple-400 font-bold text-xs sm:text-sm">
            <Crown className="h-3.5 w-3.5 text-purple-500" />
            <span className="font-mono">{hostedCount}</span>
          </div>
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5 uppercase tracking-wide">
            Hosted
          </div>
        </button>
      </div>

      {/* Selected Category Tournament List */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
          <span>
            {activeTab === 'active'
              ? 'Active Tournaments'
              : activeTab === 'upcoming'
              ? 'Upcoming Tournaments'
              : activeTab === 'hosted'
              ? 'Hosted Tournaments'
              : 'Completed Tournaments'}
          </span>
          <span className="font-mono text-[11px]">
            {currentList.length} shown
          </span>
        </div>

        {currentList.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-850/50 overflow-hidden">
            {currentList.map((t) => (
              <Link
                key={t._id}
                to={`/tournaments/${t._id}`}
                className="p-3 flex items-center justify-between hover:bg-white dark:hover:bg-slate-800 transition group cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    {t.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-2 mt-0.5">
                    <span>{FORMAT_LABELS[t.format] || t.format}</span>
                    {t.clockLimit && (
                      <span>&bull; {formatTimeControl(t.clockLimit, t.increment)}</span>
                    )}
                    {t.isHost && (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px]">
                        Host
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                  <span>Enter</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-5 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <div>No tournaments in this category yet.</div>
            <Link
              to="/tournaments/create"
              className="inline-flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Create a tournament</span>
            </Link>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <Link
          to="/tournaments/create"
          className="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold transition"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Tournament</span>
        </Link>
        <Link
          to="/tournaments"
          className="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold transition"
        >
          <span>Explore All Tournaments</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default MyTournamentsCard;
