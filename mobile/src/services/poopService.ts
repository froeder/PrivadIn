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

export const logsRef = collection(db, "poop_logs");
export const usersRef = collection(db, "users");

export async function registerPoopLog(
  user: AppUser,
  durationSeconds: number,
  earnedAmount: number,
  note?: string
) {
  const pointsEarned = Math.max(10, Math.floor(durationSeconds / 60) * 5);

  // 1. Add log
  const logData = {
    userId: user.uid,
    userName: user.name || "Cagador Anônimo",
    durationSeconds,
    earnedAmount: Number(earnedAmount.toFixed(2)),
    points: pointsEarned,
    note: note || "Cagada remunerada pelo app mobile",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(logsRef, logData);

  // 2. Update user points, streak, last log
  const userDoc = doc(db, "users", user.uid);
  await updateDoc(userDoc, {
    totalPoints: increment(pointsEarned),
    weeklyPoints: increment(pointsEarned),
    currentDailyStreak: increment(1),
    lastLogAt: serverTimestamp(),
  });

  return { id: docRef.id, ...logData };
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
