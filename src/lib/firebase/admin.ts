import { initializeApp, getApps, cert, type App } from "firebase-admin/app";

export function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === "[DEFAULT]");
  if (existing) return existing;

  return initializeApp({
    credential: cert({
      projectId: process.env["FIREBASE_PROJECT_ID"],
      clientEmail: process.env["FIREBASE_CLIENT_EMAIL"],
      privateKey: process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n"),
    }),
    // Only needed for Realtime Database — remove if using Firestore only
    databaseURL: process.env["FIREBASE_DATABASE_URL"],
  });
}
