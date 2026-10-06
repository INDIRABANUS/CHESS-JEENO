import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Swords,
  Users,
  CheckCircle2,
  Clock,
  Layers,
  Zap,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  GitBranch,
  RotateCcw,
} from 'lucide-react';

const AboutPage = () => {
  useEffect(() => {
    document.title = 'About | CHESS JEENO';
  }, []);

  const flowSteps = [
    { title: 'Create', desc: 'Host configures format, time controls, and limits.' },
    { title: 'Invite', desc: 'Share tournament link with players or community.' },
    { title: 'Join', desc: 'Players request to enter the tournament roster.' },
    { title: 'Approve', desc: 'Host reviews and approves join requests.' },
    { title: 'Ready', desc: 'Players check in to confirm active participation.' },
    { title: 'Pair', desc: 'System automatically calculates round pairings.' },
    { title: 'Play', desc: 'Games launch and are played directly on Lichess.' },
    { title: 'Results', desc: 'Game outcomes synchronize back automatically.' },
    { title: 'Standings', desc: 'Scores and tournament brackets update live.' },
  ];

  const features = [
    {
      title: 'Tournament Creation',
      desc: 'Create events with custom time limits, increments, player caps, and round limits.',
      icon: Trophy,
    },
    {
      title: 'Join Requests & Host Approval',
      desc: 'Hosts maintain full control over participant rosters with an approval workflow.',
      icon: Users,
    },
    {
      title: 'Round Robin Tournaments',
      desc: 'All-play-all schedule where every participant plays every other player.',
      icon: RotateCcw,
    },
    {
      title: 'Swiss System Tournaments',
      desc: 'Dynamic pairing where players face opponents with similar scores each round.',
      icon: GitBranch,
    },
    {
      title: 'Knockout Brackets',
      desc: 'Classic single-elimination tournament bracket leading to a final champion.',
      icon: Swords,
    },
    {
      title: 'Ready Check & Countdown',
      desc: 'Pre-round check-in ensuring all matched players are active before pairings begin.',
      icon: Clock,
    },
    {
      title: 'Lichess Integration',
      desc: 'Direct Lichess game links for pairings with full clock and board enforcement.',
      icon: Zap,
    },
    {
      title: 'Automatic Result Sync',
      desc: 'Match results are synchronized from Lichess without manual score entry.',
      icon: CheckCircle2,
    },
    {
      title: 'Live Tournament Updates',
      desc: 'Socket.IO real-time event broadcasting updates standings and rounds live.',
      icon: Layers,
    },
    {
      title: 'Live Standings',
      desc: 'Calculates points, wins, draws, losses, and tournament tiebreak standings.',
      icon: Trophy,
    },
    {
      title: 'Player Dashboard & Profiles',
      desc: 'Personal profiles with tournament history and Lichess account connection.',
      icon: ShieldCheck,
    },
    {
      title: 'Flexible Authentication',
      desc: 'Sign in using email/password or Google OAuth, with Lichess OAuth account linking.',
      icon: Users,
    },
  ];

  return (
    <div className="space-y-16 py-4 transition-colors">
      {/* 1. HERO SECTION */}
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          <span>ABOUT CHESS JEENO</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Tournament operations built around <span className="text-indigo-600 dark:text-indigo-400">Lichess</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          A tournament experience built around Lichess for organizing, playing, and tracking chess tournaments with friends and groups.
        </p>
      </section>

      {/* 2. WHAT CHESS JEENO DOES (THE CORE FLOW) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            What CHESS JEENO Does
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            From tournament creation to final standings, CHESS JEENO streamlines the entire tournament lifecycle:
          </p>
        </div>

        {/* Lifecycle Flow Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9 gap-3">
          {flowSteps.map((step, idx) => (
            <div
              key={step.title}
              className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 relative group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  0{idx + 1}
                </span>
                {idx < flowSteps.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-500 hidden lg:block" />
                )}
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {step.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. HOW LICHESS FITS IN */}
      <section className="bg-slate-900 text-white rounded-2xl p-6 sm:p-10 shadow-lg relative overflow-hidden">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-slate-200">
            <span>Architecture & Roles</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            "Lichess is the chess engine; CHESS JEENO is the tournament experience."
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            CHESS JEENO does not replicate or replace Lichess. Instead, it acts as a dedicated operational layer on top of it.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <h3 className="font-bold text-indigo-300 text-sm uppercase tracking-wider flex items-center space-x-2">
                <span>CHESS JEENO Handles</span>
              </h3>
              <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside">
                <li>Tournament creation and configuration</li>
                <li>Player rosters and join request approvals</li>
                <li>Swiss, Round Robin, and Knockout brackets</li>
                <li>Round pairings and bye assignments</li>
                <li>Ready check management and countdowns</li>
                <li>Live standings calculation and tournament history</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <h3 className="font-bold text-amber-300 text-sm uppercase tracking-wider flex items-center space-x-2">
                <span>Lichess Handles</span>
              </h3>
              <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc list-inside">
                <li>Interactive digital chessboard</li>
                <li>FIDE-standard legal move validation</li>
                <li>Precise chess clocks and increments</li>
                <li>Fair play detection and game arbitration</li>
                <li>Game execution and final game adjudication</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SUPPORTED FORMATS */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Supported Tournament Formats
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            CHESS JEENO supports three core tournament formats implemented directly in the application:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              RR
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Round Robin
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Every participant plays against every other participant in the tournament roster. Rounds are scheduled so that all pairwise matchups take place.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              SW
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Swiss System
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Players are paired each round with opponents possessing similar scores and standings, avoiding repeat pairings. Suitable for larger player fields over a fixed number of rounds.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              KO
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Knockout (Single Elimination)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              A bracket-style tournament where match winners advance to the subsequent round while defeated players are eliminated, continuing until a final winner is determined.
            </p>
          </div>
        </div>
      </section>

      {/* 5. KEY FEATURES */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Key Features
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Operational tools designed for tournament hosts and players:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {feat.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. PROJECT / REPOSITORY */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Project Information
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          CHESS JEENO is an open-source full-stack chess tournament management application built with a React/Vite client and Node.js/Express server. Development, issue tracking, and source code are maintained publicly on GitHub.
        </p>
        <div className="pt-2 flex flex-wrap gap-3">
          <a
            href="https://github.com/INDIRABANUS/CHESS-JEENO"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition"
          >
            <span>GitHub Repository</span>
            <ExternalLink className="h-4 w-4" />
          </a>
          <Link
            to="/tournaments"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
          >
            <span>Browse Tournaments</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
