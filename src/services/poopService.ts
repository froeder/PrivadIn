import {
  Timestamp,
  addDoc,
  collection,
  doc,
  increment,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AdminAuditAction, AppUser, PoopLog } from "../types";
import {
  DAILY_LIMIT,
  countToday,
  getCooldownSeconds,
  calculateDailyStreak,
  calculateWeeklyStreak,
} from "../utils/date";

export const usersRef = collection(db, "users");
export const logsRef = collection(db, "poop_logs");
export const adminLogsRef = collection(db, "admin_audit_logs");

export function createAuditLog({
  action,
  admin,
  targetUser,
  delta,
  points,
  removedLogId,
  description,
}: {
  action: AdminAuditAction;
  admin: AppUser;
  targetUser?: Pick<AppUser, "uid" | "name">;
  delta?: number;
  points?: number;
  removedLogId?: string;
  description: string;
}) {
  return {
    action,
    adminId: admin.uid,
    adminName: admin.name,
    targetUserId: targetUser?.uid ?? null,
    targetUserName: targetUser?.name ?? null,
    delta: delta ?? null,
    points: points ?? null,
    removedLogId: removedLogId ?? null,
    createdAt: Timestamp.now(),
    description,
  };
}

export function usersQuery() {
  return query(usersRef, orderBy("totalPoints", "desc"));
}

export function userLogsQuery(uid: string) {
  return query(logsRef, where("userId", "==", uid));
}

export function allLogsQuery() {
  return query(logsRef, orderBy("createdAt", "desc"));
}

export function adminAuditLogsQuery() {
  return query(adminLogsRef, orderBy("createdAt", "desc"));
}

export async function registerPoop(
  user: AppUser,
  userLogs: PoopLog[],
  cooldownMinutes: number,
  pointsPerLog: number,
) {
  const cooldown = getCooldownSeconds(userLogs, cooldownMinutes);
  if (cooldown > 0) {
    throw new Error(`Calma, campeão. O trono libera em ${Math.ceil(cooldown / 60)} minuto(s).`);
  }

  if (countToday(userLogs) >= DAILY_LIMIT) {
    throw new Error(`Limite diário de ${DAILY_LIMIT} registros atingido. Até o banheiro precisa de governança.`);
  }

  const now = Timestamp.now();
  const nextLogs = [
    {
      id: "pending",
      userId: user.uid,
      userName: user.name,
      createdAt: now,
      points: pointsPerLog,
      isWeeklyActive: true,
    },
    ...userLogs,
  ];

  const userDoc = doc(db, "users", user.uid);
  const logDoc = await addDoc(logsRef, {
    userId: user.uid,
    userName: user.name,
    createdAt: now,
    points: pointsPerLog,
    isWeeklyActive: true,
  });

  await updateDoc(userDoc, {
    totalPoints: increment(pointsPerLog),
    weeklyPoints: increment(pointsPerLog),
    firstLogAt: user.firstLogAt ?? now,
    lastLogAt: now,
    currentDailyStreak: calculateDailyStreak(nextLogs),
    currentWeeklyStreak: calculateWeeklyStreak(nextLogs),
    bestStreak: Math.max(user.bestStreak ?? 0, calculateDailyStreak(nextLogs)),
  });

  return logDoc.id;
}

export async function adjustUserPoints(admin: AppUser, targetUser: AppUser, delta: number) {
  const batch = writeBatch(db);
  const userDoc = doc(db, "users", targetUser.uid);

  batch.update(userDoc, {
    totalPoints: increment(delta),
    weeklyPoints: increment(delta),
  });

  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "adjust_points",
      admin,
      targetUser,
      delta,
      description:
        delta > 0
          ? `${admin.name} adicionou ${delta} ponto para ${targetUser.name}.`
          : `${admin.name} removeu ${Math.abs(delta)} ponto de ${targetUser.name}.`,
    }),
  );

  await batch.commit();
}

export async function removeLog(admin: AppUser, log: PoopLog) {
  await runTransaction(db, async (transaction) => {
    transaction.delete(doc(db, "poop_logs", log.id));
    transaction.update(doc(db, "users", log.userId), {
      totalPoints: increment(-log.points),
      weeklyPoints: log.isWeeklyActive ? increment(-log.points) : increment(0),
    });
    transaction.set(
      doc(adminLogsRef),
      createAuditLog({
        action: "remove_log",
        admin,
        targetUser: { uid: log.userId, name: log.userName },
        points: log.points,
        removedLogId: log.id,
        description: `${admin.name} removeu um registro de ${log.userName} valendo ${log.points} pontos.`,
      }),
    );
  });
}

export async function resetWeeklyRanking(admin: AppUser, logs: PoopLog[], users: AppUser[]) {
  const batch = writeBatch(db);
  users.forEach((user) => {
    batch.update(doc(db, "users", user.uid), { weeklyPoints: 0 });
  });
  logs.forEach((log) => {
    if (log.isWeeklyActive) {
      batch.update(doc(db, "poop_logs", log.id), { isWeeklyActive: false });
    }
  });
  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "reset_weekly",
      admin,
      description: `${admin.name} resetou o ranking semanal.`,
    }),
  );
  await batch.commit();
}
