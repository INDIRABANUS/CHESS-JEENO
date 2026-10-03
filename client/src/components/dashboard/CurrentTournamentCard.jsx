import React from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Swords,
  ExternalLink,
  Clock,
  ArrowRight,
  Shield,
  Play,
  CheckCircle2,
  Hourglass,
  Calendar,
} from 'lucide-react';
import { formatTimeControl } from '../../utils/formatters';
import { FORMAT_LABELS } from '../../utils/constants';

/**
 * CurrentTournamentCard — The primary hero card of the CHESS JEENO Player Dashboard.
 * Faithfully renders authenticated real tournament data:
 * ┌─────────────────────────────────────┐
 * │ CURRENT TOURNAMENT                  │
 * │                                     │
 * │ Sunday Blitz Championship           │
 * │ Round 3                             │
 * │                                     │
 * │ Your Score       2.0 / 3            │
 * │ Current Rank     #4                  │
 * │                                     │
 * │ ───────────────────────────────      │
 * │                                     │
 * │ NEXT MATCH                           │
 * │                                     │
 * │ You  ⚔  Opponent                    │
 * │                                     │
 * │ [ PLAY ON LICHESS ]                 │
 * └─────────────────────────────────────┘
 */
const CurrentTournamentCard = ({
  tournament,
  userName = 'You',
}) => {
  // Empty State when user has no active tournament
  if (!tournament) {
    return (
      <div
        id="current-tournament-empty-card"
        className="relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md p-6 sm:p-8 text-center space-y-5 transition-colors"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Trophy className="h-7 w-7 text-amber-500" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            No Active Tournament
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            You are not currently playing in an active tournament. Browse upcoming competitions or create your own to start competing!
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/tournaments"
            id="browse-tournaments-empty-btn"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-sm min-h-[44px]"
          >
            <span>Browse Tournaments</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/tournaments/create"
            id="create-tournament-empty-btn"
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition min-h-[44px]"
          >
            <span>Create Tournament</span>
          </Link>
        </div>
      </div>
    );
  }

  const {
    _id: tournamentId,
    name,
    format,
    status: tournamentStatus,
    currentRoundNumber = 1,
    totalRounds,
    stageName,
    clockLimit = 5,
    increment = 0,
    userScore = 0,
    userRank,
    totalPlayers = 0,
    nextMatch,
    isHost = false,
  } = tournament;

  const isWhite = nextMatch ? nextMatch.isWhite : true;
  const opponentName = nextMatch?.opponent?.name || 'Opponent';
  const opponentLichess = nextMatch?.opponent?.lichessUsername;
  const lichessGameUrl = nextMatch?.lichessGameUrl;
  const matchStatus = nextMatch?.status || 'PENDING';
  const isMatchFinished =
    matchStatus === 'FINISHED' ||
    ['1-0', '0-1', '1/2-1/2', 'WHITE_WIN', 'BLACK_WIN', 'DRAW'].includes(nextMatch?.result);

  // Status badge styling
  const isReadyCheck = tournamentStatus === 'READY_CHECK';
  const isCountdown = tournamentStatus === 'COUNTDOWN';
  const isUpcoming = ['REGISTRATION', 'PENDING', 'DRAFT'].includes(tournamentStatus);

  return (
    <div
      id="current-tournament-card"
      className="relative rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-500/30 dark:border-indigo-500/20 shadow-xl overflow-hidden transition-all duration-200 hover:shadow-2xl"
    >
      {/* Subtle ambient gradient accent */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner: CURRENT TOURNAMENT */}
      <div className="px-5 sm:px-7 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-2 border-b border-indigo-900/50">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isReadyCheck
                ? 'bg-amber-400 animate-ping'
                : isCountdown
                ? 'bg-indigo-400 animate-pulse'
                : isUpcoming
                ? 'bg-blue-400'
                : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-indigo-200">
            CURRENT TOURNAMENT
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {isHost && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-500/40">
              Host
            </span>
          )}
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-900/70 text-indigo-200 font-semibold border border-indigo-700/50">
            {formatTimeControl(clockLimit, increment)} &bull; {FORMAT_LABELS[format] || format}
          </span>
        </div>
      </div>

      {/* Main Card Body */}
      <div className="p-5 sm:p-7 space-y-6">
        {/* Tournament Name & Round */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div className="min-w-0 pr-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight hover:text-indigo-600 dark:hover:text-indigo-400 transition truncate">
              {tournamentId ? (
                <Link to={`/tournaments/${tournamentId}`}>{name}</Link>
              ) : (
                name
              )}
            </h2>
            <div className="flex items-center space-x-2 mt-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                {isUpcoming
                  ? 'Registration Open'
                  : isReadyCheck
                  ? 'Ready Check in Progress'
                  : isCountdown
                  ? 'Starting Shortly'
                  : stageName || `Round ${currentRoundNumber}${totalRounds ? ` of ${totalRounds}` : ''}`}
              </span>
            </div>
          </div>

          {tournamentId && (
            <Link
              to={`/tournaments/${tournamentId}`}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition shrink-0"
            >
              <span>View Bracket</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* Stats Grid: Your Score & Current Rank */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
          {/* Your Score */}
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Your Score
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                {typeof userScore === 'number' ? userScore.toFixed(1) : userScore}
              </span>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                pts
              </span>
            </div>
          </div>

          {/* Current Rank */}
          <div className="space-y-1 border-l border-slate-200 dark:border-slate-700/80 pl-4">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Current Rank
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-1">
                <Trophy className="h-5 w-5 text-amber-500 inline shrink-0" />
                <span>{userRank ? `#${userRank}` : '—'}</span>
              </span>
              {totalPlayers > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  of {totalPlayers}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─────────────────────────────── Visual Divider */}
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              NEXT MATCH
            </span>
          </div>
        </div>

        {/* NEXT MATCH Section */}
        {nextMatch ? (
          <div className="space-y-4">
            {/* Matchup Header */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/80 via-white to-amber-50/80 dark:from-indigo-950/40 dark:via-slate-850 dark:to-amber-950/20 border border-indigo-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Player You */}
              <div className="flex items-center space-x-3 text-center sm:text-left min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                    isWhite
                      ? 'bg-white dark:bg-slate-100 text-slate-900 border border-slate-300 shadow-xs'
                      : 'bg-slate-900 text-white border border-slate-700'
                  }`}
                >
                  {isWhite ? '♔ W' : '♚ B'}
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900 dark:text-slate-100 text-base truncate">
                    {userName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {isWhite ? 'White Pieces' : 'Black Pieces'}
                  </div>
                </div>
              </div>

              {/* Swords Icon */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Swords className="h-5 w-5" />
              </div>

              {/* Opponent */}
              <div className="flex items-center space-x-3 text-center sm:text-right flex-row-reverse sm:flex-row min-w-0">
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900 dark:text-slate-100 text-base truncate">
                    {opponentName}
                  </div>
                  <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                    {opponentLichess
                      ? `@${opponentLichess}`
                      : !isWhite
                      ? 'White Pieces'
                      : 'Black Pieces'}
                  </div>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                    !isWhite
                      ? 'bg-white dark:bg-slate-100 text-slate-900 border border-slate-300'
                      : 'bg-slate-900 text-white border border-slate-700'
                  }`}
                >
                  {!isWhite ? '♔ W' : '♚ B'}
                </div>
              </div>
            </div>

            {/* Match outcome banner if already finished */}
            {isMatchFinished && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                Match completed &bull; Result:{' '}
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {nextMatch.result}
                </span>
              </div>
            )}

            {/* The Action Button: [ PLAY ON LICHESS ] */}
            <div>
              {lichessGameUrl ? (
                <a
                  href={lichessGameUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="play-on-lichess-btn"
                  className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:bg-indigo-800 text-white font-extrabold text-base sm:text-lg rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center space-x-3 group tracking-wide cursor-pointer min-h-[52px]"
                >
                  <Swords className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                  <span>PLAY ON LICHESS</span>
                  <ExternalLink className="h-5 w-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              ) : tournamentId ? (
                <Link
                  to={`/tournaments/${tournamentId}`}
                  id="play-on-lichess-btn"
                  className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-extrabold text-base sm:text-lg rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center space-x-3 group tracking-wide cursor-pointer min-h-[52px]"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>ENTER TOURNAMENT ROOM</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          /* Empty match state within active tournament */
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="flex items-center justify-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
              <Hourglass className="h-4 w-4 animate-spin" />
              <span>
                {isUpcoming
                  ? 'Awaiting tournament start'
                  : 'Awaiting next round pairings'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {isUpcoming
                ? 'Players are currently registering. When the host starts the countdown, pairings will be generated.'
                : 'Your current round games are completed or pairings are being calculated by the tournament engine.'}
            </p>
            {tournamentId && (
              <Link
                to={`/tournaments/${tournamentId}`}
                className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
              >
                <span>View Tournament Details & Standings</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrentTournamentCard;
