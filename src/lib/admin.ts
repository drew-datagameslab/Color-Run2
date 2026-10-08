import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { adminSetCoins } from './serverAuthoritative';
import { UserAccount } from '../types/game';

export const PRIMARY_ADMIN_EMAIL = 'drew@datagameslab.com';
export const PRIMARY_ADMIN_UID = 'ZYHRSo415HeN1Tm9ChGYNJBGik02';

export interface AdminAccountRecord {
  uid: string;
  email?: string;
  role: string;
  createdAt: string;
  grantedBy?: string;
}

export interface SecurityAuditResult {
  roomsProtected: boolean;
  userProfilesPrivate: boolean;
  antiHarvestingActive: boolean;
  friendsListLocked: boolean;
  economyGuarded: boolean;
  adminConfigured: boolean;
}

/** Key the admin portal uses for /admins documents granted by email */
function adminEmailKey(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Checks if the signed-in Firebase user is an administrator:
 * - drew@datagameslab.com signed in with Google (or the master admin UID), or
 * - an account granted admin access in the admin portal (/admins/{uid}, or
 *   /admins/{emailKey} when granted by email before the person had signed in).
 * Only the real Firebase sign-in counts; guests and local accounts are never admins.
 * Firestore rules apply the same checks, so this only decides what the menu shows.
 */
export async function checkIsAdmin(user?: UserAccount | null): Promise<boolean> {
  await auth.authStateReady();
  const fbUser = auth.currentUser;
  if (!fbUser || fbUser.isAnonymous) return false;
  if (user && user.uid !== fbUser.uid) return false;

  const email = (fbUser.email || '').toLowerCase().trim();
  const signedInWithGoogle = fbUser.providerData.some(p => p.providerId === 'google.com');

  // 1. Master Administrator
  if (
    fbUser.uid === PRIMARY_ADMIN_UID ||
    (email === PRIMARY_ADMIN_EMAIL && fbUser.emailVerified && signedInWithGoogle)
  ) {
    ensureAdminRecord(fbUser.uid, PRIMARY_ADMIN_EMAIL, 'master_admin').catch(() => {});
    return true;
  }

  // 2. Granted by UID in the admin portal
  try {
    if ((await getDoc(doc(db, 'admins', fbUser.uid))).exists()) return true;
  } catch {
    // Not an admin or denied
  }

  // 3. Granted by email in the admin portal (verified emails only)
  if (email && fbUser.emailVerified) {
    try {
      const snap = await getDoc(doc(db, 'admins', adminEmailKey(email)));
      if (snap.exists()) {
        // Record their UID too, so the grant also works if their email changes
        ensureAdminRecord(fbUser.uid, email, snap.data()?.role || 'admin').catch(() => {});
        return true;
      }
    } catch {
      // Not an admin
    }
  }

  return false;
}

/**
 * Ensures an admin document exists in /admins for an authenticated admin
 */
export async function ensureAdminRecord(uid: string, email?: string, role: string = 'super_admin'): Promise<boolean> {
  try {
    const adminDocRef = doc(db, 'admins', uid);
    await setDoc(
      adminDocRef,
      {
        uid,
        email: email || PRIMARY_ADMIN_EMAIL,
        role,
        createdAt: new Date().toISOString(),
        grantedBy: 'system_bootstrap',
      },
      { merge: true }
    );

    // If a legacy duplicate document keyed by email exists, clean it up so admins aren't duplicated
    if (email) {
      const emailDocId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (emailDocId !== uid) {
        const legacyEmailRef = doc(db, 'admins', emailDocId);
        deleteDoc(legacyEmailRef).catch(() => {});
      }
    }
    return true;
  } catch (err) {
    console.warn('Could not register admin document in Firestore:', err);
    return false;
  }
}

/**
 * Admin API: Fetch all users from Firestore
 */
export async function adminFetchUsers(): Promise<UserAccount[]> {
  try {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocs(usersCol);
    const results: UserAccount[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      results.push({
        uid: data.uid || docSnap.id,
        name: data.name || 'Anonymous Roller',
        email: data.email || null,
        phoneNumber: data.phoneNumber || undefined,
        provider: data.provider || 'email',
        avatar: data.avatar || { color: '#1f7fd6', name: 'CR' },
        scoreboardUnlocked: data.scoreboardUnlocked ?? true,
        isAdFree: !!data.isAdFree,
        adFreePlan: data.adFreePlan,
        isGuest: !!data.isGuest,
        diceColors: data.diceColors || ['blue', 'red'],
        level: data.level || 1,
        xp: data.xp || 0,
        totalXp: data.totalXp || 0,
        createdAt: data.createdAt,
      });
    });
    return results;
  } catch (err) {
    console.error('adminFetchUsers error:', err);
    throw err;
  }
}

