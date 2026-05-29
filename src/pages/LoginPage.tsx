import { useState, type FormEvent } from "react";
import { KeyRound, Lock, Mail, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { Trans, useTranslation } from "react-i18next";
import { APP_VERSION } from "../constants/app";
import { useAuth } from "../contexts/AuthContext";
import { isFirebaseConfigured } from "../services/firebase";
import { AuthLoginError, loginErrorMessage } from "../utils/authErrors";

export function LoginPage({ cooldownMinutes }: { cooldownMinutes: number }) {
  const { t } = useTranslation("login");
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [requestedEmail, setRequestedEmail] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const emailForLogin = needsCode ? requestedEmail || email : email;

    try {
      const result = await login(
        emailForLogin,
        password,
        needsCode ? approvalCode : undefined,
      );
      if (result.status === "access_code_required") {
        setNeedsCode(true);
        setRequestedEmail(result.request.email);
        setEmail(result.request.email);
        toast.success(t("toastRequestCreated"));
        return;
      }

      toast.success(
        needsCode
          ? t("toastWelcome")
          : t("toastAuthorized"),
      );
    } catch (error) {
      console.error(error);
      if (error instanceof AuthLoginError) {
        toast.error(loginErrorMessage(error.code, needsCode));
        return;
      }
      toast.error(
        isFirebaseConfigured
          ? needsCode
            ? t("fallbackCodeValidation")
            : t("fallbackAccessRequest")
          : t("firebaseConfigMissing"),
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.18),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(45,212,191,0.14),transparent_26%),linear-gradient(135deg,#020617,#111827_55%,#1f2937)]" />
      <main className="relative mx-auto min-h-screen max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:grid lg:place-items-center lg:px-4 lg:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_440px] lg:items-center lg:gap-8">
          <section className="order-2 space-y-5 pt-2 lg:order-1 lg:space-y-6 lg:pt-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-200/20 bg-yellow-300/10 px-4 py-2 text-sm font-bold text-yellow-100">
              <Sparkles size={16} />
              {t("badge")}
            </div>
            <div>
              <h1 className="max-w-3xl text-4xl font-black leading-none text-white sm:text-5xl lg:text-7xl">
                {t("heroTitle")}
              </h1>
              <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg lg:mt-5 lg:text-xl">
                {t("heroDescription")}
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                t("featureRealtime"),
                t("featureAchievements"),
                t("featureAntiFraud", { count: cooldownMinutes }),
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/8 p-4 text-sm font-bold text-slate-200 backdrop-blur-xl">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={handleSubmit} className="order-1 rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-6 lg:order-2">
            <div className="mb-6 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-yellow-300 text-5xl shadow-xl shadow-yellow-400/20">
                🚽
              </div>
              <h2 className="mt-4 text-2xl font-black text-white">{t("cardTitle")}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {t("cardDescription")}
              </p>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-bold text-slate-300">{t("emailLabel")}</span>
              <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <Mail className="text-yellow-200" size={18} />
                <input
                  className="w-full bg-transparent text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-400"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("emailPlaceholder")}
                  readOnly={needsCode && Boolean(requestedEmail)}
                  required
                />
              </span>
            </label>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-bold text-slate-300">{t("passwordLabel")}</span>
              <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <Lock className="text-yellow-200" size={18} />
                <input
                  className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={needsCode ? t("passwordPlaceholderWithCode") : t("passwordPlaceholder")}
                  required
                />
              </span>
            </label>

            {needsCode ? (
              <div className="mb-6 rounded-2xl border border-yellow-200/30 bg-yellow-300/10 p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-yellow-300 text-slate-950">
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <p className="font-black text-yellow-100">{t("approvalTitle")}</p>
                    <p className="mt-1 text-sm text-slate-300">
                      <Trans
                        i18nKey="login:approvalDescription"
                        values={{ email: requestedEmail || email }}
                        components={{ strong: <span className="font-bold text-white" /> }}
                      />
                    </p>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-300">{t("approvalCodeLabel")}</span>
                  <span className="flex items-center gap-3 rounded-2xl border border-yellow-200/20 bg-slate-950/70 px-4 py-3">
                    <KeyRound className="text-yellow-200" size={18} />
                    <input
                      className="w-full bg-transparent font-mono tracking-[0.18em] text-white outline-none placeholder:tracking-normal placeholder:text-slate-500"
                      type="text"
                      value={approvalCode}
                      onChange={(event) => setApprovalCode(event.target.value.toUpperCase())}
                      placeholder="ABC123"
                      required={needsCode}
                      maxLength={6}
                      autoFocus
                    />
                  </span>
                </label>
              </div>
            ) : null}

            <button
              disabled={loading}
              className="w-full rounded-2xl bg-yellow-300 px-5 py-4 text-base font-black text-slate-950 shadow-lg shadow-yellow-300/20 transition hover:-translate-y-0.5 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? t("submitLoading")
                : needsCode
                  ? t("submitWithCode")
                  : t("submitDefault")}
            </button>
            {needsCode ? (
              <button
                type="button"
                className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setNeedsCode(false);
                  setApprovalCode("");
                  setRequestedEmail("");
                }}
              >
                {t("backToNormal")}
              </button>
            ) : (
              <button
                type="button"
                className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setNeedsCode(true);
                  setRequestedEmail(email.trim());
                  setApprovalCode("");
                  toast(t("toastCodeHint"), { icon: "🔑" });
                }}
              >
                {t("alreadyHaveCode")}
              </button>
            )}
            <p className="mt-4 text-center text-xs text-slate-500">
              {isFirebaseConfigured
                ? t("footerConfigured")
                : t("footerNotConfigured")}
            </p>
          </form>
        </div>
        <footer className="order-3 pb-4 text-center text-xs text-slate-500 lg:col-span-2 lg:pb-0">
          v{APP_VERSION}
        </footer>
      </main>
    </div>
  );
}
