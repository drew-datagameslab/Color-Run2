import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { addFriend, getLocalFriends, saveLocalFriends } from './friends';
import { addCoins } from './storage';
import { UserAccount } from '../types/game';

export interface ReferralInvite {
  code: string; // 8-digit alphanumeric code, e.g. "CR784920"
  inviterId: string;
  inviterName: string;
  inviterColor: string;
  inviterImage?: string;
  phoneNumber: string;
  preferredStore: 'apple' | 'google';
  messageText: string;
  storeLink: string;
  createdAt: string;
  used: boolean;
  usedBy?: string | null;
  usedByName?: string | null;
  usedAt?: string | null;
  reminderSent: boolean;
  lastReminderAt?: string | null;
}

const LOCAL_INVITES_PREFIX = 'cr_referral_invites_';
const LOCAL_CODES_INDEX = 'cr_all_referral_codes';
const LOCAL_REGISTERED_PHONES_KEY = 'cr_registered_phones';
const DISMISSED_24H_PREFIX = 'cr_referral_24h_dismissed_';

export interface RegisteredUserPhoneInfo {
  uid: string;
  name: string;
  avatar: {
    color: string;
    image?: string;
  };
  phoneNumber: string;
}

// Initial pre-seeded sample registered players for instant demo & testing
const DEFAULT_REGISTERED_PLAYERS: RegisteredUserPhoneInfo[] = [
  {
    uid: 'reg_user_sarah',
    name: 'Sarah Connor',
    phoneNumber: '(555) 234-5678',
    avatar: { color: '#2f9a4f', image: undefined },
  },
  {
    uid: 'reg_user_tommy',
    name: 'Tommy Tutone',
    phoneNumber: '(555) 867-5309',
    avatar: { color: '#8e44c9', image: undefined },
  },
  {
    uid: 'reg_user_marcus',
    name: 'Marcus Phoenix',
    phoneNumber: '(555) 432-1000',
    avatar: { color: '#fa8231', image: undefined },
  },
];

/**
 * Normalizes phone numbers to standard searchable keys (digits only, last 10 digits, etc.)
 */
export function getPhoneSearchKeys(raw: string): string[] {
  const digitsOnly = raw.replace(/\D/g, '');
  const keys: string[] = [];
  if (digitsOnly.length > 0) {
    keys.push(digitsOnly);
  }
  if (digitsOnly.length >= 10) {
    const tenDigits = digitsOnly.slice(-10);
    keys.push(tenDigits);
    keys.push(`+1${tenDigits}`);
    keys.push(`1${tenDigits}`);
  }
  const cleanTrim = raw.trim().replace(/\s+/g, '');
  if (cleanTrim && !keys.includes(cleanTrim)) {
    keys.push(cleanTrim);
  }
  return keys;
}

/**
 * Registers a user's phone number to both local storage and Firestore index
 */
