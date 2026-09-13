import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  increment,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { AppUser, PoopLog, WorkSchedule, BonusTimeRange, PoopLocation } from "../types";
import { mintPoopcoinsForLog } from "./poopcoinService";
import {
  minutesOfDay,
  isBetweenMinutes,
  localTimeInTimezone,
  resolveWorkSchedule,
} from "../utils/workSchedule";

export const logsRef = collection(db, "poop_logs");
export const usersRef = collection(db, "users");

function parseTimestamp(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val.toDate === "function") return val.toDate();
  if (typeof val.seconds === "number") return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateNextStreak(lastLogAt: any, currentStreak: number = 0): number {
  const lastDate = parseTimestamp(lastLogAt);
  if (!lastDate) return 1;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const lastStr = `${lastDate.getFullYear()}-${lastDate.getMonth() + 1}-${lastDate.getDate()}`;

  if (todayStr === lastStr) {
    return Math.max(1, currentStreak || 1);
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;

  if (lastStr === yesterdayStr) {
    return (currentStreak || 0) + 1;
  }

  return 1;
}

export function resolvePointsPerLog(
  settings: Record<string, unknown> | undefined,
  localTime: string,
  fallback: number = 2000
): number {
  let pointsPerLog = Math.max(1, Number(settings?.pointsPerLog ?? fallback));
  const bonusRanges = Array.isArray(settings?.bonusTimeRanges)
    ? (settings.bonusTimeRanges as BonusTimeRange[])
    : [];
  const currentMinutes = minutesOfDay(localTime);

  for (const range of bonusRanges) {
    const start = typeof range.start === "string" ? range.start : "00:00";
    const end = typeof range.end === "string" ? range.end : "00:00";
    const points = Number(range.points) || pointsPerLog;
    if (isBetweenMinutes(currentMinutes, minutesOfDay(start), minutesOfDay(end))) {
      pointsPerLog = Math.max(pointsPerLog, Math.trunc(points));
    }
  }

  return pointsPerLog;
}

export async function registerPoopLog(
  user: AppUser,
  durationSeconds: number,
  earnedAmount: number,
  note?: string,
  location?: PoopLocation | null
) {
  // Load settings for edition, pointsPerLog, bonusTimeRanges and cooldown
  let cooldownMinutes = 15;
  let currentEdition = 1;
  let basePoints = 2000;
  let settingsData: any = undefined;
  try {
    const settingsSnap = await getDoc(doc(db, "app_settings", "global"));
    if (settingsSnap.exists()) {
      settingsData = settingsSnap.data();
      if (typeof settingsData.cooldownMinutes === "number") cooldownMinutes = settingsData.cooldownMinutes;
      if (typeof settingsData.edition === "number") currentEdition = settingsData.edition;
      if (typeof settingsData.pointsPerLog === "number") basePoints = settingsData.pointsPerLog;
    }
  } catch (e) {
    console.warn("Could not fetch global app_settings in registerPoopLog:", e);
  }

  // Calculate points: base points with peak hours bonus + duration bonus
  const schedule = resolveWorkSchedule(user.workSchedule);
  const localTime = localTimeInTimezone(new Date(), schedule.timezone);
  const resolvedBasePoints = resolvePointsPerLog(settingsData, localTime, basePoints);

  const durationBonus = Math.min(500, Math.floor(durationSeconds / 60) * 10);
  const pointsEarned = resolvedBasePoints + durationBonus;

  const newStreak = calculateNextStreak(user.lastLogAt, user.currentDailyStreak || 0);
  const newBestStreak = Math.max(user.bestStreak || 0, newStreak);

  const nowMs = Date.now();
  const nextCooldown = Timestamp.fromMillis(nowMs + cooldownMinutes * 60_000);

  // 1. Add log
  const logData: any = {
    userId: user.uid,
    userName: user.name || "Cagador Anônimo",
    durationSeconds,
    earnedAmount: Number(earnedAmount.toFixed(2)),
    points: pointsEarned,
    poopcoinsEarned: 0,
    isWeeklyActive: true,
    competitionEdition: currentEdition,
    note: note || "Cagada remunerada pelo app mobile",
    createdAt: serverTimestamp(),
  };

  if (location && typeof location.latitude === "number" && typeof location.longitude === "number") {
    logData.location = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: typeof location.accuracy === "number" ? location.accuracy : null,
    };
  }

  const docRef = await addDoc(logsRef, logData);

  // 2. Mint Poopcoins on the official blockchain ledger
  let mintedCoins = 0;
  let txHash: string | null = null;
  try {
    const mintResult = await mintPoopcoinsForLog(user, docRef.id);
    mintedCoins = mintResult.poopcoinsEarned;
    txHash = mintResult.transactionHash;
    if (mintedCoins > 0 && txHash) {
      await updateDoc(doc(logsRef, docRef.id), {
        poopcoinsEarned: mintedCoins,
        poopcoinTransactionHash: txHash,
      });
    }
  } catch (err) {
    console.error("Error minting poopcoin on log:", err);
  }

  // 3. Update user points, streak, last log, cooldownUntil (and fallback poopcoinBalance if minting failed)
  const userDoc = doc(db, "users", user.uid);
  const userUpdates: any = {
    totalPoints: increment(pointsEarned),
    weeklyPoints: increment(pointsEarned),
    currentDailyStreak: newStreak,
    bestStreak: newBestStreak,
    lastLogAt: serverTimestamp(),
    cooldownUntil: nextCooldown,
  };
  if (!user.firstLogAt) {
    userUpdates.firstLogAt = serverTimestamp();
  }
  if (mintedCoins === 0) {
    // If supply not migrated or minting had an issue, fallback increment so user gets their coin
    userUpdates.poopcoinBalance = increment(1);
  }
  await updateDoc(userDoc, userUpdates);

  return {
    id: docRef.id,
    ...logData,
    points: pointsEarned,
    poopcoinsEarned: Math.max(1, mintedCoins),
    newStreak,
    cooldownUntil: nextCooldown,
    competitionEdition: currentEdition,
  };
}

