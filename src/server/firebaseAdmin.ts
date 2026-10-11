import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface AppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function readAppletConfig(): AppletConfig {
  const configPath = path.resolve(__dirname, '..', '..', 'firebase-applet-config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

interface AdminServices {
  auth: Auth;
  db: Firestore;
}

let servicesPromise: Promise<AdminServices> | null = null;

export interface ServiceAccountKey {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
}

/**
 * Reads the Firebase service account key from the FIREBASE_SERVICE_ACCOUNT secret:
 * the key file's JSON as-is, or base64-encoded. Returns null when the secret isn't set.
 */
export function readServiceAccountFromEnv(raw = process.env.FIREBASE_SERVICE_ACCOUNT): ServiceAccountKey | null {
  const value = raw?.trim();
  if (!value) return null;
  const json = value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
  const key = JSON.parse(json) as ServiceAccountKey;
  if (!key.client_email || !key.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not a service account key (missing client_email or private_key).');
  }
  // Secrets pasted on one line often carry the key's line breaks as a literal backslash-n
  key.private_key = key.private_key.replace(/\\n/g, '\n');
  return key;
}

/**
 * Firebase Admin for the server, loaded on first use rather than at startup, so the
 * game still starts if the firebase-admin package or its setup is missing (coin calls
 * then answer 503 and the app keeps coins on the device).
 *
 * Credentials: the FIREBASE_SERVICE_ACCOUNT secret (a service account key for the
 * Firebase project) when set. Otherwise the runtime's default credentials, which in
 * AI Studio belong to Google's project and can't reach this Firebase project's
 * Firestore. Verifying sign-in tokens only needs the project ID.
 */
function loadAdminServices(): Promise<AdminServices> {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const [{ initializeApp, getApps, cert }, { getAuth }, { getFirestore }] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/auth'),
        import('firebase-admin/firestore'),
      ]);
      const config = readAppletConfig();
      const serviceAccount = readServiceAccountFromEnv();
      if (serviceAccount?.project_id && serviceAccount.project_id !== config.projectId) {
        console.warn(
          `[Color Run Server] FIREBASE_SERVICE_ACCOUNT is for project "${serviceAccount.project_id}", but the app uses "${config.projectId}".`
        );
      }
      // With no explicit credential, the Admin SDK uses Application Default Credentials
      const app: App =
        getApps()[0] ||
        initializeApp({
          projectId: config.projectId,
          ...(serviceAccount ? { credential: cert(serviceAccount as Parameters<typeof cert>[0]) } : {}),
        });
      return {
        auth: getAuth(app),
        db: config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app),
      };
    })();
    // Let a later call try again instead of caching the failure
    servicesPromise.catch(() => {
      servicesPromise = null;
    });
  }
  return servicesPromise;
}

export async function getAdminAuth(): Promise<Auth> {
  return (await loadAdminServices()).auth;
}

export async function getAdminDb(): Promise<Firestore> {
  return (await loadAdminServices()).db;
}

/**
 * Logs at startup whether coin wallets will work: Firebase Admin loads and the server
 * can actually read Firestore. Never throws.
 */
export async function checkAdminAvailable(): Promise<void> {
  let services: AdminServices;
  try {
    services = await loadAdminServices();
  } catch (err) {
    console.warn(
      '[Color Run Server] Firebase Admin unavailable; coin calls will answer 503 and the app keeps coins on the device:',
      (err as Error)?.message || err
    );
    return;
  }
  const keySource = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
    ? 'FIREBASE_SERVICE_ACCOUNT key'
    : 'default credentials';
  try {
    await services.db.collection('wallets').limit(1).get();
    console.log(`[Color Run Server] Coin wallets enabled (Firestore reachable using ${keySource}).`);
  } catch (err) {
    console.warn(
      `[Color Run Server] Coin wallets DISABLED: Firestore refused the server (${keySource}): ${String((err as Error)?.message || err).replace(/\.$/, '')}. ` +
        'Add a Firebase service account key as the FIREBASE_SERVICE_ACCOUNT secret. Until then the app keeps coins on the device.'
    );
  }
}
