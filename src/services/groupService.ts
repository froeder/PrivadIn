import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
} from "@firebase/firestore";
import { db } from "./firebase";
import { appSettingsDocRef } from "./settingsService";
import type { AppUser, RankingGroup } from "../types";

export const groupsRef = collection(db, "groups");

export const GROUP_NAME_MAX_LENGTH = 48;
export const GROUP_DESCRIPTION_MAX_LENGTH = 220;

function normalizeGroupId(value: string) {
  return value.trim();
}

export function normalizeGroupName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, GROUP_NAME_MAX_LENGTH);
}

export function normalizeGroupDescription(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, GROUP_DESCRIPTION_MAX_LENGTH);
}

function assertGroupPayload(name: string, description: string) {
  const normalizedName = normalizeGroupName(name);
  const normalizedDescription = normalizeGroupDescription(description);

  if (!normalizedName) {
    throw new Error("Informe o nome do grupo.");
  }

  return { name: normalizedName, description: normalizedDescription };
}

async function buildGroupId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    const snapshot = await getDoc(doc(db, "groups", id));
    if (!snapshot.exists()) return id;
  }

  return doc(groupsRef).id;
}

export function groupsQuery() {
  return query(groupsRef, orderBy("createdAt", "desc"));
}

export async function getGroupById(groupId: string) {
  const normalizedGroupId = normalizeGroupId(groupId);
  if (!normalizedGroupId) return null;

  const snapshot = await getDoc(doc(db, "groups", normalizedGroupId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as RankingGroup) : null;
}

export async function createGroup(owner: AppUser, name: string, description: string) {
  const payload = assertGroupPayload(name, description);
  const existing = await getDocs(query(groupsRef, where("ownerId", "==", owner.uid), limit(1)));

  if (!existing.empty || owner.ownedGroupId) {
    throw new Error("Cada usuario pode criar apenas um grupo.");
  }

  const [groupId, settingsSnapshot] = await Promise.all([buildGroupId(), getDoc(appSettingsDocRef)]);
  const now = Timestamp.now();
  const edition = Math.max(1, Math.trunc(Number(settingsSnapshot.data()?.edition ?? 1)));

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", owner.uid);
    const userSnapshot = await transaction.get(userRef);
    const freshUser = userSnapshot.data() as AppUser | undefined;

    if (freshUser?.ownedGroupId) {
      throw new Error("Cada usuario pode criar apenas um grupo.");
    }

    transaction.set(doc(db, "groups", groupId), {
      ...payload,
      ownerId: owner.uid,
      memberIds: [owner.uid],
      memberCount: 1,
      edition,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
    });
    transaction.update(userRef, { ownedGroupId: groupId });
  });

  return groupId;
}

export async function joinGroup(user: AppUser, groupId: string) {
  const normalizedGroupId = normalizeGroupId(groupId);
  if (!normalizedGroupId) return null;

  const groupRef = doc(db, "groups", normalizedGroupId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(groupRef);
    if (!snapshot.exists()) {
      throw new Error("Grupo nao encontrado. Confira o codigo recebido.");
    }

    const group = snapshot.data() as RankingGroup;
    if (group.deletedAt) {
      throw new Error("Este grupo foi excluido.");
    }

    const memberIds = Array.isArray(group.memberIds) ? group.memberIds : [];
    if (memberIds.includes(user.uid)) return;

    const nextMemberIds = [...memberIds, user.uid];
    transaction.update(groupRef, {
      memberIds: nextMemberIds,
      memberCount: nextMemberIds.length,
      updatedAt: Timestamp.now(),
    });
  });

  return normalizedGroupId;
}

export async function updateGroup(
  actor: AppUser,
  group: RankingGroup,
  updates: { name: string; description: string },
) {
  if (actor.uid !== group.ownerId && actor.role !== "admin") {
    throw new Error("Apenas o admin do grupo pode editar este grupo.");
  }

  const payload = assertGroupPayload(updates.name, updates.description);
  await updateDoc(doc(db, "groups", group.id), {
    ...payload,
    updatedAt: Timestamp.now(),
  });
}

export async function removeGroupMember(actor: AppUser, group: RankingGroup, memberId: string) {
  if (actor.uid !== group.ownerId && actor.role !== "admin") {
    throw new Error("Apenas o admin do grupo pode remover membros.");
  }

  if (memberId === group.ownerId) {
    throw new Error("O dono do grupo nao pode ser removido.");
  }

  const nextMemberIds = group.memberIds.filter((id) => id !== memberId);
  await updateDoc(doc(db, "groups", group.id), {
    memberIds: nextMemberIds,
    memberCount: nextMemberIds.length,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteGroup(admin: AppUser, group: RankingGroup) {
  if (admin.role !== "admin") {
    throw new Error("Apenas o admin do sistema pode excluir grupos.");
  }

  await runTransaction(db, async (transaction) => {
    transaction.delete(doc(db, "groups", group.id));
    transaction.update(doc(db, "users", group.ownerId), { ownedGroupId: null });
  });
}
