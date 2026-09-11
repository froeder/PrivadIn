import { useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Mail, X } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { User } from "@firebase/auth";
import {
  changePasswordForCurrentUser,
  sendPasswordReset,
} from "../services/authService";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  firebaseUser: User;
}

export function ChangePasswordModal({
  isOpen,
  onClose,
  firebaseUser,
}: ChangePasswordModalProps) {
  const { t } = useTranslation("profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  if (!isOpen) return null;

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  }

  function handleClose() {
    if (isSubmitting || isSendingReset) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!currentPassword) {
      toast.error(t("passwordModal.currentRequired", { defaultValue: "Informe sua senha atual." }));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t("passwordModal.minLength", { defaultValue: "A nova senha deve ter no mínimo 6 caracteres." }));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("passwordModal.mismatch", { defaultValue: "A confirmação da nova senha não confere." }));
      return;
    }

    if (currentPassword === newPassword) {
      toast.error(t("passwordModal.samePassword", { defaultValue: "A nova senha não pode ser igual à senha atual." }));
      return;
    }

    setIsSubmitting(true);
    try {
      await changePasswordForCurrentUser(firebaseUser, currentPassword, newPassword);
      toast.success(t("passwordModal.successToast", { defaultValue: "Senha alterada com sucesso!" }));
      resetForm();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("passwordModal.genericError", { defaultValue: "Erro ao alterar a senha." }));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendResetEmail() {
    if (!firebaseUser.email) {
      toast.error(t("passwordModal.noEmail", { defaultValue: "Nenhum e-mail vinculado a esta conta." }));
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordReset(firebaseUser.email);
      toast.success(
        t("passwordModal.resetEmailSent", {
          defaultValue: "E-mail de redefinição enviado! Verifique sua caixa de entrada.",
        }),
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("passwordModal.resetEmailError", { defaultValue: "Erro ao enviar e-mail de redefinição." }));
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-3xl border border-line/10 bg-panel p-6 shadow-panel backdrop-blur-2xl">
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting || isSendingReset}
          className="absolute right-4 top-4 rounded-xl p-2 text-fg-muted transition hover:bg-panel-strong hover:text-fg disabled:opacity-50"
          aria-label={t("passwordModal.close", { defaultValue: "Fechar" })}
        >
          <X size={18} />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent-strong">
            <KeyRound size={22} />
          </div>
          <div>
            <h2 id="change-password-modal-title" className="text-xl font-black text-fg">
              {t("passwordModal.title", { defaultValue: "Alterar Senha" })}
            </h2>
            <p className="text-xs text-fg-muted">
              {t("passwordModal.subtitle", { defaultValue: "Atualize a senha de acesso da sua conta." })}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-fg-soft">
              {t("passwordModal.currentPasswordLabel", { defaultValue: "Senha atual" })}
            </span>
            <span className="flex items-center gap-2 rounded-2xl border border-line/10 bg-field px-4 py-3">
              <input
                className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("passwordModal.currentPlaceholder", { defaultValue: "Digite sua senha atual" })}
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
              {t("passwordModal.newPasswordLabel", { defaultValue: "Nova senha (mínimo 6 caracteres)" })}
            </span>
            <span className="flex items-center gap-2 rounded-2xl border border-line/10 bg-field px-4 py-3">
              <input
                className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("passwordModal.newPlaceholder", { defaultValue: "Digite a nova senha" })}
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
              {t("passwordModal.confirmPasswordLabel", { defaultValue: "Confirmar nova senha" })}
            </span>
            <span className="flex items-center gap-2 rounded-2xl border border-line/10 bg-field px-4 py-3">
              <input
                className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("passwordModal.confirmPlaceholder", { defaultValue: "Repita a nova senha" })}
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
              disabled={isSubmitting || isSendingReset}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-black text-accent-fg shadow-accent transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("passwordModal.saving", { defaultValue: "Atualizando senha..." })}
                </>
              ) : (
                t("passwordModal.submitButton", { defaultValue: "Salvar nova senha" })
              )}
            </button>
          </div>
        </form>

        <div className="mt-5 border-t border-line/10 pt-4 text-center">
          <p className="text-xs text-fg-muted">
            {t("passwordModal.forgotCurrentQuestion", { defaultValue: "Esqueceu sua senha atual?" })}
          </p>
          <button
            type="button"
            onClick={handleSendResetEmail}
            disabled={isSubmitting || isSendingReset}
            className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-accent-strong transition hover:underline disabled:opacity-50"
          >
            {isSendingReset ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                {t("passwordModal.sendingEmail", { defaultValue: "Enviando e-mail..." })}
              </>
            ) : (
              <>
                <Mail size={13} />
                {t("passwordModal.sendEmailLink", { defaultValue: "Enviar link de redefinição por e-mail" })}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
