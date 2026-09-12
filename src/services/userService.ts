import { updateProfile } from "@firebase/auth";
import { Timestamp, collection, doc, getDoc, getDocs, query, updateDoc, where, limit } from "@firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "@firebase/storage";
import i18n from "../i18n";
import { auth, db, storage } from "./firebase";
import type { AppUser } from "../types";
import { NAME_MAX_LENGTH, NICKNAME_MAX_LENGTH, normalizeProfileIdentity, validateProfileIdentity } from "../utils/profileIdentity";
import { writeBatch } from "@firebase/firestore";
import { adminLogsRef, createAuditLog } from "./poopService";

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
  return { path, url };
}

export async function deleteAvatarFile(path?: string | null) {
  if (!path) return;
  await deleteObject(ref(storage, path));
}

export async function updateUserProfile(
  firebaseUid: string,
  updates: { name?: string; nickname?: string; avatar?: string; avatarStoragePath?: string | null; bio?: string },
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
  if ("avatarStoragePath" in updates) payload.avatarStoragePath = updates.avatarStoragePath ?? null;
  if (typeof updates.bio === "string") payload.bio = updates.bio.trim();

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

export async function updateUserOperationalProfile(
  firebaseUid: string,
  updates: {
    workSchedule?: AppUser["workSchedule"];
    bathroomDurationMinutes?: number;
  },
) {
  const userDoc = doc(db, "users", firebaseUid);
  const payload: Partial<AppUser> = {};

  if (updates.workSchedule) {
    payload.workSchedule = updates.workSchedule;
  }

  if (typeof updates.bathroomDurationMinutes === "number") {
    payload.bathroomDurationMinutes = Math.max(1, Math.min(180, Math.trunc(updates.bathroomDurationMinutes)));
  }

  await updateDoc(userDoc, payload);
  const snapshot = await getDoc(userDoc);
  return snapshot.data() as AppUser;
}

export async function acceptTermsOfUse(firebaseUid: string, termsVersion: number) {
  const userDoc = doc(db, "users", firebaseUid);
  await updateDoc(userDoc, {
    termsAccepted: true,
    acceptedAt: Timestamp.now(),
    acceptedTermsVersion: Math.max(1, Math.trunc(termsVersion)),
  });
  const snapshot = await getDoc(userDoc);
  return snapshot.data() as AppUser;
}

export async function setUserCooldown(admin: AppUser, targetUid: string, cooldownMinutes: number) {
  const batch = writeBatch(db);
  const ms = Math.max(0, Math.trunc(cooldownMinutes)) * 60_000;
  const until = Timestamp.fromMillis(Date.now() + ms);

  batch.update(doc(db, "users", targetUid), { cooldownUntil: until });
  batch.set(
    doc(adminLogsRef),
    createAuditLog({ action: "update_cooldown", admin, targetUser: { uid: targetUid }, cooldownMinutes: cooldownMinutes }),
  );

  await batch.commit();
}

export async function deactivateUser(admin: AppUser, targetUser: AppUser) {
  if (admin.uid === targetUser.uid) {
    throw new Error(i18n.t("admin:selfDeactivateBlocked"));
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "users", targetUser.uid), {
    isActive: false,
    deactivatedAt: Timestamp.now(),
    deactivatedBy: admin.uid,
  });
  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "deactivate_user",
      admin,
      targetUser,
    }),
  );

  await batch.commit();
}

export async function reactivateUser(admin: AppUser, targetUser: AppUser) {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", targetUser.uid), {
    isActive: true,
    deactivatedAt: null,
    deactivatedBy: null,
  });
  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "reactivate_user",
      admin,
      targetUser,
    }),
  );

  await batch.commit();
}

export async function setUserRole(admin: AppUser, targetUser: AppUser, role: "player" | "admin") {
  if (admin.uid === targetUser.uid && role !== "admin") {
    throw new Error("Você não pode remover seu próprio privilégio de administrador.");
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "users", targetUser.uid), { role });
  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: role === "admin" ? "promote_admin" : "demote_admin",
      admin,
      targetUser,
    }),
  );

  await batch.commit();
}
