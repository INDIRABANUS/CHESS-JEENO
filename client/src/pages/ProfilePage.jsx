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
  Edit3,
  X,
  FileText,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as lichessService from '../services/lichessService';
import * as userService from '../services/userService';

const ProfilePage = () => {
  const { user, isAuthenticated, loading: authLoading, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local profile state
  const [profile, setProfile] = useState(user);
  const [fetchingProfile, setFetchingProfile] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formAvatar, setFormAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);

  // Lichess Status State
  const [lichessStatus, setLichessStatus] = useState({
    connected: false,
    username: null,
    lichessUserId: null,
    connectedAt: null,
  });
  const [fetchingStatus, setFetchingStatus] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Sync profile when auth user updates
  useEffect(() => {
    if (user) {
      setProfile((prev) => ({ ...prev, ...user }));
    }
  }, [user]);

  // Fetch fresh profile data from /api/users/me
  const loadProfile = useCallback(async () => {
    try {
      setFetchingProfile(true);
      const freshUser = await userService.getProfile();
      if (freshUser) {
        setProfile(freshUser);
        updateUser(freshUser);
      }
    } catch (err) {
      console.error('Failed to load fresh user profile:', err);
    } finally {
      setFetchingProfile(false);
    }
  }, [updateUser]);

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
      loadProfile();
      loadStatus();
    }
  }, [isAuthenticated, authLoading, navigate, loadProfile, loadStatus]);

  // Handle opening the Edit Profile modal
  const handleOpenEdit = () => {
    setFormName(profile?.name || '');
    setFormBio(profile?.bio || '');
    setFormAvatar(profile?.avatar || '');
    setFieldErrors({});
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    if (!saving) {
      setIsEditModalOpen(false);
      setFieldErrors({});
      setFormError(null);
    }
  };

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isEditModalOpen && !saving) {
        handleCloseEdit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen, saving]);

  // Validate single fields inline
  const validateForm = () => {
    const errors = {};
    const trimmedName = formName.trim();
    if (!trimmedName) {
      errors.name = 'Display name is required';
    } else if (trimmedName.length > 50) {
      errors.name = 'Display name cannot exceed 50 characters';
    }

    const trimmedBio = formBio.trim();
    if (trimmedBio.length > 500) {
      errors.bio = 'Bio cannot exceed 500 characters';
    }

    const trimmedAvatar = formAvatar.trim();
    if (trimmedAvatar) {
      try {
        const parsed = new URL(trimmedAvatar);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errors.avatar = 'Avatar must be a valid HTTP or HTTPS URL';
        }
      } catch {
        errors.avatar = 'Avatar must be a valid URL format (e.g. https://...)';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      const updatedUser = await userService.updateProfile({
        name: formName.trim(),
        bio: formBio.trim(),
        avatar: formAvatar.trim() || '',
      });

      setProfile(updatedUser);
      updateUser(updatedUser);
      setIsEditModalOpen(false);
      setNotification({
        type: 'success',
        message: 'Your profile has been successfully updated!',
      });
    } catch (err) {
      const errMsg =
        err.response?.data?.message || err.message || 'Failed to update profile. Please try again.';
      setFormError(errMsg);
    } finally {
      setSaving(false);
    }
  };

  // Lichess connect
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

  // Lichess disconnect
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
      await loadProfile();
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

  const activeUser = profile || user;
  if (!activeUser) return null;

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
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{notification.message}</div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-75 hover:opacity-100 cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center -mr-2 -my-2"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Profile Header & Identity Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4 min-w-0">
            {/* Avatar with fallback */}
            {activeUser.avatar ? (
              <img
                src={activeUser.avatar}
                alt={activeUser.name || 'User Avatar'}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-indigo-100 shadow-sm shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-inner shrink-0">
                {activeUser.name ? (
                  activeUser.name.charAt(0).toUpperCase()
                ) : (
                  <UserIcon className="h-8 w-8" />
                )}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  id="profile-display-name"
                  className="text-xl sm:text-2xl font-bold text-slate-800 truncate"
                >
                  {activeUser.name}
                </h1>
                {lichessStatus.connected && lichessStatus.username && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Check className="h-3 w-3" />
                    <span>@{lichessStatus.username}</span>
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-500 flex items-center space-x-1.5 mt-1 break-all">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>{activeUser.email}</span>
              </p>
            </div>
          </div>

          {/* Edit Profile Action */}
          <button
            onClick={handleOpenEdit}
            id="edit-profile-btn"
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition cursor-pointer min-h-[44px] shrink-0"
          >
            <Edit3 className="h-4 w-4 text-slate-600" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* About / Bio Section */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <FileText className="h-4 w-4 text-indigo-500" />
            <span>About</span>
          </h2>
          {!activeUser.bio && (
            <button
              onClick={handleOpenEdit}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer min-h-[44px] inline-flex items-center px-2"
            >
              + Add Bio
            </button>
          )}
        </div>

        <div className="pt-4">
          {activeUser.bio ? (
            <p
              id="profile-bio-text"
              className="text-sm text-slate-700 whitespace-pre-line leading-relaxed break-words"
            >
              {activeUser.bio}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">
              No bio added yet. Click &quot;Edit Profile&quot; to share your chess style, favorite openings, or background with the community.
            </p>
          )}
        </div>
      </div>

      {/* Account Details Section */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100">
          Account Details
        </h2>

        <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              Email Address
            </span>
            <span className="text-slate-800 font-medium mt-1 block break-all">
              {activeUser.email}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              Account Type
            </span>
            <div className="flex items-center space-x-1.5 mt-1">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              <span className="text-slate-800 font-semibold capitalize">
                {activeUser.authProvider}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              Member Since
            </span>
            <div className="flex items-center space-x-1.5 mt-1">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-slate-800 font-medium">
                {activeUser.createdAt ? new Date(activeUser.createdAt).toLocaleDateString() : 'Active'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Lichess Connection Section */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <span>Chess Account</span>
          </h2>
          <p className="text-sm sm:text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            Connect your personal Lichess account using OAuth 2.0 PKCE to enable seamless tournament pairing, rating verification, and game synchronization.
          </p>
        </div>

        <div className="mt-5 p-4 sm:p-5 bg-slate-50 rounded-xl border border-slate-200">
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
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">✓ Connected as @{lichessStatus.username}</span>
                </div>
                {lichessStatus.connectedAt && (
                  <p className="text-xs text-slate-400 pl-1">
                    Connected on {new Date(lichessStatus.connectedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://lichess.org/@/${lichessStatus.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition shadow-2xs min-h-[44px]"
                >
                  <span>View on Lichess</span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                </a>

                <button
                  onClick={handleDisconnect}
                  id="lichess-disconnect-button"
                  disabled={actionLoading}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50 min-h-[44px]"
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
                className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition shadow-sm cursor-pointer disabled:opacity-50 min-h-[44px]"
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

      {/* Edit Profile Modal Dialog */}
      {isEditModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 id="edit-profile-title" className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                <Edit3 className="h-5 w-5 text-indigo-600" />
                <span>Edit Profile</span>
              </h2>
              <button
                onClick={handleCloseEdit}
                disabled={saving}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 transition cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center -mr-2"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveProfile} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* General form error alert */}
                {formError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Display Name Field */}
                <div>
                  <label
                    htmlFor="profile-name-input"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                  >
                    Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="profile-name-input"
                    type="text"
                    required
                    maxLength={50}
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (fieldErrors.name) {
                        setFieldErrors((prev) => ({ ...prev, name: null }));
                      }
                    }}
                    placeholder="Your player name"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 min-h-[44px] transition ${
                      fieldErrors.name
                        ? 'border-rose-300 focus:ring-rose-500 bg-rose-50/30'
                        : 'border-slate-300 focus:ring-indigo-500 bg-white'
                    }`}
                  />
                  {fieldErrors.name ? (
                    <p className="text-xs text-rose-600 mt-1 font-medium">{fieldErrors.name}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">
                      {formName.length}/50 characters &bull; visible to other tournament players
                    </p>
                  )}
                </div>

                {/* Bio Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="profile-bio-input"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                    >
                      Personal Bio
                    </label>
                    <span
                      className={`text-xs ${
                        formBio.length > 500 ? 'text-rose-600 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {formBio.length}/500
                    </span>
                  </div>
                  <textarea
                    id="profile-bio-input"
                    rows={3}
                    maxLength={500}
                    value={formBio}
                    onChange={(e) => {
                      setFormBio(e.target.value);
                      if (fieldErrors.bio) {
                        setFieldErrors((prev) => ({ ...prev, bio: null }));
                      }
                    }}
                    placeholder="Tell players about your favorite chess openings, blitz style, or background..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 resize-none transition ${
                      fieldErrors.bio
                        ? 'border-rose-300 focus:ring-rose-500 bg-rose-50/30'
                        : 'border-slate-300 focus:ring-indigo-500 bg-white'
                    }`}
                  />
                  {fieldErrors.bio && (
                    <p className="text-xs text-rose-600 mt-1 font-medium">{fieldErrors.bio}</p>
                  )}
                </div>

                {/* Avatar URL Field */}
                <div>
                  <label
                    htmlFor="profile-avatar-input"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                  >
                    Avatar Image URL
                  </label>
                  <div className="flex items-center space-x-3">
                    {/* Live Preview Thumbnail */}
                    <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {formAvatar.trim() ? (
                        <img
                          src={formAvatar.trim()}
                          alt="Avatar preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <input
                        id="profile-avatar-input"
                        type="url"
                        value={formAvatar}
                        onChange={(e) => {
                          setFormAvatar(e.target.value);
                          if (fieldErrors.avatar) {
                            setFieldErrors((prev) => ({ ...prev, avatar: null }));
                          }
                        }}
                        placeholder="https://example.com/my-photo.jpg"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 min-h-[44px] transition ${
                          fieldErrors.avatar
                            ? 'border-rose-300 focus:ring-rose-500 bg-rose-50/30'
                            : 'border-slate-300 focus:ring-indigo-500 bg-white'
                        }`}
                      />
                    </div>
                  </div>
                  {fieldErrors.avatar ? (
                    <p className="text-xs text-rose-600 mt-1 font-medium">{fieldErrors.avatar}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">
                      Direct HTTP/HTTPS link to an image (PNG, JPG, WebP). Leave blank to use initials.
                    </p>
                  )}
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={saving}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer min-h-[44px] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  id="save-profile-btn"
                  disabled={saving}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition shadow-sm cursor-pointer min-h-[44px] disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
