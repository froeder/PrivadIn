import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { AppSettings, AppUser } from "../types";

export function listenAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data() as any;
      return { uid, ...data };
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function createRegistrationAttempt({
  email,
  status,
  groupCodeProvided,
  message,
}: {
  email: string;
  status: "account_created" | "failed" | "invalid_code" | "terms_declined";
  groupCodeProvided?: string;
  message?: string;
}) {
  try {
    await addDoc(collection(db, "registration_attempts"), {
      email: email.trim().toLowerCase(),
      status,
      groupCodeProvided: groupCodeProvided?.trim().toUpperCase() || null,
      message: message || null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Could not log registration attempt:", err);
  }
}

export async function ensureUserProfile(
  firebaseUser: User,
  nameHint?: string,
  termsAccepted = true,
  acceptedTermsVersion = 1
): Promise<AppUser> {
  const userRef = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const data = snap.data() as any;
    if (data.isActive === false) {
      await fbSignOut(auth);
      throw new Error("Este usuário foi desativado por um administrador.");
    }
    return { uid: firebaseUser.uid, ...data };
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
    termsAccepted,
    acceptedTermsVersion,
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

export async function joinGroup(user: { uid: string }, groupCode: string): Promise<string | null> {
  const code = groupCode.trim().toUpperCase();
  if (!code) return null;

  const groupRef = doc(db, "groups", code);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(groupRef);
    if (!snap.exists()) {
      throw new Error(`Grupo com código "${code}" não encontrado.`);
    }

    const groupData = snap.data() as any;
    if (groupData.deletedAt) {
      throw new Error("Este grupo foi desativado.");
    }

    const memberIds = Array.isArray(groupData.memberIds) ? groupData.memberIds : [];
    if (!memberIds.includes(user.uid)) {
      const nextMemberIds = [...memberIds, user.uid];
      transaction.update(groupRef, {
        memberIds: nextMemberIds,
        memberCount: nextMemberIds.length,
        updatedAt: serverTimestamp(),
      });
    }
  });

  return code;
}

export async function loginWithEmail(
  email: string,
  pass: string,
  groupCode?: string
): Promise<{ user: User; profile: AppUser }> {
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
  const profile = await ensureUserProfile(cred.user);

  if (groupCode?.trim()) {
    try {
      await joinGroup(profile, groupCode.trim());
    } catch (err: any) {
      console.warn("Aviso ao vincular grupo:", err.message);
    }
  }

  return { user: cred.user, profile };
}

export async function registerWithEmail(
  email: string,
  pass: string,
  name: string,
  groupCode?: string,
  termsVersion = 1
): Promise<{ user: User; profile: AppUser }> {
  const cleanEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  if (trimmedName.length < 3 || trimmedName.length > 30) {
    throw new Error("O apelido deve conter entre 3 e 30 caracteres.");
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);

    // Validação de apelido/username único no Firestore
    const existingUsersSnap = await getDocs(
      query(collection(db, "users"), where("name", "==", trimmedName))
    );
    const isDuplicate = existingUsersSnap.docs.some((d) => d.id !== cred.user.uid);
    if (isDuplicate) {
      await cred.user.delete().catch(() => undefined);
      await createRegistrationAttempt({
        email: cleanEmail,
        status: "failed",
        groupCodeProvided: groupCode,
        message: `Apelido "${trimmedName}" já está em uso por outro competidor.`,
      });
      throw new Error(
        `O apelido "${trimmedName}" já está em uso por outro competidor. Escolha outro apelido.`
      );
    }

    const profile = await ensureUserProfile(cred.user, trimmedName, true, termsVersion);

    if (groupCode?.trim()) {
      try {
        await joinGroup(profile, groupCode.trim());
      } catch (err: any) {
        console.warn("Aviso ao vincular grupo:", err.message);
      }
    }

    await createRegistrationAttempt({
      email: cleanEmail,
      status: "account_created",
      groupCodeProvided: groupCode,
      message: groupCode
        ? "Conta criada com aceite dos termos e vinculada à liga."
        : "Conta criada com aceite dos termos.",
    });

    return { user: cred.user, profile };
  } catch (err: any) {
    if (err.message && !err.message.includes("já está em uso")) {
      await createRegistrationAttempt({
        email: cleanEmail,
        status: "failed",
        groupCodeProvided: groupCode,
        message: err.message || "Falha ao criar conta.",
      });
    }
    throw err;
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Informe o seu e-mail.");
  }
  await sendPasswordResetEmail(auth, normalized);
}

export async function changePasswordWithCredentials(
  email: string,
  currentPass: string,
  newPass: string
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Informe o seu e-mail.");
  }
  if (!newPass || newPass.length < 6) {
    throw new Error("A nova senha deve ter no mínimo 6 caracteres.");
  }
  if (currentPass === newPass) {
    throw new Error("A nova senha não pode ser igual à senha atual.");
  }

  const credential = await signInWithEmailAndPassword(auth, normalized, currentPass);
  try {
    await updatePassword(credential.user, newPass);
  } finally {
    await fbSignOut(auth).catch(() => undefined);
  }
}

