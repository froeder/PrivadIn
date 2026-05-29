import i18n from "../i18n";

export type AuthLoginErrorCode =
  | "invalid_code"
  | "no_request"
  | "request_already_used"
  | "email_already_registered"
  | "weak_password"
  | "invalid_email"
  | "wrong_password"
  | "firebase_not_configured"
  | "unknown";

export class AuthLoginError extends Error {
  readonly code: AuthLoginErrorCode;

  constructor(message: string, code: AuthLoginErrorCode) {
    super(message);
    this.name = "AuthLoginError";
    this.code = code;
  }
}

export function loginErrorMessage(code: AuthLoginErrorCode, needsCode: boolean) {
  switch (code) {
    case "invalid_code":
      return i18n.t("auth:invalid_code");
    case "no_request":
      return i18n.t(needsCode ? "auth:no_request_with_code" : "auth:no_request_without_code");
    case "request_already_used":
      return i18n.t("auth:request_already_used");
    case "email_already_registered":
      return i18n.t("auth:email_already_registered");
    case "weak_password":
      return i18n.t("auth:weak_password");
    case "invalid_email":
      return i18n.t("auth:invalid_email");
    case "wrong_password":
      return i18n.t("auth:wrong_password");
    case "firebase_not_configured":
      return i18n.t("auth:firebase_not_configured");
    default:
      return i18n.t(needsCode ? "auth:unknown_with_code" : "auth:unknown_without_code");
  }
}

export function firebaseAuthErrorCode(error: unknown): AuthLoginErrorCode | null {
  if (!(error instanceof Error) || !("code" in error)) return null;
  const code = String((error as { code: string }).code);
  if (code === "auth/email-already-in-use") return "email_already_registered";
  if (code === "auth/weak-password") return "weak_password";
  if (code === "auth/invalid-email") return "invalid_email";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") return "wrong_password";
  return null;
}
