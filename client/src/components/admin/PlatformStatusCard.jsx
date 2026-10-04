import React from 'react';
import { Activity, Database, Server, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Formats uptime seconds into a human-readable string.
 */
const formatUptime = (seconds) => {
  if (!seconds || seconds <= 0) return '< 1 min';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
};

/**
 * PlatformStatusCard — Displays application-level operational health indicators.
 * 
 * @param {Object} props
 * @param {Object} props.status - Platform status object from backend
 */
const PlatformStatusCard = ({ status = {} }) => {
  const isApiHealthy = status.api === 'Operational';
  const isDbConnected = status.database === 'Connected';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Platform Status
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live operational health and runtime environment
            </p>
          </div>
        </div>

        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Operational</span>
        </span>
      </div>

      {/* Grid of indicators */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Backend REST API */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center space-x-3.5">
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 shadow-2xs text-indigo-600 dark:text-indigo-400 shrink-0">
            <Server className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">REST API</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1 mt-0.5">
              {isApiHealthy ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{status.api || 'Operational'}</span>
                </span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Degraded</span>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* MongoDB Database */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center space-x-3.5">
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 shadow-2xs text-emerald-600 dark:text-emerald-400 shrink-0">
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Database (MongoDB)</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1 mt-0.5">
              {isDbConnected ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{status.database || 'Disconnected'}</span>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Server Uptime */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center space-x-3.5">
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 shadow-2xs text-amber-600 dark:text-amber-400 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Server Uptime</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {formatUptime(status.uptimeSeconds)}
            </p>
          </div>
        </div>

        {/* Security / RBAC Status */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center space-x-3.5">
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 shadow-2xs text-purple-600 dark:text-purple-400 shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Authorization</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              RBAC Active
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformStatusCard;
