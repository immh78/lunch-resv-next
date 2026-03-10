/**
 * Firebase Admin SDK (server only). Required for SSR initial data.
 * Env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_DATABASE_URL
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing as App;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error('Firebase Admin env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_DATABASE_URL) required for server.');
  }
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL,
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDatabase() {
  return getDatabase(getAdminApp());
}
