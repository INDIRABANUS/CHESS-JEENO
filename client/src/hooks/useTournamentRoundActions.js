import { useState } from 'react';
import { createRound } from '../services/tournamentService';

/**
 * useTournamentRoundActions — custom hook to coordinate round creation actions.
 *
 * @param {Object} options
 * @param {string} [options.tournamentId] - Tournament ID
 * @param {string} [options.id] - Alias for tournamentId
 * @param {Function} [options.fetchTournamentData] - Callback to refetch tournament data after round creation
 * @param {Function} [options.setSuccessMessage] - Setter for parent notification banner
 * @param {Function} [options.onSuccess] - Alternative callback for notification banner
 * @returns {Object} { handleCreateRound, createRoundLoading, roundError, setRoundError }
 */
export const useTournamentRoundActions = ({
  tournamentId,
  id,
  fetchTournamentData,
  setSuccessMessage,
  onSuccess,
} = {}) => {
  const activeTournamentId = tournamentId || id;

  const [createRoundLoading, setCreateRoundLoading] = useState(false);
  const [roundError, setRoundError] = useState(null);

  const notifySuccess = (msg, duration = 4000) => {
    const notifyFn = onSuccess || setSuccessMessage;
    if (notifyFn) {
      notifyFn(msg);
      setTimeout(() => notifyFn(null), duration);
    }
  };

  // Handle Create Round
  const handleCreateRound = async () => {
    setCreateRoundLoading(true);
    setRoundError(null);
    try {
      const res = await createRound(activeTournamentId);
      notifySuccess(
        `Round ${res.data.round.roundNumber} created successfully with ${res.data.pairings.length} pairing(s)!`,
        4000
      );
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setRoundError(
        err.response?.data?.message || err.message || 'Failed to create round'
      );
    } finally {
      setCreateRoundLoading(false);
    }
  };

  return {
    handleCreateRound,
    createRoundLoading,
    roundError,
    setRoundError,
  };
};

export default useTournamentRoundActions;