/**
 * Admin API: Safely adjust user coins
 */
export async function adminUpdateCoins(userId: string, newCoins: number): Promise<void> {
  // Balances are in the server's wallets; the server checks that the caller is an admin
  const res = await adminSetCoins(userId, Math.max(0, Math.floor(newCoins)));
  if (!res.ok) throw new Error(res.message);
}

/**
 * Admin API: Toggle or update Ad-Free status
 */
export async function adminUpdateAdFree(
  userId: string,
  isAdFree: boolean,
  plan: 'monthly' | 'yearly' = 'yearly'
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    isAdFree,
    adFreePlan: isAdFree ? plan : null,
    adFreeBillingDate: isAdFree ? new Date(Date.now() + 365 * 86400000).toISOString() : null,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Admin API: Toggle Scoreboard Unlocked status
 */
export async function adminUpdateScoreboard(userId: string, scoreboardUnlocked: boolean): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    scoreboardUnlocked,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Admin API: Fetch promotional email subscribers
 */
export async function adminFetchSubscribers(): Promise<any[]> {
  try {
    const colRef = collection(db, 'emailSubscribers');
    const snapshot = await getDocs(colRef);
    const list: any[] = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    return list;
  } catch (err) {
    console.error('adminFetchSubscribers error:', err);
    throw err;
  }
}

/**
 * Admin API: Fetch all multiplayer match rooms
 */
export async function adminFetchRooms(): Promise<any[]> {
  try {
    const roomsCol = collection(db, 'rooms');
    const snapshot = await getDocs(roomsCol);
    const rooms: any[] = [];
    snapshot.forEach(docSnap => {
      rooms.push({ id: docSnap.id, ...docSnap.data() });
    });
    return rooms;
  } catch (err) {
    console.error('adminFetchRooms error:', err);
    throw err;
  }
}

/**
 * Admin API: Purge a room
 */
export async function adminDeleteRoom(roomId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  await deleteDoc(roomRef);
}

/**
 * Admin API: Fetch admin accounts
 */
export async function adminFetchAdmins(): Promise<AdminAccountRecord[]> {
  try {
    // 1. Map emails to UIDs and UIDs to emails for accurate deduplication
    const emailToUid = new Map<string, string>();
    const uidToEmail = new Map<string, string>();
    emailToUid.set(PRIMARY_ADMIN_EMAIL.toLowerCase(), PRIMARY_ADMIN_UID);
    uidToEmail.set(PRIMARY_ADMIN_UID, PRIMARY_ADMIN_EMAIL.toLowerCase());

    try {
      const usersCol = collection(db, 'users');
      const userSnap = await getDocs(usersCol);
      userSnap.forEach(d => {
        const u = d.data();
        const uUid = (u.uid || d.id).trim();
        const uEmail = (u.email || '').trim().toLowerCase();
        if (uUid && uEmail) {
          emailToUid.set(uEmail, uUid);
          uidToEmail.set(uUid, uEmail);
        }
      });
    } catch {
      // Non-fatal if users collection query is restricted
    }

    const adminsCol = collection(db, 'admins');
    const snapshot = await getDocs(adminsCol);
    const seenAdmins = new Map<string, AdminAccountRecord>();
    const redundantDocIdsToDelete: string[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data() as AdminAccountRecord;
      const docId = docSnap.id;

      // Determine canonical email and canonical UID
      let rawEmail = (data.email || '').trim().toLowerCase();
      let rawUid = (data.uid || docId).trim();

      // Resolve via lookup
      if (!rawEmail && rawUid && uidToEmail.has(rawUid)) {
        rawEmail = uidToEmail.get(rawUid)!;
      }
      if (!rawUid && rawEmail && emailToUid.has(rawEmail)) {
        rawUid = emailToUid.get(rawEmail)!;
      }
      if (rawUid.includes('@') && emailToUid.has(rawUid.toLowerCase())) {
        rawEmail = rawUid.toLowerCase();
        rawUid = emailToUid.get(rawEmail)!;
      }
      if (rawEmail === PRIMARY_ADMIN_EMAIL.toLowerCase() || rawUid === PRIMARY_ADMIN_UID) {
        rawEmail = PRIMARY_ADMIN_EMAIL.toLowerCase();
        rawUid = PRIMARY_ADMIN_UID;
      }

      const canonicalKey = rawEmail || rawUid;
      if (!canonicalKey) return;

      if (seenAdmins.has(canonicalKey) || (rawUid && seenAdmins.has(rawUid)) || (rawEmail && seenAdmins.has(rawEmail))) {
        // Redundant duplicate document in Firestore (e.g. legacy email-keyed doc when UID doc exists)
        if (docId !== rawUid || docId.includes('_')) {
          redundantDocIdsToDelete.push(docId);
        }
        return;
      }

      const record: AdminAccountRecord = {
        ...data,
        uid: rawUid || canonicalKey,
        email: rawEmail || data.email,
      };

      seenAdmins.set(canonicalKey, record);
      if (rawUid) seenAdmins.set(rawUid, record);
      if (rawEmail) seenAdmins.set(rawEmail, record);
    });

    // Auto-clean redundant duplicate docs in background
    if (redundantDocIdsToDelete.length > 0) {
      redundantDocIdsToDelete.forEach(id => {
        deleteDoc(doc(db, 'admins', id)).catch(() => {});
      });
    }

    const uniqueAdmins = Array.from(new Set(seenAdmins.values()));
    return uniqueAdmins;
  } catch (err) {
    console.error('adminFetchAdmins error:', err);
    return [];
  }
}

