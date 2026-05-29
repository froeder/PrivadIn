import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Card } from "../components/Card";
import { useAuth } from "../contexts/AuthContext";
import type { AppUser } from "../types";
import { avatarFor, canLoadDicebearUrl, isValidDicebearUrl } from "../utils/ranking";
import { NAME_MAX_LENGTH, NICKNAME_MAX_LENGTH, normalizeProfileIdentity, validateProfileIdentity } from "../utils/profileIdentity";
import { updateUserProfile } from "../services/userService";
import { checkForUpdates, getCurrentVersion, triggerPWAUpdate } from "../services/updateService";

type AvatarStatus = "idle" | "checking" | "valid" | "invalid";
type UpdateCheckStatus = "idle" | "checking" | "available" | "unavailable" | "error";

export function EditProfilePage({ user }: { user: AppUser }) {
  const { t } = useTranslation("profile");
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(user.name);
  const [nickname, setNickname] = useState(user.nickname ?? "");
  const [avatar, setAvatar] = useState(user.avatar ?? avatarFor(user.name, user.email));
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>(
    isValidDicebearUrl(user.avatar ?? "") ? "valid" : "idle",
  );
  const [busy, setBusy] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<UpdateCheckStatus>("idle");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  const hasValidAvatar = isValidDicebearUrl(avatar);
  const nameError = validateProfileIdentity(name, { required: true, maxLength: NAME_MAX_LENGTH });
  const nicknameError = validateProfileIdentity(nickname, { maxLength: NICKNAME_MAX_LENGTH });
  const previewAvatar = avatarStatus === "valid" && hasValidAvatar
    ? avatar.trim()
    : user.avatar || avatarFor(user.name, user.email);
  const currentVersion = getCurrentVersion();

  useEffect(() => {
    setName(user.name);
    setNickname(user.nickname ?? "");
    setAvatar(user.avatar ?? avatarFor(user.name, user.email));
    setAvatarStatus(isValidDicebearUrl(user.avatar ?? "") ? "valid" : "idle");
  }, [user.uid, user.name, user.nickname, user.avatar, user.email]);

  // Auto-trigger PWA update after a short delay when update is available
  // Cleanup timeout if component unmounts before it fires
  useEffect(() => {
    if (updateCheckStatus === "available") {
      const timeout = setTimeout(() => {
        triggerPWAUpdate();
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [updateCheckStatus]);

  async function validateAvatar(showToast = false) {
    const candidate = avatar.trim();

    if (!isValidDicebearUrl(candidate)) {
      setAvatarStatus("invalid");
      if (showToast) {
        toast.error(t("avatarToastInvalid"));
      }
      return false;
    }

    setAvatarStatus("checking");
    const canLoad = await canLoadDicebearUrl(candidate);

    if (avatar.trim() !== candidate) {
      return false;
    }

    setAvatarStatus(canLoad ? "valid" : "invalid");

    if (!canLoad && showToast) {
      toast.error(t("avatarToastLoadError"));
    }

    return canLoad;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (nameError) {
      toast.error(
        nameError === "required"
          ? t("nameRequired")
          : nameError === "too_long"
            ? t("nameTooLong", { count: NAME_MAX_LENGTH })
            : t("identityInvalid"),
      );
      return;
    }

    if (nicknameError) {
      toast.error(
        nicknameError === "too_long"
          ? t("nicknameTooLong", { count: NICKNAME_MAX_LENGTH })
          : t("identityInvalid"),
      );
      return;
    }

    if (!(await validateAvatar(true))) {
      return;
    }

    setBusy(true);
    try {
      await updateUserProfile(user.uid, {
        name: normalizeProfileIdentity(name),
        nickname: normalizeProfileIdentity(nickname),
        avatar: avatar.trim(),
      });
      await refreshProfile();
      toast.success(t("updateSuccess"));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t("updateError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckUpdates() {
    setUpdateCheckStatus("checking");
    setLatestVersion(null);

    try {
      const result = await checkForUpdates();

      if (result.error) {
        setUpdateCheckStatus("error");
        toast.error(t("updateCheckError"));
        return;
      }

      if (result.hasUpdate && result.latestVersion) {
        setLatestVersion(result.latestVersion);
        setUpdateCheckStatus("available");
        toast.success(t("updateAvailable", { newVersion: result.latestVersion }));
      } else {
        setUpdateCheckStatus("unavailable");
        toast.success(t("updateNotAvailable"));
      }
    } catch (e) {
      console.error(e);
      setUpdateCheckStatus("error");
      toast.error(t("updateCheckError"));
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">{t("eyebrow")}</p>
          <h2 className="text-2xl font-black text-white">{t("title")}</h2>
          <p className="mt-1 text-sm text-slate-400">{t("description")}</p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label>
            <span className="mb-2 block text-sm font-bold text-slate-300">{t("name")}</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX_LENGTH}
              required
            />
            {nameError ? (
              <p className="mt-2 text-xs font-semibold text-red-300">
                {nameError === "required"
                  ? t("nameRequired")
                  : nameError === "too_long"
                    ? t("nameTooLong", { count: NAME_MAX_LENGTH })
                    : t("identityInvalid")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">{t("charsCount", { count: name.length, max: NAME_MAX_LENGTH })}</p>
            )}
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold text-slate-300">{t("nickname")}</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("nicknamePlaceholder")}
              maxLength={NICKNAME_MAX_LENGTH}
            />
            <p className={nicknameError ? "mt-2 text-xs font-semibold text-red-300" : "mt-2 text-xs text-slate-500"}>
              {nicknameError === "too_long"
                ? t("nicknameTooLong", { count: NICKNAME_MAX_LENGTH })
                : nicknameError === "invalid_chars"
                  ? t("identityInvalid")
                  : t("charsCount", { count: nickname.length, max: NICKNAME_MAX_LENGTH })}
            </p>
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold text-slate-300">{t("avatarLabel")}</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              type="url"
              value={avatar}
              onChange={(e) => {
                const nextValue = e.target.value;
                setAvatar(nextValue);
                setAvatarStatus(
                  isValidDicebearUrl(nextValue)
                    ? nextValue.trim() === (user.avatar ?? "").trim()
                      ? "valid"
                      : "idle"
                    : "invalid",
                );
              }}
              onBlur={() => {
                if (isValidDicebearUrl(avatar)) {
                  void validateAvatar();
                }
              }}
              placeholder="https://api.dicebear.com/9.x/croodles/svg?seed=Liliana"
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              {t("avatarHint")}
              {" "}
              <a
                className="font-semibold text-yellow-100 underline underline-offset-2"
                href="https://www.dicebear.com/playground/"
                target="_blank"
                rel="noreferrer"
              >
                https://www.dicebear.com/playground/
              </a>
              .
            </p>
            {!hasValidAvatar ? (
              <p className="mt-1 text-xs font-semibold text-red-300">
                {t("avatarInvalid")}
              </p>
            ) : avatarStatus === "checking" ? (
              <p className="mt-1 text-xs font-semibold text-sky-200">
                {t("avatarChecking")}
              </p>
            ) : avatarStatus === "valid" ? (
              <p className="mt-1 text-xs font-semibold text-emerald-300">
                {t("avatarValid")}
              </p>
            ) : avatarStatus === "invalid" ? (
              <p className="mt-1 text-xs font-semibold text-red-300">
                {t("avatarLoadError")}
              </p>
            ) : null}
          </label>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <img src={previewAvatar} alt="avatar" className="h-16 w-16 rounded-full" />
            <div className="w-full flex-1">
              <p className="font-black text-white">{t("avatarCurrent")}</p>
              <p className="text-sm text-slate-400">{t("avatarCurrentHint")}</p>
            </div>
            <button
              disabled={busy || !hasValidAvatar || Boolean(nameError) || Boolean(nicknameError)}
              className="w-full rounded-2xl bg-yellow-300 px-5 py-3 font-black text-slate-950 hover:bg-yellow-200 disabled:opacity-60 sm:w-auto"
            >
              {t("save")}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-bold text-slate-400">{t("versionLabel")}</p>
            <p className="text-lg font-black text-white">
              {t("versionText", { version: currentVersion })}
            </p>
          </div>

          <button
            onClick={() => void handleCheckUpdates()}
            disabled={updateCheckStatus === "checking" || busy}
            className="w-full rounded-2xl bg-slate-700 px-5 py-3 font-black text-white hover:bg-slate-600 disabled:opacity-60 sm:w-auto"
          >
            {updateCheckStatus === "checking" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t("checkUpdatesLoading")}
              </span>
            ) : (
              t("checkUpdatesButton")
            )}
          </button>

          {updateCheckStatus === "available" && latestVersion && (
            <div className="rounded-lg bg-emerald-900/30 border border-emerald-600/50 p-3">
              <p className="text-sm font-semibold text-emerald-300">
                {t("updateAvailable", { newVersion: latestVersion })}
              </p>
            </div>
          )}

          {updateCheckStatus === "unavailable" && (
            <div className="rounded-lg bg-blue-900/30 border border-blue-600/50 p-3">
              <p className="text-sm font-semibold text-blue-300">
                {t("updateNotAvailable")}
              </p>
            </div>
          )}

          {updateCheckStatus === "error" && (
            <div className="rounded-lg bg-red-900/30 border border-red-600/50 p-3">
              <p className="text-sm font-semibold text-red-300">
                {t("updateCheckError")}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
