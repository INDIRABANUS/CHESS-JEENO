import React from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Gamepad2,
  Zap,
  ArrowRight,
  ExternalLink,
  Users,
  Swords,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const createPath = isAuthenticated ? '/tournaments/create' : '/login';

  return (
    <div className="space-y-16 sm:space-y-24 py-4 transition-colors">
      {/* 1. HERO SECTION & 2. PRODUCT VISUAL */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
        {/* Left Column: Headline & CTAs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="tracking-wide uppercase text-[11px]">CHESS JEENO</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
            Host. Play. <span className="text-indigo-600 dark:text-indigo-400">Compete.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
            A simple platform to host chess tournaments, manage players, and play competitive games through Lichess.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <Link
              to={createPath}
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-base font-semibold shadow-xs hover:shadow transition-all group min-h-[44px]"
            >
              <span>Create Tournament</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link
              to="/tournaments"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl text-base font-semibold transition min-h-[44px]"
            >
              <span>Browse Tournaments</span>
            </Link>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Real-Time Sync</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>Swiss, Round Robin & Knockout</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Lichess OAuth</span>
            </div>
          </div>
        </div>

        {/* Right Column: Product Visual Mockup */}
        <div className="lg:col-span-5 w-full">
          <div className="relative mx-auto max-w-md lg:max-w-none">
            {/* Subtle background glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-100 to-amber-100 dark:from-indigo-950/30 dark:to-amber-950/20 rounded-2xl blur-lg opacity-60 pointer-events-none" />

            {/* Mockup Card */}
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-lg p-5 sm:p-6 space-y-4">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    CJ
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">CHESS JEENO</h3>
                    <p className="text-xs sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">Spring Masters • Round 3</p>
                  </div>
                </div>

                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>LIVE</span>
                </div>
              </div>

              {/* Standings Snippet */}
              <div className="space-y-2">
                <div className="text-xs sm:text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Live Standings
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 font-bold text-slate-400 dark:text-slate-500">1</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Player A</span>
                    </div>
                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">2.5 pts</div>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 text-xs bg-white dark:bg-slate-900">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 font-bold text-slate-400 dark:text-slate-500">2</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Player B</span>
                    </div>
                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">2.0 pts</div>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-4 font-bold text-slate-400 dark:text-slate-500">3</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Player C</span>
                    </div>
                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">1.5 pts</div>
                  </div>
                </div>
              </div>

              {/* Active Pairing Banner */}
              <div className="p-3 bg-gradient-to-r from-indigo-50/70 to-slate-50 dark:from-slate-850 dark:to-slate-800 rounded-xl border border-indigo-100/80 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">Board 1: Player A vs Player B</div>
                  <div className="text-xs sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>3+2 Blitz • Active Game</span>
                  </div>
                </div>
                <div className="inline-flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 font-semibold text-xs sm:text-[11px]">
                  <span>Lichess</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FEATURES SECTION */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Everything you need to run a tournament
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Purpose-built tournament infrastructure designed for seamless chess competitions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Trophy className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Tournament Formats</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Run Round Robin, Swiss, or Knockout tournaments with structured rounds and pairings.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Gamepad2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Lichess-Powered Games</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Create real chess games through Lichess and let players play on the platform they already know.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Real-Time Updates</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Follow game progress, results, standings, and round completion without refreshing the page.
            </p>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            How CHESS JEENO works
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Simple, automated tournament operations from creation to champion crowning.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
            <div className="inline-block text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              01 — Create
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Setup & Schedule</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Create your tournament and choose the format, time control, and schedule.
            </p>
          </div>

          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
            <div className="inline-block text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              02 — Compete
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Join & Play</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Players join and are paired automatically for each round.
            </p>
          </div>

          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
            <div className="inline-block text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              03 — Follow
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Live Progress</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Games, results, standings, and round progress update in real time.
            </p>
          </div>
        </div>
      </section>

      {/* 5. TOURNAMENT FORMATS */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Supported Tournament Formats
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Tailor-made pairing logic built for every competitive structure.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1.5">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <Users className="h-4 w-4" />
              <span>Round Robin</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every player faces the other players.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1.5">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <Sparkles className="h-4 w-4" />
              <span>Swiss</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Players are paired based on their current scores.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1.5">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <Swords className="h-4 w-4" />
              <span>Knockout</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Win your match and advance through the bracket.
            </p>
          </div>
        </div>
      </section>

      {/* 6. FINAL CTA */}
      <section className="rounded-3xl bg-slate-900 dark:bg-slate-900/90 text-white p-8 sm:p-12 text-center relative overflow-hidden shadow-xl border border-transparent dark:border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-transparent to-amber-900/20 pointer-events-none" />

        <div className="relative max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Ready to start your tournament?
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto">
            Create a tournament, invite players, and let CHESS JEENO handle the pairings and live updates.
          </p>

          <div className="pt-2">
            <Link
              to={createPath}
              className="inline-flex items-center justify-center space-x-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-base shadow-sm transition group min-h-[44px]"
            >
              <span>Create Tournament</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
