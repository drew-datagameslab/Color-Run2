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

/**
 * Firebase Admin for the server, loaded on first use rather than at startup, so the
 * game still starts if the firebase-admin package or its setup is missing (coin calls
 * then answer 503 and the app keeps coins on the device).
 *
 * Credentials come from the runtime's service account (Cloud Run) or
 * GOOGLE_APPLICATION_CREDENTIALS locally. Verifying sign-in tokens only needs the
 * project ID; reading and writing Firestore needs the credentials.
 */
function loadAdminServices(): Promise<AdminServices> {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const [{ initializeApp, getApps }, { getAuth }, { getFirestore }] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/auth'),
        import('firebase-admin/firestore'),
      ]);
      const config = readAppletConfig();
      // With no explicit credential, the Admin SDK uses Application Default Credentials
      const app: App = getApps()[0] || initializeApp({ projectId: config.projectId });
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

/** Logs at startup whether Firebase Admin is available; never throws */
export async function checkAdminAvailable(): Promise<void> {
  try {
    await loadAdminServices();
    console.log('[Color Run Server] Firebase Admin ready (coin wallets enabled).');
  } catch (err) {
    console.warn(
      '[Color Run Server] Firebase Admin unavailable; coin calls will answer 503 and the app keeps coins on the device:',
      (err as Error)?.message || err
    );
  }
}
