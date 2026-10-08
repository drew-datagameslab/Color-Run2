import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface AppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function readAppletConfig(): AppletConfig {
  const configPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

let adminApp: App | null = null;
let config: AppletConfig | null = null;

/**
 * Firebase Admin for the server. Credentials come from the runtime's service account
 * (Cloud Run) or GOOGLE_APPLICATION_CREDENTIALS locally. Verifying sign-in tokens only
 * needs the project ID; reading and writing Firestore needs the credentials.
 */
function getAdminApp(): App {
  if (adminApp) return adminApp;
  config = readAppletConfig();
  // With no explicit credential, the Admin SDK uses Application Default Credentials
  adminApp = getApps()[0] || initializeApp({ projectId: config.projectId });
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  const app = getAdminApp();
  return config?.firestoreDatabaseId
    ? getFirestore(app, config.firestoreDatabaseId)
    : getFirestore(app);
}
