import { BarChart3, History, LayoutDashboard, LogOut, Shield, Volume2, VolumeX, User } from "lucide-react";
import type { AppView } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { clsx } from "clsx";

interface ShellProps {
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

export function Shell({ view, onViewChange, muted, onToggleMuted, children }: ShellProps) {
  const { user, logout } = useAuth();
  const navItems = user?.role === "admin" ? [...items, { view: "admin" as AppView, label: "Admin", icon: Shield }] : items;

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(250,204,21,0.16),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,0.12),transparent_24%),linear-gradient(135deg,#020617_0%,#111827_48%,#1f2937_100%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <button className="flex items-center gap-3 text-left" onClick={() => onViewChange("dashboard")}>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-yellow-300 text-2xl shadow-lg shadow-yellow-400/20">
              🚽
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-yellow-200">PrivadIn</p>
              <h1 className="text-lg font-black text-white sm:text-2xl">Liga do Expediente</h1>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-white/10 bg-white/10 p-3 text-slate-200 transition hover:bg-white/20"
              onClick={onToggleMuted}
              title={muted ? "Ativar som" : "Mutar som"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2 sm:flex">
              <img className="h-8 w-8 rounded-full bg-yellow-200" src={user?.avatar} alt="" />
              <div className="leading-tight">
                <p className="text-sm font-bold text-white">{user?.name}</p>
                <p className="text-xs text-slate-400">{user?.role === "admin" ? "Fiscal supremo" : "Competidor"}</p>
              </div>
            </div>
            <button
              className="rounded-xl border border-white/10 bg-white/10 p-3 text-slate-200 transition hover:bg-red-500/20 hover:text-red-100"
              onClick={logout}
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="grid flex-1 gap-5 py-5 lg:grid-cols-[220px_1fr]">
          <nav className="order-2 grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-white/8 p-2 backdrop-blur-xl lg:order-1 lg:h-fit lg:grid-cols-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.view}
                  onClick={() => onViewChange(item.view)}
                  className={clsx(
                    "flex min-h-14 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition lg:justify-start",
                    view === item.view
                      ? "bg-yellow-300 text-slate-950 shadow-lg shadow-yellow-300/20"
                      : "text-slate-300 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <section className="order-1 min-w-0 lg:order-2">{children}</section>
        </main>
      </div>
    </div>
  );
}
