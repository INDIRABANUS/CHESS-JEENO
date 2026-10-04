import React from 'react';

/**
 * AdminStatCard — Reusable, accessible metric card for the Admin Overview.
 * 
 * @param {Object} props
 * @param {string} props.title - Card title / label
 * @param {number|string} props.value - Metric value
 * @param {string} [props.subtitle] - Additional context / breakdown
 * @param {React.ReactNode} props.icon - Lucide icon
 * @param {string} [props.accentColor] - Color theme: 'indigo' | 'amber' | 'emerald' | 'blue' | 'purple'
 */
const AdminStatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor = 'indigo',
}) => {
  const colorStyles = {
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-100 dark:border-indigo-900/50',
      text: 'text-indigo-600 dark:text-indigo-400',
      badge: 'bg-indigo-500',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-100 dark:border-amber-900/50',
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-500',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-100 dark:border-emerald-900/50',
      text: 'text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-500',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-100 dark:border-blue-900/50',
      text: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-500',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      border: 'border-purple-100 dark:border-purple-900/50',
      text: 'text-purple-600 dark:text-purple-400',
      badge: 'bg-purple-500',
    },
  }[accentColor] || {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-100 dark:border-indigo-900/50',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-500',
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </p>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${colorStyles.bg} ${colorStyles.text}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline space-x-2">
        <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default AdminStatCard;
