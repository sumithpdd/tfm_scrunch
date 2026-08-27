import "server-only";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp, isAdminConfigured } from "@/lib/firebase-admin";

export function isServerFirestoreAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()) && isAdminConfigured();
}

export function getAdminDb(): Firestore {
  getFirebaseAdminApp();
  return getFirestore();
}
