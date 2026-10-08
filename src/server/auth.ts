import type { Request, Response, NextFunction } from 'express';
import { getAdminAuth, getAdminDb } from './firebaseAdmin.ts';

export const PRIMARY_ADMIN_EMAIL = 'drew@datagameslab.com';
export const PRIMARY_ADMIN_UID = 'ZYHRSo415HeN1Tm9ChGYNJBGik02';

export interface AuthedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
}

export type AuthedRequest = Request & { user: AuthedUser };

/** Same key the admin portal uses for /admins documents granted by email */
export function adminEmailKey(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Requires a Firebase sign-in token (Authorization: Bearer <ID token>).
 * The player's uid always comes from the verified token, never from the request body.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: 'unauthenticated', message: 'Sign in required.' });
  }
  let adminAuth;
  try {
    adminAuth = await getAdminAuth();
  } catch {
    // The app treats 503 as offline and keeps coins on the device
    return res.status(503).json({ error: 'auth_unavailable', message: 'Sign-in check unavailable.' });
  }
  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    (req as AuthedRequest).user = {
      uid: decoded.uid,
      email: decoded.email ? decoded.email.toLowerCase() : null,
      emailVerified: decoded.email_verified === true,
      signInProvider: decoded.firebase?.sign_in_provider || null,
    };
    next();
  } catch {
    res.status(401).json({ error: 'unauthenticated', message: 'Sign-in expired. Please sign in again.' });
  }
}

/**
 * Admins: drew@datagameslab.com signed in with Google, or accounts granted in the
 * admin portal (/admins/{uid}, or /admins/{emailKey} for a verified email).
 */
export async function isAdminUser(user: AuthedUser): Promise<boolean> {
  if (user.uid === PRIMARY_ADMIN_UID) return true;
  if (
    user.email === PRIMARY_ADMIN_EMAIL &&
    user.emailVerified &&
    user.signInProvider === 'google.com'
  ) {
    return true;
  }
  try {
    const db = await getAdminDb();
    if ((await db.collection('admins').doc(user.uid).get()).exists) return true;
    if (user.email && user.emailVerified) {
      return (await db.collection('admins').doc(adminEmailKey(user.email)).get()).exists;
    }
  } catch {
    // Firestore unavailable: only the primary admin is recognized
  }
  return false;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(await isAdminUser((req as AuthedRequest).user))) {
    return res.status(403).json({ error: 'forbidden', message: 'Admin access required.' });
  }
  next();
}
