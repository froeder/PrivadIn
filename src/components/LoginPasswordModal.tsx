import { useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, X } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  changePasswordWithCredentials,
  sendPasswordReset,
} from "../services/authService";

interface LoginPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onPasswordChanged?: (email: string) => void;
}

export function LoginPasswordModal({
  isOpen,
  onClose,
  initialEmail = "",
  onPasswordChanged,
}: LoginPasswordModalProps) {
  const { t } = useTranslation("login");
  const [tab, setTab] = useState<"email" | "direct">("email");
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetForm() {
    setEmail(initialEmail);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setEmailSentTo(null);
  }

  function handleClose() {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }

  async function handleSendResetEmail(event: FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error(t("passwordReset.emailRequired", { defaultValue: "Informe o seu e-mail." }));
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordReset(trimmedEmail);
      setEmailSentTo(trimmedEmail);
      toast.success(
        t("passwordReset.emailSentToast", {
          defaultValue: "Link de redefinição enviado! Verifique seu e-mail.",
        }),
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("passwordReset.genericError", { defaultValue: "Erro ao enviar e-mail de redefinição." }));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDirectChange(event: FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      toast.error(t("passwordReset.emailRequired", { defaultValue: "Informe o seu e-mail." }));
      return;
    }

    if (!currentPassword) {
      toast.error(t("passwordReset.currentRequired", { defaultValue: "Informe a senha atual." }));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t("passwordReset.minLength", { defaultValue: "A nova senha deve ter no mínimo 6 caracteres." }));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("passwordReset.mismatch", { defaultValue: "A confirmação da nova senha não confere." }));
      return;
    }

    if (currentPassword === newPassword) {
      toast.error(t("passwordReset.samePassword", { defaultValue: "A nova senha não pode ser igual à senha atual." }));
      return;
    }

    setIsSubmitting(true);
    try {
      await changePasswordWithCredentials(trimmedEmail, currentPassword, newPassword);
      toast.success(
        t("passwordReset.directSuccessToast", {
          defaultValue: "Senha alterada com sucesso! Entre com sua nova senha.",
        }),
      );
      onPasswordChanged?.(trimmedEmail);
      resetForm();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("passwordReset.genericError", { defaultValue: "Erro ao alterar a senha." }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-password-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-3xl border border-line/10 bg-panel p-6 shadow-panel backdrop-blur-2xl">
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 rounded-xl p-2 text-fg-muted transition hover:bg-panel-strong hover:text-fg disabled:opacity-50"
          aria-label={t("passwordReset.close", { defaultValue: "Fechar" })}
        >
          <X size={18} />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent-strong">
            <KeyRound size={22} />
          </div>
          <div>
            <h2 id="login-password-modal-title" className="text-xl font-black text-fg">
              {t("passwordReset.modalTitle", { defaultValue: "Alterar ou Redefinir Senha" })}
            </h2>
            <p className="text-xs text-fg-muted">
              {t("passwordReset.modalSubtitle", { defaultValue: "Recupere ou troque a senha da sua conta." })}
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="mb-5 grid grid-cols-2 rounded-2xl border border-line/10 bg-field p-1">
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-black transition ${
              tab === "email"
                ? "bg-accent text-accent-fg shadow-accent"
                : "text-fg-soft hover:bg-panel-strong hover:text-fg"
            }`}
          >
            <Mail size={14} />
            {t("passwordReset.tabEmail", { defaultValue: "Por E-mail" })}
          </button>
          <button
            type="button"
            onClick={() => setTab("direct")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-black transition ${
              tab === "direct"
                ? "bg-accent text-accent-fg shadow-accent"
                : "text-fg-soft hover:bg-panel-strong hover:text-fg"
            }`}
          >
            <KeyRound size={14} />
            {t("passwordReset.tabDirect", { defaultValue: "Trocar Agora" })}
          </button>
        </div>

        {tab === "email" ? (
          emailSentTo ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-success/20 text-success">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-base font-black text-fg">
                  {t("passwordReset.emailSuccessTitle", { defaultValue: "E-mail enviado!" })}
                </p>
                <p className="mt-1 text-xs text-fg-soft">
                  {t("passwordReset.emailSuccessDescription", {
                    defaultValue: `Enviamos as instruções para ${emailSentTo}. Abra o link recebido para criar sua nova senha.`,
                    email: emailSentTo,
                  })}
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-black text-accent-fg shadow-accent transition hover:bg-accent-strong"
                >
                  {t("passwordReset.backToLogin", { defaultValue: "Entendido, voltar para o login" })}
                </button>
                <button
                  type="button"
                  onClick={() => setEmailSentTo(null)}
                  className="text-xs text-fg-muted transition hover:underline"
                >
                  {t("passwordReset.resendEmail", { defaultValue: "Enviar para outro e-mail" })}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendResetEmail} className="space-y-4">
              <p className="text-xs text-fg-soft">
                {t("passwordReset.emailTabDescription", {
                  defaultValue: "Digite seu e-mail cadastrado. Você receberá um link seguro do Firebase para cadastrar uma nova senha.",
                })}
              </p>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-fg-soft">
                  {t("passwordReset.emailLabel", { defaultValue: "E-mail" })}
                </span>
                <span className="flex items-center gap-2 rounded-2xl border border-line/10 bg-field px-4 py-3">
                  <Mail className="text-accent-strong" size={16} />
                  <input
                    className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder", { defaultValue: "voce@empresa.com" })}
                    required
                    autoComplete="email"
                  />
                </span>
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-black text-accent-fg shadow-accent transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t("passwordReset.sendingEmail", { defaultValue: "Enviando e-mail..." })}
                    </>
                  ) : (
                    t("passwordReset.sendEmailButton", { defaultValue: "Enviar link de alteração de senha" })
                  )}
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleDirectChange} className="space-y-4">
            <p className="text-xs text-fg-soft">
              {t("passwordReset.directTabDescription", {
                defaultValue: "Se você lembra sua senha atual e quer trocá-la agora mesmo, preencha os dados abaixo.",
              })}
            </p>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-fg-soft">
                {t("passwordReset.emailLabel", { defaultValue: "E-mail" })}
              </span>
              <span className="flex items-center gap-2 rounded-2xl border border-line/10 bg-field px-4 py-3">
                <Mail className="text-accent-strong" size={16} />
                <input
                  className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder", { defaultValue: "voce@empresa.com" })}
                  required
                  autoComplete="email"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-fg-soft">
                {t("passwordReset.currentPasswordLabel", { defaultValue: "Senha atual" })}
              </span>
              <span className="flex items-center gap-2 rounded-2xl border border-line/10 bg-field px-4 py-3">
                <input
                  className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t("passwordReset.currentPlaceholder", { defaultValue: "Sua senha atual" })}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="text-fg-muted transition hover:text-fg"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-fg-soft">
                {t("passwordReset.newPasswordLabel", { defaultValue: "Nova senha (mínimo 6 caracteres)" })}
              </span>
              <span className="flex items-center gap-2 rounded-2xl border border-line/10 bg-field px-4 py-3">
                <input
                  className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("passwordReset.newPlaceholder", { defaultValue: "Nova senha" })}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="text-fg-muted transition hover:text-fg"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-fg-soft">
                {t("passwordReset.confirmPasswordLabel", { defaultValue: "Confirmar nova senha" })}
              </span>
              <span className="flex items-center gap-2 rounded-2xl border border-line/10 bg-field px-4 py-3">
                <input
                  className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("passwordReset.confirmPlaceholder", { defaultValue: "Repita a nova senha" })}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="text-fg-muted transition hover:text-fg"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-black text-accent-fg shadow-accent transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t("passwordReset.saving", { defaultValue: "Alterando senha..." })}
                  </>
                ) : (
                  t("passwordReset.directSubmitButton", { defaultValue: "Alterar senha agora" })
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
