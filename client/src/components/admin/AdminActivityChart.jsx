import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

/**
 * Formats a YYYY-MM-DD string into a concise "MMM D" label.
 */
const formatChartDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

/**
 * AdminActivityChart — Displays a responsive daily activity bar chart with hover tooltips and empty states.
 * 
 * @param {Object} props
 * @param {string} props.title - Chart title
 * @param {string} [props.subtitle] - Chart subtitle
 * @param {Array<{ date: string, count: number }>} props.data - Time series items
 * @param {string} [props.barColor='bg-indigo-500'] - Tailwind color class for bars
 * @param {string} [props.emptyMessage='No recent activity in the last 30 days']
 */
const AdminActivityChart = ({
  title,
  subtitle,
  data = [],
  barColor = 'bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400',
  emptyMessage = 'No recent activity recorded in the last 30 days',
}) => {
  const [activeItem, setActiveItem] = useState(null);

  const totalActivity = data.reduce((sum, d) => sum + (d.count || 0), 0);
  const maxCount = Math.max(...data.map((d) => d.count || 0), 1);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Calendar className="h-3.5 w-3.5" />
            <span>Last 30 Days</span>
          </div>
        </div>

        {/* Chart Body or Empty State */}
        {data.length === 0 || totalActivity === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4">
            <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-400 mb-2">
              <Calendar className="h-6 w-6 stroke-1" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {emptyMessage}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Events will be tracked here automatically as they occur.
            </p>
          </div>
        ) : (
          <div>
            {/* Active Hover Tooltip Display */}
            <div className="h-6 mb-2 flex items-center justify-between text-xs">
              {activeItem ? (
                <>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {formatChartDate(activeItem.date)}:
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {activeItem.count} {activeItem.count === 1 ? 'event' : 'events'}
                  </span>
                </>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">
                  Hover over bars to inspect daily counts
                </span>
              )}
            </div>

            {/* Bar Chart Bars */}
            <div className="h-36 flex items-end gap-1.5 sm:gap-2 pt-4 border-b border-slate-100 dark:border-slate-800">
              {data.map((item, idx) => {
                const count = item.count || 0;
                const heightPercent = Math.max(Math.round((count / maxCount) * 100), count > 0 ? 8 : 2);

                return (
                  <div
                    key={item.date || idx}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                    onMouseEnter={() => setActiveItem(item)}
                    onMouseLeave={() => setActiveItem(null)}
                  >
                    <div
                      className={`w-full rounded-t-sm transition-all duration-150 ${
                        count > 0 ? barColor : 'bg-slate-100 dark:bg-slate-800'
                      } ${activeItem?.date === item.date ? 'ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-Axis Summary Labels */}
            <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2">
              <span>{formatChartDate(data[0]?.date)}</span>
              <span>{formatChartDate(data[Math.floor(data.length / 2)]?.date)}</span>
              <span>{formatChartDate(data[data.length - 1]?.date)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Total */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <span>Total 30-Day Activity</span>
        <span className="font-bold text-slate-800 dark:text-slate-200">
          {totalActivity.toLocaleString()} {totalActivity === 1 ? 'event' : 'events'}
        </span>
      </div>
    </div>
  );
};

export default AdminActivityChart;
