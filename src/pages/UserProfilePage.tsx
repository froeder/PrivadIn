import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ArrowLeft, Copy, Edit3, KeyRound, LogOut, MessageCircle, Moon, PackageCheck, Sparkles, Sun } from "lucide-react";
import { clsx } from "clsx";
import { AvatarImage } from "../components/AvatarImage";
import { Card } from "../components/Card";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../contexts/AuthContext";
import { fetchUserCuiterPosts } from "../services/cuiterService";
import { formatTimeAgo } from "../utils/date";
import type { AppTheme, AppUser, AppView, CuiterPost, ShopItem, ShopItemCategory } from "../types";
import { useTheme } from "../hooks/useTheme";
import { equipUserShopItem, listenShopCatalog, resolveUserOwnedItems, SHOP_CATALOG } from "../constants/shop";

interface UserProfilePageProps {
  currentUser: AppUser;
  profileUser: AppUser;
  setView: (view: AppView) => void;
  onBack: () => void;
}

function getRarityBadgeClasses(rarity: string) {
  switch (rarity) {
    case "lendario":
      return "border-amber-500/40 bg-amber-500/15 text-amber-400";
    case "epico":
      return "border-purple-500/40 bg-purple-500/15 text-purple-400";
    case "raro":
      return "border-sky-500/40 bg-sky-500/15 text-sky-400";
    default:
      return "border-slate-500/40 bg-slate-500/15 text-slate-400";
  }
}

