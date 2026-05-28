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
import { AuthLoginError, firebaseAuthErrorCode } from "../utils/authErrors";

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
    throw new Error("Não foi possível carregar o perfil do usuário no Firestore.");
  }

  return {
    ...data,
    createdAt: data.createdAt ?? Timestamp.now(),
  };
}

async function registerWithApprovalCode(email: string, password: string, approvalCode: string) {
  const normalizedEmail = normalizeEmail(email);
  const request = await getRegistrationRequest(normalizedEmail);

  if (!request) {
    await createRegistrationAttempt({
      email: normalizedEmail,
      status: "failed",
      approvalCodeProvided: approvalCode,
      message: "Nenhuma solicitação encontrada para este email.",
    });
    throw new AuthLoginError(
      "Nenhuma solicitação de acesso encontrada para este email.",
      "no_request",
    );
  }

  if (request.status === "used") {
    await createRegistrationAttempt({
      email: normalizedEmail,
      status: "failed",
      approvalCodeProvided: approvalCode,
      requestId: request.id,
      message: "Solicitação já utilizada; conta já existe.",
    });
    throw new AuthLoginError(
      "A solicitação deste email já foi usada para criar conta.",
      "request_already_used",
    );
  }

  if (request.approvalCode.toUpperCase() !== approvalCode.trim().toUpperCase()) {
    await createRegistrationAttempt({
      email: normalizedEmail,
      status: "invalid_code",
      approvalCodeProvided: approvalCode,
      requestId: request.id,
      message: "Código informado não confere com a solicitação.",
    });
    throw new AuthLoginError("Código de acesso incorreto.", "invalid_code");
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const profile = await ensureUserProfile(credential.user);
    await markRegistrationRequestUsed(normalizedEmail, credential.user.uid);
    await createRegistrationAttempt({
      email: normalizedEmail,
      status: "account_created",
      approvalCodeProvided: approvalCode,
      requestId: request.id,
      message: "Conta criada com código aprovado.",
    });
    return { credential, profile };
  } catch (error) {
    const mappedCode = firebaseAuthErrorCode(error);
    await createRegistrationAttempt({
      email: normalizedEmail,
      status: "failed",
      approvalCodeProvided: approvalCode,
      requestId: request.id,
      message: error instanceof Error ? error.message : "Falha ao criar conta.",
    });
    if (mappedCode) {
      throw new AuthLoginError(
        mappedCode === "email_already_registered"
          ? "Este email já possui conta."
          : mappedCode === "weak_password"
            ? "Senha muito fraca para criar a conta."
            : "Email inválido para cadastro.",
        mappedCode,
      );
    }
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
          throw new AuthLoginError("Firebase ainda não foi configurado no .env.", "firebase_not_configured");
        }

        const normalizedEmail = normalizeEmail(email);
        setLoading(true);
        try {
          if (approvalCode?.trim()) {
            const { credential, profile } = await registerWithApprovalCode(
              normalizedEmail,
              password,
              approvalCode,
            );
            setFirebaseUser(credential.user);
            setUser(profile);
            return { status: "signed_in" };
          }

          const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
          const profile = await ensureUserProfile(credential.user);
          setFirebaseUser(credential.user);
          setUser(profile);
          return { status: "signed_in" };
        } catch (error) {
          if (!approvalCode?.trim() && isMissingAccountError(error)) {
            const request = await getOrCreateRegistrationRequest(normalizedEmail);
            if (request.status === "used") {
              throw new AuthLoginError(
                "Este email já foi cadastrado. Entre com email e senha.",
                "request_already_used",
              );
            }
            await createRegistrationAttempt({
              email: normalizedEmail,
              status: "code_requested",
              requestId: request.id,
              message: "Usuário tentou entrar sem conta e solicitou código.",
            });
            return { status: "access_code_required", request };
          }

          const mappedCode = firebaseAuthErrorCode(error);
          if (mappedCode === "wrong_password") {
            throw new AuthLoginError("Senha incorreta.", "wrong_password");
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
