import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

/**
 * Calculates deterministic standings for a tournament based on actual Pairing results
 * and Round BYEs.
 *
 * Scoring Rules:
 * - 1-0: Winner +1, Loser +0, both +1 gamesPlayed, +1 completedGames
 * - 0-1: Winner +1, Loser +0, both +1 gamesPlayed, +1 completedGames
 * - 1/2-1/2: +0.5 each, both +1 gamesPlayed, +1 completedGames
 * - ABORTED: 0 points each, 0 gamesPlayed, 0 completedGames
 * - BYE: +1 score, +1 win, 0 draws, 0 losses, 0 gamesPlayed, 0 completedGames
 *
 * Deterministic Ordering:
 * 1. Score descending
 * 2. Wins descending
 * 3. Name ascending
 *
 * @param {string} tournamentId
 * @returns {Promise<{ tournamentId: string, standings: Array<Object> }>}
 */
export const getTournamentStandings = async (tournamentId) => {
  if (!mongoose.isValidObjectId(tournamentId)) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.statusCode = 404;
    throw error;
  }

  // 1. Fetch all registered players
  const registeredPlayers = await TournamentPlayer.find({ tournamentId })
    .sort({ joinedAt: 1 })
    .populate('userId', 'name email avatar lichessUsername');

  // Map to hold calculated stats for each player
  const standingsMap = new Map();

  for (const tp of registeredPlayers) {
    const user = tp.userId;
    if (!user) continue;

    const playerId = user._id.toString();
    standingsMap.set(playerId, {
      playerId: user._id,
      name: user.name || 'Anonymous Player',
      email: user.email || '',
      avatar: user.avatar || null,
      lichessUsername: user.lichessUsername || null,
      score: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gamesPlayed: 0,
      completedGames: 0,
    });
  }

  // 2. Fetch all rounds for BYE calculations
  const rounds = await Round.find({ tournamentId }).sort({ roundNumber: 1 });

  for (const round of rounds) {
    if (round.byePlayer) {
      const byePlayerId = round.byePlayer.toString();
      const stats = standingsMap.get(byePlayerId);
      if (stats) {
        // BYE rule: +1 score, +1 win, 0 draws, 0 losses, 0 gamesPlayed, 0 completedGames
        stats.score += 1;
        stats.wins += 1;
      }
    }
  }

  // 3. Fetch all pairings for match results
  const pairings = await Pairing.find({ tournamentId });

  for (const pairing of pairings) {
    const whiteId = pairing.whitePlayer?.toString();
    const blackId = pairing.blackPlayer?.toString();

    const whiteStats = standingsMap.get(whiteId);
    const blackStats = standingsMap.get(blackId);

    const result = pairing.result;

    if (result === '1-0' || result === 'WHITE_WIN') {
      if (whiteStats) {
        whiteStats.score += 1;
        whiteStats.wins += 1;
        whiteStats.gamesPlayed += 1;
        whiteStats.completedGames += 1;
      }
      if (blackStats) {
        blackStats.losses += 1;
        blackStats.gamesPlayed += 1;
        blackStats.completedGames += 1;
      }
    } else if (result === '0-1' || result === 'BLACK_WIN') {
      if (whiteStats) {
        whiteStats.losses += 1;
        whiteStats.gamesPlayed += 1;
        whiteStats.completedGames += 1;
      }
      if (blackStats) {
        blackStats.score += 1;
        blackStats.wins += 1;
        blackStats.gamesPlayed += 1;
        blackStats.completedGames += 1;
      }
    } else if (result === '1/2-1/2' || result === 'DRAW') {
      if (whiteStats) {
        whiteStats.score += 0.5;
        whiteStats.draws += 1;
        whiteStats.gamesPlayed += 1;
        whiteStats.completedGames += 1;
      }
      if (blackStats) {
        blackStats.score += 0.5;
        blackStats.draws += 1;
        blackStats.gamesPlayed += 1;
        blackStats.completedGames += 1;
      }
    } else if (result === 'ABORTED' || pairing.status === 'ABORTED') {
      // Aborted game gives zero points and does not count as a completed game
      // No points or stats added
    }
    // PENDING / ACTIVE games do not contribute to score
  }

  // 4. Convert map to array and sort deterministically
  const standings = Array.from(standingsMap.values());

  standings.sort((a, b) => {
    // 1. Score descending
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // 2. Wins descending
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    // 3. Name ascending
    const nameDiff = (a.name || '').localeCompare(b.name || '');
    if (nameDiff !== 0) {
      return nameDiff;
    }
    // 4. Deterministic fallback: Player ID string
    return (a.playerId?.toString() || '').localeCompare(b.playerId?.toString() || '');
  });

  // Assign 1-indexed rank
  standings.forEach((player, index) => {
    player.rank = index + 1;
  });

  return {
    tournamentId: tournament._id,
    standings,
  };
};

/**
 * Idempotently syncs calculated scores and statistics back to TournamentPlayer records.
 * 
 * @param {string} tournamentId
 */
export const syncTournamentPlayerScores = async (tournamentId) => {
  const { standings } = await getTournamentStandings(tournamentId);
  for (const s of standings) {
    await TournamentPlayer.updateOne(
      { tournamentId, userId: s.playerId },
      {
        $set: {
          score: s.score,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          gamesPlayed: s.gamesPlayed,
        },
      }
    );
  }
};

export default {
  getTournamentStandings,
  syncTournamentPlayerScores,
};
