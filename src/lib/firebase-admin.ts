import "server-only";
import { readFileSync, existsSync } from "fs";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin/app";

let adminApp: App | null = null;

function parseServiceAccountJson(raw: string): ServiceAccount {
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON. Use one line with no line breaks, or set GOOGLE_APPLICATION_CREDENTIALS to a .json file path.",
    );
  }
}

function loadServiceAccount(): ServiceAccount | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) return parseServiceAccountJson(inline);

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credPath && existsSync(credPath)) {
    return parseServiceAccountJson(readFileSync(credPath, "utf8"));
  }

  return null;
}

export function getFirebaseAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured");
  }

  const serviceAccount = loadServiceAccount();
  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || `${projectId}.firebasestorage.app`;
  adminApp = initializeApp({
    ...(serviceAccount ? { credential: cert(serviceAccount) } : {}),
    projectId,
    storageBucket,
  });
  return adminApp;
}

export function isAdminConfigured(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) return true;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  return Boolean(credPath && existsSync(credPath));
}
