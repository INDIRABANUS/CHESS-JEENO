import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Trophy,
  ArrowLeft,
  Clock,
  Users,
  Calendar,
  Shield,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Layers,
  UserPlus,
  UserMinus,
  UserCheck,
  User,
  PlusCircle,
  Swords,
  ChevronRight,
  ExternalLink,
  Zap,
  RefreshCw,
  Medal,
} from 'lucide-react';
import {
  getTournamentById,
  updateTournament,
  deleteTournament,
  getTournamentPlayers,
  joinTournament,
  leaveTournament,
  getCurrentDevUser,
  getTournamentRounds,
  createRound,
  createPairingLichessGame,
  createAllRoundLichessGames,
  syncPairingResult,
  getTournamentStandings,
  getRoundStatus,
} from '../services/tournamentService';
import { joinTournamentRoom, leaveTournamentRoom } from '../services/socket';

const FORMAT_LABELS = {
  SWISS: 'Swiss System',
  ROUND_ROBIN: 'Round Robin',
  KNOCKOUT: 'Single Elimination',
};

const STATUS_BADGES = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  REGISTRATION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RUNNING: 'bg-amber-50 text-amber-700 border-amber-200',
  FINISHED: 'bg-blue-50 text-blue-700 border-blue-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const formatTimeControl = (clockLimit, increment) => {
  if (!clockLimit) return 'N/A';
  const mins = Math.floor(clockLimit / 60);
  const secs = clockLimit % 60;
  let baseStr = '';
  if (mins > 0 && secs === 0) {
    baseStr = `${mins}m`;
  } else if (mins > 0) {
    baseStr = `${mins}m ${secs}s`;
  } else {
    baseStr = `${secs}s`;
  }
  return increment > 0 ? `${baseStr} + ${increment}s` : baseStr;
};

