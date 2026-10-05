import React from 'react';

/**
 * AdminAnalyticsStatCard — Displays a single analytics metric with icon, value, and context label.
 * 
 * @param {Object} props
 * @param {string} props.title - Metric title
 * @param {number|string} props.value - Numeric or formatted metric value
 * @param {string} [props.subtitle] - Context label or explanation
 * @param {React.ReactNode} props.icon - Lucide icon element
 * @param {string} [props.colorScheme='indigo'] - 'indigo' | 'amber' | 'emerald' | 'blue' | 'purple' | 'rose'
 * @param {string} [props.badge] - Optional badge text
 */
const AdminAnalyticsStatCard = ({
  title,
  value,
  subtitle,
  icon,
  colorScheme = 'indigo',
  badge,
}) => {
  const colorMap = {
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-100 dark:border-indigo-900/50',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-100 dark:border-amber-900/50',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-100 dark:border-emerald-900/50',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-100 dark:border-blue-900/50',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-100 dark:border-purple-900/50',
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-100 dark:border-rose-900/50',
    },
  };

  const scheme = colorMap[colorScheme] || colorMap.indigo;
  const displayValue = value === null || value === undefined ? '0' : value.toLocaleString();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className={`p-2.5 rounded-xl ${scheme.bg} ${scheme.text}`}>
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {displayValue}
        </span>
        {badge && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${scheme.bg} ${scheme.text} ${scheme.border}`}>
            {badge}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default AdminAnalyticsStatCard;
