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

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return cred.user;
}

export async function registerWithEmail(
  email: string,
  pass: string,
  name: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const user = cred.user;

  // Create user profile in Firestore
  const newProfile: Partial<AppUser> = {
    uid: user.uid,
    name: name.trim() || email.split("@")[0],
    email: user.email || email.trim(),
    role: "player",
    totalPoints: 0,
    weeklyPoints: 0,
    currentDailyStreak: 0,
    bestStreak: 0,
    poopcoinBalance: 0,
    salary: 3000,
    hourlyRate: 3000 / 176, // ~17.04/h
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", user.uid), newProfile);
  return user;
}

export async function signOutUser() {
  await fbSignOut(auth);
}
