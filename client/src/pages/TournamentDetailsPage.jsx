import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Trophy,
  ArrowLeft,
  Clock,
  Users,
  Shield,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  UserPlus,
  UserMinus,
  UserCheck,
  PlusCircle,
  Swords,
  Zap,
  Share2,
} from 'lucide-react';
import {
  updateTournament,
  deleteTournament,
  getCurrentDevUser,
} from '../services/tournamentService';
import { useAuth } from '../context/AuthContext';
import { useTournamentDetails } from '../hooks/useTournamentDetails';
import { useTournamentSocket } from '../hooks/useTournamentSocket';
import { useTournamentLichessActions } from '../hooks/useTournamentLichessActions';
import { useTournamentPlayerActions } from '../hooks/useTournamentPlayerActions';
import { useTournamentHostActions } from '../hooks/useTournamentHostActions';
import { useTournamentRoundActions } from '../hooks/useTournamentRoundActions';
import RoundCard from '../components/RoundCard';
import StandingsTable from '../components/StandingsTable';
import ParticipantsTable from '../components/ParticipantsTable';
import MyPairingCard from '../components/MyPairingCard';
import EditTournamentModal from '../components/EditTournamentModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import KnockoutBracket from '../components/KnockoutBracket';
import TournamentCompletionSummary from '../components/TournamentCompletionSummary';
import MyTournamentResultCard from '../components/MyTournamentResultCard';
import CountdownBanner from '../components/CountdownBanner';
import TournamentSpecsGrid from '../components/TournamentSpecsGrid';
import JoinRequestsCard from '../components/JoinRequestsCard';
import TournamentInviteModal from '../components/TournamentInviteModal';
import { FORMAT_LABELS, STATUS_BADGES } from '../utils/constants';

const TournamentDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { user: authUser, isAuthenticated } = useAuth();
  const [currentUser, setCurrentUser] = useState(authUser || null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const {
    tournament,
    players,
    rounds,
    standings,
    loading,
    error,
    fetchTournamentData,
    setTournament,
    setRounds,
    setStandings,
  } = useTournamentDetails(id);

  // Realtime Socket.IO subscription
  useTournamentSocket({
    tournamentId: id,
    setRounds,
    setStandings,
    fetchTournamentData,
  });

  // Synchronize authUser into currentUser
  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
    } else if (import.meta.env.DEV) {
      getCurrentDevUser()
        .then((res) => {
          if (res && res.data) {
            setCurrentUser(res.data);
          }
        })
        .catch(() => {});
    }
  }, [authUser]);

  // Player action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);


  // Lichess actions and state
  const {
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
  } = useTournamentLichessActions({
    tournamentId: id,
    fetchTournamentData,
    setSuccessMessage,
  });

  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  // Delete State
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Countdown timer state
  const [countdownRemaining, setCountdownRemaining] = useState(null);

  // Derived user / host / registration status
  const currentUserId = (currentUser?._id || authUser?._id)?.toString();
  const creatorId = (
    tournament?.createdBy?._id ||
    tournament?.createdBy?.id ||
    tournament?.createdBy
  )?.toString();
  const isHost = Boolean(
    currentUserId &&
    creatorId &&
    currentUserId === creatorId
  );
  const isRegistered =
    Boolean(tournament?.isRegistered) ||
    (currentUserId &&
      players.some((p) => {
        const pUid = (p.userId?._id || p.userId?.id || p.userId)?.toString();
        return pUid && pUid === currentUserId;
      }));

  const joinRequestStatus =
    tournament?.joinRequestStatus ||
    (isRegistered ? 'PARTICIPANT' : 'NOT_REQUESTED');

  const isFull =
    Boolean(tournament?.maxPlayers) && players.length >= tournament.maxPlayers;

  // Derived progression & completion status
  const playerCount = players.length;
  const maxRounds =
    tournament?.format === 'ROUND_ROBIN' && playerCount >= 2
      ? playerCount % 2 === 0
        ? playerCount - 1
        : playerCount
      : tournament?.format === 'SWISS'
      ? Number(tournament?.totalRounds) || 0
      : tournament?.format === 'KNOCKOUT' && playerCount >= 2
      ? Math.ceil(Math.log2(playerCount))
      : 0;

  const allRoundsCreated = rounds.length > 0 && maxRounds > 0 && rounds.length >= maxRounds;

  const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const isLatestRoundComplete = Boolean(
    latestRound &&
    latestRound.pairings &&
    (latestRound.pairings.length === 0 ||
      latestRound.pairings.every((p) =>
        ['FINISHED', 'COMPLETED', 'BYE'].includes(p.status) ||
        ['1-0', '0-1', '1/2-1/2', 'WHITE_WIN', 'BLACK_WIN', 'DRAW', 'BYE'].includes(p.result)
      ))
  );

  const isTournamentComplete =
    tournament?.status === 'FINISHED' ||
    tournament?.status === 'COMPLETED' ||
    (allRoundsCreated && isLatestRoundComplete);

  // Current user's standing and active pairing
  const currentStanding = useMemo(() => {
    if (!currentUserId || !standings || standings.length === 0) return null;
    return standings.find((s) => {
      const sId = (s.playerId?._id || s.playerId?.id || s.playerId)?.toString();
      return sId && sId === currentUserId;
    });
  }, [standings, currentUserId]);

  // Find latest pairing for current user
  const myCurrentPairing = useMemo(() => {
    if (!currentUserId || rounds.length === 0) return null;
    for (let i = rounds.length - 1; i >= 0; i--) {
      const r = rounds[i];
      const match = (r.pairings || []).find((p) => {
        const wId = (p.whitePlayer?._id || p.whitePlayer?.id || p.whitePlayer)?.toString();
        const bId = (p.blackPlayer?._id || p.blackPlayer?.id || p.blackPlayer)?.toString();
        return wId === currentUserId || bId === currentUserId;
      });
      if (match) {
        const isWhite = (match.whitePlayer?._id || match.whitePlayer?.id || match.whitePlayer)?.toString() === currentUserId;
        const opponent = isWhite ? match.blackPlayer : match.whitePlayer;
        return {
          roundNumber: r.roundNumber,
          stageName: r.stageName,
          pairing: match,
          isWhite,
          opponent,
        };
      }
    }
    return null;
  }, [rounds, currentUserId]);


  // Readiness derived state
  const currentPlayerRecord = currentUserId
    ? players.find((p) => {
        const pUid = (p.userId?._id || p.userId?.id || p.userId)?.toString();
        return pUid === currentUserId;
      })
    : null;
  const isCurrentUserReady = Boolean(currentPlayerRecord?.isReady || tournament?.isCurrentUserReady);
  const readyPlayerCount = players.filter((p) => p.isReady).length || tournament?.readyPlayers || 0;
  const allPlayersReady = players.length >= 2 && readyPlayerCount === players.length;

  // Player actions
  const {
    handleJoin,
    handleLeave,
    handleToggleReady,
  } = useTournamentPlayerActions({
    tournamentId: id,
    isRegistered,
    isCurrentUserReady,
    fetchTournamentData,
    setSuccessMessage,
    setActionLoading,
    setActionError,
  });

  const handlePlayerJoinClick = () => {
    if (!isAuthenticated && !currentUserId) {
      navigate('/login', { state: { from: `/tournaments/${id}` } });
      return;
    }
    handleJoin();
  };

  // Host actions
  const {
    handleStartReadyCheck,
    handleStartCountdown,
    handleCancelCountdown,
    handleStartTournament,
  } = useTournamentHostActions({
    tournamentId: id,
    fetchTournamentData,
    setSuccessMessage,
    setActionLoading,
    setActionError,
  });

  // Countdown timer effect
  useEffect(() => {
    if (tournament?.status === 'COUNTDOWN' && tournament?.scheduledStartAt) {
      const targetTime = new Date(tournament.scheduledStartAt).getTime();
      const updateRemaining = () => {
        const diff = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
        setCountdownRemaining(diff);
        if (diff === 0 && isHost) {
          handleStartTournament();
        }
      };
      updateRemaining();
      const interval = setInterval(updateRemaining, 1000);
      return () => clearInterval(interval);
    } else {
      setCountdownRemaining(null);
    }
  }, [tournament?.status, tournament?.scheduledStartAt, isHost]);


  // Round creation actions and state
  const {
    handleCreateRound,
    createRoundLoading,
    roundError,
  } = useTournamentRoundActions({
    tournamentId: id,
    fetchTournamentData,
    setSuccessMessage,
  });


  const handleOpenEdit = () => {
    setEditFormData({
      name: tournament.name || '',
      description: tournament.description || '',
      format: tournament.format || 'SWISS',
      rated: Boolean(tournament.rated),
      clockLimit: tournament.clockLimit || 300,
      increment: tournament.increment || 0,
      maxPlayers: tournament.maxPlayers || '',
      startTime: tournament.startTime
        ? new Date(tournament.startTime).toISOString().slice(0, 16)
        : '',
    });
    setEditError(null);
    setIsEditing(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);

    try {
      const payload = {
        name: editFormData.name.trim(),
        description: editFormData.description.trim(),
        format: editFormData.format,
        rated: Boolean(editFormData.rated),
        clockLimit: Number(editFormData.clockLimit),
        increment: Number(editFormData.increment),
        maxPlayers: editFormData.maxPlayers ? Number(editFormData.maxPlayers) : null,
        startTime: editFormData.startTime
          ? new Date(editFormData.startTime).toISOString()
          : null,
      };

      const res = await updateTournament(id, payload);
      setTournament(res.data);
      setIsEditing(false);
      setSuccessMessage('Tournament details updated successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || 'Failed to update tournament');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    setActionError(null);
    try {
      await deleteTournament(id);
      navigate('/tournaments');
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to delete tournament');
      setIsDeleting(false);
      setDeleteLoading(false);
    }
  };

  const canDelete =
    tournament && (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION');

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 text-center max-w-2xl mx-auto">
        <Loader2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-300 text-sm">Loading tournament details...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-rose-200 dark:border-rose-900/50 p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Tournament Not Available</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{error || 'Unable to display tournament'}</p>
        <Link
          to="/tournaments"
          className="inline-flex items-center space-x-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Tournaments</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          to="/tournaments"
          className="inline-flex items-center space-x-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition self-start min-h-[40px] py-2 sm:min-h-0 sm:py-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Tournaments</span>
        </Link>

        {/* Organizer Action Buttons */}
        {isHost && (
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg shadow-sm transition min-h-[36px]"
              title="Share tournament link to invite players"
            >
              <Share2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>INVITE PLAYERS</span>
            </button>

            <button
              type="button"
              onClick={handleOpenEdit}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg shadow-sm transition min-h-[36px]"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>

            {canDelete && (
              <button
                type="button"
                onClick={() => setIsDeleting(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg shadow-sm transition min-h-[36px]"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-3 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Action Error Alert */}
      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center space-x-3 text-sm text-rose-800 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Tournament Details Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Banner Section */}
        <div className="p-4 sm:p-6 lg:p-8 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/20">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                STATUS_BADGES[tournament.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {tournament.status}
            </span>

            {tournament.rated ? (
              <span className="inline-flex items-center space-x-1 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-full">
                <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>Rated Match</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full">
                Casual
              </span>
            )}

            <span className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full">
              {FORMAT_LABELS[tournament.format] || tournament.format}
              {tournament.format === 'SWISS' && tournament.totalRounds ? ` (${tournament.totalRounds} Rounds)` : ''}
              {tournament.format === 'KNOCKOUT' && maxRounds > 0 ? ` (${maxRounds} Stages)` : ''}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight break-words">
            {tournament.name}
          </h1>

          {tournament.description ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
              {tournament.description}
            </p>
          ) : (
            <p className="mt-3 text-xs italic text-slate-400 dark:text-slate-500">
              No description provided for this tournament.
            </p>
          )}
        </div>

        {/* Specifications Grid */}
        <TournamentSpecsGrid
          tournament={tournament}
          players={players}
          readyPlayerCount={readyPlayerCount}
          allPlayersReady={allPlayersReady}
        />

        {/* Registration CTA & Readiness Banner */}
        {!isTournamentComplete && (
          <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <UserCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Tournament Participation & Readiness
              </h3>
              {['REGISTRATION', 'READY_CHECK'].includes(tournament.status) && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
                  {readyPlayerCount} / {players.length} READY
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {isRegistered ? (
                isCurrentUserReady ? (
                  <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold rounded border border-emerald-300 dark:border-emerald-800">
                    YOU ARE READY ✓
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold rounded border border-amber-300 dark:border-amber-800">
                    YOU ARE NOT READY
                  </span>
                )
              ) : joinRequestStatus === 'PENDING' ? (
                <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold rounded border border-amber-300 dark:border-amber-800 flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>REQUEST PENDING</span>
                </span>
              ) : joinRequestStatus === 'REJECTED' ? (
                <span className="px-2.5 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold rounded border border-rose-300 dark:border-rose-800 flex items-center space-x-1">
                  <X className="h-3 w-3" />
                  <span>REQUEST REJECTED</span>
                </span>
              ) : null}

              <span className="text-slate-500 dark:text-slate-400">
                {tournament.status === 'REGISTRATION'
                  ? isRegistered
                    ? 'Mark yourself ready when you are prepared for Round 1 pairings.'
                    : joinRequestStatus === 'PENDING'
                    ? 'Your join request is pending approval by the host.'
                    : joinRequestStatus === 'REJECTED'
                    ? 'Your join request was rejected by the tournament host.'
                    : isFull
                    ? 'This tournament has reached its maximum player limit.'
                    : 'Registration is currently open. Request to join now!'
                  : tournament.status === 'READY_CHECK'
                  ? 'Ready check in progress. Please confirm you are ready!'
                  : tournament.status === 'COUNTDOWN'
                  ? 'Tournament countdown is active. Starting soon!'
                  : tournament.status === 'RUNNING' || tournament.status === 'IN_PROGRESS'
                  ? 'Tournament is currently in progress.'
                  : tournament.status === 'FINISHED' || tournament.status === 'COMPLETED'
                  ? 'This tournament has concluded.'
                  : 'Registration is currently closed.'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 w-full md:w-auto">
            {/* Player Ready Toggle */}
            {isRegistered && ['REGISTRATION', 'READY_CHECK'].includes(tournament.status) && (
              <button
                onClick={handleToggleReady}
                disabled={actionLoading}
                className={`inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition shadow-sm w-full sm:w-auto min-h-[40px] ${
                  isCurrentUserReady
                    ? 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <span>{isCurrentUserReady ? 'MARK NOT READY' : "I'M READY ✓"}</span>
              </button>
            )}

            {/* Leave Tournament */}
            {isRegistered && tournament.status === 'REGISTRATION' && (
              <button
                onClick={handleLeave}
                disabled={actionLoading}
                className="inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold transition w-full sm:w-auto min-h-[40px]"
              >
                <UserMinus className="h-4 w-4" />
                <span>LEAVE</span>
              </button>
            )}

            {/* Non-participant Request States */}
            {!isRegistered && tournament.status === 'REGISTRATION' && (
              joinRequestStatus === 'PENDING' ? (
                <button
                  disabled
                  className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-800 cursor-default w-full sm:w-auto min-h-[40px]"
                >
                  <Clock className="h-4 w-4 text-amber-600 animate-pulse" />
                  <span>REQUEST PENDING</span>
                </button>
              ) : joinRequestStatus === 'REJECTED' ? (
                <button
                  disabled
                  className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold border border-rose-300 dark:border-rose-800 cursor-not-allowed w-full sm:w-auto min-h-[40px]"
                >
                  <X className="h-4 w-4 text-rose-600" />
                  <span>REQUEST REJECTED</span>
                </button>
              ) : isFull ? (
                <button
                  disabled
                  className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 w-full sm:w-auto min-h-[40px]"
                >
                  <Users className="h-4 w-4" />
                  <span>TOURNAMENT FULL</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePlayerJoinClick}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm w-full sm:w-auto min-h-[40px]"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  <span>REQUEST TO JOIN</span>
                </button>
              )
            )}

            {/* Host Controls */}
            {isHost && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 sm:pl-2 sm:ml-1">
                {['REGISTRATION', 'READY_CHECK'].includes(tournament.status) && (
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(true)}
                    className="inline-flex items-center justify-center space-x-1 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold transition w-full sm:w-auto min-h-[40px]"
                    title="Share tournament link to invite players"
                  >
                    <Share2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>INVITE</span>
                  </button>
                )}

                {tournament.status === 'REGISTRATION' && (
                  <button
                    type="button"
                    onClick={handleStartReadyCheck}
                    disabled={actionLoading || players.length < 2}
                    title={players.length < 2 ? 'At least 2 players required' : 'Prompt all players for ready confirmation'}
                    className="inline-flex items-center justify-center space-x-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition shadow-sm disabled:opacity-50 w-full sm:w-auto min-h-[40px]"
                  >
                    <span>START READY CHECK</span>
                  </button>
                )}

                {['REGISTRATION', 'READY_CHECK'].includes(tournament.status) && (
                  <>
                    <button
                      onClick={handleStartCountdown}
                      disabled={actionLoading || !allPlayersReady}
                      title={
                        !allPlayersReady
                          ? players.length < 2
                            ? 'At least 2 players are required'
                            : `${readyPlayerCount} of ${players.length} players are ready. All players must be ready.`
                          : 'Start 60-second tournament countdown'
                      }
                      className="inline-flex items-center justify-center space-x-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition shadow-sm disabled:opacity-50 w-full sm:w-auto min-h-[40px]"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>COUNTDOWN (60s)</span>
                    </button>

                    <button
                      onClick={handleStartTournament}
                      disabled={actionLoading || !allPlayersReady}
                      title={
                        !allPlayersReady
                          ? `${readyPlayerCount} of ${players.length} players ready. All players must be ready to start.`
                          : 'Immediately start tournament and generate pairings'
                      }
                      className="inline-flex items-center justify-center space-x-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition shadow-sm disabled:opacity-50 w-full sm:w-auto min-h-[40px]"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      <span>START NOW</span>
                    </button>
                  </>
                )}

                {tournament.status === 'COUNTDOWN' && (
                  <>
                    <button
                      onClick={handleStartTournament}
                      disabled={actionLoading}
                      className="inline-flex items-center justify-center space-x-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm w-full sm:w-auto min-h-[40px]"
                    >
                      <span>START NOW</span>
                    </button>
                    <button
                      onClick={handleCancelCountdown}
                      disabled={actionLoading}
                      className="inline-flex items-center justify-center space-x-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition shadow-sm w-full sm:w-auto min-h-[40px]"
                    >
                      <span>CANCEL COUNTDOWN</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Creator Info Footer */}
        <div className="px-4 sm:px-6 lg:px-8 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <span>Organized by </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {tournament.createdBy?.name || 'CHESS JEENO Host'}
            </span>
            {tournament.createdBy?.lichessUsername && (
              <span className="ml-1 text-indigo-600 dark:text-indigo-400 font-mono">
                (@{tournament.createdBy.lichessUsername})
              </span>
            )}
          </div>
          <div>
            Created on{' '}
            {new Date(tournament.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
      </div>

      {/* Live Countdown Banner */}
      {tournament.status === 'COUNTDOWN' && (
        <CountdownBanner
          countdownRemaining={countdownRemaining}
          isHost={isHost}
          actionLoading={actionLoading}
          onStartTournament={handleStartTournament}
          onCancelCountdown={handleCancelCountdown}
        />
      )}

      {/* Personal Match / Result Card (Sections 19, 20, 21) */}
      {isRegistered && myCurrentPairing && (
        <MyPairingCard
          myCurrentPairing={myCurrentPairing}
          currentStanding={currentStanding}
          rematchLoading={rematchLoading}
          syncLoading={syncLoading}
          onRematch={handleRematch}
          onSyncResult={handleSyncResult}
        />
      )}

      {/* Tournament Completed Summary & Participant Result */}
      {isTournamentComplete && (
        <div className="space-y-4">
          <TournamentCompletionSummary
            tournament={tournament}
            standings={standings}
            players={players}
            onShare={() => setIsInviteOpen(true)}
          />
          <MyTournamentResultCard
            standings={standings}
            currentUserId={currentUserId}
            tournament={tournament}
          />
        </div>
      )}

      {/* Standings Section */}
      <StandingsTable
        standings={standings}
        rounds={rounds}
        currentUserId={currentUserId}
        isCompleted={isTournamentComplete}
        winnerPlayerId={tournament?.winnerPlayer?._id || tournament?.winnerPlayer}
      />

      {/* Host Join Requests Management */}
      {isHost && ['REGISTRATION', 'READY_CHECK'].includes(tournament.status) && (
        <JoinRequestsCard
          tournamentId={id}
          pendingCount={tournament.pendingJoinRequestsCount || 0}
          onActionComplete={fetchTournamentData}
          setSuccessMessage={setSuccessMessage}
          onOpenInvite={() => setIsInviteOpen(true)}
        />
      )}

      {/* Participants Section */}
      <ParticipantsTable
        players={players}
        tournament={tournament}
        currentUserId={currentUserId}
        creatorId={creatorId}
      />

      {/* Rounds & Pairings Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Swords className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <span>Rounds & Pairings</span>
              {maxRounds > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {tournament.format === 'KNOCKOUT'
                    ? `Stage: ${rounds.length} / ${maxRounds}`
                    : `Round: ${rounds.length} / ${maxRounds}`}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tournament.format === 'SWISS'
                ? 'Swiss system match pairings and standings'
                : tournament.format === 'KNOCKOUT'
                ? 'Single-elimination knockout bracket and stage pairings'
                : 'Round Robin schedule and match pairings'}
            </p>
          </div>

          {/* CREATE ROUND / CREATE NEXT ROUND Control added running and in progress logic*/}
          {['REGISTRATION', 'RUNNING', 'IN_PROGRESS'].includes(tournament.status) && (
            <div className="flex flex-col sm:items-end space-y-1 w-full sm:w-auto">
              {rounds.length === 0 ? (
                isHost && (
                  <button
                    onClick={handleCreateRound}
                    disabled={createRoundLoading || players.length < 2}
                    title={
                      players.length < 2
                        ? 'At least 2 players are required to create a round'
                        : 'Generate Round 1 pairings'
                    }
                    className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm w-full sm:w-auto min-h-[40px]"
                  >
                    {createRoundLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    <span>{createRoundLoading ? 'Generating...' : 'CREATE ROUND'}</span>
                  </button>
                )
              ) : allRoundsCreated ? (
                <span className="inline-flex items-center justify-center space-x-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg w-full sm:w-auto min-h-[36px]">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>All {rounds.length} Rounds Created</span>
                </span>
              ) : isHost ? (
                <div className="flex flex-col sm:items-end w-full sm:w-auto">
                  <button
                    onClick={handleCreateRound}
                    disabled={createRoundLoading || !isLatestRoundComplete}
                    title={
                      !isLatestRoundComplete
                        ? 'Finish and sync all games before creating the next round.'
                        : `Create Round ${rounds.length + 1}`
                    }
                    className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm w-full sm:w-auto min-h-[40px]"
                  >
                    {createRoundLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    <span>
                      {createRoundLoading
                        ? 'Creating Round...'
                        : tournament.format === 'KNOCKOUT'
                        ? 'CREATE NEXT STAGE'
                        : `CREATE NEXT ROUND (Round ${rounds.length + 1})`}
                    </span>
                  </button>
                  {!isLatestRoundComplete && (
                    <span className="text-xs sm:text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1 text-left sm:text-right">
                      Finish and sync all games before creating the next round.
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Round Creation Error Message */}
        {roundError && (
          <div className="mx-3.5 sm:mx-6 mt-3 sm:mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
            <span>{roundError}</span>
          </div>
        )}

        {/* Lichess Game Error Alert */}
        {gameError && (
          <div className="mx-3.5 sm:mx-6 mt-3 sm:mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
              <span>{gameError}</span>
            </div>
            <button
              onClick={() => setGameError(null)}
              className="text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 min-h-[40px] min-w-[40px] inline-flex items-center justify-center -mr-2 -my-2"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Knockout Bracket Stage Progression View */}
        {tournament.format === 'KNOCKOUT' && rounds.length > 0 && (
          <KnockoutBracket rounds={rounds} />
        )}

        {/* Rounds Content */}
        {rounds.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 rounded-full inline-flex mb-3">
              <Swords className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">No Rounds Created Yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {players.length < 2
                ? 'Register at least 2 players to enable round and pairing generation.'
                : 'Players are registered! Click "CREATE ROUND" to generate Round 1 pairings.'}
            </p>
          </div>
        ) : (
          <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
            {rounds.map((round) => (
              <RoundCard
                key={round._id}
                round={round}
                currentUserId={currentUserId}
                isHost={isHost}
                roundBulkLoading={roundBulkLoading}
                pairingGameLoading={pairingGameLoading}
                syncLoading={syncLoading}
                rematchLoading={rematchLoading}
                isTournamentComplete={isTournamentComplete}
                onCreateAllGames={handleCreateAllRoundGames}
                onCreateGame={handleCreatePairingGame}
                onSyncResult={handleSyncResult}
                onRematch={handleRematch}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Tournament Modal */}
      <EditTournamentModal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        formData={editFormData}
        onChange={setEditFormData}
        loading={editLoading}
        error={editError}
        onSubmit={handleSaveEdit}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleting}
        onClose={() => setIsDeleting(false)}
        onConfirm={handleDelete}
        tournamentName={tournament.name}
        loading={deleteLoading}
      />

      {/* Tournament Invite / Share Modal (Host only) */}
      {isHost && (
        <TournamentInviteModal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          tournament={tournament}
          setSuccessMessage={setSuccessMessage}
        />
      )}
    </div>
  );
};

export default TournamentDetailsPage;
