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
} from "@firebase/auth";
import { FirebaseError } from "@firebase/app";
import { Timestamp, doc, getDoc, serverTimestamp, setDoc } from "@firebase/firestore";
import i18n from "../i18n";
import { auth, db, isFirebaseConfigured } from "../services/firebase";
import type { AppSettings, AppUser } from "../types";
import { avatarFor } from "../utils/ranking";
import {
  createRegistrationAttempt,
  normalizeEmail,
} from "../services/registrationService";
import { isUserNameTaken } from "../services/userService";
import { AuthLoginError, firebaseAuthErrorCode } from "../utils/authErrors";
import { acceptTermsOfUse } from "../services/userService";
import { appSettingsDocRef, parseAppSettings } from "../services/settingsService";
import { getCurrentTermsVersion, hasAcceptedCurrentTerms } from "../utils/terms";
import { joinGroup } from "../services/groupService";

type AuthResult =
  | { status: "signed_in" }
  | { status: "terms_required" };

interface AuthContextValue {
  firebaseUser: User | null;
  user: AppUser | null;
  pendingTermsUser: AppUser | null;
  currentAppSettings: AppSettings | null;
  loading: boolean;
  login: (email: string, password: string, groupCode?: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  acceptPendingTerms: () => Promise<void>;
  openTermsReview: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function buildName(firebaseUser: User) {
  return firebaseUser.displayName || firebaseUser.email?.split("@")[0] || i18n.t("common:defaultUserName");
}

async function buildUniqueName(firebaseUser: User) {
  const baseName = buildName(firebaseUser).trim();
  if (!(await isUserNameTaken(baseName))) {
    return baseName;
  }

  let index = 1;
  while (true) {
    const candidate = `${baseName} (${index})`;
    if (!(await isUserNameTaken(candidate))) {
      return candidate;
    }
    index += 1;
  }
}

function isMissingAccountError(error: unknown) {
  return (
    error instanceof FirebaseError &&
    ["auth/user-not-found", "auth/invalid-credential", "auth/invalid-login-credentials"].includes(
      error.code,
    )
  );
}

function assertActiveUserProfile(profile: AppUser) {
  if (profile.isActive === false) {
    throw new AuthLoginError("Este usuario foi desativado por um admin.", "deactivated_user");
  }

  return profile;
}

async function ensureUserProfile(firebaseUser: User) {
  const userDoc = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(userDoc);

  if (!snapshot.exists()) {
    const name = await buildUniqueName(firebaseUser);
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
      workSchedule: {
        horarioInicioExpediente: "09:00",
        horarioFimExpediente: "18:00",
        horarioInicioAlmoco: "12:00",
        horarioFimAlmoco: "13:00",
        timezone: "America/Sao_Paulo",
      },
      termsAccepted: false,
      cooldownUntil: null,
      bathroomDurationMinutes: 10,
      isActive: true,
      poopcoinBalance: 0,
      createdAt: serverTimestamp(),
    });
  }

  const fresh = await getDoc(userDoc);
  const data = fresh.data() as AppUser;
  if (!data) {
    throw new Error("Não foi possível carregar o perfil do usuário no Firestore.");
  }

  return assertActiveUserProfile({
    ...data,
    createdAt: data.createdAt ?? Timestamp.now(),
  });
}

async function loadAppSettings() {
  const settingsSnapshot = await getDoc(appSettingsDocRef);
  return parseAppSettings(settingsSnapshot.data() as Partial<AppSettings> | undefined);
}

