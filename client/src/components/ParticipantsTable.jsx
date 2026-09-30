import React from 'react';
import { Users } from 'lucide-react';

/**
 * ParticipantsTable — renders the tournament participants section.
 *
 * Props:
 * @param {Array}  players       – Array of registered player objects
 * @param {Object} tournament    – Tournament object (for maxPlayers and status)
 * @param {string} currentUserId – ID of current logged-in user
 * @param {string} creatorId     – ID of tournament creator/host
 */
const ParticipantsTable = ({
  players = [],
  tournament = {},
  currentUserId,
  creatorId,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <span>Participants</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered players competing in this tournament
          </p>
        </div>
        <div className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
          {players.length} / {tournament.maxPlayers ? `${tournament.maxPlayers} Players` : 'Open'}
        </div>
      </div>

      {/* Players List */}
      {players.length === 0 ? (
        <div className="p-12 text-center">
          <div className="p-3 bg-indigo-50 text-indigo-500 rounded-full inline-flex mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No Participants Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {tournament.status === 'REGISTRATION'
              ? 'Be the first player to register for this tournament!'
              : 'No players registered for this tournament.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 text-xs text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3 w-16">#</th>
                <th className="px-6 py-3">Player</th>
                <th className="px-6 py-3">Lichess ID</th>
                <th className="px-6 py-3 text-center">Ready</th>
                <th className="px-6 py-3">Joined</th>
                <th className="px-6 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {players.map((p, idx) => {
                const playerUserId = (p.userId?._id || p.userId?.id || p.userId)?.toString();
                const isPlayerHost = Boolean(
                  playerUserId &&
                  creatorId &&
                  playerUserId === creatorId
                );

                const isCurrent = Boolean(
                  currentUserId &&
                  playerUserId &&
                  playerUserId === currentUserId
                );

                return (
                  <tr
                    key={p._id}
                    className={`hover:bg-slate-50/80 transition ${
                      isCurrent ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    {/* Seed Number */}
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Player Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {p.userId?.avatar ? (
                          <img
                            src={p.userId.avatar}
                            alt={p.userId.name}
                            className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                            {(p.userId?.name || 'P')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center space-x-2">
                            <span>{p.userId?.name || 'Anonymous Player'}</span>
                            {isPlayerHost && (
                              <span className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded">
                                Host
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.userId?.email || ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Lichess Username */}
                    <td className="px-6 py-4 text-xs font-mono text-indigo-600">
                      {p.userId?.lichessUsername ? `@${p.userId.lichessUsername}` : '—'}
                    </td>

                    {/* Ready Status */}
                    <td className="px-6 py-4 text-center">
                      {p.isReady ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          READY ✓
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">
                          NOT READY
                        </span>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(p.joinedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    {/* Score */}
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded font-semibold text-xs">
                        {p.score ?? 0} pts
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ParticipantsTable;
