import { updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { AppUser, WorkSchedule } from "../types";
import {
  deactivateUser,
  reactivateUser,
  setUserCooldown,
  setUserRole,
} from "./adminService";
import {
  updateUserSalary,
  updateUserProfileCustomization,
  updateUserWorkSchedule,
  updateUserOperationalProfile,
  updateUserFinancialSettings,
} from "./poopService";

export const usersRef = collection(db, "users");

/**
 * Verifica se um nome de exibição já está cadastrado por outro usuário.
 */
export async function isUserNameTaken(name: string, excludeUid?: string): Promise<boolean> {
  const normalized = name.trim();
  if (!normalized) return false;

  const snapshot = await getDocs(
    query(usersRef, where("name", "==", normalized), limit(1))
  );

  if (snapshot.empty) return false;
  if (!excludeUid) return true;

  return snapshot.docs.some((d) => d.id !== excludeUid);
}

/**
 * Atualiza os dados cadastrais, cargo, salário e avatar do usuário no Firestore e no Firebase Auth.
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    name?: string;
    nickname?: string;
    avatar?: string;
    bio?: string;
    salary?: number;
    role?: "player" | "admin";
    themeColor?: string;
    workSchedule?: WorkSchedule;
    bathroomDurationMinutes?: number;
  }
): Promise<AppUser> {
  const userRef = doc(db, "users", userId);
  const payload: Record<string, any> = {};

  if (typeof updates.name === "string") {
    const trimmed = updates.name.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      throw new Error("O nome de usuário deve ter entre 3 e 30 caracteres.");
    }
    const taken = await isUserNameTaken(trimmed, userId);
    if (taken) {
      throw new Error(`O nome "${trimmed}" já está em uso por outro competidor.`);
    }
    payload.name = trimmed;
  }

  if (typeof updates.nickname === "string") {
    payload.nickname = updates.nickname.trim();
  }

  if (typeof updates.avatar === "string") {
    payload.avatar = updates.avatar.trim();
  }

  if (typeof updates.bio === "string") {
    payload.bio = updates.bio.trim();
  }

  if (typeof updates.themeColor === "string") {
    payload.themeColor = updates.themeColor.trim();
  }

  if (typeof updates.role === "string") {
    payload.role = updates.role;
  }

  if (typeof updates.salary === "number" && !isNaN(updates.salary)) {
    payload.salary = updates.salary;
    payload.hourlyRate = Number((updates.salary / 176).toFixed(2));
  }

  if (updates.workSchedule) {
    payload.workSchedule = updates.workSchedule;
  }

  if (typeof updates.bathroomDurationMinutes === "number" && !isNaN(updates.bathroomDurationMinutes)) {
    payload.bathroomDurationMinutes = Math.max(1, Math.min(180, Math.trunc(updates.bathroomDurationMinutes)));
  }

  if (Object.keys(payload).length > 0) {
    await updateDoc(userRef, payload);
  }

  // Atualiza perfil no Firebase Auth se for o usuário conectado
  const current = auth.currentUser;
  if (current && current.uid === userId) {
    const authUpdates: { displayName?: string; photoURL?: string } = {};
    if (payload.name) authUpdates.displayName = payload.name;
    if (payload.avatar) authUpdates.photoURL = payload.avatar;
    if (Object.keys(authUpdates).length > 0) {
      await updateProfile(current, authUpdates).catch((err) => {
        console.warn("Aviso ao atualizar profile no Auth:", err);
      });
    }
  }

  const snap = await getDoc(userRef);
  return { uid: snap.id, ...snap.data() } as AppUser;
}

// Re-exportações de administração e perfil
export {
  deactivateUser,
  reactivateUser,
  setUserCooldown,
  setUserRole,
  updateUserSalary,
  updateUserProfileCustomization,
  updateUserWorkSchedule,
  updateUserOperationalProfile,
  updateUserFinancialSettings,
};
