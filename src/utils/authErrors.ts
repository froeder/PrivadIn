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
      return "Código incorreto. Confira com o admin e tente de novo.";
    case "no_request":
      return needsCode
        ? "Não achei pedido para este email. Clique em ENTRAR primeiro para gerar a solicitação."
        : "Não achei acesso ativo. Vou preparar uma solicitação de código.";
    case "request_already_used":
      return "Este email já foi cadastrado. Entre com email e senha, sem código.";
    case "email_already_registered":
      return "Este email já tem conta no Firebase. Entre com email e senha.";
    case "weak_password":
      return "Senha fraca demais. Use pelo menos 6 caracteres (não use o código como senha).";
    case "invalid_email":
      return "Email inválido. Use o mesmo email que o admin vinculou ao código.";
    case "wrong_password":
      return "Senha incorreta para este email.";
    case "firebase_not_configured":
      return "Configure o .env com as credenciais Firebase antes de entrar.";
    default:
      return needsCode
        ? "Não foi possível validar o código. Confira email, senha e código com o admin."
        : "Não achei acesso ativo. Vou preparar uma solicitação de código.";
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
