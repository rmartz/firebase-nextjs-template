import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(getClientAuth(), email, password);
}

export async function signUp(email: string, password: string) {
  return createUserWithEmailAndPassword(getClientAuth(), email, password);
}

export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(getClientAuth(), email);
}

export async function signOut() {
  return firebaseSignOut(getClientAuth());
}
