import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env["NEXT_PUBLIC_FIREBASE_API_KEY"],
  authDomain: process.env["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"],
  projectId: process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"],
  // Only needed for Realtime Database — remove if using Firestore only
  databaseURL: process.env["NEXT_PUBLIC_FIREBASE_DATABASE_URL"],
};

export function getClientApp(): FirebaseApp {
  return (
    getApps().find((a) => a.name === "[DEFAULT]") ??
    initializeApp(firebaseConfig)
  );
}
