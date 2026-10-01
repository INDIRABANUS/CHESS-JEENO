import { useState } from 'react';
import {
  joinTournament,
  leaveTournament,
  setPlayerReady,
  setPlayerNotReady,
} from '../services/tournamentService';

/**
 * useTournamentPlayerActions — custom hook to coordinate player actions:
 * joining a tournament, leaving a tournament, and toggling player readiness.
 *
 * @param {Object} options
 * @param {string} [options.tournamentId] - Tournament ID
 * @param {string} [options.id] - Alias for tournamentId
 * @param {boolean} [options.isRegistered] - Whether current user is registered
 * @param {boolean} [options.isCurrentUserReady] - Whether current user is currently ready
 * @param {Function} [options.fetchTournamentData] - Callback to refetch tournament data after action
 * @param {Function} [options.setSuccessMessage] - Setter for parent notification banner
 * @param {Function} [options.onSuccess] - Alternative callback for notification banner
 * @param {boolean} [options.actionLoading] - Optional external loading state
 * @param {Function} [options.setActionLoading] - Optional external loading setter
 * @param {string|null} [options.actionError] - Optional external error state
 * @param {Function} [options.setActionError] - Optional external error setter
 * @returns {Object} Action handlers, loading state, and error state
 */
export const useTournamentPlayerActions = ({
  tournamentId,
  id,
  isRegistered,
  isCurrentUserReady,
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

  // Handle Joining Tournament
  const handleJoin = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await joinTournament(activeTournamentId);
      notifySuccess('You have successfully joined the tournament!', 4000);
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to join tournament'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Leaving Tournament
  const handleLeave = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await leaveTournament(activeTournamentId);
      notifySuccess('You have withdrawn from the tournament.', 4000);
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to leave tournament'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Toggle Player Ready
  const handleToggleReady = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      if (isCurrentUserReady) {
        await setPlayerNotReady(activeTournamentId);
      } else {
        await setPlayerReady(activeTournamentId);
      }
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to update readiness status'
      );
    } finally {
      setActionLoading(false);
    }
  };

  return {
    actionLoading,
    actionError,
    setActionError,
    handleJoin,
    handleLeave,
    handleToggleReady,
  };
};

export default useTournamentPlayerActions;
