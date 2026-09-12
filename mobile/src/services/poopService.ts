import {
  collection,
  doc,
  addDoc,
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
import { AppUser, PoopLog } from "../types";
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
  const pointsEarned = Math.max(10, Math.floor(durationSeconds / 60) * 5);
  const newStreak = calculateNextStreak(user.lastLogAt, user.currentDailyStreak || 0);
  const newBestStreak = Math.max(user.bestStreak || 0, newStreak);

  // 1. Add log
  const logData: any = {
    userId: user.uid,
    userName: user.name || "Cagador Anônimo",
    durationSeconds,
    earnedAmount: Number(earnedAmount.toFixed(2)),
    points: pointsEarned,
    poopcoinsEarned: 0,
    isWeeklyActive: true,
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

  // 3. Update user points, streak, last log (and fallback poopcoinBalance if minting failed)
  const userDoc = doc(db, "users", user.uid);
  const userUpdates: any = {
    totalPoints: increment(pointsEarned),
    weeklyPoints: increment(pointsEarned),
    currentDailyStreak: newStreak,
    bestStreak: newBestStreak,
    lastLogAt: serverTimestamp(),
  };
  if (mintedCoins === 0) {
    // If supply not migrated or minting had an issue, fallback increment so user gets their coin
    userUpdates.poopcoinBalance = increment(1);
  }
  await updateDoc(userDoc, userUpdates);

  return {
    id: docRef.id,
    ...logData,
    poopcoinsEarned: Math.max(1, mintedCoins),
    newStreak,
  };
}

export async function getLeaderboard(top = 20): Promise<AppUser[]> {
  try {
    const q = query(usersRef, orderBy("totalPoints", "desc"), limit(top));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...(doc.data() as any),
    }));
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

export async function updateUserSalary(userId: string, salary: number) {
  const hourlyRate = Number((salary / 176).toFixed(2));
  await updateDoc(doc(db, "users", userId), {
    salary,
    hourlyRate,
  });
}
