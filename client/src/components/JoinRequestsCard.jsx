import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Check, X, Loader2, Clock, AlertCircle, Share2 } from 'lucide-react';
import {
  getTournamentJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from '../services/tournamentService';
import { formatDate } from '../utils/formatters';

/**
 * JoinRequestsCard — Host-only card displaying pending player join requests
 * with inline Approve and Reject actions.
 *
 * @param {Object} props
 * @param {string} props.tournamentId - Tournament ID
 * @param {Function} [props.onActionComplete] - Callback to refetch tournament details on approve/reject
 * @param {Function} [props.setSuccessMessage] - Parent success message setter
 * @param {number} [props.pendingCount] - Initial/external pending requests count
 * @param {Function} [props.onOpenInvite] - Optional callback to open the invite/share modal
 */
const JoinRequestsCard = ({
  tournamentId,
  onActionComplete,
  setSuccessMessage,
  pendingCount = 0,
  onOpenInvite,
}) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState(null);

  const fetchRequests = useCallback(async () => {
    if (!tournamentId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getTournamentJoinRequests(tournamentId, 'PENDING');
      setRequests(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load join requests');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, pendingCount]);

  const handleApprove = async (requestId, userName) => {
    setProcessingId(requestId);
    setError(null);
    try {
      await approveJoinRequest(tournamentId, requestId);
      if (setSuccessMessage) {
        setSuccessMessage(`Approved join request for ${userName || 'player'}!`);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
      await fetchRequests();
      if (onActionComplete) {
        await onActionComplete();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to approve join request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId, userName) => {
    setProcessingId(requestId);
    setError(null);
    try {
      await rejectJoinRequest(tournamentId, requestId);
      if (setSuccessMessage) {
        setSuccessMessage(`Rejected join request for ${userName || 'player'}.`);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
      await fetchRequests();
      if (onActionComplete) {
        await onActionComplete();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to reject join request');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden mb-6 transition-colors">
      {/* Header */}
      <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <span>Pending Join Requests</span>
              {requests.length > 0 && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-700">
                  {requests.length} PENDING
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review and approve players requesting entry into this tournament
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {onOpenInvite && (
            <button
              type="button"
              onClick={onOpenInvite}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold transition min-h-[40px] sm:min-h-0 cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Invite Players</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchRequests}
            disabled={loading}
            className="inline-flex items-center min-h-[40px] px-2 py-2 sm:min-h-0 sm:py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition cursor-pointer"
          >
            {loading ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 mx-3.5 sm:mx-5 mt-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center space-x-2 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      <div className="p-3.5 sm:p-5">
        {loading && requests.length === 0 ? (
          <div className="py-6 flex items-center justify-center space-x-2 text-slate-400 dark:text-slate-500 text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            <span>Checking join requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              No pending join requests at this time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {requests.map((req) => {
              const user = req.user || {};
              const isProcessing = processingId === req._id;

              return (
                <div
                  key={req._id}
                  className="py-3 sm:py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  {/* User info */}
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-200 shrink-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name || 'User'}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        (user.name || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {user.name || 'Anonymous User'}
                        </span>
                        {user.lichessUsername && (
                          <span className="text-xs sm:text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 font-semibold">
                            @{user.lichessUsername}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>Requested {formatDate(req.requestedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleReject(req._id, user.name)}
                      disabled={isProcessing || processingId !== null}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold transition disabled:opacity-50 min-h-[40px] sm:min-h-0 cursor-pointer"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      <span>REJECT</span>
                    </button>

                    <button
                      onClick={() => handleApprove(req._id, user.name)}
                      disabled={isProcessing || processingId !== null}
                      className="inline-flex items-center space-x-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 min-h-[40px] sm:min-h-0 cursor-pointer"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      <span>APPROVE</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinRequestsCard;