const formatDate = (dateString) => {
  if (!dateString) return 'Not scheduled';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Not scheduled';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TournamentDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [standings, setStandings] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Player action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Round creation state
  const [createRoundLoading, setCreateRoundLoading] = useState(false);
  const [roundError, setRoundError] = useState(null);

  // Lichess Game Creation state
  const [pairingGameLoading, setPairingGameLoading] = useState({});
  const [roundBulkLoading, setRoundBulkLoading] = useState({});
  const [syncLoading, setSyncLoading] = useState({});
  const [gameError, setGameError] = useState(null);

  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  // Delete State
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTournamentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tourneyRes, playersRes, userRes, roundsRes, standingsRes] = await Promise.all([
        getTournamentById(id),
        getTournamentPlayers(id),
        getCurrentDevUser().catch(() => ({ data: null })),
        getTournamentRounds(id).catch(() => ({ data: [] })),
        getTournamentStandings(id).catch(() => ({ data: { standings: [] } })),
      ]);

      setTournament(tourneyRes.data);
      setPlayers(playersRes.data || []);
      setRounds(roundsRes.data || []);
      setStandings(standingsRes.data?.standings || []);
      if (userRes && userRes.data) {
        setCurrentUser(userRes.data);
      }
    } catch (err) {
      setError(
        err.response?.status === 404
          ? 'Tournament not found'
          : err.response?.data?.message || err.message || 'Failed to load tournament'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournamentData();
  }, [id]);

  // Realtime Socket.IO subscription
  useEffect(() => {
    if (!id) return;

    const handleGameUpdate = (event) => {
      if (event.tournamentId && event.tournamentId !== id) return;

      setRounds((prevRounds) => {
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
      if (data.tournamentId && data.tournamentId !== id) return;
      if (data.standings && Array.isArray(data.standings)) {
        setStandings(data.standings);
      }
    };

    const handleRoundCompleted = (data) => {
      if (data.tournamentId && data.tournamentId !== id) return;
      setRounds((prevRounds) => {
        return prevRounds.map((r) => {
          if (r.roundNumber === data.roundNumber) {
            return { ...r, status: 'COMPLETED' };
          }
          return r;
        });
      });
    };

    joinTournamentRoom(id, {
      onGameStarted: handleGameUpdate,
      onGameState: handleGameUpdate,
      onGameFinished: (evt) => {
        handleGameUpdate(evt);
        fetchTournamentData();
      },
      onGameAborted: (evt) => {
        handleGameUpdate(evt);
        fetchTournamentData();
      },
      onStandingsUpdated: handleStandingsUpdate,
      onRoundCompleted: handleRoundCompleted,
    });

    return () => {
      leaveTournamentRoom(id);
    };
  }, [id]);

  // Derived registration status
  const currentUserId = currentUser?._id;
  const isRegistered =
    Boolean(tournament?.isRegistered) ||
    (currentUserId && players.some((p) => (p.userId?._id || p.userId) === currentUserId));

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
        ['FINISHED', 'COMPLETED', 'ABORTED', 'CANCELLED', 'BYE'].includes(p.status) ||
        ['1-0', '0-1', '1/2-1/2', 'WHITE_WIN', 'BLACK_WIN', 'DRAW', 'ABORTED', 'BYE'].includes(p.result)
      ))
  );

  const isTournamentComplete =
    tournament?.status === 'FINISHED' || (allRoundsCreated && isLatestRoundComplete);

  // Handle Joining Tournament
  const handleJoin = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await joinTournament(id);
      setSuccessMessage('You have successfully joined the tournament!');
      await fetchTournamentData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to join tournament'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Leaving Tournament
  const handleLeave = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await leaveTournament(id);
      setSuccessMessage('You have withdrawn from the tournament.');
      await fetchTournamentData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to leave tournament'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Round
  const handleCreateRound = async () => {
    setCreateRoundLoading(true);
    setRoundError(null);
    try {
      const res = await createRound(id);
      setSuccessMessage(
        `Round ${res.data.round.roundNumber} created successfully with ${res.data.pairings.length} pairing(s)!`
      );
      await fetchTournamentData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setRoundError(
        err.response?.data?.message || err.message || 'Failed to create round'
      );
    } finally {
      setCreateRoundLoading(false);
    }
  };

  // Handle Create Lichess Game for single pairing
  const handleCreatePairingGame = async (roundNumber, pairingId) => {
    setPairingGameLoading((prev) => ({ ...prev, [pairingId]: true }));
    setGameError(null);
    try {
      await createPairingLichessGame(id, roundNumber, pairingId);
      setSuccessMessage('Lichess game created successfully!');
      await fetchTournamentData();
      setTimeout(() => setSuccessMessage(null), 4000);
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
      const res = await createAllRoundLichessGames(id, roundNumber);
      const { created = 0, skipped = 0, failed = 0 } = res.data || {};
      let msg = `Round ${roundNumber}: ${created} game(s) created`;
      if (skipped > 0) msg += `, ${skipped} already existed`;
      if (failed > 0) msg += `, ${failed} failed`;
      setSuccessMessage(msg);
      await fetchTournamentData();
      setTimeout(() => setSuccessMessage(null), 5000);
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
      const res = await syncPairingResult(id, roundNumber, pairingId);
      const updatedPairing = res.data;
      const statusText = updatedPairing.status || 'UPDATED';
      const resultText = updatedPairing.result && updatedPairing.result !== 'PENDING' ? ` (${updatedPairing.result})` : '';
      setSuccessMessage(`Game synchronized: ${statusText}${resultText}`);
      await fetchTournamentData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setGameError(
        err.response?.data?.message || err.message || 'Failed to sync game result from Lichess'
      );
    } finally {
      setSyncLoading((prev) => ({ ...prev, [pairingId]: false }));
    }
  };

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
    try {
      await deleteTournament(id);
      navigate('/tournaments');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete tournament');
      setIsDeleting(false);
      setDeleteLoading(false);
    }
  };

  const canDelete =
    tournament && (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION');

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center max-w-2xl mx-auto">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 text-sm">Loading tournament details...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-rose-200 p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800 mb-1">Tournament Not Available</h2>
        <p className="text-sm text-slate-500 mb-6">{error || 'Unable to display tournament'}</p>
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
      <div className="flex items-center justify-between">
        <Link
          to="/tournaments"
          className="inline-flex items-center space-x-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Tournaments</span>
        </Link>

        {/* Organizer Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenEdit}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>

          {canDelete && (
            <button
              onClick={() => setIsDeleting(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg shadow-sm transition"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 text-sm text-emerald-800">
          <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Action Error Alert */}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-3 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Tournament Details Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Banner Section */}
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/20">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                STATUS_BADGES[tournament.status] || 'bg-slate-100 text-slate-700'
              }`}
            >
              {tournament.status}
            </span>

            {tournament.rated ? (
              <span className="inline-flex items-center space-x-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                <Shield className="h-3.5 w-3.5 text-amber-600" />
                <span>Rated Match</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                Casual
              </span>
            )}

            <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
              {FORMAT_LABELS[tournament.format] || tournament.format}
              {tournament.format === 'SWISS' && tournament.totalRounds ? ` (${tournament.totalRounds} Rounds)` : ''}
              {tournament.format === 'KNOCKOUT' && maxRounds > 0 ? ` (${maxRounds} Stages)` : ''}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {tournament.name}
          </h1>

          {tournament.description ? (
            <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-3xl">
              {tournament.description}
            </p>
          ) : (
            <p className="mt-3 text-xs italic text-slate-400">
              No description provided for this tournament.
            </p>
          )}

          {/* Tournament Champion Banner */}
          {tournament.status === 'FINISHED' && tournament.winnerPlayer && (
            <div className="mt-5 p-4 bg-gradient-to-r from-amber-500/15 via-yellow-400/25 to-amber-500/10 border-2 border-amber-300 rounded-xl flex items-center space-x-3.5 shadow-xs">
              <div className="p-2.5 bg-amber-500 text-white rounded-lg shadow-sm">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Tournament Champion</div>
                <div className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center space-x-2">
                  <span>{tournament.winnerPlayer?.name || 'Tournament Winner'}</span>
                  {tournament.winnerPlayer?.lichessUsername && (
                    <span className="text-xs font-mono text-amber-800 font-semibold">
                      (@{tournament.winnerPlayer.lichessUsername})
                    </span>
                  )}
                </div>
                <div className="text-xs text-amber-700 mt-0.5">
                  Winner of {tournament.name} ({FORMAT_LABELS[tournament.format] || tournament.format})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Specifications Grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-white">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center space-x-2 text-slate-500 text-xs mb-1">
              <Clock className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold uppercase tracking-wider">Time Control</span>
            </div>
            <div className="text-base font-bold text-slate-800">
              {formatTimeControl(tournament.clockLimit, tournament.increment)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {Math.floor(tournament.clockLimit / 60)} min base + {tournament.increment}s inc
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center space-x-2 text-slate-500 text-xs mb-1">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold uppercase tracking-wider">Format</span>
            </div>
            <div className="text-base font-bold text-slate-800">
              {FORMAT_LABELS[tournament.format] || tournament.format}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {tournament.format === 'SWISS' && tournament.totalRounds
                ? `${tournament.totalRounds} scheduled rounds`
                : tournament.format === 'ROUND_ROBIN'
                ? 'All-play-all schedule'
                : tournament.format === 'KNOCKOUT'
                ? 'Single-elimination bracket'
                : 'Standard tournament bracket'}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center space-x-2 text-slate-500 text-xs mb-1">
              <Users className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold uppercase tracking-wider">Players</span>
            </div>
            <div className="text-base font-bold text-slate-800">
              {players.length} / {tournament.maxPlayers ? tournament.maxPlayers : 'Open'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isFull ? 'Tournament Full' : 'Spots Available'}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center space-x-2 text-slate-500 text-xs mb-1">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold uppercase tracking-wider">Start Time</span>
            </div>
            <div className="text-sm font-bold text-slate-800 truncate">
              {formatDate(tournament.startTime)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {tournament.startTime ? 'Scheduled' : 'TBD'}
            </div>
          </div>
        </div>

        {/* Registration CTA Banner */}
        <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              <span>Tournament Participation</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {tournament.status === 'REGISTRATION'
                ? isRegistered
                  ? 'You are currently registered for this tournament.'
                  : isFull
                  ? 'This tournament has reached its maximum player limit.'
                  : 'Registration is currently open. Join now to secure your spot!'
                : tournament.status === 'RUNNING'
                ? 'Tournament is currently in progress. Registrations are closed.'
                : tournament.status === 'FINISHED'
                ? 'This tournament has concluded.'
                : 'Registration is currently closed.'}
            </p>
          </div>

          {/* Registration Buttons */}
          <div className="flex-shrink-0">
            {tournament.status === 'REGISTRATION' && (
              <>
                {isRegistered ? (
                  <button
                    onClick={handleLeave}
                    disabled={actionLoading}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition shadow-sm"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserMinus className="h-4 w-4" />
                    )}
                    <span>{actionLoading ? 'Leaving...' : 'LEAVE TOURNAMENT'}</span>
                  </button>
                ) : isFull ? (
                  <button
                    disabled
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-200 text-slate-500 cursor-not-allowed rounded-lg text-sm font-semibold border border-slate-300 shadow-none"
                  >
                    <Users className="h-4 w-4" />
                    <span>TOURNAMENT FULL</span>
                  </button>
                ) : (
                  <button
                    onClick={handleJoin}
                    disabled={actionLoading}
                    className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    <span>{actionLoading ? 'Joining...' : 'JOIN TOURNAMENT'}</span>
                  </button>
                )}
              </>
            )}

            {tournament.status === 'RUNNING' && (
              <span className="inline-flex items-center px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg border border-amber-300">
                Tournament in Progress
              </span>
            )}
          </div>
        </div>

        {/* Creator Info Footer */}
        <div className="px-6 sm:px-8 py-3.5 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            <span>Organized by </span>
            <span className="font-semibold text-slate-700">
              {tournament.createdBy?.name || 'CHESS JEENO Host'}
            </span>
            {tournament.createdBy?.lichessUsername && (
              <span className="ml-1 text-indigo-600 font-mono">
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

      {/* Tournament Complete Indicator */}
      {isTournamentComplete && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-sm text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs flex-shrink-0">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-wide flex items-center space-x-2">
                <span>TOURNAMENT COMPLETE</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-white/30 rounded-full">
                  All Rounds Finished
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                All scheduled Round Robin matches have concluded. Final standings are displayed below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Standings Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span>Standings</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live tournament standings calculated deterministically from match outcomes and BYEs
            </p>
          </div>
          {rounds.length > 0 && (
            <div className="text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
              After Round {rounds.length}
            </div>
          )}
        </div>

        {standings.length === 0 ? (
          <div className="p-8 text-center">
            <Trophy className="h-6 w-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              No standings available yet. Standings will populate as players register and matches conclude.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/75 text-xs text-slate-400 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 w-16 text-center">Rank</th>
                  <th className="px-6 py-3">Player</th>
                  <th className="px-6 py-3">Lichess</th>
                  <th className="px-6 py-3 text-center">Score</th>
                  <th className="px-4 py-3 text-center">W</th>
                  <th className="px-4 py-3 text-center">D</th>
                  <th className="px-4 py-3 text-center">L</th>
                  <th className="px-6 py-3 text-center">Games</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {standings.map((entry) => {
                  const isCurrent =
                    currentUserId &&
                    (entry.playerId === currentUserId ||
                      entry.playerId?._id === currentUserId);

                  return (
                    <tr
                      key={entry.playerId}
                      className={`hover:bg-slate-50/80 transition ${
                        isCurrent ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center font-bold text-xs rounded-full w-6 h-6 ${
                            entry.rank === 1
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : entry.rank === 2
                              ? 'bg-slate-200 text-slate-700 border border-slate-300'
                              : entry.rank === 3
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'text-slate-400 font-mono'
                          }`}
                        >
                          {entry.rank}
                        </span>
                      </td>

                      {/* Player Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {entry.avatar ? (
                            <img
                              src={entry.avatar}
                              alt={entry.name}
                              className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                              {(entry.name || 'P')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center space-x-2">
                              <span>{entry.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded">
                                  You
                                </span>
                              )}
                            </div>
                            {entry.email && (
                              <div className="text-[11px] text-slate-400">{entry.email}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Lichess Username */}
                      <td className="px-6 py-4 text-xs font-mono text-indigo-600">
                        {entry.lichessUsername ? `@${entry.lichessUsername}` : '—'}
                      </td>

                      {/* Score */}
                      <td className="px-6 py-4 text-center font-bold text-slate-900 text-sm">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 font-mono">
                          {entry.score} pts
                        </span>
                      </td>

                      {/* W */}
                      <td className="px-4 py-4 text-center font-semibold text-emerald-600 text-xs">
                        {entry.wins}
                      </td>

                      {/* D */}
                      <td className="px-4 py-4 text-center font-semibold text-slate-500 text-xs">
                        {entry.draws}
                      </td>

                      {/* L */}
                      <td className="px-4 py-4 text-center font-semibold text-rose-500 text-xs">
                        {entry.losses}
                      </td>

                      {/* Games */}
                      <td className="px-6 py-4 text-center text-xs text-slate-500 font-medium">
                        {entry.completedGames ?? entry.gamesPlayed ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Participants Section */}
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
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {players.map((p, idx) => {
                  const isHost =
                    p.userId?._id &&
                    tournament.createdBy?._id &&
                    p.userId._id.toString() === tournament.createdBy._id.toString();

                  const isCurrent =
                    currentUserId &&
                    p.userId?._id &&
                    p.userId._id.toString() === currentUserId.toString();

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
                              {isHost && (
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

      {/* Rounds & Pairings Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Swords className="h-5 w-5 text-indigo-600" />
              <span>Rounds & Pairings</span>
              {maxRounds > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {tournament.format === 'KNOCKOUT'
                    ? `Stage: ${rounds.length} / ${maxRounds}`
                    : `Round: ${rounds.length} / ${maxRounds}`}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tournament.format === 'SWISS'
                ? 'Swiss system match pairings and standings'
                : tournament.format === 'KNOCKOUT'
                ? 'Single-elimination knockout bracket and stage pairings'
                : 'Round Robin schedule and match pairings'}
            </p>
          </div>

          {/* CREATE ROUND / CREATE NEXT ROUND Control */}
          {tournament.status === 'REGISTRATION' && (
            <div className="flex flex-col items-end space-y-1">
              {rounds.length === 0 ? (
                <button
                  onClick={handleCreateRound}
                  disabled={createRoundLoading || players.length < 2}
                  title={
                    players.length < 2
                      ? 'At least 2 players are required to create a round'
                      : 'Generate Round 1 pairings'
                  }
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                >
                  {createRoundLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlusCircle className="h-4 w-4" />
                  )}
                  <span>{createRoundLoading ? 'Generating...' : 'CREATE ROUND'}</span>
                </button>
              ) : allRoundsCreated ? (
                <span className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span>All {rounds.length} Rounds Created</span>
                </span>
              ) : (
                <div className="flex flex-col items-end">
                  <button
                    onClick={handleCreateRound}
                    disabled={createRoundLoading || !isLatestRoundComplete}
                    title={
                      !isLatestRoundComplete
                        ? 'Finish and sync all games before creating the next round.'
                        : `Create Round ${rounds.length + 1}`
                    }
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
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
                    <span className="text-[11px] text-amber-700 font-medium mt-1">
                      Finish and sync all games before creating the next round.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Round Creation Error Message */}
        {roundError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
            <span>{roundError}</span>
          </div>
        )}

        {/* Lichess Game Error Alert */}
        {gameError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
              <span>{gameError}</span>
            </div>
            <button
              onClick={() => setGameError(null)}
              className="text-rose-500 hover:text-rose-700 p-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Knockout Bracket Stage Progression View */}
        {tournament.format === 'KNOCKOUT' && rounds.length > 0 && (
          <div className="p-6 bg-slate-50/70 border-b border-slate-200">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
              <Trophy className="h-4 w-4 text-indigo-600" />
              <span>Knockout Bracket Progression</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-2">
              {rounds.map((r) => {
                const stageTitle = r.stageName || (r.pairings?.length === 1 ? 'Final' : `Round ${r.roundNumber}`);
                return (
                  <div key={r._id} className="bg-white rounded-lg border border-slate-200 shadow-xs p-3 flex flex-col justify-between">
                    <div className="border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        {stageTitle}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {r.pairings?.length || 0} match(es)
                      </span>
                    </div>
                    <div className="space-y-2">
                      {r.pairings?.map((p, mIdx) => {
                        const wWinner = p.result === '1-0' || p.result === 'WHITE_WIN' || p.status === 'BYE' || p.result === 'BYE';
                        const bWinner = p.result === '0-1' || p.result === 'BLACK_WIN';
                        return (
                          <div key={p._id || mIdx} className="bg-slate-50/80 rounded border border-slate-200 p-2 text-xs space-y-1">
                            {/* White player slot */}
                            <div className={`flex items-center justify-between px-1 py-0.5 rounded ${wWinner ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'}`}>
                              <span className="truncate max-w-[130px]">{p.whitePlayer?.name || 'Player'}</span>
                              <span className="font-mono text-[11px] font-bold">
                                {p.status === 'BYE' || p.result === 'BYE' ? 'BYE' : p.result === '1-0' ? '1' : p.result === '0-1' ? '0' : p.result === '1/2-1/2' ? '½' : '—'}
                              </span>
                            </div>
                            {/* Black player slot */}
                            <div className={`flex items-center justify-between px-1 py-0.5 rounded ${bWinner ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'}`}>
                              <span className="truncate max-w-[130px] italic text-slate-500">
                                {p.status === 'BYE' || !p.blackPlayer ? 'BYE (Advances)' : (p.blackPlayer?.name || 'Player')}
                              </span>
                              <span className="font-mono text-[11px] font-bold">
                                {p.status === 'BYE' || !p.blackPlayer ? '' : p.result === '0-1' ? '1' : p.result === '1-0' ? '0' : p.result === '1/2-1/2' ? '½' : '—'}
                              </span>
                            </div>
                            {(wWinner || bWinner) && (
                              <div className="text-[10px] text-emerald-700 font-semibold pt-1 border-t border-slate-200/60 flex items-center space-x-1">
                                <span>Winner: {wWinner ? (p.whitePlayer?.name || 'White') : (p.blackPlayer?.name || 'Black')}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rounds Content */}
        {rounds.length === 0 ? (
          <div className="p-12 text-center">
            <div className="p-3 bg-indigo-50 text-indigo-500 rounded-full inline-flex mb-3">
              <Swords className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No Rounds Created Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {players.length < 2
                ? 'Register at least 2 players to enable round and pairing generation.'
                : 'Players are registered! Click "CREATE ROUND" to generate Round 1 pairings.'}
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {rounds.map((round) => {
              const roundPairings = round.pairings || [];
              const hasPendingGames = roundPairings.some(
                (p) =>
                  !p.lichessGameId &&
                  p.status !== 'BYE' &&
                  p.result !== 'BYE' &&
                  p.blackPlayer &&
                  !['FINISHED', 'COMPLETED', 'ABORTED', 'CANCELLED'].includes(p.status)
              );
              const isRoundBulkLoading = Boolean(roundBulkLoading[round.roundNumber]);

              const completedGamesCount = roundPairings.filter((p) =>
                ['FINISHED', 'COMPLETED', 'ABORTED', 'CANCELLED', 'BYE'].includes(p.status) ||
                ['1-0', '0-1', '1/2-1/2', 'WHITE_WIN', 'BLACK_WIN', 'DRAW', 'ABORTED', 'BYE'].includes(p.result)
              ).length;
              const isRoundDone =
                roundPairings.length === 0 || completedGamesCount === roundPairings.length;

              return (
                <div
                  key={round._id}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40"
                >
                  {/* Round Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-slate-900 text-base">
                        {round.stageName ? `${round.stageName} (Round ${round.roundNumber})` : `Round ${round.roundNumber}`}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                          isRoundDone
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isRoundDone ? 'FINISHED' : 'IN PROGRESS'}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {completedGamesCount} / {roundPairings.length} games complete
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-slate-500 font-medium">
                        {round.pairings?.length || 0} Match(es)
                      </span>

                      {/* CREATE ALL LICHESS GAMES Button */}
                      {hasPendingGames && (
                        <button
                          onClick={() => handleCreateAllRoundGames(round.roundNumber)}
                          disabled={isRoundBulkLoading}
                          title="Create Lichess games for all eligible pairings in this round"
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                        >
                          {isRoundBulkLoading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                              <span>CREATING GAMES...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="h-3.5 w-3.5 text-indigo-600" />
                              <span>CREATE ALL LICHESS GAMES</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* BYE Player Notice (if any) */}
                  {round.byePlayer && (
                    <div className="mx-4 mt-3 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between text-xs text-indigo-900">
                      <span className="font-medium">
                        Player on BYE: <span className="font-bold">{round.byePlayer.name}</span>
                        {round.byePlayer.lichessUsername && (
                          <span className="font-mono text-indigo-600 ml-1">
                            (@{round.byePlayer.lichessUsername})
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] bg-white text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-200">
                        BYE
                      </span>
                    </div>
                  )}

                  {/* Pairings List */}
                  <div className="p-4">
                    {round.pairings && round.pairings.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {round.pairings.map((pairing, pIdx) => {
                          const isPairingLoading = Boolean(pairingGameLoading[pairing._id]);
                          const isGameReady = Boolean(pairing.lichessGameId);
                          const isBye = pairing.status === 'BYE' || pairing.result === 'BYE' || !pairing.blackPlayer;

                          return (
                            <div
                              key={pairing._id}
                              className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs"
                            >
                              {/* Board / Match Number */}
                              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                                <span>Board {pIdx + 1}</span>
                              </div>

                              {/* Matchup: White vs Black */}
                              <div className="flex-1 flex items-center justify-center space-x-4">
                                {/* White Player */}
                                <div className="flex items-center space-x-2 flex-1 justify-end text-right">
                                  <div>
                                    <div className="text-xs font-semibold text-slate-900">
                                      {pairing.whitePlayer?.name || 'Player'}
                                    </div>
                                    {pairing.whitePlayer?.lichessUsername && (
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        @{pairing.whitePlayer.lichessUsername}
                                      </div>
                                    )}
                                  </div>
                                  <span
                                    className="w-5 h-5 rounded-full bg-white border-2 border-slate-700 flex items-center justify-center text-xs font-bold text-slate-800 shadow-2xs"
                                    title="White Pieces"
                                  >
                                    ♔
                                  </span>
                                </div>

                                {/* VS separator */}
                                <span className="text-xs font-bold text-slate-400 px-2 py-0.5 bg-slate-100 rounded">
                                  {isBye ? '—' : 'VS'}
                                </span>

                                {/* Black Player / BYE */}
                                {isBye ? (
                                  <div className="flex items-center space-x-2 flex-1 justify-start text-left">
                                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                                      BYE (Auto-Advance)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2 flex-1 justify-start text-left">
                                    <span
                                      className="w-5 h-5 rounded-full bg-slate-900 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-white shadow-2xs"
                                      title="Black Pieces"
                                    >
                                      ♚
                                    </span>
                                    <div>
                                      <div className="text-xs font-semibold text-slate-900">
                                        {pairing.blackPlayer?.name || 'Player'}
                                      </div>
                                      {pairing.blackPlayer?.lichessUsername && (
                                        <div className="text-[10px] text-slate-400 font-mono">
                                          @{pairing.blackPlayer.lichessUsername}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Match Status, Result & Lichess Actions */}
                              <div className="flex flex-wrap items-center space-x-2 text-xs self-end sm:self-center">
                                {/* Pairing Status Badge */}
                                <span
                                  className={`px-2 py-0.5 rounded font-semibold text-[11px] flex items-center space-x-1 ${
                                    isBye
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : pairing.status === 'FINISHED' || pairing.status === 'COMPLETED'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : pairing.status === 'ABORTED' || pairing.status === 'CANCELLED'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : pairing.status === 'ACTIVE' || pairing.status === 'READY'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {pairing.status === 'ACTIVE' ? (
                                    <>
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                                      <span>LIVE</span>
                                    </>
                                  ) : isBye ? (
                                    <span>BYE</span>
                                  ) : (
                                    <span>{pairing.status}</span>
                                  )}
                                </span>

                                {/* Realtime Clocks if available */}
                                {pairing.clocks && (typeof pairing.clocks.white === 'number' || typeof pairing.clocks.black === 'number') && (
                                  <span
                                    className="px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-600 bg-slate-50 border border-slate-200"
                                    title="Remaining clock time"
                                  >
                                    ⏱ {typeof pairing.clocks.white === 'number' ? `${Math.floor(pairing.clocks.white / 60)}:${String(pairing.clocks.white % 60).padStart(2, '0')}` : '—'} / {typeof pairing.clocks.black === 'number' ? `${Math.floor(pairing.clocks.black / 60)}:${String(pairing.clocks.black % 60).padStart(2, '0')}` : '—'}
                                  </span>
                                )}

                                {/* Realtime Last Move if available */}
                                {pairing.lastMove && (
                                  <span
                                    className="px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200"
                                    title={`Last move: ${pairing.lastMove}`}
                                  >
                                    Move: {pairing.lastMove}
                                  </span>
                                )}

                                {/* Lichess Raw Status Badge */}
                                {pairing.lichessStatus && (
                                  <span
                                    className="px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-500 bg-slate-100 border border-slate-200"
                                    title={`Lichess status: ${pairing.lichessStatus}`}
                                  >
                                    {pairing.lichessStatus}
                                  </span>
                                )}

                                {/* Result */}
                                <span
                                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                                    isBye
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : pairing.result && pairing.result !== 'PENDING'
                                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                      : 'text-slate-500 bg-slate-50 border border-slate-200'
                                  }`}
                                >
                                  {isBye ? 'BYE' : pairing.result === 'PENDING' ? '—' : pairing.result}
                                </span>

                                {/* Lichess Action Buttons */}
                                {isBye ? (
                                  <div className="flex items-center space-x-1 px-2.5 py-1 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span>AUTO-ADVANCED</span>
                                  </div>
                                ) : isGameReady ? (
                                  <div className="flex items-center space-x-1.5">
                                    {/* SYNC RESULT Button */}
                                    <button
                                      onClick={() => handleSyncResult(round.roundNumber, pairing._id)}
                                      disabled={Boolean(syncLoading[pairing._id])}
                                      title="Sync game result and status from Lichess"
                                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                      {Boolean(syncLoading[pairing._id]) ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          <span>SYNCING...</span>
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="h-3 w-3" />
                                          <span>SYNC RESULT</span>
                                        </>
                                      )}
                                    </button>

                                    {/* PLAY ON LICHESS Link */}
                                    <a
                                      href={
                                        pairing.lichessGameUrl ||
                                        `https://lichess.org/${pairing.lichessGameId}`
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                                      title="Open game on Lichess in a new tab"
                                    >
                                      <span>PLAY ON LICHESS</span>
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleCreatePairingGame(round.roundNumber, pairing._id)
                                    }
                                    disabled={isPairingLoading}
                                    title="Create real Lichess match for this pairing"
                                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition"
                                  >
                                    {isPairingLoading ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>CREATING GAME...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Zap className="h-3.5 w-3.5" />
                                        <span>CREATE LICHESS GAME</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center py-2">
                        No matches scheduled for this round.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Tournament Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-lg">Edit Tournament</h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tournament Name
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Format
                  </label>
                  <select
                    value={editFormData.format}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, format: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="SWISS">Swiss System</option>
                    <option value="ROUND_ROBIN">Round Robin</option>
                    <option value="KNOCKOUT">Single Elimination</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Players
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={editFormData.maxPlayers}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, maxPlayers: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clock Limit (Sec)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editFormData.clockLimit}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, clockLimit: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Increment (Sec)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editFormData.increment}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, increment: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={editFormData.startTime}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, startTime: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="ratedCheck"
                  checked={editFormData.rated}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, rated: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="ratedCheck" className="text-xs font-medium text-slate-700">
                  Rated Tournament
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {editLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-full inline-flex">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Delete Tournament?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold">"{tournament.name}"</span>?
                This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="inline-flex items-center space-x-1 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition"
              >
                {deleteLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                <span>{deleteLoading ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetailsPage;
