import { useState, useEffect, useCallback } from 'react';
import {
  getTournamentById,
  getTournamentPlayers,
  getTournamentRounds,
  getTournamentStandings,
} from '../services/tournamentService';

/**
 * useTournamentDetails — custom hook to load and manage tournament detail data,
 * including participants, rounds, pairings, and standings.
 *
 * @param {string} id - Tournament ID from route parameters
 * @returns {Object} Tournament details state, setters, and refetch handler
 */
export const useTournamentDetails = (id) => {
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTournamentData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [tourneyRes, playersRes, roundsRes, standingsRes] = await Promise.all([
        getTournamentById(id),
        getTournamentPlayers(id),
        getTournamentRounds(id).catch(() => ({ data: [] })),
        getTournamentStandings(id).catch(() => ({ data: { standings: [] } })),
      ]);

      setTournament(tourneyRes.data);
      setPlayers(playersRes.data || []);
      setRounds(roundsRes.data || []);
      setStandings(standingsRes.data?.standings || []);
    } catch (err) {
      setError(
        err.response?.status === 404
          ? 'Tournament not found'
          : err.response?.data?.message || err.message || 'Failed to load tournament'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTournamentData();
  }, [fetchTournamentData]);

  return {
    tournament,
    players,
    rounds,
    standings,
    loading,
    error,
    fetchTournamentData,
    refetch: fetchTournamentData,
    setTournament,
    setPlayers,
    setRounds,
    setStandings,
  };
};

export default useTournamentDetails;