export async function registerUserPhoneNumber(user: UserAccount, rawPhone: string): Promise<void> {
  const cleanDigits = rawPhone.replace(/\D/g, '');
  if (!cleanDigits) return;

  const info: RegisteredUserPhoneInfo = {
    uid: user.uid,
    name: user.name,
    avatar: {
      color: user.avatar?.color || '#1f7fd6',
      image: user.avatar?.image,
    },
    phoneNumber: rawPhone.trim(),
  };

  // 1. Save in local storage
  cacheRegisteredPhoneLocally(info);

  // 2. Save in Firestore phoneIndex collection
  if (db) {
    try {
      const key = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
      const phoneRef = doc(db, 'phoneIndex', key);
      await setDoc(phoneRef, {
        userId: user.uid,
        name: user.name,
        color: user.avatar?.color || '#1f7fd6',
        image: user.avatar?.image || null,
        phoneNumber: rawPhone.trim(),
        digits: cleanDigits,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Also update user profile document
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { phoneNumber: rawPhone.trim() }, { merge: true });
    } catch (err) {
      console.warn('Could not save phone index in Firestore:', err);
    }
  }
}

/**
 * Checks if a phone number is associated with an existing registered user.
 * Returns the RegisteredUserPhoneInfo if found, or null if not registered.
 */
export async function findRegisteredUserByPhone(
  phone: string
): Promise<RegisteredUserPhoneInfo | null> {
  if (!phone || !phone.trim()) return null;
  const searchKeys = getPhoneSearchKeys(phone);

  // 1. Check local storage
  try {
    const raw = localStorage.getItem(LOCAL_REGISTERED_PHONES_KEY);
    let map: Record<string, RegisteredUserPhoneInfo> = raw ? JSON.parse(raw) : {};

    // First time init with default pre-seeded players if empty
    if (!raw || Object.keys(map).length === 0) {
      map = {};
      DEFAULT_REGISTERED_PLAYERS.forEach(p => {
        const d = p.phoneNumber.replace(/\D/g, '');
        map[d] = p;
        if (d.length >= 10) map[d.slice(-10)] = p;
      });
      localStorage.setItem(LOCAL_REGISTERED_PHONES_KEY, JSON.stringify(map));
    }

    for (const key of searchKeys) {
      if (map[key]) {
        return map[key];
      }
    }
  } catch (err) {
    console.warn('Error reading local phone index:', err);
  }

  // 2. Check Firestore phoneIndex collection
  if (db) {
    try {
      for (const key of searchKeys) {
        const phoneRef = doc(db, 'phoneIndex', key);
        const snap = await getDoc(phoneRef);
        if (snap.exists()) {
          const data = snap.data();
          const info: RegisteredUserPhoneInfo = {
            uid: data.userId || snap.id,
            name: data.name || 'Color Roller',
            avatar: {
              color: data.color || '#1f7fd6',
              image: data.image || undefined,
            },
            phoneNumber: data.phoneNumber || phone,
          };
          cacheRegisteredPhoneLocally(info);
          return info;
        }
      }

      // Also optionally check users collection directly by phoneNumber field if allowed
      for (const key of searchKeys) {
        try {
          const q = query(collection(db, 'users'), where('phoneNumber', '==', key));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const docData = qSnap.docs[0].data();
            const info: RegisteredUserPhoneInfo = {
              uid: docData.uid || qSnap.docs[0].id,
              name: docData.name || 'Color Roller',
              avatar: docData.avatar || { color: '#1f7fd6' },
              phoneNumber: docData.phoneNumber || phone,
            };
            cacheRegisteredPhoneLocally(info);
            return info;
          }
        } catch {
          // Non-critical fallback if querying users collection is restricted
        }
      }
    } catch (err) {
      console.warn('Error querying Firestore for registered phone:', err);
    }
  }

  return null;
}

function cacheRegisteredPhoneLocally(info: RegisteredUserPhoneInfo) {
  try {
    const raw = localStorage.getItem(LOCAL_REGISTERED_PHONES_KEY);
    const map: Record<string, RegisteredUserPhoneInfo> = raw ? JSON.parse(raw) : {};
    const d = info.phoneNumber.replace(/\D/g, '');
    if (d) map[d] = info;
    if (d.length >= 10) map[d.slice(-10)] = info;
    localStorage.setItem(LOCAL_REGISTERED_PHONES_KEY, JSON.stringify(map));
  } catch {}
}

export const STORE_LINKS = {
  apple: 'https://apps.apple.com/app/color-run/id123456789',
  google: 'https://play.google.com/store/apps/details?id=com.datagameslab.colorrun',
};

/**
 * Generates an 8-character uppercase referral code (e.g. CR928471 or 82947192).
 * Formatted with "CR" + 6 digits/letters for instant recognizable branding.
 */
export function generate8DigitReferralCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CR${randomPart}`;
}

/**
 * Builds the exact SMS referral message requested:
 * "{User Name} would like to play Color Run with you! Use this referral code when you sign in for a 300 coin bonus! {Generate an 8 digit code} Come join the fun. {Store Link}"
 */
export function buildReferralSmsText(
  userName: string,
  code: string,
  preferredStore: 'apple' | 'google'
): { messageText: string; storeLink: string } {
  const storeLink = STORE_LINKS[preferredStore];
  const messageText = `${userName} would like to play Color Run with you! Use this referral code when you sign in for a 300 coin bonus! ${code} Come join the fun. Download here: ${storeLink}`;
  return { messageText, storeLink };
}

/**
 * Builds the reminder SMS message text for pending codes:
 */
export function buildReminderSmsText(invite: ReferralInvite): string {
  return `Reminder from ${invite.inviterName}! Don't forget to use your referral code ${invite.code} when you sign in for your 300 coin bonus in Color Run! Come join the fun: ${invite.storeLink}`;
}

/**
 * Creates and registers a new referral code and invite
 */
