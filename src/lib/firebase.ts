import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  updateDoc,
  collection,
  query,
  getDocs,
  deleteDoc,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import { UserAccount, UserFileRecord, DiceColor } from '../types/game';

// Firebase configuration from firebase-applet-config.json
const firebaseConfig = {
  projectId: "gen-lang-client-0844384071",
  appId: "1:467873404797:web:7a0573561af1f85df0de14",
  apiKey: "AIzaSyAQHIDB4PYRdKEhTov9FK_yZr6dTzBoN3A",
  authDomain: "gen-lang-client-0844384071.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-colorrun-81bfc488-d8a9-40a6-9e3d-2674d276a49e",
  storageBucket: "gen-lang-client-0844384071.firebasestorage.app",
  messagingSenderId: "467873404797",
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Initialize Firestore with long polling to ensure reliable connectivity in iframe/proxy environments
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  try {
    firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } catch {
    firestoreInstance = getFirestore(app);
  }
}
export const db = firestoreInstance;

// Test connection on boot to verify Firestore availability gracefully
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore operating in offline mode. Local persistence active.");
    }
  }
}
testConnection();

// Helper to convert Firebase Auth User to application UserAccount
export function mapFirebaseUserToAccount(
  fbUser: FirebaseUser,
  providerOverride?: 'guest' | 'email' | 'google' | 'apple'
): UserAccount {
  const isAnonymous = fbUser.isAnonymous;
  let provider: 'guest' | 'email' | 'google' | 'apple' = providerOverride || 'email';

  if (isAnonymous) {
    provider = 'guest';
  } else if (!providerOverride) {
    const pId = fbUser.providerData[0]?.providerId;
    if (pId === 'google.com') provider = 'google';
    else if (pId === 'apple.com') provider = 'apple';
    else provider = 'email';
  }

  const email = fbUser.email || (isAnonymous ? null : null);
  const displayName =
    fbUser.displayName ||
    (email ? email.split('@')[0] : isAnonymous ? 'Guest Roller' : 'Color Roller');

  const formattedName =
    displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const colors = ['#1f7fd6', '#e5352f', '#2a8b41', '#8338ec', '#e76f51', '#3a86ff'];
  let color =
    provider === 'google'
      ? '#e5352f'
      : provider === 'apple'
      ? '#222222'
      : provider === 'guest'
      ? '#3b82f6'
      : colors[Math.floor(Math.random() * colors.length)];

  let preservedImage = fbUser.photoURL || undefined;
  let preservedName = formattedName;
  let preservedDiceColors: [DiceColor, DiceColor] = ['blue', 'red'];

  // Check if the user already configured an avatar or name in localStorage
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('cr_user') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.avatar?.color) {
        color = parsed.avatar.color;
      }
      if (parsed.avatar?.image !== undefined) {
        preservedImage = parsed.avatar.image;
      }
      if (parsed.name && parsed.name !== 'Player' && parsed.name !== 'Color Roller' && parsed.name !== 'Guest Roller') {
        preservedName = parsed.name;
      }
      if (Array.isArray(parsed.diceColors) && parsed.diceColors.length === 2) {
        preservedDiceColors = parsed.diceColors as [DiceColor, DiceColor];
      }
    }
  } catch {
    // Ignore
  }

  return {
    uid: fbUser.uid,
    name: preservedName,
    email: email,
    provider: provider,
    isGuest: isAnonymous,
    avatar: {
      color: color,
      name: preservedName.slice(0, 2).toUpperCase(),
      image: preservedImage,
    },
    scoreboardUnlocked: true,
    diceColors: preservedDiceColors,
    createdAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// Authentication Functions
// -------------------------------------------------------------

/**
 * Sign up with Email and Password
 */
export async function signUpWithEmail(
  email: string,
  pass: string,
  displayName?: string
): Promise<UserAccount> {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
  
  if (displayName && displayName.trim()) {
    try {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    } catch {
      // Non-critical if profile update fails
    }
  }

  const account = mapFirebaseUserToAccount(cred.user, 'email');
  if (displayName && displayName.trim()) {
    account.name = displayName.trim();
  }

  // New users get 200 coins when they sign in
  await syncUserProfileToFirestore(account, 200);
  return account;
}

/**
 * Sign in with Email and Password
 */
export async function signInWithEmail(email: string, pass: string): Promise<UserAccount> {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
  const account = mapFirebaseUserToAccount(cred.user, 'email');

  // Try to load any saved profile from Firestore
  try {
    const existing = await loadUserProfileFromFirestore(cred.user.uid);
    if (existing) {
      return existing;
    }
  } catch {
    // ignore
  }

  await syncUserProfileToFirestore(account, 200);
  return account;
}

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<UserAccount> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const account = mapFirebaseUserToAccount(cred.user, 'google');

  try {
    const existing = await loadUserProfileFromFirestore(cred.user.uid);
    if (existing) {
      return existing;
    }
  } catch {
    // ignore
  }

  await syncUserProfileToFirestore(account, 200);
  return account;
}

