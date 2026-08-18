import { useState, type FormEvent } from "react";
import { Lock, Mail, Sparkles, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../constants/app";
import { useAuth } from "../contexts/AuthContext";
import { isFirebaseConfigured } from "../services/firebase";
import { AuthLoginError, loginErrorMessage } from "../utils/authErrors";
import type { AppSettings } from "../types";
import { getCurrentTermsText, getCurrentTermsVersion } from "../utils/terms";

export function LoginPage({
  cooldownMinutes,
  appSettings,
}: {
  cooldownMinutes: number;
  appSettings: AppSettings;
}) {
  const { t } = useTranslation("login");
  const { login, loading, pendingTermsUser, acceptPendingTerms, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [termsChecked, setTermsChecked] = useState(false);
  const termsText = getCurrentTermsText(appSettings);
  const termsVersion = getCurrentTermsVersion(appSettings);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      const result = await login(email, password, groupCode);

      toast.success(
        result.status === "terms_required"
          ? t("termsRequiredToast", { version: termsVersion })
          : t("toastAuthorized"),
      );
    } catch (error) {
      console.error(error);
      if (error instanceof AuthLoginError) {
        toast.error(loginErrorMessage(error.code, false));
        return;
      }
      toast.error(
        isFirebaseConfigured
          ? t("fallbackAccessRequest")
          : t("firebaseConfigMissing"),
      );
    }
  }

  async function handleTermsAccept(event: FormEvent) {
    event.preventDefault();
    if (!termsChecked) {
      toast.error(t("termsCheckboxRequired"));
      return;
    }

    try {
      await acceptPendingTerms();
      toast.success(t("termsAcceptedToast"));
      setTermsChecked(false);
    } catch (error) {
      console.error(error);
      toast.error(t("termsAcceptError"));
    }
  }

  if (pendingTermsUser) {
    return (
      <div className="min-h-screen bg-canvas text-fg">
      <div className="app-login-gradient fixed inset-0" />
        <main className="relative mx-auto min-h-screen max-w-4xl px-4 py-4 sm:px-6 sm:py-6 lg:grid lg:place-items-center lg:px-4 lg:py-10">
          <form onSubmit={handleTermsAccept} className="w-full rounded-3xl border border-line/10 bg-panel/90 p-5 shadow-panel backdrop-blur-2xl sm:p-6">
            <div className="mb-6 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-accent text-5xl text-accent-fg shadow-accent">
                🚽
              </div>
              <h2 className="mt-4 text-2xl font-black text-fg">{t("termsTitle")}</h2>
              <p className="mt-1 text-sm text-fg-muted">
                {t("termsDescription", { email: pendingTermsUser.email, version: termsVersion })}
              </p>
            </div>

            <div className="rounded-2xl border border-line/10 bg-field p-4">
              <p className="mb-3 text-sm font-bold text-fg-soft">{t("termsVersionLabel", { version: termsVersion })}</p>
              <div className="max-h-80 overflow-auto whitespace-pre-wrap text-sm text-fg-soft">
                {termsText}
              </div>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-line/10 bg-field p-4">
              <input
                className="mt-1 h-5 w-5"
                type="checkbox"
                checked={termsChecked}
                onChange={(event) => setTermsChecked(event.target.checked)}
              />
              <span className="text-sm text-fg-soft">{t("termsCheckboxLabel")}</span>
            </label>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                disabled={loading}
                className="w-full rounded-2xl bg-accent px-5 py-4 text-base font-black text-accent-fg shadow-accent transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t("submitLoading") : t("termsAcceptAction")}
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full rounded-2xl border border-line/10 px-5 py-4 text-base font-black text-fg-soft transition hover:bg-panel-strong hover:text-fg"
              >
                {t("termsDeclineAction")}
              </button>
            </div>
          </form>

          <footer className="pb-4 pt-4 text-center text-xs text-fg-muted lg:pb-0">
            v{APP_VERSION}
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-fg">
      <div className="app-login-gradient fixed inset-0" />
      <main className="relative mx-auto min-h-screen max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:grid lg:place-items-center lg:px-4 lg:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_440px] lg:items-center lg:gap-8">
          <section className="order-2 space-y-5 pt-2 lg:order-1 lg:space-y-6 lg:pt-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft/40 px-4 py-2 text-sm font-bold text-accent-strong">
              <Sparkles size={16} />
              {t("badge")}
            </div>
            <div>
              <h1 className="max-w-3xl text-4xl font-black leading-none text-fg sm:text-5xl lg:text-7xl">
                {t("heroTitle")}
              </h1>
              <p className="mt-4 max-w-2xl text-base text-fg-soft sm:text-lg lg:mt-5 lg:text-xl">
                {t("heroDescription")}
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                t("featureRealtime"),
                t("featureAchievements"),
                t("featureAntiFraud", { count: cooldownMinutes }),
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-line/10 bg-panel/90 p-4 text-sm font-bold text-fg-soft backdrop-blur-xl">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={handleSubmit} className="order-1 rounded-3xl border border-line/10 bg-panel/90 p-5 shadow-panel backdrop-blur-2xl sm:p-6 lg:order-2">
            <div className="mb-6 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-accent text-5xl text-accent-fg shadow-accent">
                🚽
              </div>
              <h2 className="mt-4 text-2xl font-black text-fg">{t("cardTitle")}</h2>
              <p className="mt-1 text-sm text-fg-muted">{t("cardDescription")}</p>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-bold text-fg-soft">{t("emailLabel")}</span>
              <span className="flex items-center gap-3 rounded-2xl border border-line/10 bg-field px-4 py-3">
                <Mail className="text-accent-strong" size={18} />
                <input
                  className="w-full bg-transparent text-fg outline-none placeholder:text-fg-muted disabled:cursor-not-allowed disabled:text-fg-muted"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("emailPlaceholder")}
                  required
                />
              </span>
            </label>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-bold text-fg-soft">{t("passwordLabel")}</span>
              <span className="flex items-center gap-3 rounded-2xl border border-line/10 bg-field px-4 py-3">
                <Lock className="text-accent-strong" size={18} />
                <input
                  className="w-full bg-transparent text-fg outline-none placeholder:text-fg-muted"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  required
                />
              </span>
            </label>

            <label className="mb-6 block">
              <span className="mb-2 block text-sm font-bold text-fg-soft">
                {t("groupCodeLabel", { defaultValue: "Código do grupo (opcional)" })}
              </span>
              <span className="flex items-center gap-3 rounded-2xl border border-line/10 bg-field px-4 py-3">
                <Users className="text-accent-strong" size={18} />
                <input
                  className="w-full bg-transparent font-mono tracking-[0.12em] text-fg outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-fg-muted"
                  type="text"
                  value={groupCode}
                  onChange={(event) => setGroupCode(event.target.value.trim().toUpperCase())}
                  placeholder={t("groupCodePlaceholder", { defaultValue: "Ex: ABCD1234" })}
                  maxLength={32}
                />
              </span>
              <p className="mt-2 text-xs text-fg-muted">
                {t("groupCodeHint", { defaultValue: "Se você recebeu um ID de grupo, sua conta já entra nele ao ser criada." })}
              </p>
            </label>

            <button
              disabled={loading}
              className="w-full rounded-2xl bg-accent px-5 py-4 text-base font-black text-accent-fg shadow-accent transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("submitLoading") : t("submitDefault")}
            </button>
            <p className="mt-4 text-center text-xs text-fg-muted">
              {isFirebaseConfigured
                ? t("footerConfigured")
                : t("footerNotConfigured")}
            </p>
          </form>
        </div>
        <footer className="order-3 pb-4 text-center text-xs text-fg-muted lg:col-span-2 lg:pb-0">
          v{APP_VERSION}
        </footer>
      </main>
    </div>
  );
}