export async function getLeaderboard(
  mode: "weekly" | "overall" = "weekly",
  top = 50
): Promise<AppUser[]> {
  try {
    const field = mode === "weekly" ? "weeklyPoints" : "totalPoints";
    let snapshot;
    try {
      const q = query(usersRef, orderBy(field, "desc"), limit(top));
      snapshot = await getDocs(q);
    } catch (orderErr) {
      console.warn(`Query with orderBy('${field}') failed, falling back to basic query:`, orderErr);
      const q = query(usersRef, limit(top));
      snapshot = await getDocs(q);
    }

    const users = snapshot.docs
      .map((doc) => ({
        uid: doc.id,
        ...(doc.data() as any),
      }))
      .filter((u: AppUser) => u.isActive !== false);

    // Sort in memory to guarantee correct ranking even with missing fields
    users.sort((a, b) => {
      const ptsA = (mode === "weekly" ? a.weeklyPoints : a.totalPoints) ?? 0;
      const ptsB = (mode === "weekly" ? b.weeklyPoints : b.totalPoints) ?? 0;
      if (ptsB !== ptsA) return ptsB - ptsA;
      return (b.currentDailyStreak ?? 0) - (a.currentDailyStreak ?? 0);
    });

    return users;
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return [];
  }
}


export async function getUserRecentLogs(userId: string, count = 10): Promise<PoopLog[]> {
  try {
    const q = query(
      logsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
  } catch (error) {
    console.error("Error fetching user logs:", error);
    return [];
  }
}

export const getUserLogs = getUserRecentLogs;

export async function getUserAllLogs(userId: string): Promise<PoopLog[]> {
  try {
    let snapshot;
    try {
      const q = query(
        logsRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      snapshot = await getDocs(q);
    } catch (orderErr) {
      console.warn("Index query for all logs failed, querying without orderBy:", orderErr);
      const q = query(logsRef, where("userId", "==", userId));
      snapshot = await getDocs(q);
    }

    const logs = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    // Sort descending by date in-memory
    logs.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime());
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime());
      return timeB - timeA;
    });

    return logs;
  } catch (error) {
    console.error("Error fetching all user logs:", error);
    return [];
  }
}

