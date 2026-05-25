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
      return "Codigo incorreto. Confira com o admin e tente de novo.";
    case "no_request":
      return needsCode
        ? "Nao achei pedido para este email. Clique em ENTRAR primeiro para gerar a solicitacao."
        : "Nao achei acesso ativo. Vou preparar uma solicitacao de codigo.";
    case "request_already_used":
      return "Este email ja foi cadastrado. Entre com email e senha, sem codigo.";
    case "email_already_registered":
      return "Este email ja tem conta no Firebase. Entre com email e senha.";
    case "weak_password":
      return "Senha fraca demais. Use pelo menos 6 caracteres (nao use o codigo como senha).";
    case "invalid_email":
      return "Email invalido. Use o mesmo email que o admin vinculou ao codigo.";
    case "wrong_password":
      return "Senha incorreta para este email.";
    case "firebase_not_configured":
      return "Configure o .env com as credenciais Firebase antes de entrar.";
    default:
      return needsCode
        ? "Nao foi possivel validar o codigo. Confira email, senha e codigo com o admin."
        : "Nao achei acesso ativo. Vou preparar uma solicitacao de codigo.";
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
