import "server-only";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp, isAdminConfigured } from "@/lib/firebase-admin";

let settingsApplied = false;

export function isServerFirestoreAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()) && isAdminConfigured();
}

export function getAdminDb(): Firestore {
  getFirebaseAdminApp();
  const db = getFirestore();
  if (!settingsApplied) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // settings() throws if it was already called on this instance
    }
    settingsApplied = true;
  }
  return db;
}
