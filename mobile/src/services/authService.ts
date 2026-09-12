import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { AppUser } from "../types";

export function listenAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return { uid, ...(userDoc.data() as any) };
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function ensureUserProfile(firebaseUser: User, nameHint?: string): Promise<AppUser> {
  const userRef = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return { uid: firebaseUser.uid, ...(snap.data() as any) };
  }

  const defaultName =
    nameHint?.trim() ||
    firebaseUser.displayName?.trim() ||
    (firebaseUser.email ? firebaseUser.email.split("@")[0] : "Cagador");

  const newProfile: AppUser = {
    uid: firebaseUser.uid,
    name: defaultName,
    email: firebaseUser.email || "",
    role: "player",
    isActive: true,
    totalPoints: 0,
    weeklyPoints: 0,
    currentDailyStreak: 0,
    currentWeeklyStreak: 0,
    bestStreak: 0,
    poopcoinBalance: 0,
    salary: 3000,
    hourlyRate: Number((3000 / 176).toFixed(2)),
    bathroomDurationMinutes: 10,
    termsAccepted: true,
    workSchedule: {
      horarioInicioExpediente: "09:00",
      horarioFimExpediente: "18:00",
      horarioInicioAlmoco: "12:00",
      horarioFimAlmoco: "13:00",
      timezone: "America/Sao_Paulo",
    },
    createdAt: serverTimestamp(),
  };

  await setDoc(userRef, newProfile);
  return newProfile;
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function registerWithEmail(
  email: string,
  pass: string,
  name: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  await ensureUserProfile(cred.user, name);
  return cred.user;
}

export async function signOutUser() {
  await fbSignOut(auth);
}