export async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const snap = await getDoc(doc(db, "app_settings", "global"));
    if (snap.exists()) {
      const data = snap.data();
      return {
        cooldownMinutes: Number(data.cooldownMinutes ?? 15),
        pointsPerLog: Number(data.pointsPerLog ?? 2000),
        poopcoinsPerLog: Number(data.poopcoinsPerLog ?? 1),
        cuiterPostCost: Number(data.cuiterPostCost ?? 5),
        edition: Number(data.edition ?? 1),
        overallRankingVisible: Boolean(data.overallRankingVisible),
        termsOfUseText: data.termsOfUseText,
        termsOfUseVersion: Number(data.termsOfUseVersion ?? 1),
        competitionAnnouncement: data.competitionAnnouncement,
      };
    }
  } catch (err) {
    console.warn("Error loading app settings:", err);
  }

  return {
    cooldownMinutes: 15,
    pointsPerLog: 2000,
    poopcoinsPerLog: 1,
    cuiterPostCost: 5,
    edition: 1,
    termsOfUseVersion: 1,
  };
}

export async function acceptTerms(uid: string, version: number): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    termsAccepted: true,
    acceptedTermsVersion: version,
    termsAcceptedAt: serverTimestamp(),
  });
}

export async function signOutUser() {
  await fbSignOut(auth);
}

/**
 * Exclui definitivamente a conta e todos os dados associados do usuário no PrivadIn,
 * em estrita conformidade com as diretrizes do Google Play e LGPD (Lei nº 13.709/2018):
 * - Registros e histórico de cagadas (poop_logs)
 * - Postagens no Cuiter (cuiter_posts)
 * - Vínculos em grupos/ligas (remove de memberIds ou exclui se for dono único)
 * - Dados privados (user_private)
 * - Perfil do usuário (users/{uid})
 * - Conta no Firebase Authentication (deleteUser)
 *
 * Link da política: https://froeder.github.io/privadin-exclusao.html
 */
export async function deleteCurrentUserAccount(password?: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Nenhum usuário autenticado encontrado para exclusão.");
  }

  const uid = currentUser.uid;
  const email = currentUser.email;

  // 1. Reautenticação se a senha foi informada (necessária caso o login não seja recente)
  if (password && email) {
    const credential = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(currentUser, credential);
  }

  // 2. Limpeza de todos os dados do usuário no Firestore
  // a) Exclui todos os logs de cagada (poop_logs)
  try {
    const logsSnap = await getDocs(
      query(collection(db, "poop_logs"), where("userId", "==", uid))
    );
    if (!logsSnap.empty) {
      const batch = writeBatch(db);
      logsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn("Aviso ao limpar poop_logs na exclusão:", err);
  }

  // b) Exclui todas as postagens no Cuiter (cuiter_posts)
  try {
    const postsSnap = await getDocs(
      query(collection(db, "cuiter_posts"), where("userId", "==", uid))
    );
    if (!postsSnap.empty) {
      const batch = writeBatch(db);
      postsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn("Aviso ao limpar cuiter_posts na exclusão:", err);
  }

  // c) Atualiza/desvincula grupos onde o usuário participa
  try {
    const groupsSnap = await getDocs(
      query(collection(db, "groups"), where("memberIds", "array-contains", uid))
    );
    for (const groupDoc of groupsSnap.docs) {
      const groupData = groupDoc.data() as any;
      if (groupData.ownerId === uid) {
        if (!groupData.memberIds || groupData.memberIds.length <= 1) {
          // Dono único: exclui o grupo
          await deleteDoc(groupDoc.ref).catch(() => undefined);
        } else {
          // Passa a liderança para o próximo membro
          const nextMembers = groupData.memberIds.filter((id: string) => id !== uid);
          await updateDoc(groupDoc.ref, {
            ownerId: nextMembers[0],
            memberIds: nextMembers,
            memberCount: nextMembers.length,
            updatedAt: serverTimestamp(),
          }).catch(() => undefined);
        }
      } else {
        // Apenas membro: remove da lista
        const nextMembers = (groupData.memberIds || []).filter((id: string) => id !== uid);
        await updateDoc(groupDoc.ref, {
          memberIds: nextMembers,
          memberCount: nextMembers.length,
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }
    }
  } catch (err) {
    console.warn("Aviso ao desvincular grupos na exclusão:", err);
  }

  // d) Exclui dados privados (user_private) se houver
  try {
    await deleteDoc(doc(db, "user_private", uid)).catch(() => undefined);
  } catch (err) {
    console.warn("Aviso ao excluir user_private:", err);
  }

  // e) Exclui o documento principal do perfil (users/{uid})
  try {
    await deleteDoc(doc(db, "users", uid));
  } catch (err) {
    console.warn("Aviso ao excluir users doc:", err);
  }

  // 3. Exclui o usuário no Firebase Auth
  try {
    await deleteUser(currentUser);
  } catch (authErr: any) {
    // Se exigir login recente e a senha não tiver sido fornecida antes
    if (authErr.code === "auth/requires-recent-login") {
      throw new Error(
        "Por motivos de segurança, confirme sua senha atual para excluir a conta definitivamente."
      );
    }
    throw authErr;
  }

  // 4. Garante logout final
  await fbSignOut(auth).catch(() => undefined);
}

