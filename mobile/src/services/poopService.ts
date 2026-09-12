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
} from "firebase/firestore";
import { db } from "./firebase";
import { AppUser, PoopLog, WorkSchedule } from "../types";
import { mintPoopcoinsForLog } from "./poopcoinService";

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

export async function registerPoopLog(
  user: AppUser,
  durationSeconds: number,
  earnedAmount: number,
  note?: string
) {
  // Load settings for edition, pointsPerLog and cooldown
  let cooldownMinutes = 15;
  let currentEdition = 1;
  let basePoints = 2000;
  try {
    const settingsSnap = await getDoc(doc(db, "app_settings", "global"));
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      if (typeof data.cooldownMinutes === "number") cooldownMinutes = data.cooldownMinutes;
      if (typeof data.edition === "number") currentEdition = data.edition;
      if (typeof data.pointsPerLog === "number") basePoints = data.pointsPerLog;
    }
  } catch (e) {
    console.warn("Could not fetch global app_settings in registerPoopLog:", e);
  }

  // Calculate points: base points from edition settings + small bonus for duration
  const durationBonus = Math.min(500, Math.floor(durationSeconds / 60) * 10);
  const pointsEarned = basePoints + durationBonus;

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

export async function updateUserWorkSchedule(userId: string, schedule: WorkSchedule) {
  await updateDoc(doc(db, "users", userId), {
    workSchedule: {
      horarioInicioExpediente: schedule.horarioInicioExpediente || "09:00",
      horarioFimExpediente: schedule.horarioFimExpediente || "18:00",
      horarioInicioAlmoco: schedule.horarioInicioAlmoco || "12:00",
      horarioFimAlmoco: schedule.horarioFimAlmoco || "13:00",
      timezone: schedule.timezone || "America/Sao_Paulo",
    },
  });
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
