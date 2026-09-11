import { useEffect, useRef } from "react";
import { Bell, CheckCheck, Sparkles, Trash2, X } from "lucide-react";
import { formatTimeAgo } from "../utils/date";
import type { PoopNotification } from "../hooks/usePoopNotifications";

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: PoopNotification[];
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onClearNotifications: () => void;
  permission: NotificationPermission | "unsupported";
  onRequestPermission: () => Promise<NotificationPermission | "unsupported">;
}

export function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onClearNotifications,
  permission,
  onRequestPermission,
}: NotificationCenterProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 w-[min(380px,94vw)] rounded-3xl border border-line/15 bg-panel/98 p-4 shadow-2xl backdrop-blur-2xl transition animate-in fade-in zoom-in-95 duration-200"
      role="region"
      aria-label="Central de notificações"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-line/10">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent-strong">
            <Bell size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black text-fg">Pontuações</h3>
            <p className="text-[11px] text-fg-muted">
              {unreadCount > 0 ? `${unreadCount} nova(s)` : "Tempo real"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-accent-strong transition hover:bg-panel-strong"
              title="Marcar todas como lidas"
            >
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Lidas</span>
            </button>
          ) : null}

          {notifications.length > 0 ? (
            <button
              type="button"
              onClick={onClearNotifications}
              className="rounded-lg p-1.5 text-fg-muted transition hover:bg-panel-strong hover:text-fg"
              title="Limpar notificações"
            >
              <Trash2 size={14} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-muted transition hover:bg-panel-strong hover:text-fg"
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Browser Permission Prompt Banner */}
      {permission === "default" ? (
        <div className="my-3 rounded-2xl border border-accent/20 bg-accent/10 p-3">
          <div className="flex items-start gap-2.5">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-accent-strong" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-fg">Notificações no Navegador</p>
              <p className="mt-0.5 text-[11px] text-fg-muted">
                Receba alertas na área de trabalho quando alguém pontuar, mesmo com a aba em segundo plano.
              </p>
              <button
                type="button"
                onClick={() => void onRequestPermission()}
                className="mt-2 rounded-xl bg-accent px-3 py-1.5 text-xs font-black text-accent-fg shadow-accent transition hover:bg-accent-strong"
              >
                Permitir notificações
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Notifications List */}
      <div className="mt-2 max-h-80 overflow-y-auto space-y-2 pr-1">
        {notifications.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-field text-2xl text-fg-muted">
              🚽
            </div>
            <p className="mt-2 text-xs font-bold text-fg">Nenhuma pontuação recente</p>
            <p className="mt-1 text-[11px] text-fg-muted max-w-xs mx-auto">
              Quando algum competidor registrar cagada e pontuar, o alerta aparecerá aqui em tempo real.
            </p>
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-2xl border border-line/10 p-2.5 transition ${
                item.read ? "bg-panel-strong/30" : "bg-panel-strong/70 border-accent/30"
              }`}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/20 text-lg">
                🚽
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-xs font-black text-fg">
                    {item.userName}
                  </p>
                  <span className="shrink-0 text-[10px] text-fg-muted">
                    {formatTimeAgo(item.timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-black text-accent-strong">
                    +{item.points} pts
                  </span>
                  <span className="text-[11px] text-fg-soft">bateu o ponto</span>
                </div>
              </div>
              {!item.read ? (
                <div className="h-2 w-2 shrink-0 rounded-full bg-accent" title="Não lida" />
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
