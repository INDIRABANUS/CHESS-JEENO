import { useState } from 'react';
import {
  createPairingLichessGame,
  createAllRoundLichessGames,
  syncPairingResult,
  rematchPairing,
} from '../services/tournamentService';

/**
 * useTournamentLichessActions — custom hook to coordinate Lichess game creation,
 * bulk round game creation, result synchronization, and rematches.
 *
 * @param {Object} options
 * @param {string} [options.tournamentId] - Tournament ID
 * @param {string} [options.id] - Alias for tournamentId
 * @param {Function} [options.fetchTournamentData] - Callback to refetch tournament data after action
 * @param {Function} [options.setSuccessMessage] - Setter for parent notification banner
 * @param {Function} [options.onSuccess] - Alternative callback for notification banner
 * @returns {Object} Action handlers, loading states, and error state
 */
export const useTournamentLichessActions = ({
  tournamentId,
  id,
  fetchTournamentData,
  setSuccessMessage,
  onSuccess,
} = {}) => {
  const activeTournamentId = tournamentId || id;

  const [pairingGameLoading, setPairingGameLoading] = useState({});
  const [roundBulkLoading, setRoundBulkLoading] = useState({});
  const [syncLoading, setSyncLoading] = useState({});
  const [rematchLoading, setRematchLoading] = useState({});
  const [gameError, setGameError] = useState(null);

  const notifySuccess = (msg, duration = 4000) => {
    const notifyFn = onSuccess || setSuccessMessage;
    if (notifyFn) {
      notifyFn(msg);
      setTimeout(() => notifyFn(null), duration);
    }
  };

  // Handle Rematch for Aborted Pairing
  const handleRematch = async (roundNumber, pairingId) => {
    setRematchLoading((prev) => ({ ...prev, [pairingId]: true }));
    setGameError(null);
    try {
      await rematchPairing(activeTournamentId, roundNumber, pairingId);
      notifySuccess('New rematch game created successfully on Lichess!', 4000);
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setGameError(
        err.response?.data?.message || err.message || 'Failed to create rematch game'
      );
    } finally {
      setRematchLoading((prev) => ({ ...prev, [pairingId]: false }));
    }
  };

  // Handle Create Lichess Game for single pairing
  const handleCreatePairingGame = async (roundNumber, pairingId) => {
    setPairingGameLoading((prev) => ({ ...prev, [pairingId]: true }));
    setGameError(null);
    try {
      await createPairingLichessGame(activeTournamentId, roundNumber, pairingId);
      notifySuccess('Lichess game created successfully!', 4000);
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setGameError(
        err.response?.data?.message || err.message || 'Failed to create Lichess game'
      );
    } finally {
      setPairingGameLoading((prev) => ({ ...prev, [pairingId]: false }));
    }
  };

  // Handle Create All Lichess Games for a round
  const handleCreateAllRoundGames = async (roundNumber) => {
    setRoundBulkLoading((prev) => ({ ...prev, [roundNumber]: true }));
    setGameError(null);
    try {
      const res = await createAllRoundLichessGames(activeTournamentId, roundNumber);
      const { created = 0, skipped = 0, failed = 0 } = res.data || {};
      let msg = `Round ${roundNumber}: ${created} game(s) created`;
      if (skipped > 0) msg += `, ${skipped} already existed`;
      if (failed > 0) msg += `, ${failed} failed`;
      notifySuccess(msg, 5000);
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setGameError(
        err.response?.data?.message || err.message || 'Failed to create Lichess games for round'
      );
    } finally {
      setRoundBulkLoading((prev) => ({ ...prev, [roundNumber]: false }));
    }
  };

  // Handle Sync Lichess Game Result
  const handleSyncResult = async (roundNumber, pairingId) => {
    setSyncLoading((prev) => ({ ...prev, [pairingId]: true }));
    setGameError(null);
    try {
      const res = await syncPairingResult(activeTournamentId, roundNumber, pairingId);
      const updatedPairing = res.data;
      const statusText = updatedPairing.status || 'UPDATED';
      const resultText =
        updatedPairing.result && updatedPairing.result !== 'PENDING'
          ? ` (${updatedPairing.result})`
          : '';
      notifySuccess(`Game synchronized: ${statusText}${resultText}`, 4000);
      if (fetchTournamentData) {
        await fetchTournamentData();
      }
    } catch (err) {
      setGameError(
        err.response?.data?.message || err.message || 'Failed to sync game result from Lichess'
      );
    } finally {
      setSyncLoading((prev) => ({ ...prev, [pairingId]: false }));
    }
  };

  return {
    pairingGameLoading,
    roundBulkLoading,
    syncLoading,
    rematchLoading,
    gameError,
    setGameError,
    handleRematch,
    handleCreatePairingGame,
    handleCreateAllRoundGames,
    handleSyncResult,
  };
};

export default useTournamentLichessActions;
