import { useCallback, useEffect, useRef, useState } from "react";
import { onSnapshot } from "@firebase/firestore";
import toast from "react-hot-toast";
import type { AppUser, PoopLog } from "../types";
import { allLogsQuery } from "../services/poopService";
import { isFirebaseConfigured } from "../services/firebase";

export interface PoopNotification {
  id: string;
  logId: string;
  userId: string;
  userName: string;
  points: number;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "privadin_poop_notifications";
const MAX_NOTIFICATIONS = 30;

function loadStoredNotifications(): PoopNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PoopNotification[];
  } catch {
    return [];
  }
}

function saveStoredNotifications(items: PoopNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // Ignore storage quota errors
  }
}

export function usePoopNotifications(
  currentUser: AppUser | null,
  onNewScoreSound?: () => void,
) {
  const [notifications, setNotifications] = useState<PoopNotification[]>(loadStoredNotifications);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });

  const isInitialLoadRef = useRef(true);
  const seenLogIdsRef = useRef<Set<string>>(new Set());

  // Keep localStorage synchronized
  useEffect(() => {
    saveStoredNotifications(notifications);
  }, [notifications]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return "denied";
    }
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (!currentUser || !isFirebaseConfigured) return;

    isInitialLoadRef.current = true;
    seenLogIdsRef.current.clear();

    const unsubscribe = onSnapshot(
      allLogsQuery(),
      (snapshot) => {
        // On initial load, record all existing log IDs without notifying
        if (isInitialLoadRef.current) {
          snapshot.docs.forEach((doc) => {
            seenLogIdsRef.current.add(doc.id);
          });
          isInitialLoadRef.current = false;
          return;
        }

        const newItems: PoopNotification[] = [];

        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;

          const docId = change.doc.id;
          if (seenLogIdsRef.current.has(docId)) return;
          seenLogIdsRef.current.add(docId);

          const data = change.doc.data() as PoopLog;

          // Do not notify user about their own scores
          if (data.userId === currentUser.uid) return;

          const nowMs = Date.now();
          const logTimeMs = data.createdAt?.toMillis?.() ?? nowMs;

          // Only consider events created recently (within last 5 minutes)
          if (nowMs - logTimeMs > 5 * 60 * 1000) return;

          const userName = data.userName?.trim() || "Um competidor";
          const points = data.points || 10;

          const notificationItem: PoopNotification = {
            id: `notif_${docId}_${Date.now()}`,
            logId: docId,
            userId: data.userId,
            userName,
            points,
            timestamp: logTimeMs,
            read: false,
          };

          newItems.push(notificationItem);

          // 1. In-App Toast
          toast(
            (toastInstance) => (
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => toast.dismiss(toastInstance.id)}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent text-xl text-accent-fg shadow-accent">
                  🚽
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider text-accent-strong">
                    Ponto no Trono!
                  </p>
                  <p className="truncate text-sm font-black text-fg">
                    <span className="text-accent-strong">{userName}</span> acabou de pontuar!
                  </p>
                  <p className="text-xs text-fg-muted">+{points} pontos na tabela</p>
                </div>
              </div>
            ),
            {
              duration: 5500,
              style: {
                background: "rgb(var(--panel-strong) / 0.98)",
                border: "1px solid rgb(var(--line) / 0.15)",
                color: "rgb(var(--fg))",
                boxShadow: "0 18px 48px rgb(var(--shadow-color) / 0.28)",
                borderRadius: "1.25rem",
                padding: "0.85rem 1rem",
              },
            },
          );

          // 2. Play Notification Sound
          onNewScoreSound?.();

          // 3. Browser Native Desktop Notification
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification("🚽 PrivadIn - Ponto no Trono!", {
                body: `${userName} acabou de pontuar (+${points} pts)!`,
                icon: "/pwa-192x192.png",
                badge: "/pwa-192x192.png",
              });
            } catch {
              // Notification could fail if browser permissions changed
            }
          }
        });

        if (newItems.length > 0) {
          setNotifications((prev) => [...newItems, ...prev].slice(0, MAX_NOTIFICATIONS));
        }
      },
      (error) => {
        console.error("Erro ao escutar notificações de pontuação:", error);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser, onNewScoreSound]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAllAsRead,
    clearNotifications,
    requestNotificationPermission,
    permission,
  };
}
