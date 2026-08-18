import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ArrowLeft, Copy, Edit3, LogOut, MessageCircle, Moon, Sun } from "lucide-react";
import { clsx } from "clsx";
import { AvatarImage } from "../components/AvatarImage";
import { Card } from "../components/Card";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../contexts/AuthContext";
import { fetchUserCuiterPosts } from "../services/cuiterService";
import { formatTimeAgo } from "../utils/date";
import type { AppTheme, AppUser, AppView, CuiterPost } from "../types";
import { useTheme } from "../hooks/useTheme";

interface UserProfilePageProps {
  currentUser: AppUser;
  profileUser: AppUser;
  setView: (view: AppView) => void;
  onBack: () => void;
}

export function UserProfilePage({
  currentUser,
  profileUser,
  setView,
  onBack,
}: UserProfilePageProps) {
  const { t } = useTranslation(["profile", "common"]);
  const { logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [posts, setPosts] = useState<CuiterPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const isOwnProfile = currentUser.uid === profileUser.uid;
  const themeOptions: Array<{ value: AppTheme; label: string; icon: React.ElementType }> = [
    { value: "light", label: t("common:theme.light"), icon: Sun },
    { value: "dark", label: t("common:theme.dark"), icon: Moon },
  ];

  useEffect(() => {
    async function loadUserPosts() {
      setLoadingPosts(true);
      try {
        const userPosts = await fetchUserCuiterPosts(profileUser.uid, 5);
        setPosts(userPosts);
      } catch (error) {
        console.error("Erro ao carregar posts do usuario:", error);
      } finally {
        setLoadingPosts(false);
      }
    }
    void loadUserPosts();
  }, [profileUser.uid]);

  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(profileUser.uid);
      toast.success(t("profile:updateSuccess") ? "ID copiado." : "ID copied.");
    } catch {
      toast.error("Erro ao copiar ID.");
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Barra de Navegação Superior / Ações */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-line/10 bg-panel px-4 py-2.5 text-sm font-black text-fg transition hover:bg-panel-strong"
        >
          <ArrowLeft size={16} />
          {t("profile:backButton")}
        </button>

        {isOwnProfile ? (
          <button
            onClick={() => setView("edit-profile")}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-black text-accent-fg transition hover:bg-accent-strong shadow-accent"
          >
            <Edit3 size={16} />
            {t("profile:editProfileButton")}
          </button>
        ) : null}
      </div>

      {isOwnProfile ? (
        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-accent-strong">
              {t("profile:preferencesEyebrow", { defaultValue: "Preferencias" })}
            </p>
            <h2 className="text-2xl font-black text-fg">
              {t("profile:preferencesTitle", { defaultValue: "Idioma e tema" })}
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <LanguageSwitcher className="min-w-0 bg-field" />
            <div
              role="group"
              className="flex items-center rounded-xl border border-line/10 bg-field p-1"
              title={t("common:theme.switcherLabel")}
              aria-label={t("common:theme.switcherLabel")}
            >
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const active = resolvedTheme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    aria-pressed={active}
                    aria-label={option.label}
                    className={clsx(
                      "inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition sm:flex-none",
                      active
                        ? "bg-accent text-accent-fg shadow-accent"
                        : "text-fg-soft hover:bg-panel-strong hover:text-fg",
                    )}
                  >
                    <Icon size={16} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 border-t border-line/10 pt-4">
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/20 bg-danger-soft/45 px-4 py-3 text-sm font-black text-danger transition hover:bg-danger-soft/65 sm:w-auto"
              title={t("shell:logout", { defaultValue: "Sair" })}
            >
              <LogOut size={18} />
              {t("shell:logout", { defaultValue: "Sair" })}
            </button>
          </div>
        </Card>
      ) : null}

      {/* Cartão Principal de Perfil */}
      <Card>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          {/* Avatar com efeito de destaque */}
          <div className="relative group shrink-0">
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-accent to-accent-strong opacity-30 blur group-hover:opacity-60 transition duration-300" />
            <div className="relative">
              <AvatarImage
                avatar={profileUser.avatar}
                email={profileUser.email}
                name={profileUser.name}
                className="h-24 w-24 rounded-full border-2 border-line/10 bg-panel"
              />
            </div>
          </div>

          {/* Nome, Apelido e Status */}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent-strong">
              {t("profile:publicEyebrow")}
            </p>
            <h2 className="truncate text-3xl font-black text-fg">
              {profileUser.name}
            </h2>
            {profileUser.nickname ? (
              <p className="text-lg font-bold text-fg-soft">
                @{profileUser.nickname}
              </p>
            ) : null}

            {/* Crachá de Cargo */}
            <div className="pt-1">
              <span className="inline-flex items-center rounded-full bg-panel-strong px-2.5 py-0.5 text-xs font-bold text-fg-muted">
                {profileUser.role === "admin"
                  ? t("common:roles.admin")
                  : t("common:roles.player")}
              </span>
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="my-5 border-t border-line/10" />

        <div className="grid gap-5 md:grid-cols-2">
          {/* Chave de Moedas (ID) */}
          <div className="min-w-0 rounded-2xl border border-line/10 bg-panel-strong/40 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg-muted">
              {t("profile:coinKey")}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="block min-w-0 flex-1 truncate rounded-xl bg-field px-3 py-2 text-sm text-fg-soft font-mono">
                {profileUser.uid}
              </code>
              <button
                type="button"
                onClick={() => void copyUserId()}
                className="rounded-xl bg-accent p-2.5 text-accent-fg transition hover:bg-accent-strong shadow-accent"
                title="Copiar ID"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>

          {/* Biografia (Bio) */}
          <div className="rounded-2xl border border-line/10 bg-panel-strong/40 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg-muted">
              {t("profile:bio")}
            </p>
            <div className="mt-2 text-sm text-fg-soft">
              {profileUser.bio ? (
                <p className="whitespace-pre-wrap leading-relaxed italic">
                  "{profileUser.bio}"
                </p>
              ) : (
                <p className="text-fg-muted italic">
                  {t("profile:noBio")}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Cartão de Posts Recentes */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle size={20} className="text-accent-strong" />
          <h3 className="text-xl font-black text-fg">
            {t("profile:recentPosts")}
          </h3>
        </div>

        <div className="space-y-3">
          {loadingPosts ? (
            <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-fg-muted text-sm">
              {t("common:actions.loading")}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-fg-muted text-sm">
              {t("profile:noPosts")}
            </div>
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl border border-line/10 bg-panel-strong/40 p-4 transition hover:bg-panel-strong/60"
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-fg-muted">
                  <span className="font-bold">
                    {profileUser.nickname?.trim() || profileUser.name}
                  </span>
                  <span>{formatTimeAgo(post.createdAt)}</span>
                </div>
                <p className="text-sm text-fg-soft leading-relaxed">
                  {post.message}
                </p>
              </article>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
