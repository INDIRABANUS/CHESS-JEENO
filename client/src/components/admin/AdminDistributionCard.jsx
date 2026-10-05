import React from 'react';

/**
 * AdminDistributionCard — Displays categorical distribution with progress bars and percentage breakdown.
 * 
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {string} [props.subtitle] - Card subtitle
 * @param {React.ReactNode} props.icon - Lucide icon
 * @param {Array<{ label: string, count: number, color?: string }>} props.items - Distribution items
 * @param {string} [props.emptyMessage='No distribution data available'] - Empty state message
 */
const AdminDistributionCard = ({
  title,
  subtitle,
  icon,
  items = [],
  emptyMessage = 'No distribution data available',
}) => {
  const total = items.reduce((sum, item) => sum + (item.count || 0), 0);

  // Palette generator for items without predefined colors
  const defaultColors = [
    { bg: 'bg-indigo-500', bar: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
    { bg: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    { bg: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    { bg: 'bg-blue-500', bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
    { bg: 'bg-purple-500', bar: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400' },
    { bg: 'bg-rose-500', bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
    { bg: 'bg-slate-400', bar: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          {icon && (
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        {total === 0 || items.length === 0 ? (
          <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Visual Multi-Segment Bar */}
            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden">
              {items.map((item, idx) => {
                const count = item.count || 0;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                if (percentage === 0) return null;
                const colorConfig = defaultColors[idx % defaultColors.length];

                return (
                  <div
                    key={item.label || idx}
                    className={`${item.color || colorConfig.bar} h-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                    title={`${item.label}: ${count} (${percentage.toFixed(1)}%)`}
                  />
                );
              })}
            </div>

            {/* Item Details */}
            <div className="space-y-2.5 pt-2">
              {items.map((item, idx) => {
                const count = item.count || 0;
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
                const colorConfig = defaultColors[idx % defaultColors.length];

                return (
                  <div
                    key={item.label || idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color || colorConfig.bar}`} />
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {item.label}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {count.toLocaleString()}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 w-12 text-right">
                        ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Total */}
      {total > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <span>Total Recorded</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{total.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
};

export default AdminDistributionCard;
