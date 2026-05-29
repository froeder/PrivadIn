import { updateProfile } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, updateDoc, where, limit } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import type { AppUser } from "../types";

export const usersRef = collection(db, "users");

export async function isUserNameTaken(name: string, excludeUid?: string) {
  const normalizedName = name.trim();
  if (!normalizedName) return false;

  const snapshot = await getDocs(
    query(usersRef, where("name", "==", normalizedName), limit(1)),
  );

  if (snapshot.empty) {
    return false;
  }

  if (!excludeUid) {
    return true;
  }

  return snapshot.docs.some((doc) => doc.id !== excludeUid);
}

export async function uploadAvatarFile(firebaseUid: string, file: File) {
  const path = `avatars/${firebaseUid}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}

export async function updateUserProfile(
  firebaseUid: string,
  updates: { name?: string; nickname?: string; avatar?: string },
) {
  const userDoc = doc(db, "users", firebaseUid);
  const payload: Partial<AppUser> = {};

  if (typeof updates.name === "string") {
    const trimmedName = updates.name.trim();
    if (!trimmedName) {
      throw new Error("O nome não pode ficar em branco.");
    }

    if (await isUserNameTaken(trimmedName, firebaseUid)) {
      throw new Error("Já existe outro usuário com este nome. Escolha um nome diferente.");
    }

    payload.name = trimmedName;
  }

  if (typeof updates.nickname === "string") {
    payload.nickname = updates.nickname.trim();
  }
  if (typeof updates.avatar === "string") payload.avatar = updates.avatar.trim();

  if (Object.keys(payload).length > 0) {
    await updateDoc(userDoc, payload);
  }

  // also update Firebase Auth profile if signed-in user matches
  const current = auth.currentUser;
  if (current && current.uid === firebaseUid) {
    const authUpdates: { displayName?: string; photoURL?: string } = {};
    if (typeof updates.name === "string") authUpdates.displayName = updates.name;
    if (typeof updates.avatar === "string") authUpdates.photoURL = updates.avatar;
    if (Object.keys(authUpdates).length > 0) await updateProfile(current, authUpdates);
  }

  const snapshot = await getDoc(userDoc);
  return snapshot.data() as AppUser;
}
