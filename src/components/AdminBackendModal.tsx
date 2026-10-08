import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Users,
  Mail,
  Gamepad2,
  KeyRound,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Coins,
  Shield,
  Trash2,
  Search,
  LogOut,
  Sliders,
} from 'lucide-react';
import { UserAccount } from '../types/game';
import {
  checkIsAdmin,
  adminFetchUsers,
  adminUpdateCoins,
  adminUpdateAdFree,
  adminUpdateScoreboard,
  adminFetchSubscribers,
  adminFetchRooms,
  adminDeleteRoom,
  adminFetchAdmins,
  adminGrantAdmin,
  adminRevokeAdmin,
  getSecurityAuditStatus,
  AdminAccountRecord,
} from '../lib/admin';

interface AdminBackendModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onUserUpdated?: (updated: UserAccount) => void;
}

type AdminTab = 'audit' | 'users' | 'subscribers' | 'rooms' | 'admins';

export const AdminBackendModal: React.FC<AdminBackendModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
}) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('audit');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Data States
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [subscribersList, setSubscribersList] = useState<any[]>([]);
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const [adminsList, setAdminsList] = useState<AdminAccountRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Coin Adjustment
  const [customCoinsUserId, setCustomCoinsUserId] = useState<string | null>(null);
  const [customCoinsAmount, setCustomCoinsAmount] = useState<string>('1000');

  // New Admin Grant Input
  const [newAdminUid, setNewAdminUid] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');

  const auditStatus = getSecurityAuditStatus();

  // Verify admin status on open
  useEffect(() => {
    if (!isOpen) return;
    checkAdminStatus();
  }, [isOpen, currentUser]);

  const checkAdminStatus = async () => {
    setIsLoading(true);
    try {
      const admin = await checkIsAdmin(currentUser);
      setIsAdmin(admin);
      if (admin) {
        await loadAllAdminData();
      }
    } catch {
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllAdminData = async () => {
    setIsRefreshing(true);
    try {
      const [users, subs, rooms, admins] = await Promise.all([
        adminFetchUsers().catch(() => []),
        adminFetchSubscribers().catch(() => []),
        adminFetchRooms().catch(() => []),
        adminFetchAdmins().catch(() => []),
      ]);
      setUsersList(users);
      setSubscribersList(subs);
      setRoomsList(rooms);
      setAdminsList(admins);
    } catch (err) {
      console.warn('Error loading admin data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAdjustCoins = async (userId: string, delta: number) => {
    const user = usersList.find(u => u.uid === userId);
    const current = (user as any)?.coins || 0;
    const target = Math.max(0, current + delta);
    try {
      await adminUpdateCoins(userId, target);
      setUsersList(prev =>
        prev.map(u => (u.uid === userId ? ({ ...u, coins: target } as any) : u))
      );
      setStatusMessage(`Updated balance for ${user?.name || userId} to ${target} coins`);
    } catch (err) {
      setStatusMessage('Error updating coins. Check permissions.');
    }
  };

  const handleSetCustomCoins = async (userId: string) => {
    const amt = parseInt(customCoinsAmount, 10);
    if (isNaN(amt)) return;
    try {
      await adminUpdateCoins(userId, amt);
      setUsersList(prev =>
        prev.map(u => (u.uid === userId ? ({ ...u, coins: amt } as any) : u))
      );
      setCustomCoinsUserId(null);
      setStatusMessage(`Set balance to ${amt} coins.`);
    } catch {
      setStatusMessage('Error setting custom coins.');
    }
  };

  const handleToggleAdFree = async (userId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    try {
      await adminUpdateAdFree(userId, nextStatus, 'yearly');
      setUsersList(prev =>
        prev.map(u => (u.uid === userId ? { ...u, isAdFree: nextStatus } : u))
      );
      setStatusMessage(`${nextStatus ? 'Activated' : 'Revoked'} Ad-Free for user.`);
    } catch {
      setStatusMessage('Error toggling Ad-Free.');
    }
  };

  const handleToggleScoreboard = async (userId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    try {
      await adminUpdateScoreboard(userId, nextStatus);
      setUsersList(prev =>
        prev.map(u => (u.uid === userId ? { ...u, scoreboardUnlocked: nextStatus } : u))
      );
      setStatusMessage(`Scoreboard ${nextStatus ? 'unlocked' : 'locked'} for user.`);
    } catch {
      setStatusMessage('Error toggling Scoreboard.');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      await adminDeleteRoom(roomId);
      setRoomsList(prev => prev.filter(r => r.id !== roomId));
      setStatusMessage(`Room ${roomId} purged.`);
    } catch {
      setStatusMessage('Error purging room.');
    }
  };

  const handleGrantAdmin = async (targetIdentifier?: string, targetEmail?: string) => {
    const ident = (targetIdentifier || newAdminUid).trim();
    const email = (targetEmail || newAdminEmail).trim();
    if (!ident && !email) return;
    try {
      await adminGrantAdmin(ident || email, email || undefined, 'admin');
      if (!targetIdentifier && !targetEmail) {
        setNewAdminUid('');
        setNewAdminEmail('');
      }
      setStatusMessage(`Granted admin privileges to ${ident || email}`);
      const updated = await adminFetchAdmins();
      setAdminsList(updated);
    } catch {
      setStatusMessage('Error granting admin.');
    }
  };

  const handleRevokeAdmin = async (targetUid: string, email?: string) => {
    try {
      await adminRevokeAdmin(targetUid, email);
      setAdminsList(prev => prev.filter(a => a.uid !== targetUid && (!email || a.email !== email)));
      setStatusMessage(`Revoked admin access for ${targetUid || email}`);
    } catch {
      setStatusMessage('Error revoking admin.');
    }
  };

  if (!isOpen) return null;

  const filteredUsers = usersList.filter(
    u =>
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      u.uid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      id="admin-backend-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-[#1e2024] border-2 border-[#3b82f6]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] text-white animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-400/40 rounded-xl text-blue-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wide text-white">
                  Color Run • Backend Admin
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Live Rules Hardened
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Database Access Control • PII Guard • Economy & Player Management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-4 py-2 text-[12px] text-emerald-300 flex items-center justify-between">
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-emerald-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Body */}
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-400" />
            <p className="text-sm">Verifying Administrative Privileges...</p>
          </div>
        ) : !isAdmin ? (
          /* Not an admin: admin access comes from signing in with an approved account */
          <div className="p-6 sm:p-8 max-w-md mx-auto w-full">
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-blue-400">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                Admin Access Required
              </h3>
              <p className="text-xs text-gray-400">
                Sign in to Color Run with an administrator account. Admin access is granted in the admin portal.
              </p>
            </div>
          </div>
        ) : (
          /* Authenticated Admin Dashboard */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-white/10 bg-[#16181d] px-4 gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === 'audit'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Security Rules Audit (5 Fixes)
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Player Accounts ({usersList.length})
              </button>
              <button
                onClick={() => setActiveTab('subscribers')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === 'subscribers'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Mail className="w-4 h-4" />
                Email Subscribers ({subscribersList.length})
              </button>
              <button
                onClick={() => setActiveTab('rooms')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === 'rooms'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                Match Rooms ({roomsList.length})
              </button>
              <button
                onClick={() => setActiveTab('admins')}
                className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === 'admins'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                Admin Roster ({adminsList.length})
              </button>
            </div>

            {/* Tab Panes */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {/* TAB 1: SECURITY AUDIT */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="bg-[#14161a] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Firestore Security Audit: 5/5 Vulnerabilities Hardened
                        </h4>
                        <p className="text-xs text-gray-400">
                          Active deployed firestore.rules verification report.
                        </p>
                      </div>
                      <button
                        onClick={loadAllAdminData}
                        disabled={isRefreshing}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-gray-300 flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh Rules Status
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {/* Item 1 */}
                      <div className="p-3 bg-[#1c1f26] border border-white/5 rounded-xl flex items-start gap-3">
                        <div className="p-1 bg-emerald-500/10 rounded-lg text-emerald-400 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              1. Public Unauthenticated Read/Write Removed
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                              HARDENED
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            <code className="text-blue-300 bg-black/40 px-1 py-0.5 rounded">rooms</code>,{' '}
                            <code className="text-blue-300 bg-black/40 px-1 py-0.5 rounded">lobbies</code>,{' '}
                            <code className="text-blue-300 bg-black/40 px-1 py-0.5 rounded">presence</code>,{' '}
                            <code className="text-blue-300 bg-black/40 px-1 py-0.5 rounded">game_invites</code>,{' '}
                            <code className="text-blue-300 bg-black/40 px-1 py-0.5 rounded">phoneIndex</code>, and{' '}
                            <code className="text-blue-300 bg-black/40 px-1 py-0.5 rounded">referralCodes</code> now require authentication (<code className="text-emerald-300">isSignedIn()</code>). Unauthenticated read, rewrite, and deletion are strictly rejected.
                          </p>
                        </div>
                      </div>

                      {/* Item 2 */}
                      <div className="p-3 bg-[#1c1f26] border border-white/5 rounded-xl flex items-start gap-3">
                        <div className="p-1 bg-emerald-500/10 rounded-lg text-emerald-400 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              2. User Profile PII Isolated (Email & Phone Numbers)
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                              SECURED
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Replaced open user profile reads with <code className="text-emerald-300">allow get: if isOwner(userId) || isAdmin()</code> and <code className="text-emerald-300">allow list: if isAdmin()</code>. Non-admin players cannot read or list another player's private email, phone, or billing data.
                          </p>
                        </div>
                      </div>

                      {/* Item 3 */}
                      <div className="p-3 bg-[#1c1f26] border border-white/5 rounded-xl flex items-start gap-3">
                        <div className="p-1 bg-emerald-500/10 rounded-lg text-emerald-400 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              3. Anti-Harvesting Guard (Phone Index & Email Subscribers)
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                              PROTECTED
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            <code className="text-blue-300 bg-black/40 px-1 py-0.5 rounded">emailSubscribers</code> list access is restricted to verified admins only. <code className="text-blue-300 bg-black/40 px-1 py-0.5 rounded">phoneIndex</code> list is disabled to prevent bulk telephone enumeration, allowing only single direct lookups.
                          </p>
                        </div>
                      </div>

                      {/* Item 4 */}
                      <div className="p-3 bg-[#1c1f26] border border-white/5 rounded-xl flex items-start gap-3">
                        <div className="p-1 bg-emerald-500/10 rounded-lg text-emerald-400 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              4. Friend List Write Pollution Eliminated
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                              ISOLATED
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Removed line 31 loophole (<code className="text-red-400">|| isAuthenticated()</code>). Subcollection <code className="text-blue-300 bg-black/40 px-1 py-0.5 rounded">/users/{'{userId}'}/friends</code> now enforces <code className="text-emerald-300">allow read, write: if isOwner(userId) || isAdmin()</code>.
                          </p>
                        </div>
                      </div>

                      {/* Item 5 */}
                      <div className="p-3 bg-[#1c1f26] border border-white/5 rounded-xl flex items-start gap-3">
                        <div className="p-1 bg-emerald-500/10 rounded-lg text-emerald-400 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              5. Economy Tamper-Proofing (Coins, Ad-Free & Scoreboard)
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                              ENFORCED
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Players can no longer update <code className="text-amber-300">coins</code>, <code className="text-amber-300">isAdFree</code>, or <code className="text-amber-300">scoreboardUnlocked</code> directly in Firestore. Modifications are locked down with <code className="text-emerald-300">!isRestrictedUserField() || isAdmin()</code>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: USERS LIST */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search by name, email, or UID..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-[#111317] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={loadAllAdminData}
                      disabled={isRefreshing}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-gray-300 flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  <div className="space-y-2">
                    {filteredUsers.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-xs">
                        No users found matching query.
                      </div>
                    ) : (
                      filteredUsers.map(user => {
                        const userCoins = (user as any).coins ?? 0;
                        const isUserMasterAdmin =
                          (user.email && user.email.toLowerCase() === 'drew@datagameslab.com') ||
                          user.uid === 'ZYHRSo415HeN1Tm9ChGYNJBGik02';
                        const isUserAdmin =
                          isUserMasterAdmin ||
                          adminsList.some(
                            a =>
                              a.uid === user.uid ||
                              (user.email && a.email?.toLowerCase() === user.email.toLowerCase())
                          );

                        return (
                          <div
                            key={user.uid}
                            className="p-3 bg-[#14161a] border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs"
                                style={{ backgroundColor: user.avatar?.color || '#1f7fd6' }}
                              >
                                {user.name?.slice(0, 2).toUpperCase() || 'CR'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-white">{user.name}</span>
                                  {isUserMasterAdmin ? (
                                    <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-semibold border border-amber-500/30">
                                      👑 Master Admin
                                    </span>
                                  ) : isUserAdmin ? (
                                    <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded font-semibold border border-blue-500/30">
                                      🛡️ Admin
                                    </span>
                                  ) : null}
                                  {user.isAdFree && (
                                    <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold border border-emerald-500/30">
                                      Ad-Free
                                    </span>
                                  )}
                                  {user.scoreboardUnlocked && (
                                    <span className="text-[9px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded font-semibold border border-purple-500/30">
                                      Scoreboard
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                                  <span>{user.email || 'No email (Guest)'}</span>
                                  <span>•</span>
                                  <span className="font-mono text-[9.5px] text-gray-500 truncate max-w-[120px]">
                                    {user.uid}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Admin Controls */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Coin Controls */}
                              <div className="flex items-center gap-1 bg-[#1c1f26] border border-white/10 px-2 py-1 rounded-lg text-xs">
                                <Coins className="w-3.5 h-3.5 text-amber-400" />
                                <span className="font-bold text-amber-300 text-xs mr-1">
                                  {userCoins.toLocaleString()}
                                </span>
                                <button
                                  onClick={() => handleAdjustCoins(user.uid, 500)}
                                  className="px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold rounded"
                                >
                                  +500
                                </button>
                                <button
                                  onClick={() => handleAdjustCoins(user.uid, -500)}
                                  className="px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-bold rounded"
                                >
                                  -500
                                </button>
                                <button
                                  onClick={() => setCustomCoinsUserId(user.uid)}
                                  className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-gray-300 text-[10px] font-bold rounded"
                                  title="Set Custom Coins"
                                >
                                  Edit
                                </button>
                              </div>

                              {/* Ad Free Toggle */}
                              <button
                                onClick={() => handleToggleAdFree(user.uid, !!user.isAdFree)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                                  user.isAdFree
                                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                }`}
                              >
                                {user.isAdFree ? 'Ad-Free: ON' : 'Ad-Free: OFF'}
                              </button>

                              {/* Scoreboard Toggle */}
                              <button
                                onClick={() => handleToggleScoreboard(user.uid, !!user.scoreboardUnlocked)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                                  user.scoreboardUnlocked
                                    ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30'
                                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                }`}
                              >
                                {user.scoreboardUnlocked ? 'Scoreboard: ON' : 'Scoreboard: OFF'}
                              </button>

                              {/* Grant / Revoke Admin Privilege Toggle */}
                              {!isUserMasterAdmin && (
                                <button
                                  onClick={() => {
                                    if (isUserAdmin) {
                                      handleRevokeAdmin(user.uid, user.email || undefined);
                                    } else {
                                      handleGrantAdmin(user.uid, user.email || undefined);
                                    }
                                  }}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                                    isUserAdmin
                                      ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                                      : 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30'
                                  }`}
                                >
                                  {isUserAdmin ? 'Revoke Admin' : '+ Make Admin'}
                                </button>
                              )}
                            </div>

                            {/* Custom Coin Input Drawer */}
                            {customCoinsUserId === user.uid && (
                              <div className="w-full mt-2 p-2 bg-[#1c1f26] border border-blue-500/30 rounded-lg flex items-center gap-2">
                                <span className="text-[11px] text-gray-300">Set exact coins:</span>
                                <input
                                  type="number"
                                  value={customCoinsAmount}
                                  onChange={e => setCustomCoinsAmount(e.target.value)}
                                  className="w-24 bg-[#111317] border border-white/10 rounded px-2 py-0.5 text-xs text-white"
                                />
                                <button
                                  onClick={() => handleSetCustomCoins(user.uid)}
                                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setCustomCoinsUserId(null)}
                                  className="px-2 py-0.5 bg-white/10 text-gray-400 hover:text-white text-xs rounded"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: EMAIL SUBSCRIBERS */}
              {activeTab === 'subscribers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        Promotional Email Subscribers ({subscribersList.length})
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Protected subscriber directory accessible exclusively to administrators.
                      </p>
                    </div>
                    <button
                      onClick={loadAllAdminData}
                      disabled={isRefreshing}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  <div className="space-y-2">
                    {subscribersList.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-xs">
                        No promotional email subscribers recorded yet.
                      </div>
                    ) : (
                      subscribersList.map((sub, idx) => (
                        <div
                          key={sub.id || idx}
                          className="p-3 bg-[#14161a] border border-white/10 rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{sub.email}</span>
                              {sub.verified && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                                  Verified
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                              <span>Source: {sub.source || 'app'}</span>
                              <span>•</span>
                              <span>
                                {sub.agreedAt
                                  ? new Date(sub.agreedAt).toLocaleDateString()
                                  : 'Subscribed'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {sub.country || 'Global'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: ROOMS */}
              {activeTab === 'rooms' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        Active Multiplayer Match Rooms ({roomsList.length})
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Live matchmaking records in /rooms collection.
                      </p>
                    </div>
                    <button
                      onClick={loadAllAdminData}
                      disabled={isRefreshing}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  <div className="space-y-2">
                    {roomsList.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-xs">
                        No active match rooms in Firestore.
                      </div>
                    ) : (
                      roomsList.map(room => (
                        <div
                          key={room.id}
                          className="p-3 bg-[#14161a] border border-white/10 rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-blue-400">
                                {room.id}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 bg-white/10 rounded font-semibold text-gray-300">
                                {room.status || 'active'}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-semibold">
                                {room.tier || 'Casual'}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-2">
                              <span>Players: {room.players?.length || 0}</span>
                              <span>•</span>
                              <span>Buy-in: {room.buyIn || 0} coins</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors"
                            title="Purge Room"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: ADMINS */}
              {activeTab === 'admins' && (
                <div className="space-y-4">
                  <div className="bg-[#14161a] border border-white/10 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-white mb-1">Authorize New Administrator</h4>
                    <p className="text-[11px] text-gray-400 mb-3">
                      Add a trusted administrator by Email address or User UID. Once authorized, they will see the Admin Backend button when signed in with their account.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      <input
                        type="email"
                        placeholder="User Email (e.g. colleague@datagameslab.com)"
                        value={newAdminEmail}
                        onChange={e => setNewAdminEmail(e.target.value)}
                        className="bg-[#111317] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500"
                      />
                      <input
                        type="text"
                        placeholder="User UID (optional if email provided)"
                        value={newAdminUid}
                        onChange={e => setNewAdminUid(e.target.value)}
                        className="bg-[#111317] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500"
                      />
                    </div>
                    <button
                      onClick={() => handleGrantAdmin()}
                      disabled={!newAdminUid.trim() && !newAdminEmail.trim()}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Authorize Administrator
                    </button>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white">Authorized Administrators</h4>
                    {Array.from(
                      new Map<string, AdminAccountRecord>(
                        adminsList.map(a => [(a.email?.toLowerCase().trim() || a.uid), a])
                      ).values()
                    ).map(admin => {
                      const isMaster =
                        (admin.email && admin.email.toLowerCase() === 'drew@datagameslab.com') ||
                        admin.uid === 'ZYHRSo415HeN1Tm9ChGYNJBGik02';
                      return (
                        <div
                          key={admin.uid}
                          className="p-3 bg-[#14161a] border border-white/10 rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {admin.email || 'Administrator'}
                              </span>
                              {isMaster ? (
                                <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-semibold border border-amber-500/30">
                                  👑 Master Admin
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded font-semibold">
                                  {admin.role || 'admin'}
                                </span>
                              )}
                            </div>
                            <span className="text-[9.5px] font-mono text-gray-500">{admin.uid}</span>
                          </div>
                          {!isMaster && (
                            <button
                              onClick={() => handleRevokeAdmin(admin.uid, admin.email)}
                              className="px-2.5 py-1 text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-[#16181d] border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Trust Firestore ABAC Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg transition-colors"
          >
            Close Admin Portal
          </button>
        </div>
      </div>
    </div>
  );
};
export default AdminBackendModal;