export async function createReferralInvite(
  user: UserAccount,
  phoneNumber: string,
  preferredStore: 'apple' | 'google'
): Promise<ReferralInvite> {
  const code = generate8DigitReferralCode();
  const { messageText, storeLink } = buildReferralSmsText(user.name, code, preferredStore);

  const invite: ReferralInvite = {
    code,
    inviterId: user.uid,
    inviterName: user.name,
    inviterColor: user.avatar.color || '#e5352f',
    inviterImage: user.avatar.image,
    phoneNumber: phoneNumber.trim(),
    preferredStore,
    messageText,
    storeLink,
    createdAt: new Date().toISOString(),
    used: false,
    usedBy: null,
    usedByName: null,
    usedAt: null,
    reminderSent: false,
    lastReminderAt: null,
  };

  // 1. Cache in localStorage
  saveInviteLocally(user.uid, invite);

  // 2. Save to Firestore collection 'referralCodes'
  if (db) {
    try {
      const codeRef = doc(db, 'referralCodes', code);
      await setDoc(codeRef, invite);
    } catch (err) {
      console.warn('Firestore referral code save error (offline mode):', err);
    }
  }

  return invite;
}

/**
 * Dispatches an SMS via standard device protocol or fallback
 */
export function dispatchSmsText(phoneNumber: string, text: string): void {
  const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
  const encodedText = encodeURIComponent(text);
  
  // Try opening standard mobile SMS schema
  const smsUrl = cleanPhone ? `sms:${cleanPhone}?body=${encodedText}` : `sms:?body=${encodedText}`;
  try {
    window.location.href = smsUrl;
  } catch (err) {
    console.log('Could not open SMS protocol:', err);
  }
}

/**
 * Sends / triggers a text reminder for an unused code
 */
export async function sendReferralReminder(
  invite: ReferralInvite
): Promise<{ success: boolean; message: string; updatedInvite: ReferralInvite }> {
  const reminderText = buildReminderSmsText(invite);
  dispatchSmsText(invite.phoneNumber, reminderText);

  const updatedInvite: ReferralInvite = {
    ...invite,
    reminderSent: true,
    lastReminderAt: new Date().toISOString(),
  };

  // Update locally
  saveInviteLocally(invite.inviterId, updatedInvite);

  // Update in Firestore
  if (db) {
    try {
      const codeRef = doc(db, 'referralCodes', invite.code);
      await updateDoc(codeRef, {
        reminderSent: true,
        lastReminderAt: updatedInvite.lastReminderAt,
      });
    } catch (err) {
      console.warn('Firestore reminder update error:', err);
    }
  }

  return {
    success: true,
    message: `Reminder text sent to ${invite.phoneNumber}!`,
    updatedInvite,
  };
}

/**
 * Get all sent referral invites for a given user
 */
export async function getUserReferralInvites(userId: string): Promise<ReferralInvite[]> {
  const local = getLocalInvites(userId);

  if (userId && !userId.startsWith('guest_') && db) {
    try {
      const colRef = collection(db, 'referralCodes');
      const q = query(colRef, where('inviterId', '==', userId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const cloudInvites: ReferralInvite[] = [];
        snap.forEach(d => cloudInvites.push(d.data() as ReferralInvite));

        // Merge with local
        const map = new Map<string, ReferralInvite>();
        local.forEach(inv => map.set(inv.code, inv));
        cloudInvites.forEach(inv => map.set(inv.code, inv));
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        saveAllInvitesLocally(userId, merged);
        return merged;
      }
    } catch {
      // offline fallback
    }
  }

  return local;
}

/**
 * Look up a referral code from Firestore or local index
 */
export async function lookupReferralCode(rawCode: string): Promise<ReferralInvite | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;

  // 1. Check Firestore
  if (db) {
    try {
      const codeRef = doc(db, 'referralCodes', code);
      const snap = await getDoc(codeRef);
      if (snap.exists()) {
        return snap.data() as ReferralInvite;
      }
    } catch (err) {
      console.warn('Lookup referral error:', err);
    }
  }

  // 2. Check local index
  try {
    const rawAll = localStorage.getItem(LOCAL_CODES_INDEX);
    if (rawAll) {
      const all: Record<string, ReferralInvite> = JSON.parse(rawAll);
      if (all[code]) return all[code];
    }
  } catch {}

  return null;
}

/**
 * Redeems a referral code:
 * 1. Checks if code exists and is unused
 * 2. Awards 300 coins to the user
 * 3. Marks the code as used in Firestore & locally
 * 4. Automatically adds mutual friends:
 *    - Adds Inviter to User's friends
 *    - Adds User to Inviter's friends
 */
