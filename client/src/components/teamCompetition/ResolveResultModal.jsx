import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, X, Shield, Loader2, Info } from 'lucide-react';

const ResolveResultModal = ({
  isOpen,
  onClose,
  boards = [],
  teamAName = 'Team A',
  teamBName = 'Team B',
  onResolve,
  loading = false,
}) => {
  // Find initially aborted boards if any
  const abortedBoards = boards.filter(
    (b) => (b.overrideResult || b.result) === 'ABORTED' || b.lichessStatus === 'ABORTED'
  );
  const defaultBoard = abortedBoards[0] || boards[0] || null;

  const [selectedBoardNumber, setSelectedBoardNumber] = useState(
    defaultBoard ? defaultBoard.boardNumber : 1
  );
  const [selectedResult, setSelectedResult] = useState('1/2-1/2');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState(null);

  if (!isOpen) return null;

  const currentBoard = boards.find((b) => b.boardNumber === Number(selectedBoardNumber));

  // Determine who is White and Black on this board
  const isOdd = Number(selectedBoardNumber) % 2 === 1;
  const whiteTeam = isOdd ? teamAName : teamBName;
  const blackTeam = isOdd ? teamBName : teamAName;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);

    if (!selectedBoardNumber) {
      setValidationError('Please select a board to resolve.');
      return;
    }
    if (!['1-0', '0-1', '1/2-1/2'].includes(selectedResult)) {
      setValidationError('Please choose a valid resolution result.');
      return;
    }
    if (!reason.trim()) {
      setValidationError('Please provide a short explanation or reason for the audit log.');
      return;
    }

    try {
      await onResolve({
        boardNumber: Number(selectedBoardNumber),
        result: selectedResult,
        reason: reason.trim(),
      });
      onClose();
    } catch (err) {
      setValidationError(err.response?.data?.message || err.message || 'Failed to resolve result');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-500/5 dark:bg-amber-500/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Resolve Board Result
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Organizer Decision & Match Recalculation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {validationError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Explanation Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              When games are aborted on Lichess, the system requires an authoritative decision.
              Resolving this board will automatically recalculate the team match score, determine the match winner, and update official standings.
            </p>
          </div>

          {/* Board Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Select Board
            </label>
            <select
              value={selectedBoardNumber}
              onChange={(e) => setSelectedBoardNumber(Number(e.target.value))}
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden transition"
            >
              {boards.map((b) => (
                <option key={b.boardNumber} value={b.boardNumber}>
                  Board {b.boardNumber} —{' '}
                  {b.overrideResult
                    ? `Overridden (${b.overrideResult})`
                    : b.result || b.lichessStatus || 'Pending'}
                </option>
              ))}
            </select>
          </div>

          {/* Current Board Color & Players Summary */}
          {currentBoard && (
            <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>White:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {whiteTeam} ({isOdd ? currentBoard.teamAPlayer?.name || 'Player' : currentBoard.teamBPlayer?.name || 'Player'})
                </span>
              </div>
              <div className="flex justify-between">
                <span>Black:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {blackTeam} ({isOdd ? currentBoard.teamBPlayer?.name || 'Player' : currentBoard.teamAPlayer?.name || 'Player'})
                </span>
              </div>
            </div>
          )}

          {/* Result Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
              Authoritative Board Result
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 1-0 White Wins */}
              <button
                type="button"
                onClick={() => setSelectedResult('1-0')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between min-h-[72px] ${
                  selectedResult === '1-0'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="font-black text-sm">1 - 0</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  White wins ({whiteTeam} +1.0)
                </div>
              </button>

              {/* 1/2-1/2 Draw */}
              <button
                type="button"
                onClick={() => setSelectedResult('1/2-1/2')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between min-h-[72px] ${
                  selectedResult === '1/2-1/2'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="font-black text-sm">½ - ½</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Draw (Both +0.5)
                </div>
              </button>

              {/* 0-1 Black Wins */}
              <button
                type="button"
                onClick={() => setSelectedResult('0-1')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between min-h-[72px] ${
                  selectedResult === '0-1'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="font-black text-sm">0 - 1</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Black wins ({blackTeam} +1.0)
                </div>
              </button>
            </div>
          </div>

          {/* Reason / Audit Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Reason / Explanation (Required)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              placeholder="e.g. Disconnected on move 1; mutual agreement to split point"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden transition"
              required
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30 min-h-[44px]"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Resolving...' : 'Confirm & Recalculate Match'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResolveResultModal;
