import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Trophy, ShieldCheck, Activity, RefreshCw, Layers } from 'lucide-react';

const HomePage = () => {
  const { backendHealth, verifyHealth } = useOutletContext() || {};

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full mb-4">
            <Trophy className="h-3.5 w-3.5" />
            <span>CHESS JEENO &bull; Foundation</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
            Welcome to CHESS JEENO
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            Create, participate, and manage chess tournaments seamlessly on CHESS JEENO. Gameplay, legal moves, clocks, and game results are powered by Lichess, while this platform coordinates tournament brackets, pairings, rounds, and standings.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              to="/tournaments"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
            >
              View Tournaments
            </Link>
            <Link
              to="/tournaments/create"
              className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
            >
              Create Tournament
            </Link>
          </div>
        </div>
      </div>

      {/* Backend API Connection Health Verification */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <Activity className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              Backend Health Check Verification
            </h2>
          </div>
          <button
            onClick={verifyHealth}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Test Connection</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-1">
              Target Endpoint
            </span>
            <code className="text-sm text-indigo-600 font-mono bg-white px-2 py-1 rounded border border-slate-200 inline-block">
              GET /api/health
            </code>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-1">
              Live Status
            </span>
            <div className="flex items-center space-x-2">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  backendHealth?.status === 'connected'
                    ? 'bg-emerald-500'
                    : backendHealth?.status === 'error'
                    ? 'bg-rose-500'
                    : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span className="text-sm font-medium text-slate-700">
                {backendHealth?.message || 'Unknown status'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Architecture Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 text-indigo-600 font-semibold text-base mb-3">
            <Layers className="h-5 w-5" />
            <h3>CHESS JEENO Responsibilities</h3>
          </div>
          <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
            <li>User accounts & player registration</li>
            <li>Tournament formats, brackets, and standings</li>
            <li>Pairings calculation and round progression</li>
            <li>Tournament history and Lichess game ID tracking</li>
            <li>Automatic next round generation</li>
          </ul>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2 text-emerald-600 font-semibold text-base mb-3">
            <ShieldCheck className="h-5 w-5" />
            <h3>Lichess Delegated Responsibilities</h3>
          </div>
          <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
            <li>Actual chess gameplay interface</li>
            <li>Move legality & game state validation</li>
            <li>Chess clocks and time management</li>
            <li>Official game outcomes & results</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
