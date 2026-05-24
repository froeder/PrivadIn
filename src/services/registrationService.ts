import {
  Timestamp,
  collection,
  doc,
  getDoc,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { RegistrationRequest } from "../types";

export const registrationRequestsRef = collection(db, "registration_requests");

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function registrationRequestId(email: string) {
  return encodeURIComponent(normalizeEmail(email)).replace(/\./g, "%2E");
}

function nameFromEmail(email: string) {
  return normalizeEmail(email).split("@")[0] || "Novo competidor";
}

function generateApprovalCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function registrationRequestsQuery() {
  return query(registrationRequestsRef, orderBy("createdAt", "desc"));
}

export async function getOrCreateRegistrationRequest(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const requestDoc = doc(db, "registration_requests", registrationRequestId(normalizedEmail));
  const snapshot = await getDoc(requestDoc);

  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as RegistrationRequest;
  }

  const request: Omit<RegistrationRequest, "id"> = {
    email: normalizedEmail,
    name: nameFromEmail(normalizedEmail),
    approvalCode: generateApprovalCode(),
    status: "pending",
    createdAt: Timestamp.now(),
  };

  await setDoc(requestDoc, request);
  return { id: requestDoc.id, ...request };
}

export async function getRegistrationRequest(email: string) {
  const requestDoc = doc(db, "registration_requests", registrationRequestId(email));
  const snapshot = await getDoc(requestDoc);
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as RegistrationRequest) : null;
}

export async function markRegistrationRequestUsed(email: string, uid: string) {
  const requestDoc = doc(db, "registration_requests", registrationRequestId(email));
  await updateDoc(requestDoc, {
    status: "used",
    claimedBy: uid,
    usedAt: Timestamp.now(),
  });
}
