import { useState } from 'react';
import {
  startReadyCheck,
  startCountdown,
  cancelCountdown,
  startTournament,
} from '../services/tournamentService';

/**
 * useTournamentHostActions — custom hook to coordinate host lifecycle actions:
 * starting ready checks, initiating countdowns, cancelling countdowns, and starting tournaments.
 *
 * @param {Object} options
 * @param {string} [options.tournamentId] - Tournament ID
 * @param {string} [options.id] - Alias for tournamentId
 * @param {Function} [options.fetchTournamentData] - Callback to refetch tournament data after action
 * @param {Function} [options.setSuccessMessage] - Setter for parent notification banner
 * @param {Function} [options.onSuccess] - Alternative callback for notification banner
 * @param {boolean} [options.actionLoading] - Optional external loading state
 * @param {Function} [options.setActionLoading] - Optional external loading setter
 * @param {string|null} [options.actionError] - Optional external error state
 * @param {Function} [options.setActionError] - Optional external error setter
 * @returns {Object} Host action handlers, loading state, and error state
 */
export const useTournamentHostActions = ({
  tournamentId,
  id,
  fetchTournamentData,
  setSuccessMessage,
  onSuccess,
  actionLoading: externalLoading,
  setActionLoading: externalSetLoading,
  actionError: externalError,
  setActionError: externalSetError,
} = {}) => {
  const activeTournamentId = tournamentId || id;

  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState(null);

  const actionLoading = externalLoading !== undefined ? externalLoading : internalLoading;
  const setActionLoading = externalSetLoading || setInternalLoading;

  const actionError = externalError !== undefined ? externalError : internalError;
  const setActionError = externalSetError || setInternalError;

  const notifySuccess = (msg, duration = 4000) => {
    const notifyFn = onSuccess || setSuccessMessage;
    if (notifyFn) {
      notifyFn(msg);
      setTimeout(() => notifyFn(null), duration);
    }
  };

  // Handle Start Ready Check (Host)
  const handleStartReadyCheck = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await startReadyCheck(activeTournamentId);
      notifySuccess('Ready check initiated! Players can now mark themselves ready.', 4000);
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to start ready check'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Start Countdown (Host)
  const handleStartCountdown = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await startCountdown(activeTournamentId, { countdownSeconds: 60 });
      notifySuccess('Countdown started! Tournament will begin shortly.', 4000);
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to start countdown'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Countdown (Host)
  const handleCancelCountdown = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await cancelCountdown(activeTournamentId);
      notifySuccess('Countdown cancelled.', 4000);
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to cancel countdown'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Start Tournament Now (Host)
  const handleStartTournament = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await startTournament(activeTournamentId);
      notifySuccess('Tournament started! Round 1 pairings have been generated.', 4000);
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to start tournament'
      );
    } finally {
      setActionLoading(false);
    }
  };

  return {
    actionLoading,
    actionError,
    setActionError,
    handleStartReadyCheck,
    handleStartCountdown,
    handleCancelCountdown,
    handleStartTournament,
  };
};

export default useTournamentHostActions;
