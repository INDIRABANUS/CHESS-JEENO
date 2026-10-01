import React from 'react';
import { Clock } from 'lucide-react';

/**
 * CountdownBanner — renders the active countdown display before tournament start,
 * along with host controls to start immediately or cancel the countdown.
 *
 * Props:
 * @param {number|null} countdownRemaining – Remaining countdown seconds
 * @param {boolean}     isHost             – Whether current user is the tournament host
 * @param {boolean}     actionLoading      – Whether a host action is currently in flight
 * @param {Function}    onStartTournament  – Callback to start tournament immediately
 * @param {Function}    onCancelCountdown  – Callback to cancel the active countdown
 */
const CountdownBanner = ({
  countdownRemaining,
  isHost = false,
  actionLoading = false,
  onStartTournament,
  onCancelCountdown,
}) => {
  return (
    <div className="p-6 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 text-white rounded-xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-xs animate-pulse">
          <Clock className="h-8 w-8 text-white" />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-200">
            Tournament Countdown Active
          </div>
          <div className="text-3xl font-black font-mono tracking-tight">
            Starting in {typeof countdownRemaining === 'number' ? `00:${String(countdownRemaining).padStart(2, '0')}` : '60s'}
          </div>
          <div className="text-xs text-indigo-100 mt-1">
            Round 1 pairings will generate automatically when the countdown reaches zero.
          </div>
        </div>
      </div>
      {isHost && (
        <div className="flex items-center space-x-2">
          <button
            onClick={onStartTournament}
            disabled={actionLoading}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs shadow-sm transition"
          >
            START NOW
          </button>
          <button
            onClick={onCancelCountdown}
            disabled={actionLoading}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg text-xs border border-white/30 transition"
          >
            CANCEL
          </button>
        </div>
      )}
    </div>
  );
};

export default CountdownBanner;