/**
 * Sign in with Apple Popup
 */
export async function signInWithApple(): Promise<UserAccount> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const cred = await signInWithPopup(auth, provider);
  const account = mapFirebaseUserToAccount(cred.user, 'apple');

  try {
    const existing = await loadUserProfileFromFirestore(cred.user.uid);
    if (existing) {
      return existing;
    }
  } catch {
    // ignore
  }

  await syncUserProfileToFirestore(account, 200);
  return account;
}

/**
 * Sign in as Guest (Anonymous Firebase Auth)
 */
export async function signInAsGuest(): Promise<UserAccount> {
  const cred = await signInAnonymously(auth);
  const account = mapFirebaseUserToAccount(cred.user, 'guest');

  try {
    const existing = await loadUserProfileFromFirestore(cred.user.uid);
    if (existing) {
      return existing;
    }
  } catch {
    // ignore
  }

  await syncUserProfileToFirestore(account, 200);
  return account;
}

/**
 * Promotional Email Subscribers Database Operations
 */
export async function saveEmailSubscriber(data: {
  email: string;
  userId?: string;
  country?: string;
  agreedAt: string;
  verified: boolean;
  verifiedAt?: string;
  consentVersion: string;
  source: string;
}): Promise<string> {
  const cleanEmail = data.email.trim().toLowerCase();
  const subId = cleanEmail.replace(/[^a-z0-9]/g, '_');
  const docRef = doc(db, 'emailSubscribers', subId);
  await setDoc(
    docRef,
    {
      ...data,
      id: subId,
      email: cleanEmail,
    },
    { merge: true }
  );
  return subId;
}

export async function markEmailSubscriberVerified(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const subId = cleanEmail.replace(/[^a-z0-9]/g, '_');
  const docRef = doc(db, 'emailSubscribers', subId);
  try {
    await updateDoc(docRef, {
      verified: true,
      verifiedAt: new Date().toISOString(),
    });
  } catch {
    await setDoc(
      docRef,
      {
        email: cleanEmail,
        verified: true,
        verifiedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
}

/**
 * Sign out user
 */
export async function logOut(): Promise<void> {
  await signOut(auth);
}

/**
 * Listen to Firebase Auth state changes
 */
export function subscribeToAuth(
  callback: (user: UserAccount | null) => void
): () => void {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      const account = mapFirebaseUserToAccount(fbUser);
      try {
        const existing = await loadUserProfileFromFirestore(fbUser.uid);
        if (existing) {
          const merged: UserAccount = {
            ...account,
            ...existing,
            name: (existing.name && existing.name !== 'Color Roller' && existing.name !== 'Guest Roller')
              ? existing.name
              : account.name,
            avatar: {
              ...account.avatar,
              ...(existing.avatar || {}),
              color: existing.avatar?.color || account.avatar?.color || '#1f7fd6',
              image: existing.avatar?.image !== undefined ? existing.avatar.image : account.avatar?.image,
            },
            diceColors: existing.diceColors || account.diceColors || ['blue', 'red'],
          };
          callback(merged);
          return;
        }
      } catch (e) {
        console.warn('Could not load Firestore profile:', e);
      }
      callback(account);
    } else {
      callback(null);
    }
  });
}

// -------------------------------------------------------------
// Firestore Database Functions for User Profile & Account Data
// -------------------------------------------------------------