async function joinGroupOrThrow(profile: AppUser, groupCode: string) {
  try {
    await joinGroup(profile, groupCode);
  } catch (error) {
    throw new AuthLoginError(
      error instanceof Error ? error.message : "Grupo nao encontrado.",
      "invalid_group_code",
    );
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [pendingTermsUser, setPendingTermsUser] = useState<AppUser | null>(null);
  const [currentAppSettings, setCurrentAppSettings] = useState<AppSettings | null>(null);
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
        setPendingTermsUser(null);
        setLoading(false);
        return;
      }

      try {
        const [profile, appSettings] = await Promise.all([ensureUserProfile(nextUser), loadAppSettings()]);
        setCurrentAppSettings(appSettings);
        if (hasAcceptedCurrentTerms(profile, appSettings)) {
          setPendingTermsUser(null);
          setUser(profile);
        } else {
          setUser(null);
          setPendingTermsUser(profile);
        }
      } catch (error) {
        console.error(error);
        setUser(null);
        setPendingTermsUser(null);
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
      pendingTermsUser,
      currentAppSettings,
      loading,
      login: async (email, password, groupCode) => {
        if (!isFirebaseConfigured) {
          throw new AuthLoginError("Firebase ainda não foi configurado no .env.", "firebase_not_configured");
        }

        const normalizedEmail = normalizeEmail(email);
        const normalizedGroupCode = groupCode?.trim() ?? "";
        setLoading(true);
        try {
          const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
          let profile = await ensureUserProfile(credential.user);
          if (normalizedGroupCode) {
            await joinGroupOrThrow(profile, normalizedGroupCode);
            profile = await ensureUserProfile(credential.user);
          }
          const appSettings = await loadAppSettings();
          setCurrentAppSettings(appSettings);
          setFirebaseUser(credential.user);
          if (hasAcceptedCurrentTerms(profile, appSettings)) {
            setPendingTermsUser(null);
            setUser(profile);
            return { status: "signed_in" };
          }
          setUser(null);
          setPendingTermsUser(profile);
          return { status: "terms_required" };
        } catch (error) {
          if (error instanceof AuthLoginError) {
            await signOut(auth).catch(() => undefined);
            throw error;
          }

          if (isMissingAccountError(error)) {
            try {
              const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
              let profile = await ensureUserProfile(credential.user);
              if (normalizedGroupCode) {
                await joinGroupOrThrow(profile, normalizedGroupCode);
                profile = await ensureUserProfile(credential.user);
              }
              await createRegistrationAttempt({
                email: normalizedEmail,
                status: "account_created",
                groupCodeProvided: normalizedGroupCode || undefined,
                message: normalizedGroupCode
                  ? "Conta criada sem aprovacao e vinculada a grupo."
                  : "Conta criada sem necessidade de aprovacao.",
              });
              const appSettings = await loadAppSettings();
              setCurrentAppSettings(appSettings);
              setFirebaseUser(credential.user);
              if (hasAcceptedCurrentTerms(profile, appSettings)) {
                setPendingTermsUser(null);
                setUser(profile);
                return { status: "signed_in" };
              }
              setUser(null);
              setPendingTermsUser(profile);
              return { status: "terms_required" };
            } catch (createError) {
              const mappedCreateCode = firebaseAuthErrorCode(createError);
              if (createError instanceof AuthLoginError) {
                await signOut(auth).catch(() => undefined);
                throw createError;
              }
              await createRegistrationAttempt({
                email: normalizedEmail,
                status: "failed",
                groupCodeProvided: normalizedGroupCode || undefined,
                message: createError instanceof Error ? createError.message : "Falha ao criar conta.",
              });
              if (mappedCreateCode) {
                throw new AuthLoginError(
                  mappedCreateCode === "email_already_registered"
                    ? "Senha incorreta."
                    : mappedCreateCode === "weak_password"
                      ? "Senha muito fraca para criar a conta."
                      : "Email inválido para cadastro.",
                  mappedCreateCode === "email_already_registered" ? "wrong_password" : mappedCreateCode,
                );
              }
              throw createError;
            }
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
      logout: async () => {
        setPendingTermsUser(null);
        setCurrentAppSettings(null);
        await signOut(auth);
      },
      refreshProfile: async () => {
        if (!firebaseUser) return;
        const [profile, appSettings] = await Promise.all([ensureUserProfile(firebaseUser), loadAppSettings()]);
        setCurrentAppSettings(appSettings);
        if (hasAcceptedCurrentTerms(profile, appSettings)) {
          setPendingTermsUser(null);
          setUser(profile);
          return;
        }
        setUser(null);
        setPendingTermsUser(profile);
      },
      acceptPendingTerms: async () => {
        if (!firebaseUser) return;
        const appSettings = currentAppSettings ?? await loadAppSettings();
        const updatedProfile = await acceptTermsOfUse(firebaseUser.uid, getCurrentTermsVersion(appSettings));
        setCurrentAppSettings(appSettings);
        setPendingTermsUser(null);
        setUser(assertActiveUserProfile({
          ...updatedProfile,
          createdAt: updatedProfile.createdAt ?? Timestamp.now(),
        }));
      },
      openTermsReview: async () => {
        if (!firebaseUser) return;
        setLoading(true);
        try {
          const [profile, appSettings] = await Promise.all([ensureUserProfile(firebaseUser), loadAppSettings()]);
          setCurrentAppSettings(appSettings);
          setUser(null);
          setPendingTermsUser(profile);
        } finally {
          setLoading(false);
        }
      },
    }),
    [currentAppSettings, firebaseUser, loading, pendingTermsUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
