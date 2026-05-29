import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
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
import i18n from "../i18n";

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
  cooldownMinutes,
  pointsPerLog,
  edition,
}: {
  action: AdminAuditAction;
  admin: AppUser;
  targetUser?: Pick<AppUser, "uid">;
  delta?: number;
  points?: number;
  removedLogId?: string;
  cooldownMinutes?: number;
  pointsPerLog?: number;
  edition?: number;
}) {
  return {
    action,
    adminId: admin.uid,
    targetUserId: targetUser?.uid ?? null,
    delta: delta ?? null,
    points: points ?? null,
    removedLogId: removedLogId ?? null,
    cooldownMinutes: cooldownMinutes ?? null,
    pointsPerLog: pointsPerLog ?? null,
    edition: edition ?? null,
    createdAt: Timestamp.now(),
  };
}

export function usersQuery() {
  return query(usersRef, orderBy("totalPoints", "desc"));
}

export function userLogsQuery(uid: string) {
  return query(logsRef, where("userId", "==", uid));
}

export function latestUserLogQuery(uid: string) {
  return query(logsRef, where("userId", "==", uid), orderBy("createdAt", "desc"), limit(1));
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
    throw new Error(i18n.t("services:poop.cooldown", { count: Math.ceil(cooldown / 60) }));
  }

  if (countToday(userLogs) >= DAILY_LIMIT) {
    throw new Error(i18n.t("services:poop.dailyLimit", { count: DAILY_LIMIT }));
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
  const userDoc = doc(db, "users", targetUser.uid);
  const targetSnapshot = await getDoc(userDoc);
  const targetData = targetSnapshot.data() as AppUser | undefined;
  const targetName = targetData?.name ?? targetUser.name;
  const now = Timestamp.now();

  if (delta > 0) {
    const batch = writeBatch(db);
    batch.set(doc(logsRef), {
      userId: targetUser.uid,
      userName: targetName,
      createdAt: now,
      points: delta,
      isWeeklyActive: true,
    });
    batch.update(userDoc, {
      totalPoints: increment(delta),
      weeklyPoints: increment(delta),
      firstLogAt: targetData?.firstLogAt ?? now,
      lastLogAt: now,
    });
    batch.set(
      doc(adminLogsRef),
      createAuditLog({
        action: "adjust_points",
        admin,
        targetUser,
        delta,
      }),
    );
    await batch.commit();
    return;
  }

  if (delta < 0) {
    const latestSnapshot = await getDocs(latestUserLogQuery(targetUser.uid));
    const latestLog = latestSnapshot.docs[0];
    if (!latestLog) {
      throw new Error(i18n.t("services:poop.noLogToRemove"));
    }

    const logData = latestLog.data() as Omit<PoopLog, "id">;
    const batch = writeBatch(db);
    batch.delete(latestLog.ref);
    batch.update(userDoc, {
      totalPoints: increment(delta),
      weeklyPoints: logData.isWeeklyActive ? increment(delta) : increment(0),
    });
    batch.set(
      doc(adminLogsRef),
      createAuditLog({
        action: "adjust_points",
        admin,
        targetUser,
        delta,
      }),
    );
    await batch.commit();
  }
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
        targetUser: { uid: log.userId },
        points: log.points,
        removedLogId: log.id,
      }),
    );
  });
}

const APP_SETTINGS_DOC_ID = "global";
const appSettingsDocRef = doc(db, "app_settings", APP_SETTINGS_DOC_ID);

export async function resetWeeklyRanking(admin: AppUser, logs: PoopLog[], users: AppUser[]) {
  const settingsSnapshot = await getDoc(appSettingsDocRef);
  const currentEdition = Number(settingsSnapshot.data()?.edition ?? 17);
  const nextEdition = Math.max(1, Math.trunc(currentEdition)) + 1;

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
    appSettingsDocRef,
    {
      edition: nextEdition,
      updatedAt: Timestamp.now(),
      updatedBy: admin.uid,
    },
    { merge: true },
  );
  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "reset_weekly",
      admin,
      edition: nextEdition,
    }),
  );
  await batch.commit();
}
