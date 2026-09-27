import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Unlink,
  Link as LinkIcon,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as lichessService from '../services/lichessService';

const ProfilePage = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [lichessStatus, setLichessStatus] = useState({
    connected: false,
    username: null,
    lichessUserId: null,
    connectedAt: null,
  });
  const [fetchingStatus, setFetchingStatus] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Fetch Lichess connection status
  const loadStatus = useCallback(async () => {
    try {
      setFetchingStatus(true);
      const data = await lichessService.getStatus();
      setLichessStatus(data);
    } catch (err) {
      console.error('Failed to load Lichess status:', err);
    } finally {
      setFetchingStatus(false);
    }
  }, []);

  // Parse callback search params if redirected from Lichess OAuth
  useEffect(() => {
    const statusParam = searchParams.get('lichess_status');
    const messageParam = searchParams.get('message');
    const usernameParam = searchParams.get('username');

    if (statusParam === 'success') {
      setNotification({
        type: 'success',
        message: `Lichess account connected successfully${usernameParam ? `: @${usernameParam}` : '.'}`,
      });
      // Clear query params from URL without reloading
      setSearchParams({}, { replace: true });
    } else if (statusParam === 'error') {
      setNotification({
        type: 'error',
        message: messageParam || 'Lichess connection was cancelled or could not be completed.',
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (isAuthenticated) {
      loadStatus();
    }
  }, [isAuthenticated, authLoading, navigate, loadStatus]);

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      setNotification(null);
      await lichessService.connect();
    } catch (err) {
      setActionLoading(false);
      setNotification({
        type: 'error',
        message: err.message || 'Failed to initiate Lichess connection.',
      });
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Lichess account?')) {
      return;
    }

    try {
      setActionLoading(true);
      setNotification(null);
      const result = await lichessService.disconnect();
      setNotification({
        type: 'success',
        message: result.message || 'Lichess account disconnected successfully.',
      });
      await loadStatus();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to disconnect Lichess account.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Banner Notifications */}
      {notification && (
        <div
          id="profile-notification"
          className={`p-4 rounded-xl border flex items-start space-x-3 text-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{notification.message}</div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-inner">
            {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-8 w-8" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{user.name}</h1>
            <p className="text-sm text-slate-500 flex items-center space-x-1.5 mt-0.5">
              <Mail className="h-3.5 w-3.5" />
              <span>{user.email}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
            <span>Account Type: <strong className="text-slate-700 capitalize">{user.authProvider}</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>Member since: <strong className="text-slate-700">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}</strong></span>
          </div>
        </div>
      </div>

      {/* Lichess Connection Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <span>Lichess Account</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-lg">
              Connect your personal Lichess account using OAuth 2.0 PKCE to enable seamless tournament pairing, rating verification, and game synchronization.
            </p>
          </div>
        </div>

        <div className="mt-5 p-5 bg-slate-50 rounded-xl border border-slate-200">
          {fetchingStatus ? (
            <div className="flex items-center space-x-2 text-slate-500 text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              <span>Checking Lichess connection status...</span>
            </div>
          ) : lichessStatus.connected ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div
                  id="lichess-connected-badge"
                  className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>✓ Connected as @{lichessStatus.username}</span>
                </div>
                {lichessStatus.connectedAt && (
                  <p className="text-xs text-slate-400 pl-1">
                    Connected on {new Date(lichessStatus.connectedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <a
                  href={`https://lichess.org/@/${lichessStatus.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition shadow-2xs"
                >
                  <span>View on Lichess</span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                </a>

                <button
                  onClick={handleDisconnect}
                  id="lichess-disconnect-button"
                  disabled={actionLoading}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5" />
                  )}
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-700">No Lichess account connected</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authorize CHESS JEENO to connect with your Lichess profile.
                </p>
              </div>

              <button
                onClick={handleConnect}
                id="lichess-connect-button"
                disabled={actionLoading}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4" />
                    <span>Connect Lichess</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