export function UserProfilePage({
  currentUser,
  profileUser,
  setView,
  onBack,
}: UserProfilePageProps) {
  const { t } = useTranslation(["profile", "common"]);
  const { logout, firebaseUser, refreshProfile } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [posts, setPosts] = useState<CuiterPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [shopCatalog, setShopCatalog] = useState<ShopItem[]>(SHOP_CATALOG);
  const [itemCategoryFilter, setItemCategoryFilter] = useState<"all" | ShopItemCategory>("all");
  const [equippingItemId, setEquippingItemId] = useState<string | null>(null);

  const isOwnProfile = currentUser.uid === profileUser.uid;
  const themeOptions: Array<{ value: AppTheme; label: string; icon: React.ElementType }> = [
    { value: "light", label: t("common:theme.light"), icon: Sun },
    { value: "dark", label: t("common:theme.dark"), icon: Moon },
  ];

  useEffect(() => {
    const unsub = listenShopCatalog((items) => {
      setShopCatalog(items);
    });
    return () => unsub();
  }, []);

  const ownedItems = useMemo(() => {
    return resolveUserOwnedItems(profileUser, shopCatalog);
  }, [profileUser, shopCatalog]);

  const filteredOwnedItems = useMemo(() => {
    if (itemCategoryFilter === "all") return ownedItems;
    return ownedItems.filter((i) => i.category === itemCategoryFilter);
  }, [ownedItems, itemCategoryFilter]);

  async function handleToggleEquip(item: ShopItem) {
    if (!isOwnProfile) return;
    setEquippingItemId(item.id);
    try {
      const isEquipped =
        item.category === "title"
          ? profileUser.equippedTitle === item.name
          : item.category === "badge"
          ? profileUser.equippedBadge === item.icon
          : false;

      await equipUserShopItem(currentUser.uid, item, !isEquipped);
      await refreshProfile();
      toast.success(isEquipped ? "Item desequipado." : "Item equipado no seu perfil!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao equipar item.");
    } finally {
      setEquippingItemId(null);
    }
  }

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChangePasswordModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-line/10 bg-panel px-4 py-2.5 text-sm font-black text-fg transition hover:bg-panel-strong"
            >
              <KeyRound size={16} />
              {t("profile:changePasswordButton", { defaultValue: "Alterar Senha" })}
            </button>

            <button
              onClick={() => setView("edit-profile")}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-black text-accent-fg transition hover:bg-accent-strong shadow-accent"
            >
              <Edit3 size={16} />
              {t("profile:editProfileButton")}
            </button>
          </div>
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
              {profileUser.equippedBadge ? (
                <span
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-panel bg-panel-strong text-base shadow-md"
                  title="Emblema Ativo"
                >
                  {profileUser.equippedBadge}
                </span>
              ) : null}
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

            {/* Crachá de Cargo e Título Equipado */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center rounded-full bg-panel-strong px-2.5 py-0.5 text-xs font-bold text-fg-muted">
                {profileUser.role === "admin"
                  ? t("common:roles.admin")
                  : t("common:roles.player")}
              </span>

              {profileUser.equippedTitle ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-xs font-black text-accent-strong">
                  👑 {profileUser.equippedTitle}
                </span>
              ) : null}
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

      {/* Cartão de Itens Adquiridos / Colecionáveis da Loja */}
      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck size={20} className="text-accent-strong" />
              <h3 className="text-xl font-black text-fg">
                {t("profile:purchasedItemsTitle", { defaultValue: "Itens Adquiridos" })}
              </h3>
              <span className="rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-xs font-black text-accent-strong">
                {ownedItems.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-fg-muted">
              {t("profile:purchasedItemsDescription", {
                defaultValue: "Títulos honorários, emblemas e vantagens adquiridos na loja de Poopcoins.",
              })}
            </p>
          </div>

          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setView("poopcoins")}
              className="inline-flex items-center gap-1.5 self-start rounded-xl border border-line/10 bg-field px-3 py-1.5 text-xs font-bold text-accent-strong transition hover:bg-panel-strong sm:self-auto"
            >
              <Sparkles size={14} />
              <span>{t("profile:exploreShopButton", { defaultValue: "Loja Poopcoins" })} →</span>
            </button>
          )}
        </div>

        {ownedItems.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { key: "all", label: t("profile:filterAll", { defaultValue: "Todos" }), count: ownedItems.length },
              {
                key: "title",
                label: `👑 ${t("profile:filterTitles", { defaultValue: "Títulos" })}`,
                count: ownedItems.filter((i) => i.category === "title").length,
              },
              {
                key: "badge",
                label: `🥇 ${t("profile:filterBadges", { defaultValue: "Emblemas" })}`,
                count: ownedItems.filter((i) => i.category === "badge").length,
              },
              {
                key: "perk",
                label: `☕ ${t("profile:filterPerks", { defaultValue: "Privilégios" })}`,
                count: ownedItems.filter((i) => i.category === "perk").length,
              },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setItemCategoryFilter(filter.key as any)}
                className={clsx(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition",
                  itemCategoryFilter === filter.key
                    ? "bg-accent text-accent-fg shadow-accent"
                    : "border border-line/10 bg-field text-fg-soft hover:bg-panel-strong hover:text-fg",
                )}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        )}

        {filteredOwnedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center">
            <span className="mb-2 block text-3xl">🛍️</span>
            <p className="text-sm font-bold text-fg">
              {ownedItems.length === 0
                ? t("profile:purchasedItemsEmpty", { defaultValue: "Nenhum item da loja adquirido ainda." })
                : "Nenhum item nesta categoria."}
            </p>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setView("poopcoins")}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-black text-accent-fg shadow-accent transition hover:bg-accent-strong"
              >
                <Sparkles size={14} />
                <span>{t("profile:exploreShopButton", { defaultValue: "Explorar Loja de Poopcoins" })}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredOwnedItems.map((item) => {
              const isEquipped =
                item.category === "title"
                  ? profileUser.equippedTitle === item.name
                  : item.category === "badge"
                  ? profileUser.equippedBadge === item.icon
                  : false;
              const isBusy = equippingItemId === item.id;
              const rarityClasses = getRarityBadgeClasses(item.rarity);

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-line/10 bg-panel-strong/40 p-4 transition hover:bg-panel-strong/60"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line/20 bg-panel text-2xl shadow-sm">
                      {item.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="truncate font-bold text-fg text-sm">{item.name}</h4>
                        <span
                          className={clsx(
                            "rounded-md border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                            rarityClasses,
                          )}
                        >
                          {item.rarity}
                        </span>
                      </div>

                      <p className="mt-0.5 text-xs text-fg-muted font-medium">
                        {item.category === "title"
                          ? "👑 Título de Honra"
                          : item.category === "badge"
                          ? "🥇 Emblema de Avatar"
                          : "☕ Privilégio Corporativo"}
                      </p>

                      <p className="mt-1 text-xs text-fg-soft leading-relaxed">
                        {item.description}
                      </p>

                      {item.perkEffect && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent-strong">
                          <span>⚡</span>
                          <span>{item.perkEffect}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end border-t border-line/10 pt-2.5">
                    {item.category === "perk" ? (
                      <span className="rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent-strong">
                        ✓ {t("profile:itemActive", { defaultValue: "Ativo" })}
                      </span>
                    ) : isOwnProfile ? (
                      <button
                        type="button"
                        onClick={() => handleToggleEquip(item)}
                        disabled={isBusy}
                        className={clsx(
                          "rounded-xl px-3 py-1.5 text-xs font-black transition",
                          isEquipped
                            ? "border border-success/40 bg-success/15 text-success hover:bg-success/25"
                            : "border border-line/15 bg-panel text-fg hover:bg-panel-strong",
                        )}
                      >
                        {isBusy
                          ? "..."
                          : isEquipped
                          ? `✓ ${t("profile:itemInUse", { defaultValue: "Em uso" })} (${t("profile:unequipAction", { defaultValue: "Remover" })})`
                          : item.category === "title"
                          ? `👑 ${t("profile:equipAction", { defaultValue: "Equipar Título" })}`
                          : `🥇 ${t("profile:equipAction", { defaultValue: "Usar no Avatar" })}`}
                      </button>
                    ) : isEquipped ? (
                      <span className="rounded-lg border border-success/40 bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
                        ✓ {t("profile:itemInUse", { defaultValue: "Em uso" })}
                      </span>
                    ) : (
                      <span className="text-xs text-fg-muted">
                        {t("profile:itemEquipped", { defaultValue: "Adquirido" })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
      {isOwnProfile && firebaseUser ? (
        <ChangePasswordModal
          isOpen={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(false)}
          firebaseUser={firebaseUser}
        />
      ) : null}
    </div>
  );
}