export async function redeemReferralCode(
  rawCode: string,
  currentUser: { uid: string; name: string; avatar: { color: string; image?: string } }
): Promise<{
  success: boolean;
  coins: number;
  message: string;
  inviterName?: string;
  invite?: ReferralInvite;
}> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { success: false, coins: 0, message: 'Please enter an 8-digit referral code.' };
  }

  const invite = await lookupReferralCode(code);
  if (!invite) {
    return {
      success: false,
      coins: 0,
      message: 'Referral code not found. Please verify the 8-digit code.',
    };
  }

  if (invite.used) {
    return {
      success: false,
      coins: 0,
      message: `This referral code has already been redeemed by ${invite.usedByName || 'another roller'}.`,
    };
  }

  if (invite.inviterId === currentUser.uid) {
    return {
      success: false,
      coins: 0,
      message: "You cannot redeem your own referral code! Share it with a friend instead.",
    };
  }

  const now = new Date().toISOString();
  const updatedInvite: ReferralInvite = {
    ...invite,
    used: true,
    usedBy: currentUser.uid,
    usedByName: currentUser.name,
    usedAt: now,
  };

  // 1. Update Firestore
  if (db) {
    try {
      const codeRef = doc(db, 'referralCodes', code);
      await updateDoc(codeRef, {
        used: true,
        usedBy: currentUser.uid,
        usedByName: currentUser.name,
        usedAt: now,
      });
    } catch (err) {
      console.warn('Firestore referral code redeem error:', err);
    }
  }

  // 2. Update local storage
  saveInviteLocally(invite.inviterId, updatedInvite);

  // 3. Award 300 coins
  addCoins(currentUser.uid, 300);

  // 4. Automatically add mutual friends!
  // A) Add inviter to current user's friends
  await addFriend(currentUser.uid, {
    id: invite.inviterId,
    name: invite.inviterName,
    color: invite.inviterColor,
    image: invite.inviterImage,
  });

  // B) Add current user to inviter's friends
  await addFriend(invite.inviterId, {
    id: currentUser.uid,
    name: currentUser.name,
    color: currentUser.avatar.color,
    image: currentUser.avatar.image,
  });

  return {
    success: true,
    coins: 300,
    inviterName: invite.inviterName,
    invite: updatedInvite,
    message: `🎉 Referral code verified! 300 Coins added, and you and ${invite.inviterName} are now Friends!`,
  };
}

/**
 * 24-Hour overlay check:
 * Checks if 24 hours have elapsed since account creation.
 */
export function shouldShow24hReferralOverlay(user: UserAccount): boolean {
  if (!user || user.isGuest || !user.uid) return false;

  // Check if dismissed in the last 24h
  try {
    const dismissedAt = localStorage.getItem(DISMISSED_24H_PREFIX + user.uid);
    if (dismissedAt) {
      const diffDismiss = Date.now() - parseInt(dismissedAt, 10);
      if (diffDismiss < 24 * 60 * 60 * 1000) {
        return false;
      }
    }
  } catch {}

  // Check user creation time
  if (user.createdAt) {
    const createdTime = new Date(user.createdAt).getTime();
    if (!isNaN(createdTime)) {
      const ageHours = (Date.now() - createdTime) / (1000 * 60 * 60);
      return ageHours >= 24;
    }
  }

  return false;
}

export function dismiss24hReferralOverlay(userId: string): void {
  try {
    localStorage.setItem(DISMISSED_24H_PREFIX + userId, Date.now().toString());
  } catch {}
}

// Helper local storage functions
function getLocalInvites(userId: string): ReferralInvite[] {
  try {
    const raw = localStorage.getItem(LOCAL_INVITES_PREFIX + userId);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveInviteLocally(userId: string, invite: ReferralInvite): void {
  const current = getLocalInvites(userId);
  const updated = [invite, ...current.filter(i => i.code !== invite.code)];
  saveAllInvitesLocally(userId, updated);

  // Also update master index of codes for rapid lookup
  try {
    const rawIndex = localStorage.getItem(LOCAL_CODES_INDEX);
    const index: Record<string, ReferralInvite> = rawIndex ? JSON.parse(rawIndex) : {};
    index[invite.code] = invite;
    localStorage.setItem(LOCAL_CODES_INDEX, JSON.stringify(index));
  } catch {}
}

function saveAllInvitesLocally(userId: string, invites: ReferralInvite[]): void {
  try {
    localStorage.setItem(LOCAL_INVITES_PREFIX + userId, JSON.stringify(invites));
  } catch {}
}