export async function updateUserSalary(userId: string, salary: number) {
  const hourlyRate = Number((salary / 176).toFixed(2));
  await updateDoc(doc(db, "users", userId), {
    salary,
    hourlyRate,
  });
}

export async function updateUserProfileCustomization(
  userId: string,
  data: {
    nickname?: string;
    avatar?: string;
    themeColor?: string;
    bio?: string;
  }
) {
  const updates: Record<string, any> = {};
  if (data.nickname !== undefined) updates.nickname = data.nickname.trim();
  if (data.avatar !== undefined) updates.avatar = data.avatar.trim();
  if (data.themeColor !== undefined) updates.themeColor = data.themeColor.trim();
  if (data.bio !== undefined) updates.bio = data.bio.trim();

  await updateDoc(doc(db, "users", userId), updates);
}

export async function updateUserWorkSchedule(
  userId: string,
  schedule: WorkSchedule,
  bathroomDurationMinutes?: number
) {
  const payload: Record<string, any> = {
    workSchedule: {
      horarioInicioExpediente: schedule.horarioInicioExpediente || "09:00",
      horarioFimExpediente: schedule.horarioFimExpediente || "18:00",
      horarioInicioAlmoco: schedule.horarioInicioAlmoco || "12:00",
      horarioFimAlmoco: schedule.horarioFimAlmoco || "13:00",
      timezone: schedule.timezone || "America/Sao_Paulo",
    },
  };

  if (typeof bathroomDurationMinutes === "number" && !isNaN(bathroomDurationMinutes)) {
    payload.bathroomDurationMinutes = Math.max(1, Math.min(180, Math.trunc(bathroomDurationMinutes)));
  }

  await updateDoc(doc(db, "users", userId), payload);
}

export async function updateUserOperationalProfile(
  userId: string,
  updates: {
    workSchedule?: WorkSchedule;
    bathroomDurationMinutes?: number;
  }
) {
  const payload: Record<string, any> = {};
  if (updates.workSchedule) {
    payload.workSchedule = {
      horarioInicioExpediente: updates.workSchedule.horarioInicioExpediente || "09:00",
      horarioFimExpediente: updates.workSchedule.horarioFimExpediente || "18:00",
      horarioInicioAlmoco: updates.workSchedule.horarioInicioAlmoco || "12:00",
      horarioFimAlmoco: updates.workSchedule.horarioFimAlmoco || "13:00",
      timezone: updates.workSchedule.timezone || "America/Sao_Paulo",
    };
  }
  if (typeof updates.bathroomDurationMinutes === "number" && !isNaN(updates.bathroomDurationMinutes)) {
    payload.bathroomDurationMinutes = Math.max(1, Math.min(180, Math.trunc(updates.bathroomDurationMinutes)));
  }

  if (Object.keys(payload).length > 0) {
    await updateDoc(doc(db, "users", userId), payload);
  }
}


export async function updateUserFinancialSettings(
  userId: string,
  data: { salary: number; hourlyRate: number }
) {
  await updateDoc(doc(db, "users", userId), {
    salary: data.salary,
    hourlyRate: data.hourlyRate,
  });
}

/**
 * Remove um registro de cagada próprio do usuário e recalcula
 * automaticamente seus pontos acumulados (totalPoints, weeklyPoints)
 * e saldo de PoopCoins.
 */
export async function deleteUserPoopLog(user: AppUser, log: PoopLog): Promise<void> {
  if (!log.id) throw new Error("ID do registro inválido.");
  if (log.userId !== user.uid) throw new Error("Você só pode excluir seus próprios registros.");

  const pointsToRemove = typeof log.points === "number" ? log.points : 2000;
  const poopcoinsToRemove =
    typeof log.poopcoinsEarned === "number"
      ? log.poopcoinsEarned
      : log.poopcoinTransactionHash
      ? 1
      : 0;

  const logRef = doc(db, "poop_logs", log.id);
  const userRef = doc(db, "users", user.uid);

  const batch = writeBatch(db);
  batch.delete(logRef);

  const userUpdates: Record<string, any> = {
    totalPoints: increment(-pointsToRemove),
  };
  if (log.isWeeklyActive) {
    userUpdates.weeklyPoints = increment(-pointsToRemove);
  }
  if (poopcoinsToRemove > 0) {
    userUpdates.poopcoinBalance = increment(-poopcoinsToRemove);
  }

  batch.update(userRef, userUpdates);
  await batch.commit();
}

