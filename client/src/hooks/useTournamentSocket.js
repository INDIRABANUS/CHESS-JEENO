import { useEffect, useRef } from 'react';
import { joinTournamentRoom, leaveTournamentRoom, getSocket } from '../services/socket';

/**
 * useTournamentSocket — custom hook to manage realtime Socket.IO subscriptions
 * for a tournament room and wire incoming game, round, and standing updates.
 *
 * @param {string|Object} tournamentIdOrOptions - Tournament ID or options object
 * @param {Object} [maybeOptions] - Options when first argument is tournament ID
 * @param {string} [maybeOptions.tournamentId] - Tournament ID
 * @param {Function} [maybeOptions.setRounds] - Setter for tournament rounds state
 * @param {Function} [maybeOptions.setStandings] - Setter for tournament standings state
 * @param {Function} [maybeOptions.fetchTournamentData] - Function to refetch full tournament state
 * @returns {Object} { socket }
 */
export const useTournamentSocket = (tournamentIdOrOptions, maybeOptions = {}) => {
  const options =
    typeof tournamentIdOrOptions === 'object' && tournamentIdOrOptions !== null
      ? tournamentIdOrOptions
      : { tournamentId: tournamentIdOrOptions, ...maybeOptions };

  const { tournamentId, setRounds, setStandings, fetchTournamentData } = options;

  const callbacksRef = useRef({ setRounds, setStandings, fetchTournamentData });
  useEffect(() => {
    callbacksRef.current = { setRounds, setStandings, fetchTournamentData };
  });

  useEffect(() => {
    if (!tournamentId) return;

    const handleGameUpdate = (event) => {
      if (event.tournamentId && event.tournamentId !== tournamentId) return;

      const { setRounds: updateRounds } = callbacksRef.current;
      if (!updateRounds) return;

      updateRounds((prevRounds) => {
        return prevRounds.map((round) => {
          if (event.roundNumber && round.roundNumber !== event.roundNumber) {
            return round;
          }
          const updatedPairings = (round.pairings || []).map((pairing) => {
            const matchesId =
              (event.pairingId && (pairing._id === event.pairingId || String(pairing._id) === String(event.pairingId))) ||
              (event.lichessGameId && pairing.lichessGameId === event.lichessGameId);

            if (matchesId) {
              const nextPairing = { ...pairing };
              if (event.status) nextPairing.lichessStatus = event.status;
              if (event.result && event.result !== 'PENDING') {
                nextPairing.result = event.result;
              }
              if (
                event.eventType === 'GAME_FINISHED' ||
                ['1-0', '0-1', '1/2-1/2'].includes(event.result)
              ) {
                nextPairing.status = 'FINISHED';
              } else if (event.eventType === 'GAME_ABORTED' || event.result === 'ABORTED') {
                nextPairing.status = 'ABORTED';
              } else if (
                event.status === 'started' ||
                event.eventType === 'GAME_STARTED' ||
                event.eventType === 'GAME_STATE'
              ) {
                nextPairing.status = 'ACTIVE';
              }
              if (event.clocks) nextPairing.clocks = event.clocks;
              if (event.lastMove) nextPairing.lastMove = event.lastMove;
              return nextPairing;
            }
            return pairing;
          });
          return { ...round, pairings: updatedPairings };
        });
      });
    };

    const handleStandingsUpdate = (data) => {
      if (data.tournamentId && data.tournamentId !== tournamentId) return;
      if (data.standings && Array.isArray(data.standings)) {
        const { setStandings: updateStandings } = callbacksRef.current;
        if (updateStandings) {
          updateStandings(data.standings);
        }
      }
    };

    const handleRoundCompleted = (data) => {
      if (data.tournamentId && data.tournamentId !== tournamentId) return;
      const { setRounds: updateRounds } = callbacksRef.current;
      if (!updateRounds) return;

      updateRounds((prevRounds) => {
        return prevRounds.map((r) => {
          if (r.roundNumber === data.roundNumber) {
            return { ...r, status: 'COMPLETED' };
          }
          return r;
        });
      });
    };

    const triggerRefetch = () => {
      const { fetchTournamentData: refetch } = callbacksRef.current;
      if (refetch) {
        refetch();
      }
    };

    joinTournamentRoom(tournamentId, {
      onGameStarted: handleGameUpdate,
      onGameState: handleGameUpdate,
      onGameFinished: (evt) => {
        handleGameUpdate(evt);
        triggerRefetch();
      },
      onGameAborted: (evt) => {
        handleGameUpdate(evt);
        triggerRefetch();
      },
      onGameRematched: (evt) => {
        handleGameUpdate(evt);
        triggerRefetch();
      },
      onStandingsUpdated: handleStandingsUpdate,
      onRoundCompleted: handleRoundCompleted,
      onPlayerReadyChanged: triggerRefetch,
      onReadyCheckStarted: triggerRefetch,
      onCountdownStarted: triggerRefetch,
      onCountdownCancelled: triggerRefetch,
      onTournamentStarted: triggerRefetch,
      onTournamentCompleted: triggerRefetch,
    });

    return () => {
      leaveTournamentRoom(tournamentId);
    };
  }, [tournamentId]);

  return {
    socket: getSocket(),
  };
};

export default useTournamentSocket;
