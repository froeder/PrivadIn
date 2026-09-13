import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "./firebase";
import { AppUser, RegistrationAttemptStatus, RegistrationRequest } from "../types";
import {
  createRegistrationAttempt,
  registerWithEmail,
} from "./authService";

export const registrationRequestsRef = collection(db, "registration_requests");
export const registrationAttemptsRef = collection(db, "registration_attempts");

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function registrationRequestId(email: string): string {
  return encodeURIComponent(normalizeEmail(email)).replace(/\./g, "%2E");
}

function nameFromEmail(email: string): string {
  return normalizeEmail(email).split("@")[0] || "Novo competidor";
}

function generateApprovalCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

/**
 * Criação de credencial no Firebase Auth + criação de documento users/{uid} + registro de auditoria.
 */
export async function registerWithPassword(
  email: string,
  pass: string,
  name: string,
  groupCode?: string,
  termsVersion = 1
): Promise<{ user: User; profile: AppUser }> {
  return registerWithEmail(email, pass, name, groupCode, termsVersion);
}

export { createRegistrationAttempt };

export async function getOrCreateRegistrationRequest(email: string): Promise<RegistrationRequest> {
  const normalized = normalizeEmail(email);
  const requestDoc = doc(db, "registration_requests", registrationRequestId(normalized));
  const snapshot = await getDoc(requestDoc);

  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as RegistrationRequest;
  }

  const request = {
    email: normalized,
    name: nameFromEmail(normalized),
    approvalCode: generateApprovalCode(),
    status: "pending" as const,
    createdAt: serverTimestamp(),
  };

  await setDoc(requestDoc, request);
  return { id: requestDoc.id, ...request } as unknown as RegistrationRequest;
}

export async function getRegistrationRequest(email: string): Promise<RegistrationRequest | null> {
  const requestDoc = doc(db, "registration_requests", registrationRequestId(email));
  const snapshot = await getDoc(requestDoc);
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as RegistrationRequest) : null;
}

export async function markRegistrationRequestUsed(email: string, uid: string): Promise<void> {
  const requestDoc = doc(db, "registration_requests", registrationRequestId(email));
  await updateDoc(requestDoc, {
    status: "used",
    claimedBy: uid,
    usedAt: serverTimestamp(),
  });
}
