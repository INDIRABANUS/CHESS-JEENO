import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Save,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Shield,
  Loader2,
  Check,
} from 'lucide-react';

const TeamLineupManager = ({
  team,
  boards = [],
  boardCount = 4,
  teamSide = 'A', // 'A' | 'B'
  isLocked = false,
  lockedAt = null,
  activeMembers = [],
  onSaveLineup,
  onLockLineup,
  onUnlockLineup,
  onTogglePlayerReady,
  loading = false,
  matchStatus = 'LINEUP',
}) => {
  // Local state for board assignments: { [boardNumber]: playerId }
  const [assignments, setAssignments] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync initial board assignments from props
  useEffect(() => {
    const initialMap = {};
    boards.forEach((b) => {
      const player = teamSide === 'A' ? b.teamAPlayer : b.teamBPlayer;
      initialMap[b.boardNumber] = player?._id || '';
    });
    setAssignments(initialMap);
    setHasChanges(false);
    setErrorMsg('');
  }, [boards, teamSide]);

  const handlePlayerChange = (boardNumber, playerId) => {
    setErrorMsg('');
    setAssignments((prev) => ({
      ...prev,
      [boardNumber]: playerId,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setErrorMsg('');
    // Check duplicates locally before sending
    const selectedPlayerIds = Object.values(assignments).filter(Boolean);
    const uniqueIds = new Set(selectedPlayerIds);
    if (uniqueIds.size !== selectedPlayerIds.length) {
      setErrorMsg('A player cannot occupy multiple boards in the same match.');
      return;
    }

    const payload = [];
    for (let i = 1; i <= boardCount; i++) {
      payload.push({
        boardNumber: i,
        playerId: assignments[i] || null,
      });
    }

    try {
      await onSaveLineup(payload);
      setHasChanges(false);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save lineup');
    }
  };

  // Readiness calculation
  const allBoardsFilled = Array.from({ length: boardCount }, (_, idx) => idx + 1).every(
    (bNum) => Boolean(assignments[bNum])
  );

  const allPlayersReady = boards.every((b) => {
    const isReady = teamSide === 'A' ? b.teamAReady : b.teamBReady;
    const player = teamSide === 'A' ? b.teamAPlayer : b.teamBPlayer;
    return Boolean(player) && Boolean(isReady);
  });

  const canLock = allBoardsFilled && allPlayersReady && !hasChanges && !isLocked;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              Captain Control
            </span>
            {isLocked ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                <Lock className="h-3 w-3" />
                <span>Lineup Locked</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                <Unlock className="h-3 w-3" />
                <span>Editable</span>
              </span>
            )}
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            Your Team Lineup: {team?.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select an active player for each board and confirm their readiness before locking.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isLocked ? (
            <>
              <button
                onClick={handleSave}
                disabled={loading || !hasChanges}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  hasChanges
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Save Lineup</span>
              </button>

              <button
                onClick={onLockLineup}
                disabled={loading || !canLock}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  canLock
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
                title={
                  !canLock
                    ? 'All boards must be filled and marked ready before locking'
                    : 'Lock lineup'
                }
              >
                <Lock className="h-4 w-4" />
                <span>Lock Team Lineup</span>
              </button>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 mr-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>
                  Locked {lockedAt ? new Date(lockedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              {matchStatus !== 'COMPLETED' && matchStatus !== 'CANCELLED' && onUnlockLineup && (
                <button
                  onClick={onUnlockLineup}
                  disabled={loading}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center space-x-2"
                >
                  <Unlock className="h-4 w-4 text-amber-500" />
                  <span>Unlock Lineup</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Error or validation banners */}
      {errorMsg && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!isLocked && (!allBoardsFilled || !allPlayersReady) && (
        <div className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs flex items-start space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <span className="font-bold">Requirements to Lock Lineup: </span>
            {!allBoardsFilled && <span>Every board must have an assigned player. </span>}
            {hasChanges && <span>Save your pending lineup changes first. </span>}
            {allBoardsFilled && !allPlayersReady && (
              <span>All players on your team must confirm readiness. Captains may also toggle readiness for their players below.</span>
            )}
          </div>
        </div>
      )}

      {/* Board Selector List */}
      <div className="mt-6 space-y-4">
        {Array.from({ length: boardCount }, (_, idx) => idx + 1).map((boardNum) => {
          const boardDoc = boards.find((b) => b.boardNumber === boardNum);
          const currentSelectedPlayerId = assignments[boardNum] || '';
          const isPlayerReady = boardDoc ? (teamSide === 'A' ? boardDoc.teamAReady : boardDoc.teamBReady) : false;

          return (
            <div
              key={boardNum}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  #{boardNum}
                </span>
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    Board {boardNum}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {teamSide === 'A' ? 'White pieces' : 'Black pieces'}
                  </div>
                </div>
              </div>

              {/* Player Selector & Status */}
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <select
                  value={currentSelectedPlayerId}
                  onChange={(e) => handlePlayerChange(boardNum, e.target.value)}
                  disabled={isLocked || loading}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition min-w-[200px]"
                >
                  <option value="">-- Select Player --</option>
                  {activeMembers.map((member) => {
                    const memberUser = member.user || member;
                    const isAlreadySelectedElsewhere = Object.entries(assignments).some(
                      ([bN, pId]) => parseInt(bN, 10) !== boardNum && pId === memberUser._id
                    );

                    return (
                      <option
                        key={memberUser._id}
                        value={memberUser._id}
                        disabled={isAlreadySelectedElsewhere}
                      >
                        {memberUser.name} {isAlreadySelectedElsewhere ? '(Assigned on other board)' : ''}
                      </option>
                    );
                  })}
                </select>

                {/* Readiness status & Captain toggle */}
                {currentSelectedPlayerId && boardDoc && (
                  <div className="flex items-center space-x-2 shrink-0">
                    {isPlayerReady ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                        <Clock className="h-3 w-3" />
                        <span>Pending</span>
                      </span>
                    )}

                    {!isLocked && onTogglePlayerReady && (
                      <button
                        type="button"
                        onClick={() => onTogglePlayerReady(boardNum, !isPlayerReady)}
                        disabled={loading}
                        className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                      >
                        {isPlayerReady ? 'Set Pending' : 'Mark Ready'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamLineupManager;