/**
 * Permite ao usuário corrigir dados de uma sessão própria (duração e observações),
 * recalculando automaticamente:
 * - O rendimento em R$ (baseado no hourlyRate)
 * - Os pontos acumulados (bônus de duração proporcional)
 * - Os totais de totalPoints e weeklyPoints do perfil do usuário
 */
export async function editUserPoopLog(
  user: AppUser,
  log: PoopLog,
  updates: { durationSeconds: number; note?: string }
): Promise<{ updatedLog: PoopLog; deltaPoints: number; deltaEarned: number }> {
  if (!log.id) throw new Error("ID do registro inválido.");
  if (log.userId !== user.uid) throw new Error("Você só pode editar seus próprios registros.");

  const hourlyRate = user.hourlyRate || (user.salary ? user.salary / 176 : 20);
  const newDurationSeconds = Math.max(1, Math.min(10800, Math.trunc(updates.durationSeconds)));
  const newEarnedAmount = Number(((newDurationSeconds / 3600) * hourlyRate).toFixed(2));
  const oldEarnedAmount = typeof log.earnedAmount === "number" ? log.earnedAmount : 0;
  const deltaEarned = Number((newEarnedAmount - oldEarnedAmount).toFixed(2));

  // Recálculo de pontos baseado no bônus de duração: Math.min(500, Math.floor(sec / 60) * 10)
  const oldDuration = typeof log.durationSeconds === "number" ? log.durationSeconds : 600;
  const oldBonus = Math.min(500, Math.floor(oldDuration / 60) * 10);
  const newBonus = Math.min(500, Math.floor(newDurationSeconds / 60) * 10);
  const bonusDelta = newBonus - oldBonus;

  const oldPoints = typeof log.points === "number" ? log.points : 2000;
  const newPoints = Math.max(1, oldPoints + bonusDelta);
  const deltaPoints = newPoints - oldPoints;

  const logRef = doc(db, "poop_logs", log.id);
  const userRef = doc(db, "users", user.uid);

  const batch = writeBatch(db);
  const logUpdates: Record<string, any> = {
    durationSeconds: newDurationSeconds,
    earnedAmount: newEarnedAmount,
    points: newPoints,
    updatedAt: serverTimestamp(),
  };
  if (updates.note !== undefined) {
    logUpdates.note = updates.note.trim();
  }
  batch.update(logRef, logUpdates);

  if (deltaPoints !== 0) {
    const userUpdates: Record<string, any> = {
      totalPoints: increment(deltaPoints),
    };
    if (log.isWeeklyActive) {
      userUpdates.weeklyPoints = increment(deltaPoints);
    }
    batch.update(userRef, userUpdates);
  }

  await batch.commit();

  return {
    updatedLog: {
      ...log,
      durationSeconds: newDurationSeconds,
      earnedAmount: newEarnedAmount,
      points: newPoints,
      note: updates.note !== undefined ? updates.note.trim() : log.note,
    },
    deltaPoints,
    deltaEarned,
  };
}

// ---------------------------------------------------------------------------
// COMPATIBILIDADE PWA / SERVIÇOS UNIFICADOS
// ---------------------------------------------------------------------------

import {
  removePoopLogAsAdmin,
  resetWeeklyCompetition,
  adjustUserPoints,
} from "./adminService";

/**
 * Valida regras de negócio, streaks, bônus e registra a cagada (alias compatível com PWA).
 */
export const registerPoopWithValidation = registerPoopLog;

/**
 * Remove log de cagada e recalcula pontuações / moedas com registro de auditoria (alias compatível com PWA).
 */
export const removeLog = removePoopLogAsAdmin;

/**
 * Zera o ranking semanal incrementando a edição da liga (alias compatível com PWA).
 */
export const resetWeeklyRanking = resetWeeklyCompetition;

export { adjustUserPoints };

