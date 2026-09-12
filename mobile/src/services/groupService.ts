import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  documentId,
} from "firebase/firestore";
import { db } from "./firebase";
import { AppUser, RankingGroup } from "../types";

export const groupsRef = collection(db, "groups");
export const usersRef = collection(db, "users");
export const appSettingsDocRef = doc(db, "app_settings", "global");

export const GROUP_NAME_MAX_LENGTH = 48;
export const GROUP_DESCRIPTION_MAX_LENGTH = 220;

export function normalizeGroupName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, GROUP_NAME_MAX_LENGTH);
}

export function normalizeGroupDescription(value: string): string {
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

export async function buildGroupId(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = Array.from(
      { length: 8 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("");
    const snapshot = await getDoc(doc(db, "groups", id));
    if (!snapshot.exists()) return id;
  }

  return doc(groupsRef).id;
}

export async function getGroupById(groupId: string): Promise<RankingGroup | null> {
  const normalizedGroupId = groupId.trim().toUpperCase();
  if (!normalizedGroupId) return null;

  const snapshot = await getDoc(doc(db, "groups", normalizedGroupId));
  return snapshot.exists()
    ? ({ id: snapshot.id, ...snapshot.data() } as RankingGroup)
    : null;
}

export async function createGroup(
  owner: AppUser,
  name: string,
  description: string
): Promise<string> {
  const payload = assertGroupPayload(name, description);

  // Check if owner already owns a group
  const existing = await getDocs(
    query(groupsRef, where("ownerId", "==", owner.uid), limit(1))
  );

  if (!existing.empty || owner.ownedGroupId) {
    throw new Error("Você já administra um grupo. Cada usuário pode criar apenas uma liga.");
  }

  const [groupId, settingsSnapshot] = await Promise.all([
    buildGroupId(),
    getDoc(appSettingsDocRef),
  ]);

  const edition = Math.max(
    1,
    Math.trunc(Number(settingsSnapshot.data()?.edition ?? 1))
  );

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", owner.uid);
    const userSnapshot = await transaction.get(userRef);
    const freshUser = userSnapshot.data() as AppUser | undefined;

    if (freshUser?.ownedGroupId) {
      throw new Error("Você já administra um grupo.");
    }

    transaction.set(doc(db, "groups", groupId), {
      ...payload,
      ownerId: owner.uid,
      memberIds: [owner.uid],
      memberCount: 1,
      edition,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: null,
      deletedBy: null,
    });
    transaction.update(userRef, { ownedGroupId: groupId });
  });

  return groupId;
}

export async function joinGroup(user: AppUser, groupCode: string): Promise<string> {
  const code = groupCode.trim().toUpperCase();
  if (!code) {
    throw new Error("Informe o código do grupo.");
  }

  const groupRef = doc(db, "groups", code);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(groupRef);
    if (!snap.exists()) {
      throw new Error(`Grupo com código "${code}" não foi encontrado.`);
    }

    const groupData = snap.data() as RankingGroup;
    if (groupData.deletedAt) {
      throw new Error("Este grupo foi desativado pelo administrador.");
    }

    const memberIds = Array.isArray(groupData.memberIds) ? groupData.memberIds : [];
    if (memberIds.includes(user.uid)) {
      throw new Error("Você já faz parte desta liga!");
    }

    const nextMemberIds = [...memberIds, user.uid];
    transaction.update(groupRef, {
      memberIds: nextMemberIds,
      memberCount: nextMemberIds.length,
      updatedAt: serverTimestamp(),
    });
  });

  return code;
}

export async function updateGroup(
  actor: AppUser,
  group: RankingGroup,
  updates: { name: string; description: string }
): Promise<void> {
  if (actor.uid !== group.ownerId && actor.role !== "admin") {
    throw new Error("Apenas o administrador do grupo pode editá-lo.");
  }

  const payload = assertGroupPayload(updates.name, updates.description);
  await updateDoc(doc(db, "groups", group.id), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function removeGroupMember(
  actor: AppUser,
  group: RankingGroup,
  memberId: string
): Promise<void> {
  if (actor.uid !== group.ownerId && actor.role !== "admin") {
    throw new Error("Apenas o administrador do grupo pode remover membros.");
  }

  if (memberId === group.ownerId) {
    throw new Error("O criador e dono da liga não pode ser removido.");
  }

  const nextMemberIds = group.memberIds.filter((id) => id !== memberId);
  await updateDoc(doc(db, "groups", group.id), {
    memberIds: nextMemberIds,
    memberCount: nextMemberIds.length,
    updatedAt: serverTimestamp(),
  });
}

export async function getUserGroups(userId: string): Promise<RankingGroup[]> {
  try {
    const q = query(groupsRef, where("memberIds", "array-contains", userId));
    const snap = await getDocs(q);
    const groups: RankingGroup[] = [];

    snap.forEach((d) => {
      const data = d.data();
      if (!data.deletedAt) {
        groups.push({ ...data, id: d.id } as RankingGroup);
      }
    });

    // Order with owned group first, then by memberCount desc
    return groups.sort((a, b) => {
      if (a.ownerId === userId && b.ownerId !== userId) return -1;
      if (b.ownerId === userId && a.ownerId !== userId) return 1;
      return (b.memberCount || 0) - (a.memberCount || 0);
    });
  } catch (err) {
    console.error("Erro ao buscar grupos do usuário:", err);
    return [];
  }
}

export async function getGroupMembers(memberIds: string[]): Promise<AppUser[]> {
  if (!memberIds || memberIds.length === 0) return [];

  try {
    // Firestore 'in' query allows up to 30 values
    const chunkSize = 30;
    const users: AppUser[] = [];

    for (let i = 0; i < memberIds.length; i += chunkSize) {
      const chunk = memberIds.slice(i, i + chunkSize);
      const q = query(usersRef, where(documentId(), "in", chunk));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        users.push({ uid: d.id, ...(d.data() as any) });
      });
    }

    // Sort by totalPoints descending
    return users.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
  } catch (err) {
    console.error("Erro ao buscar membros do grupo:", err);
    return [];
  }
}
