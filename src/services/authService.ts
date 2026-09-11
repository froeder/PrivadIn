import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from "@firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";
import { normalizeEmail } from "./registrationService";
import i18n from "../i18n";

export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || !("code" in error)) {
    return error instanceof Error ? error.message : i18n.t("common:feedback.genericError");
  }

  const code = String((error as { code: string }).code);

  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return i18n.t("auth:wrong_password", { defaultValue: "Senha incorreta." });
    case "auth/user-not-found":
      return i18n.t("auth:user_not_found", { defaultValue: "Usuário não encontrado com este e-mail." });
    case "auth/weak-password":
      return i18n.t("auth:weak_password", { defaultValue: "A nova senha deve ter no mínimo 6 caracteres." });
    case "auth/invalid-email":
      return i18n.t("auth:invalid_email", { defaultValue: "Formato de e-mail inválido." });
    case "auth/too-many-requests":
      return i18n.t("auth:too_many_requests", { defaultValue: "Muitas tentativas sem sucesso. Aguarde um momento e tente novamente." });
    case "auth/requires-recent-login":
      return i18n.t("auth:requires_recent_login", { defaultValue: "Por segurança, confirme sua senha atual novamente." });
    default:
      return error.message || i18n.t("common:feedback.genericError");
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error(i18n.t("login:firebaseConfigMissing"));
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error(i18n.t("auth:invalid_email", { defaultValue: "Informe um e-mail válido." }));
  }

  try {
    await sendPasswordResetEmail(auth, normalized);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export async function changePasswordForCurrentUser(
  user: User,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error(i18n.t("login:firebaseConfigMissing"));
  }

  if (!user.email) {
    throw new Error(i18n.t("common:feedback.genericError"));
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error(i18n.t("auth:weak_password", { defaultValue: "A nova senha deve ter no mínimo 6 caracteres." }));
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export async function changePasswordWithCredentials(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error(i18n.t("login:firebaseConfigMissing"));
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error(i18n.t("auth:invalid_email", { defaultValue: "Informe um e-mail válido." }));
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error(i18n.t("auth:weak_password", { defaultValue: "A nova senha deve ter no mínimo 6 caracteres." }));
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, normalized, currentPassword);
    await updatePassword(credential.user, newPassword);
    await signOut(auth);
  } catch (error) {
    await signOut(auth).catch(() => undefined);
    throw new Error(getAuthErrorMessage(error));
  }
}