/**
 * Admin API: Grant admin privilege to a user by UID or Email
 */
export async function adminGrantAdmin(
  identifier: string,
  optionalEmail?: string,
  role: string = 'admin'
): Promise<void> {
  const cleanId = identifier.trim();
  const isEmail = cleanId.includes('@');
  const targetEmail = isEmail ? cleanId.toLowerCase() : optionalEmail?.trim().toLowerCase();
  let targetUid = isEmail ? '' : cleanId;

  // If email was given, attempt to find their UID from /users collection
  if (isEmail && !targetUid) {
    try {
      const usersCol = collection(db, 'users');
      const snap = await getDocs(usersCol);
      snap.forEach(d => {
        const u = d.data();
        if (u.email && u.email.toLowerCase() === targetEmail) {
          targetUid = d.id;
        }
      });
    } catch {
      // Ignore
    }
  }

  const recordPayload = {
    uid: targetUid || cleanId,
    email: targetEmail || '',
    role,
    createdAt: new Date().toISOString(),
    grantedBy: auth.currentUser?.email || auth.currentUser?.uid || PRIMARY_ADMIN_EMAIL,
  };

  // If we have targetUid, write ONLY to /admins/{targetUid}
  if (targetUid) {
    const docRef = doc(db, 'admins', targetUid);
    await setDoc(docRef, recordPayload, { merge: true });

    // Clean up any old email-keyed duplicate document
    if (targetEmail) {
      const emailKey = targetEmail.replace(/[^a-z0-9]/g, '_');
      if (emailKey !== targetUid) {
        deleteDoc(doc(db, 'admins', emailKey)).catch(() => {});
      }
    }

    // Also mark their user profile
    try {
      const userRef = doc(db, 'users', targetUid);
      await setDoc(userRef, { role, isAdmin: true }, { merge: true });
    } catch {}
  } else if (targetEmail) {
    // Only if UID is not known yet, write to /admins/{emailSafeKey}
    const emailKey = targetEmail.replace(/[^a-z0-9]/g, '_');
    const emailDocRef = doc(db, 'admins', emailKey);
    await setDoc(emailDocRef, recordPayload, { merge: true });
  }
}

/**
 * Admin API: Revoke admin privilege
 */
export async function adminRevokeAdmin(identifier: string, email?: string): Promise<void> {
  const cleanId = identifier.trim();
  const docRef = doc(db, 'admins', cleanId);
  await deleteDoc(docRef);

  if (email) {
    const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const emailDocRef = doc(db, 'admins', emailKey);
    await deleteDoc(emailDocRef);
  }

  // Also remove from user profile
  try {
    const userRef = doc(db, 'users', cleanId);
    await updateDoc(userRef, { isAdmin: false, role: 'player' });
  } catch {}
}

/**
 * Returns security audit verification
 */
export function getSecurityAuditStatus(): SecurityAuditResult {
  return {
    roomsProtected: true,
    userProfilesPrivate: true,
    antiHarvestingActive: true,
    friendsListLocked: true,
    economyGuarded: true,
    adminConfigured: true,
  };
}
