import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Swords,
  Users,
  Clock,
  ArrowRight,
  ExternalLink,
  Shield,
  Layers,
  RotateCcw,
  GitBranch,
  CheckCircle2,
  Sparkles,
  Calendar,
  Gamepad2,
  ChevronRight,
  Loader2,
  AlertCircle,
  HelpCircle,
  PlusCircle,
  List,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTournaments } from '../services/tournamentService';
import { formatTimeControl, formatDate } from '../utils/formatters';
import { FORMAT_LABELS, STATUS_BADGES } from '../utils/constants';
import ChessHeroVisual from '../components/ChessHeroVisual';

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const createPath = isAuthenticated ? '/tournaments/create' : '/login';

  // Live tournaments state
  const [tournaments, setTournaments] = useState([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [tournamentError, setTournamentError] = useState(null);

  useEffect(() => {
    document.title = 'CHESS JEENO — Chess Tournament Platform';
  }, []);

  // Fetch real tournaments for live preview section
  useEffect(() => {
    let isMounted = true;
    const fetchLiveTournaments = async () => {
      setLoadingTournaments(true);
      setTournamentError(null);
      try {
        const response = await getTournaments({ sort: 'relevance' });
        if (isMounted) {
          const list = response?.data || [];
          setTournaments(list.slice(0, 3)); // show top 3 real tournaments
        }
      } catch (err) {
        if (isMounted) {
          setTournamentError(err.response?.data?.message || err.message || 'Unable to load tournaments');
        }
      } finally {
        if (isMounted) {
          setLoadingTournaments(false);
        }
      }
    };

    fetchLiveTournaments();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-16 sm:space-y-24 py-4 sm:py-6 transition-colors">
      {/* =========================================================================
          1. HERO SECTION
          ========================================================================= */}
      <section
        aria-labelledby="hero-heading"
        className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center"
      >
        {/* Left Column: Headline, Description & CTAs */}
        <div className="lg:col-span-7 space-y-6">
          {/* Subtle Platform Tag */}
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-xs">
            <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="tracking-wider uppercase text-[11px] font-bold">
              CHESS JEENO PLATFORM
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
              Tournament Operations
            </span>
          </div>

          {/* Main Headline */}
          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]"
          >
            Your Next Chess Match{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-500 to-amber-500 dark:from-indigo-400 dark:via-indigo-300 dark:to-amber-400">
              Starts Here.
            </span>
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl font-normal">
            Discover tournaments, organize competitions, track standings, and bring your chess community together with CHESS JEENO.
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
            <Link
              to="/tournaments"
              id="hero-explore-tournaments-cta"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-base font-semibold shadow-sm hover:shadow-md transition-all group min-h-[46px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <List className="h-4 w-4 shrink-0" />
              <span>Explore Tournaments</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>

            <Link
              to={createPath}
              id="hero-create-tournament-cta"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl text-base font-semibold shadow-xs transition-all min-h-[46px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <PlusCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Create Tournament</span>
            </Link>
          </div>

          {/* Feature Highlights Pills */}
          <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Swiss, Round Robin & Knockout</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
              <span>Real-Time Pairings & Standings</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span>Lichess Game Sync</span>
            </div>
          </div>
        </div>

        {/* Right Column: Tasteful Chess-Themed Visual */}
        <div className="lg:col-span-5 w-full">
          <ChessHeroVisual />
        </div>
      </section>

      {/* =========================================================================
          2. LIVE & UPCOMING TOURNAMENTS (Real Data Integration)
          ========================================================================= */}
      <section aria-labelledby="live-tournaments-heading" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
              <Trophy className="h-3.5 w-3.5" />
              <span>Live Platform Activity</span>
            </div>
            <h2
              id="live-tournaments-heading"
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight"
            >
              Active & Upcoming Tournaments
            </h2>
          </div>
          <Link
            to="/tournaments"
            className="inline-flex items-center space-x-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition shrink-0"
          >
            <span>View all tournaments</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Loading State */}
        {loadingTournaments && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs animate-pulse space-y-3"
              >
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-md" />
              </div>
            ))}
          </div>
        )}

        {/* Error State: Graceful handling without breaking page */}
        {!loadingTournaments && tournamentError && (
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-slate-400" />
              <span>Could not load live tournaments at this moment. You can still explore all events directly.</span>
            </div>
            <Link
              to="/tournaments"
              className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold hover:bg-indigo-100 transition"
            >
              Browse Tournaments
            </Link>
          </div>
        )}

        {/* Real Tournaments Available */}
        {!loadingTournaments && !tournamentError && tournaments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {tournaments.map((tournament) => {
              const statusBadgeClass =
                STATUS_BADGES[tournament.status] ||
                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
              const formatLabel = FORMAT_LABELS[tournament.format] || tournament.format;
              const timeControl = formatTimeControl(tournament.clockLimit, tournament.increment);
              const playerCount =
                Array.isArray(tournament.participants)
                  ? tournament.participants.length
                  : tournament.playerCount || 0;

              return (
                <div
                  key={tournament._id}
                  className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2.5">
                    {/* Status & Format row */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadgeClass}`}
                      >
                        {tournament.status}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {formatLabel}
                      </span>
                    </div>

                    {/* Tournament Title */}
                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {tournament.name}
                    </h3>

                    {/* Metadata specs */}
                    <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{timeControl}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span>{playerCount} players</span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Link */}
                  <Link
                    to={`/tournaments/${tournament._id}`}
                    className="pt-2 border-t border-slate-100 dark:border-slate-800/80 inline-flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                  >
                    <span>View Tournament Details</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State: No live tournaments currently scheduled */}
        {!loadingTournaments && !tournamentError && tournaments.length === 0 && (
          <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                No active tournaments right now
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Public tournaments organized by the community will appear here. Be the first to create one!
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <Link
                to={createPath}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Create a Tournament</span>
              </Link>
              <Link
                to="/tournaments"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <span>Browse Tournament Directory</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          3. WHAT YOU CAN DO (Real, Implemented Features)
          ========================================================================= */}
      <section aria-labelledby="what-you-can-do-heading" className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Platform Capabilities</span>
          </div>
          <h2
            id="what-you-can-do-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight"
          >
            What You Can Do on CHESS JEENO
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Real features designed to run fair, structured, and engaging chess competitions.
          </p>
        </div>

        {/* 5 Real Implemented Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1: Discover and Join */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Trophy className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  For Players
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Discover & Join Tournaments
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Find scheduled competitions across Bullet, Blitz, Rapid, and Classical time controls. Request entry, view participant rosters, and confirm check-in when registration closes.
              </p>
            </div>
            <Link
              to="/tournaments"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 pt-2"
            >
              <span>Explore Tournaments</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Feature 2: Create and Manage */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Shield className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  For Hosts
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Create & Manage Tournaments
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Configure your tournament rules, clock limits, increment, format, and round numbers. Manage participant join requests with full host approval control and progress rounds smoothly.
              </p>
            </div>
            <Link
              to={createPath}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 pt-2"
            >
              <span>Create Tournament</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Feature 3: Pairings, Results & Standings */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Operations
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Follow Pairings & Standings
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Automated pairing engines generate balanced pairings for every round. Standings calculate instantly with official Buchholz and Sonneborn-Berger tiebreak scores.
              </p>
            </div>
            <Link
              to="/tournaments"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 pt-2"
            >
              <span>View Active Events</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Feature 4: Team Competitions */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Clubs & Teams
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Organize Team Competitions
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Run multi-board competitions between clubs or groups. Register teams, manage club rosters, assign board orders, and track cumulative team match points alongside board scores.
              </p>
            </div>
            <Link
              to="/team-competitions"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 pt-2"
            >
              <span>Team Competitions</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Feature 5: Lichess Integration */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between md:col-span-2 lg:col-span-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Gamepad2 className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Live Engine
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Play on Lichess & Auto-Synchronize
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                Connect your account via official Lichess OAuth. Tournament games launch directly on Lichess so participants play on the world-class board they know, with wins, draws, resignations, and clock results syncing back automatically in real time.
              </p>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <Link
                to="/help"
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
              >
                <span>Read How Lichess Sync Works</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. TOURNAMENT FORMATS (Accurate & Beginner-Friendly)
          ========================================================================= */}
      <section aria-labelledby="tournament-formats-heading" className="space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Tournament Rules</span>
          </div>
          <h2
            id="tournament-formats-heading"
            className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight"
          >
            Supported Tournament Formats
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Choose the competitive format that best fits your player count and schedule.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Format 1: Swiss */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <GitBranch className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>Swiss</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                  Fixed Rounds
                </span>
              </h3>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Players are paired across rounds based on tournament performance.
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
              No participant is eliminated. Everyone plays all rounds, meeting opponents with matching scores as the event develops. Ideal for large groups and club tournaments.
            </p>
          </div>

          {/* Format 2: Round Robin */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <RotateCcw className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>Round Robin</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                  All vs All
                </span>
              </h3>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Participants play each other according to the tournament schedule.
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
              Every competitor plays against every other player once. Provides the most comprehensive and balanced measure of skill for small-to-medium tournaments.
            </p>
          </div>

          {/* Format 3: Knockout */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Swords className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>Knockout</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800">
                  Elimination
                </span>
              </h3>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Players advance by winning their matches.
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
              Classic single-elimination tournament bracket where each victory propels you closer to the finals. Fast-paced, high drama, and crowns an undisputed champion.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. HOW IT WORKS (Three-Step Process)
          ========================================================================= */}
      <section aria-labelledby="how-it-works-heading" className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Simple Workflow</span>
          </div>
          <h2
            id="how-it-works-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight"
          >
            How CHESS JEENO Works
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Three simple steps from initial setup to crowning the champion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Step 1 */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                01
              </span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Discovery & Setup
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Explore or Create
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Explore an upcoming tournament in the directory or create your own with custom time controls (Bullet, Blitz, Rapid, Classical) and format rules.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                02
              </span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Rosters & Approvals
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Join or Manage Participants
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Join the competition as a player with a single request, or review and approve participant rosters if you are directing the tournament.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                03
              </span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Competition & Standings
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Follow Pairings, Results & Standings
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Play matches seamlessly through Lichess integration, with round pairings, match results, tiebreaks, and standings updating in real time.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. CLOSING CTA SECTION
          ========================================================================= */}
      <section
        aria-labelledby="closing-cta-heading"
        className="rounded-3xl bg-slate-900 dark:bg-slate-900/90 text-white p-8 sm:p-12 lg:p-14 text-center relative overflow-hidden shadow-xl border border-slate-800"
      >
        {/* Subtle ambient lighting */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-amber-950/40 pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative max-w-2xl mx-auto space-y-5">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-amber-400 text-xs font-semibold">
            <Trophy className="h-3.5 w-3.5" />
            <span>Start Your Next Competition</span>
          </div>

          <h2
            id="closing-cta-heading"
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white"
          >
            Ready to Organize or Compete?
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto">
            Discover upcoming tournaments, launch a club competition, or bring your chess community together on CHESS JEENO.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/tournaments"
              id="closing-explore-tournaments-cta"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm sm:text-base shadow-sm transition min-h-[46px] focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <List className="h-4 w-4" />
              <span>Explore Tournaments</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to={createPath}
              id="closing-create-tournament-cta"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold rounded-xl text-sm sm:text-base border border-slate-700 hover:border-slate-600 transition min-h-[46px] focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <PlusCircle className="h-4 w-4 text-amber-400" />
              <span>Create Tournament</span>
            </Link>
          </div>

          <div className="pt-2 flex items-center justify-center space-x-4 text-xs text-slate-400">
            <Link to="/team-competitions" className="hover:text-slate-200 transition underline underline-offset-4">
              Team Competitions
            </Link>
            <span>•</span>
            <Link to="/help" className="hover:text-slate-200 transition underline underline-offset-4">
              Help & How It Works
            </Link>
            <span>•</span>
            <Link to="/faq" className="hover:text-slate-200 transition underline underline-offset-4">
              FAQ
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
