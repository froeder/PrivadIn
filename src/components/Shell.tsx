import { BarChart3, History, LayoutDashboard, LogOut, Shield, Volume2, VolumeX, User } from "lucide-react";
import type { AppUser, AppView } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { clsx } from "clsx";

interface ShellProps {
  currentUser: AppUser | null;
  view: AppView;
  onViewChange: (view: AppView) => void;
  muted: boolean;
  onToggleMuted: () => void;
  children: React.ReactNode;
}

const items: Array<{ view: AppView; label: string; icon: React.ElementType }> = [
  { view: "dashboard", label: "Painel", icon: LayoutDashboard },
  { view: "history", label: "Historico", icon: History },
  { view: "stats", label: "Stats", icon: BarChart3 },
  { view: "profile", label: "Perfil", icon: User },
];

export function Shell({ currentUser, view, onViewChange, muted, onToggleMuted, children }: ShellProps) {
  const { logout } = useAuth();
  const navItems =
    currentUser?.role === "admin"
      ? [...items, { view: "admin" as AppView, label: "Admin", icon: Shield }]
      : items;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(250,204,21,0.16),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,0.12),transparent_24%),linear-gradient(135deg,#020617_0%,#111827_48%,#1f2937_100%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
        <header className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3">
          <button className="flex items-center gap-3 text-left" onClick={() => onViewChange("dashboard")}>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-yellow-300 text-xl shadow-lg shadow-yellow-400/20 sm:h-11 sm:w-11 sm:rounded-2xl sm:text-2xl">
              🚽
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] text-yellow-200 sm:text-xs sm:tracking-[0.28em]">PrivadIn</p>
              <h1 className="truncate text-base font-black text-white sm:text-2xl">Liga do Expediente v1</h1>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <img className="h-9 w-9 rounded-full bg-yellow-200 sm:hidden" src={currentUser?.avatar} alt="" />
            <button
              className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-slate-200 transition hover:bg-white/20 sm:p-3"
              onClick={onToggleMuted}
              title={muted ? "Ativar som" : "Mutar som"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2 sm:flex">
              <img className="h-8 w-8 rounded-full bg-yellow-200" src={currentUser?.avatar} alt="" />
              <div className="leading-tight">
                <p className="text-sm font-bold text-white">{currentUser?.name}</p>
                <p className="text-xs text-slate-400">{currentUser?.role === "admin" ? "Fiscal supremo" : "Competidor"}</p>
              </div>
            </div>
            <button
              className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-slate-200 transition hover:bg-red-500/20 hover:text-red-100 sm:p-3"
              onClick={logout}
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="grid flex-1 gap-4 py-4 md:gap-5 md:py-5 lg:grid-cols-[88px_1fr]">
          <nav
            className={clsx(
              "mobile-nav-safe fixed inset-x-3 bottom-0 z-30 grid gap-1 rounded-t-3xl border border-white/10 border-b-0 bg-slate-950/90 px-2 pt-2 shadow-2xl shadow-black/40 backdrop-blur-xl sm:inset-x-6 md:static md:inset-x-auto md:bottom-auto md:order-2 md:gap-2 md:rounded-2xl md:border-b md:bg-white/8 md:p-2 md:shadow-none lg:order-1 lg:h-fit lg:grid-cols-1 lg:gap-1.5 lg:p-1.5",
              navItems.length === 5 ? "grid-cols-5 md:grid-cols-5" : "grid-cols-4 md:grid-cols-4",
            )}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => onViewChange(item.view)}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={clsx(
                    "flex min-h-[3.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[11px] font-bold transition md:min-h-14 md:flex-row md:justify-center md:gap-2 md:rounded-xl md:px-3 md:py-3 md:text-sm lg:min-h-[4.25rem] lg:flex-col lg:justify-center lg:gap-1 lg:px-2 lg:py-2.5 lg:text-xs",
                    active
                      ? "bg-yellow-300 text-slate-950 shadow-lg shadow-yellow-300/20"
                      : "text-slate-300 hover:bg-white/10 hover:text-white",
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
          <section className="mobile-nav-offset min-w-0 lg:order-2">{children}</section>
        </main>
      </div>
    </div>
  );
}
