import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Trophy,
  Users,
  Calendar,
  Clock,
  ExternalLink,
  Ban,
  CheckCircle2,
  Swords,
  Layers,
  Crown,
  User as UserIcon,
} from 'lucide-react';

/**
 * Formats ISO date string to a human-readable format.
 */
const formatDate = (dateString) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/**
 * Returns color classes for status badges.
 */
const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'RUNNING':
    case 'IN_PROGRESS':
    case 'ACTIVE':
      return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'COUNTDOWN':
    case 'READY_CHECK':
      return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'FINISHED':
    case 'COMPLETED':
      return 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    case 'CANCELLED':
      return 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'REGISTRATION':
    case 'DRAFT':
    default:
      return 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
  }
};

/**
 * AdminTournamentDetailsModal — Comprehensive inspection modal for administrators.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object|null} props.tournament - Detailed tournament object
 * @param {Function} props.onCancelClick - Callback to initiate cancellation
 */
const AdminTournamentDetailsModal = ({
  isOpen,
  onClose,
  tournament,
  onCancelClick,
}) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'participants', 'rounds'

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !tournament) return null;

  const canCancel =
    tournament.status !== 'FINISHED' &&
    tournament.status !== 'COMPLETED' &&
    tournament.status !== 'CANCELLED';

  const participants = tournament.participants || [];
  const rounds = tournament.rounds || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-details-title"
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-5 transition-colors my-8 max-h-[90vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(
                  tournament.status
                )}`}
              >
                {tournament.status}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {tournament.format?.replace('_', ' ')}
              </span>
              {tournament.rated && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  Rated
                </span>
              )}
            </div>

            <h3
              id="tournament-details-title"
              className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate"
            >
              {tournament.name}
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono select-all">
              ID: {tournament.id}
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Link
              to={`/tournaments/${tournament.id}`}
              target="_blank"
              rel="noopener noreferrer"
              id="view-public-tournament-btn"
              title="Open public tournament page in new tab"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={onClose}
              id="close-tournament-modal-btn"
              title="Close modal"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-px">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'overview'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Overview
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('participants')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'participants'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>Participants</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
              {participants.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rounds')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'rounds'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>Rounds & Pairings</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
              {rounds.length}
            </span>
          </button>
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Creator Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {tournament.creator?.avatar ? (
                    <img
                      src={tournament.creator.avatar}
                      alt={tournament.creator.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {tournament.creator?.name ? tournament.creator.name.charAt(0).toUpperCase() : 'H'}
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                      Tournament Host
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {tournament.creator?.name || 'Tournament Host'}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {tournament.creator?.email}
                      {tournament.creator?.lichessUsername && ` • @${tournament.creator.lichessUsername}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tournament Config Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    Time Control
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {Math.floor(tournament.clockLimit / 60)}+{tournament.increment} min
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    Players Capacity
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {tournament.participantCount} / {tournament.maxPlayers || 'Unlimited'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    Rounds
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {tournament.currentRound ? `Round ${tournament.currentRound}` : 'Not started'}{' '}
                    {tournament.totalRounds ? `of ${tournament.totalRounds}` : ''}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    Created
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatDate(tournament.createdAt)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    Last Updated
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatDate(tournament.updatedAt)}
                  </p>
                </div>

                {tournament.winner && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 space-y-1">
                    <span className="text-amber-600 dark:text-amber-400 text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1">
                      <Crown className="h-3 w-3" />
                      <span>Winner</span>
                    </span>
                    <p className="font-bold text-amber-800 dark:text-amber-300">
                      {tournament.winner.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              {tournament.description && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    Description
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 italic">
                    &quot;{tournament.description}&quot;
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB: PARTICIPANTS */}
          {activeTab === 'participants' && (
            <div className="space-y-2">
              {participants.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <Users className="h-8 w-8 mx-auto stroke-1 mb-2 text-slate-400" />
                  <p className="font-semibold">No participants registered yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {participants.map((p, idx) => (
                    <div
                      key={p.id}
                      className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="text-slate-400 dark:text-slate-500 font-bold w-5 text-center">
                          #{idx + 1}
                        </span>
                        {p.avatar ? (
                          <img
                            src={p.avatar}
                            alt={p.name}
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {p.name ? p.name.charAt(0).toUpperCase() : 'P'}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {p.email}
                            {p.lichessUsername && ` • @${p.lichessUsername}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-right">
                        <div>
                          <span className="font-black text-slate-900 dark:text-white text-sm">
                            {p.score} pts
                          </span>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {p.isReady ? 'Ready' : 'Not Ready'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: ROUNDS & PAIRINGS */}
          {activeTab === 'rounds' && (
            <div className="space-y-3">
              {rounds.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <Swords className="h-8 w-8 mx-auto stroke-1 mb-2 text-slate-400" />
                  <p className="font-semibold">No rounds created yet</p>
                  <p className="text-[11px] text-slate-400">
                    Rounds and matchups will appear once the tournament starts.
                  </p>
                </div>
              ) : (
                rounds.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-900 dark:text-white">
                        Round {r.roundNumber}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          r.status === 'RUNNING'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : r.status === 'COMPLETED'
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    {r.pairings?.length > 0 ? (
                      <div className="space-y-1.5">
                        {r.pairings.map((pair) => (
                          <div
                            key={pair.id}
                            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {pair.whitePlayer?.name || 'White'}
                              </span>
                              <span className="text-slate-400">vs</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {pair.blackPlayer?.name || 'Black'}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {pair.result || 'Pending'}
                              </span>
                              {pair.lichessGameUrl && (
                                <a
                                  href={pair.lichessGameUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center space-x-0.5"
                                >
                                  <span>Game</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No pairings in this round.</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[42px]"
          >
            Close
          </button>

          {canCancel && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCancelClick(tournament);
              }}
              id="details-cancel-tournament-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition cursor-pointer min-h-[42px]"
            >
              <Ban className="h-4 w-4" />
              <span>Cancel Tournament</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTournamentDetailsModal;
