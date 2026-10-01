import React, { useState, useRef, useEffect } from 'react';
import { Share2, Copy, Check, X, Users, AlertCircle } from 'lucide-react';

/**
 * TournamentInviteModal — modal dialog for tournament hosts to copy and share
 * the tournament invitation link.
 *
 * Props:
 * @param {boolean}  isOpen             – Visibility state of the modal
 * @param {Function} onClose            – Dismiss modal callback
 * @param {Object}   tournament         – Tournament document
 * @param {Function} [setSuccessMessage] – Optional parent notification callback
 */
const TournamentInviteModal = ({
  isOpen,
  onClose,
  tournament,
  setSuccessMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [hasWebShare, setHasWebShare] = useState(false);
  const inputRef = useRef(null);

  const tournamentId = tournament?._id || tournament?.id;
  const shareUrl =
    typeof window !== 'undefined' && tournamentId
      ? `${window.location.origin}/tournaments/${tournamentId}`
      : `/tournaments/${tournamentId || ''}`;

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setHasWebShare(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setCopyFeedback(null);
      // Auto-focus and select input after modal opens
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen || !tournament) return null;

  const handleCopy = async () => {
    setCopyFeedback(null);

    // 1. Try modern Clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setCopyFeedback({ type: 'success', text: 'Invite link copied to clipboard!' });
        if (setSuccessMessage) {
          setSuccessMessage('Invite link copied to clipboard!');
          setTimeout(() => setSuccessMessage(null), 3000);
        }
        setTimeout(() => setCopied(false), 3000);
        return;
      } catch (err) {
        // Fallback to legacy execCommand if clipboard.writeText was rejected
      }
    }

    // 2. Fallback: Select input element and execCommand('copy')
    try {
      if (inputRef.current) {
        inputRef.current.select();
        inputRef.current.setSelectionRange(0, 99999); // For mobile devices
        const successful = document.execCommand('copy');
        if (successful) {
          setCopied(true);
          setCopyFeedback({ type: 'success', text: 'Invite link copied to clipboard!' });
          if (setSuccessMessage) {
            setSuccessMessage('Invite link copied to clipboard!');
            setTimeout(() => setSuccessMessage(null), 3000);
          }
          setTimeout(() => setCopied(false), 3000);
          return;
        }
      }
    } catch (err) {
      // execCommand failed
    }

    // 3. Fallback: Prompt user to copy manually
    if (inputRef.current) {
      inputRef.current.select();
      setCopyFeedback({
        type: 'info',
        text: 'Link selected! Press Ctrl+C (or Cmd+C) to copy.',
      });
    }
  };

  const handleNativeShare = async () => {
    if (!hasWebShare) return;

    try {
      await navigator.share({
        title: tournament.name || 'Chess Tournament',
        text: `Join the tournament "${tournament.name || 'Chess Tournament'}" on CHESS JEENO!`,
        url: shareUrl,
      });
      if (setSuccessMessage) {
        setSuccessMessage('Tournament link shared successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      // User cancelled share or share failed
      if (err.name !== 'AbortError') {
        setCopyFeedback({
          type: 'error',
          text: 'Unable to share via device dialog. Please copy the link below.',
        });
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Invite Players
              </h3>
              <p className="text-xs text-slate-500">
                Share this link with players to let them request to join
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tournament Summary Preview */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
          <div>
            <div className="font-semibold text-slate-800 truncate max-w-[240px]">
              {tournament.name}
            </div>
            <div className="text-slate-400 mt-0.5">
              {tournament.format} • {tournament.maxPlayers ? `Max ${tournament.maxPlayers} players` : 'Open capacity'}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {tournament.status}
          </span>
        </div>

        {/* Shareable Link Input & Copy Button */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Tournament Link
          </label>
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={shareUrl}
              onClick={(e) => e.target.select()}
              className="w-full text-xs font-mono bg-slate-50 text-slate-800 px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition select-all"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition shadow-xs shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>COPY LINK</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {copyFeedback && (
          <div
            className={`p-2.5 rounded-lg flex items-center space-x-2 text-xs font-medium ${
              copyFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : copyFeedback.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
            }`}
          >
            {copyFeedback.type === 'success' ? (
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-indigo-600 shrink-0" />
            )}
            <span>{copyFeedback.text}</span>
          </div>
        )}

        {/* Native Web Share Button (if supported) */}
        {hasWebShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition"
          >
            <Share2 className="h-3.5 w-3.5 text-slate-600" />
            <span>Share via Device / Apps...</span>
          </button>
        )}

        {/* Information Callout */}
        <div className="flex items-start space-x-2 text-[11px] text-slate-400 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
          <Users className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Players visiting this link can submit a join request. You will review and approve each player before they can participate.
          </span>
        </div>
      </div>
    </div>
  );
};

export default TournamentInviteModal;
