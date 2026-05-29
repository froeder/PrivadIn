import { updateProfile } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, updateDoc, where, limit } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import i18n from "../i18n";
import { auth, db, storage } from "./firebase";
import type { AppUser } from "../types";
import { NAME_MAX_LENGTH, NICKNAME_MAX_LENGTH, normalizeProfileIdentity, validateProfileIdentity } from "../utils/profileIdentity";

export const usersRef = collection(db, "users");

export async function isUserNameTaken(name: string, excludeUid?: string) {
  const normalizedName = normalizeProfileIdentity(name);
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
    const normalizedName = normalizeProfileIdentity(updates.name);
    const nameError = validateProfileIdentity(normalizedName, { required: true, maxLength: NAME_MAX_LENGTH });

    if (nameError === "required") {
      throw new Error(i18n.t("profile:nameRequired"));
    }

    if (nameError === "invalid_chars") {
      throw new Error(i18n.t("profile:identityInvalid"));
    }

    if (nameError === "too_long") {
      throw new Error(i18n.t("profile:nameTooLong", { count: NAME_MAX_LENGTH }));
    }

    if (await isUserNameTaken(normalizedName, firebaseUid)) {
      throw new Error(i18n.t("profile:nameTaken"));
    }

    payload.name = normalizedName;
  }

  if (typeof updates.nickname === "string") {
    const normalizedNickname = normalizeProfileIdentity(updates.nickname);
    const nicknameError = validateProfileIdentity(normalizedNickname, { maxLength: NICKNAME_MAX_LENGTH });

    if (nicknameError === "invalid_chars") {
      throw new Error(i18n.t("profile:identityInvalid"));
    }

    if (nicknameError === "too_long") {
      throw new Error(i18n.t("profile:nicknameTooLong", { count: NICKNAME_MAX_LENGTH }));
    }

    payload.nickname = normalizedNickname;
  }
  if (typeof updates.avatar === "string") payload.avatar = updates.avatar.trim();

  if (Object.keys(payload).length > 0) {
    await updateDoc(userDoc, payload);
  }

  // also update Firebase Auth profile if signed-in user matches
  const current = auth.currentUser;
  if (current && current.uid === firebaseUid) {
    const authUpdates: { displayName?: string; photoURL?: string } = {};
    if (typeof payload.name === "string") authUpdates.displayName = payload.name;
    if (typeof payload.avatar === "string") authUpdates.photoURL = payload.avatar;
    if (Object.keys(authUpdates).length > 0) await updateProfile(current, authUpdates);
  }

  const snapshot = await getDoc(userDoc);
  return snapshot.data() as AppUser;
}
