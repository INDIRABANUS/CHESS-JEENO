import dotenv from 'dotenv';
import mongoose from 'mongoose';
import TournamentPlayer from '../models/TournamentPlayer.js';
import Round from '../models/Round.js';
import Pairing from '../models/Pairing.js';

dotenv.config();

const setupSmoke = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const tid = new mongoose.Types.ObjectId('6ab9353fcb4da21c4e409711');
  const hostId = new mongoose.Types.ObjectId('6ab9247f21bf370d6f44a86f');

  // 1. Ensure host is registered with early joinedAt
  await TournamentPlayer.findOneAndUpdate(
    { tournamentId: tid, userId: hostId },
    {
      tournamentId: tid,
      userId: hostId,
      score: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gamesPlayed: 0,
      joinedAt: new Date('2026-09-27T14:13:00.000Z'),
    },
    { upsert: true, new: true }
  );

  // 2. Remove orphaned mock round 2 & 3
  const allRounds = await Round.find({ tournamentId: tid });
  for (const r of allRounds) {
    if (r.roundNumber > 1) {
      await Pairing.deleteMany({ roundId: r._id });
      await Round.findByIdAndDelete(r._id);
    }
  }

  // 3. Set Round 1 byePlayer to host
  await Round.findOneAndUpdate(
    { tournamentId: tid, roundNumber: 1 },
    { byePlayer: hostId, status: 'PENDING' }
  );

  // 4. Ensure Pairing for Round 1 is ready with p6GtWsRf
  const p1 = await Pairing.findOne({ tournamentId: tid });
  console.log('Setup complete. R1 Pairing:', {
    id: p1._id,
    gameId: p1.lichessGameId,
    status: p1.status,
    result: p1.result,
  });
  const count = await Round.countDocuments({ tournamentId: tid });
  console.log('Total rounds now:', count);

  await mongoose.disconnect();
};

setupSmoke().catch(console.error);
