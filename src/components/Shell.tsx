import { BarChart3, Coins, History, LayoutDashboard, LogOut, MessageCircle, Moon, Shield, Sun, User, Users, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../constants/app";
import type { AppTheme, AppUser, AppView } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { clsx } from "clsx";
import { AvatarImage } from "./AvatarImage";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface ShellProps {
  currentUser: AppUser | null;
  view: AppView;
  onViewChange: (view: AppView) => void;
  muted: boolean;
  onToggleMuted: () => void;
  children: React.ReactNode;
}

type NavItem = { view: AppView; label: string; icon: React.ElementType; mobile?: boolean };

export function Shell({ currentUser, view, onViewChange, muted, onToggleMuted, children }: ShellProps) {
  const { t } = useTranslation(["common", "shell"]);
  const { logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const items: NavItem[] = [
    { view: "dashboard", label: t("shell:nav.dashboard"), icon: LayoutDashboard },
    { view: "poopcoins", label: t("shell:nav.poopcoins"), icon: Coins },
    { view: "groups", label: t("shell:nav.groups", { defaultValue: "Grupos" }), icon: Users },
    { view: "cuiter", label: t("shell:nav.cuiter"), icon: MessageCircle },
    { view: "history", label: t("shell:nav.history"), icon: History },
    { view: "stats", label: t("shell:nav.stats"), icon: BarChart3, mobile: false },
    { view: "profile", label: t("shell:nav.profile"), icon: User },
  ];
  const navItems: NavItem[] =
    currentUser?.role === "admin"
      ? [...items, { view: "admin" as AppView, label: t("shell:nav.admin"), icon: Shield }]
      : items;
  const mobileNavCount = navItems.filter((item) => item.mobile !== false).length;
  const themeOptions: Array<{ value: AppTheme; label: string; icon: React.ElementType }> = [
    { value: "light", label: t("common:theme.light"), icon: Sun },
    { value: "dark", label: t("common:theme.dark"), icon: Moon },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas text-fg">
      <div className="app-shell-gradient pointer-events-none fixed inset-0" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/10 bg-panel/90 px-3 py-2.5 shadow-panel backdrop-blur-xl sm:flex-nowrap sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3">
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onViewChange("dashboard")}>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-xl text-accent-fg shadow-accent sm:h-11 sm:w-11 sm:rounded-2xl sm:text-2xl">
              🚽
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] text-accent-strong sm:text-xs sm:tracking-[0.28em]">PrivadIn</p>
              <h1 className="truncate text-base font-black text-fg sm:text-2xl">{t("common:labels.appNameWithEdition")}</h1>
            </div>
          </button>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            {currentUser ? <AvatarImage className="h-9 w-9 sm:hidden" avatar={currentUser.avatar} email={currentUser.email} name={currentUser.name} /> : null}
            <LanguageSwitcher compact className="px-2.5 py-2 md:hidden" />
            <LanguageSwitcher className="hidden md:flex" />
            <button
              className="rounded-xl border border-line/10 bg-panel p-2.5 text-fg-soft transition hover:bg-panel-strong hover:text-fg sm:p-3"
              onClick={onToggleMuted}
              title={muted ? t("shell:soundOn") : t("shell:soundOff")}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div
              role="group"
              className="flex items-center rounded-xl border border-line/10 bg-panel p-1"
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
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition sm:px-3",
                      active
                        ? "bg-accent text-accent-fg shadow-accent"
                        : "text-fg-soft hover:bg-panel-strong hover:text-fg",
                    )}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="hidden items-center gap-3 rounded-xl border border-line/10 bg-panel px-3 py-2 sm:flex">
              {currentUser ? <AvatarImage className="h-8 w-8" avatar={currentUser.avatar} email={currentUser.email} name={currentUser.name} /> : null}
              <div className="leading-tight">
                <p className="text-sm font-bold text-fg">{currentUser?.name}</p>
                <p className="text-xs text-fg-muted">{currentUser?.role === "admin" ? t("common:roles.admin") : t("common:roles.player")}</p>
              </div>
            </div>
            <button
              className="rounded-xl border border-line/10 bg-panel p-2.5 text-fg-soft transition hover:bg-danger-soft/70 hover:text-danger sm:p-3"
              onClick={logout}
              title={t("shell:logout")}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="grid flex-1 gap-4 py-4 md:gap-5 md:py-5 lg:grid-cols-[88px_1fr]">
          <nav
            className={clsx(
              "mobile-nav-safe fixed inset-x-3 bottom-0 z-30 grid gap-1 rounded-t-3xl border border-line/10 border-b-0 bg-panel/95 px-2 pt-2 shadow-panel backdrop-blur-xl sm:inset-x-6 md:static md:inset-x-auto md:bottom-auto md:order-2 md:gap-2 md:rounded-2xl md:border-b md:bg-panel/90 md:p-2 md:shadow-none lg:order-1 lg:h-fit lg:grid-cols-1 lg:gap-1.5 lg:p-1.5",
              mobileNavCount === 6 ? "grid-cols-6" : mobileNavCount === 5 ? "grid-cols-5" : "grid-cols-4",
              navItems.length === 7
                ? "md:grid-cols-7"
                : navItems.length === 6
                  ? "md:grid-cols-6"
                  : navItems.length === 5
                    ? "md:grid-cols-5"
                    : "md:grid-cols-4",
            )}
          >
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = view === item.view || (item.view === "profile" && view === "edit-profile");
              return (
                <button
                  key={item.view}
                  onClick={() => onViewChange(item.view)}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={clsx(
                    "min-h-[3.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[11px] font-bold transition md:min-h-14 md:flex-row md:justify-center md:gap-2 md:rounded-xl md:px-3 md:py-3 md:text-sm lg:min-h-[4.25rem] lg:flex-col lg:justify-center lg:gap-1 lg:px-2 lg:py-2.5 lg:text-xs",
                    item.mobile === false ? "hidden md:flex" : "flex",
                    active
                      ? "bg-accent text-accent-fg shadow-accent"
                      : "text-fg-muted hover:bg-panel-strong hover:text-fg",
                  )}
                >
                  <Icon size={18} />
                  <span className={clsx("max-w-full truncate leading-none md:hidden", active ? "block" : "hidden")}>
                    {item.label}
                  </span>
                  <span className="hidden max-w-full truncate leading-none md:block lg:hidden">
                    {item.label}
                  </span>
                  {active ? (
                    <span className="hidden max-w-full truncate text-[10px] leading-none lg:block">
                      {item.label}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <section className="mobile-nav-offset min-w-0 lg:order-2">
            {children}
            <footer className="pb-20 pt-5 text-center text-xs text-fg-muted md:pb-0">
              v{APP_VERSION}
            </footer>
          </section>
        </main>
      </div>
    </div>
  );
}
