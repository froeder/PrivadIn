import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { Timestamp, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../services/firebase";
import type { AppUser, RegistrationRequest } from "../types";
import { avatarFor } from "../utils/ranking";
import {
  createRegistrationAttempt,
  getOrCreateRegistrationRequest,
  getRegistrationRequest,
  markRegistrationRequestUsed,
  normalizeEmail,
} from "../services/registrationService";

type AuthResult =
  | { status: "signed_in" }
  | { status: "access_code_required"; request: RegistrationRequest };

interface AuthContextValue {
  firebaseUser: User | null;
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string, approvalCode?: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function buildName(firebaseUser: User) {
  return firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Operador do Trono";
}

function isMissingAccountError(error: unknown) {
  return (
    error instanceof FirebaseError &&
    ["auth/user-not-found", "auth/invalid-credential", "auth/invalid-login-credentials"].includes(
      error.code,
    )
  );
}

async function ensureUserProfile(firebaseUser: User) {
  const userDoc = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(userDoc);

  if (!snapshot.exists()) {
    const name = buildName(firebaseUser);
    await setDoc(userDoc, {
      uid: firebaseUser.uid,
      name,
      email: firebaseUser.email,
      avatar: avatarFor(name, firebaseUser.email ?? firebaseUser.uid),
      role: "player",
      totalPoints: 0,
      weeklyPoints: 0,
      currentDailyStreak: 0,
      currentWeeklyStreak: 0,
      bestStreak: 0,
      createdAt: serverTimestamp(),
    });
  }

  const fresh = await getDoc(userDoc);
  const data = fresh.data() as AppUser;
  if (!data) {
    throw new Error("Nao foi possivel carregar o perfil do usuario no Firestore.");
  }

  return {
    ...data,
    createdAt: data.createdAt ?? Timestamp.now(),
  };
}

async function registerWithApprovalCode(email: string, password: string, approvalCode: string) {
  const request = await getRegistrationRequest(email);
  if (!request || request.status !== "pending") {
    await createRegistrationAttempt({
      email,
      status: "failed",
      approvalCodeProvided: approvalCode,
      message: "Solicitacao inexistente ou ja utilizada.",
    });
    throw new Error("Solicitacao de acesso nao encontrada ou ja utilizada.");
  }

  if (request.approvalCode.toUpperCase() !== approvalCode.trim().toUpperCase()) {
    await createRegistrationAttempt({
      email,
      status: "invalid_code",
      approvalCodeProvided: approvalCode,
      requestId: request.id,
      message: "Codigo informado nao confere com a solicitacao.",
    });
    throw new Error("Codigo de acesso incorreto.");
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
    const profile = await ensureUserProfile(credential.user);
    await markRegistrationRequestUsed(email, credential.user.uid);
    await createRegistrationAttempt({
      email,
      status: "account_created",
      approvalCodeProvided: approvalCode,
      requestId: request.id,
      message: "Conta criada com codigo aprovado.",
    });
    return { credential, profile };
  } catch (error) {
    await createRegistrationAttempt({
      email,
      status: "failed",
      approvalCodeProvided: approvalCode,
      requestId: request.id,
      message: error instanceof Error ? error.message : "Falha ao criar conta.",
    });
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setFirebaseUser(nextUser);
      if (!nextUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        setUser(await ensureUserProfile(nextUser));
      } catch (error) {
        console.error(error);
        setUser(null);
        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      user,
      loading,
      login: async (email, password, approvalCode) => {
        if (!isFirebaseConfigured) {
          throw new Error("Firebase ainda nao foi configurado no .env.");
        }
        setLoading(true);
        try {
          if (approvalCode?.trim()) {
            const { credential, profile } = await registerWithApprovalCode(
              email,
              password,
              approvalCode,
            );
            setFirebaseUser(credential.user);
            setUser(profile);
            return { status: "signed_in" };
          }

          const credential = await signInWithEmailAndPassword(auth, email, password);
          const profile = await ensureUserProfile(credential.user);
          setFirebaseUser(credential.user);
          setUser(profile);
          return { status: "signed_in" };
        } catch (error) {
          if (!approvalCode?.trim() && isMissingAccountError(error)) {
            const request = await getOrCreateRegistrationRequest(email);
            await createRegistrationAttempt({
              email,
              status: "code_requested",
              requestId: request.id,
              message: "Usuario tentou entrar sem conta e solicitou codigo.",
            });
            return { status: "access_code_required", request };
          }
          await signOut(auth).catch(() => undefined);
          throw error;
        } finally {
          setLoading(false);
        }
      },
      logout: () => signOut(auth),
    }),
    [firebaseUser, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
