import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  UserCheck,
  Trophy,
  Swords,
  Clock,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
  Award,
  Zap,
} from 'lucide-react';

const HelpPage = () => {
  useEffect(() => {
    document.title = 'Help | CHESS JEENO';
  }, []);

  const steps = [
    {
      num: 1,
      title: 'Create an Account or Sign In',
      desc: 'Sign up with your email and password, or authenticate instantly with your Google account.',
    },
    {
      num: 2,
      title: 'Connect Your Lichess Account',
      desc: 'Visit your Profile page and connect your Lichess account using OAuth 2.0 PKCE so your games can be verified and tracked.',
    },
    {
      num: 3,
      title: 'Find or Create a Tournament',
      desc: 'Browse public tournaments from the Tournaments page or click "Create Tournament" to host your own event.',
    },
    {
      num: 4,
      title: 'Request to Join',
      desc: 'On the tournament page, click "Request to Join" while registration is open to enter the participant queue.',
    },
    {
      num: 5,
      title: 'Wait for Host Approval',
      desc: 'Tournament hosts review join requests from the management console. Once approved, you are on the roster.',
    },
    {
      num: 6,
      title: 'Mark Yourself Ready',
      desc: 'During the Ready Check phase, click "I am Ready" to confirm you are active and ready to play your match.',
    },
    {
      num: 7,
      title: 'Wait for Pairing Generation',
      desc: 'Once the pre-round countdown finishes, the system automatically generates pairings for the round.',
    },
    {
      num: 8,
      title: 'Play on Lichess',
      desc: 'Click the pairing card link to open your official Lichess match and play with the designated clock and color.',
    },
    {
      num: 9,
      title: 'Result Synchronization',
      desc: 'When the game finishes on Lichess (checkmate, resignation, draw, timeout), the result syncs back to CHESS JEENO automatically.',
    },
    {
      num: 10,
      title: 'Check Standings & Advance',
      desc: 'Review the updated tournament standings and wait for the remaining matches before the next round begins.',
    },
  ];

  return (
    <div className="space-y-16 py-4 transition-colors max-w-5xl mx-auto">
      {/* 1. HERO SECTION */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full">
          <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
          <span>HOW IT WORKS</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          How CHESS JEENO Works
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          A practical guide to participating in, hosting, and completing tournaments on CHESS JEENO.
        </p>
      </section>

      {/* 2. GETTING STARTED (10 STEPS) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Getting Started: Step by Step
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Follow these ten steps to go from account creation to tournament competition:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((step) => (
            <div
              key={step.num}
              className="flex items-start space-x-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                {step.num}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. TOURNAMENT FORMATS */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Tournament Formats
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Pairings and progression depend on the format selected during tournament creation:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Round Robin */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              RR
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Round Robin
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Players play against the other participants according to the implemented pairing system. Every participant faces every opponent across consecutive rounds.
            </p>
          </div>

          {/* Swiss */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              SW
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Swiss
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Players are paired according to the implemented Swiss system and standings. In each round, players face opponents with comparable records without repeating matchups.
            </p>
          </div>

          {/* Knockout */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              KO
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Knockout
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Players progress through elimination rounds according to the implemented tournament system. Winners advance toward the finals while eliminated players finish their run.
            </p>
          </div>
        </div>
      </section>

      {/* 4. PLAYING A GAME & RESULT SYNCHRONIZATION */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Playing a Game on Lichess
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Understanding how CHESS JEENO and Lichess coordinate during gameplay:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
              <Swords className="h-4 w-4" />
              <span>Pairing Generation</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Pairing is generated by CHESS JEENO. Each match assigns White and Black players and creates or tracks the associated Lichess game room.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
              <ExternalLink className="h-4 w-4" />
              <span>Execution on Lichess</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              The actual chess game takes place on Lichess. Players use the interactive chessboard, clock timer, and move validation provided by Lichess.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <Zap className="h-4 w-4" />
              <span>Automated Result Sync</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              CHESS JEENO receives and synchronizes the result directly from Lichess. Wins (1-0), losses (0-1), and draws (½-½) are recorded without manual score entry.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
              <Trophy className="h-4 w-4" />
              <span>Standings Update</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              The result contributes to tournament standings according to the existing implementation, updating participant scores and tiebreak metrics in real time.
            </p>
          </div>
        </div>
      </section>

      {/* 5. TOURNAMENT COMPLETION */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Tournament Completion
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            When all tournament rounds conclude, CHESS JEENO marks the tournament as completed:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <Award className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Final Standings
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              The full scoreboard with final rankings, total points, wins, draws, and losses for all participants.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <Layers className="h-5 w-5 text-indigo-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Completed Rounds
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              A historical archive of every round and pairing played throughout the event.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Personal Result
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              An individual completion summary displaying your personal placement and win-loss record.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <Clock className="h-5 w-5 text-slate-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Tournament History
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Permanent tournament record preserved in the public directory and on player dashboards.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-center">
          <Link
            to="/tournaments"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
          >
            <span>Explore Active Tournaments</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HelpPage;
