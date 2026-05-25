import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { AppUser } from "../types";

export async function updateUserProfile(firebaseUid: string, updates: { name?: string; avatar?: string }) {
  const userDoc = doc(db, "users", firebaseUid);
  const payload: Partial<AppUser> = {};
  if (typeof updates.name === "string") payload.name = updates.name;
  if (typeof updates.avatar === "string") payload.avatar = updates.avatar;

  if (Object.keys(payload).length > 0) {
    await updateDoc(userDoc, payload as any);
  }

  // also update Firebase Auth profile if signed-in user matches
  const current = auth.currentUser;
  if (current && current.uid === firebaseUid) {
    const authUpdates: { displayName?: string; photoURL?: string } = {};
    if (typeof updates.name === "string") authUpdates.displayName = updates.name;
    if (typeof updates.avatar === "string") authUpdates.photoURL = updates.avatar;
    if (Object.keys(authUpdates).length > 0) await updateProfile(current, authUpdates as any);
  }
}