export async function syncUserProfileToFirestore(
  user: UserAccount,
  coins?: number
): Promise<void> {
  try {
    const userRef = doc(db, 'users', user.uid);
    const data: Record<string, any> = {
      uid: user.uid,
      name: user.name,
      email: user.email,
      provider: user.provider,
      isGuest: !!user.isGuest,
      scoreboardUnlocked: !!user.scoreboardUnlocked,
      isAdFree: !!user.isAdFree,
      adFreePlan: user.adFreePlan || null,
      adFreeBillingDate: user.adFreeBillingDate || null,
      adFreeRecurring: user.adFreeRecurring ?? null,
      phoneNumber: user.phoneNumber || null,
      avatar: user.avatar,
      diceColors: user.diceColors || ['blue', 'red'],
      // Level & XP progression
      level: user.level || 1,
      xp: user.xp || 0,
      totalXp: user.totalXp || 0,
      prestige: user.prestige || 0,
      title: user.title || null,
      banner: user.banner || null,
      nameColor: user.nameColor || null,
      unlockedRewards: user.unlockedRewards || [],
      unlockedEmotes: user.unlockedEmotes || [],
      unlockedTitles: user.unlockedTitles || [],
      unlockedBanners: user.unlockedBanners || [],
      lastFirstWinDate: user.lastFirstWinDate || null,
      rankedUnlocked: user.rankedUnlocked || ((user.level || 1) >= 10),
      matchmakingRating: user.matchmakingRating || ((user.level || 1) * 100),
      updatedAt: new Date().toISOString(),
    };
    if (coins !== undefined) {
      data.coins = coins;
    }
    if (user.createdAt) {
      data.createdAt = user.createdAt;
    }
    await setDoc(userRef, data, { merge: true });
  } catch (err) {
    console.warn('Could not sync user profile to Firestore:', err);
  }
}

export async function loadUserProfileFromFirestore(userId: string): Promise<UserAccount | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: data.uid || userId,
        name: data.name || 'Color Roller',
        email: data.email || null,
        phoneNumber: data.phoneNumber || undefined,
        provider: data.provider || 'email',
        avatar: data.avatar || { color: '#1f7fd6', name: 'CR' },
        scoreboardUnlocked: data.scoreboardUnlocked ?? true,
        isAdFree: !!data.isAdFree,
        adFreePlan: data.adFreePlan || undefined,
        adFreeBillingDate: data.adFreeBillingDate || undefined,
        adFreeRecurring: data.adFreeRecurring ?? undefined,
        isGuest: !!data.isGuest,
        diceColors: (data.diceColors as [DiceColor, DiceColor]) || ['blue', 'red'],
        createdAt: data.createdAt,
        level: data.level || 1,
        xp: data.xp || 0,
        totalXp: data.totalXp || 0,
        prestige: data.prestige || 0,
        title: data.title || undefined,
        banner: data.banner || undefined,
        nameColor: data.nameColor || undefined,
        unlockedRewards: data.unlockedRewards || [],
        unlockedEmotes: data.unlockedEmotes || [],
        unlockedTitles: data.unlockedTitles || [],
        unlockedBanners: data.unlockedBanners || [],
        lastFirstWinDate: data.lastFirstWinDate || undefined,
        rankedUnlocked: data.rankedUnlocked || ((data.level || 1) >= 10),
        matchmakingRating: data.matchmakingRating || ((data.level || 1) * 100),
      };
    }
  } catch (err) {
    console.warn('Could not load user profile from Firestore:', err);
  }
  return null;
}

// -------------------------------------------------------------
// File Storage & File Metadata in Firestore (users/{userId}/files/{fileId})
// -------------------------------------------------------------

export async function uploadUserFile(
  userId: string,
  file: File,
  notes?: string
): Promise<UserFileRecord> {
  // Convert file to base64 dataUrl for reliable storage & preview
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });

  const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const record: UserFileRecord = {
    id: fileId,
    userId,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    uploadDate: new Date().toISOString(),
    dataUrl,
    notes: notes || '',
  };

  const fileDocRef = doc(db, 'users', userId, 'files', fileId);
  await setDoc(fileDocRef, record);
  return record;
}

export async function getUserFiles(userId: string): Promise<UserFileRecord[]> {
  try {
    const filesCollection = collection(db, 'users', userId, 'files');
    const q = query(filesCollection);
    const snapshot = await getDocs(q);
    const files: UserFileRecord[] = [];
    snapshot.forEach(d => {
      files.push(d.data() as UserFileRecord);
    });
    // Sort descending by upload date
    files.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    return files;
  } catch (err) {
    console.warn('Could not fetch user files from Firestore:', err);
    return [];
  }
}

export async function deleteUserFile(userId: string, fileId: string): Promise<void> {
  const fileDocRef = doc(db, 'users', userId, 'files', fileId);
  await deleteDoc(fileDocRef);
}

export function subscribeUserFiles(
  userId: string,
  onUpdate: (files: UserFileRecord[]) => void
): () => void {
  try {
    const filesCollection = collection(db, 'users', userId, 'files');
    return onSnapshot(
      filesCollection,
      snapshot => {
        const files: UserFileRecord[] = [];
        snapshot.forEach(d => {
          files.push(d.data() as UserFileRecord);
        });
        files.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
        onUpdate(files);
      },
      err => {
        console.warn('User files subscription error:', err);
      }
    );
  } catch {
    return () => {};
  }
}
