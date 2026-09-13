import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppUser, PoopLog, PoopcoinTransaction } from "../types";
import { logsRef } from "../services/poopService";
import { poopcoinTransactionsRef } from "../services/poopcoinService";
import { playNotificationSound } from "../services/soundService";

export interface PoopNotification {
  id: string;
  type: "score" | "overtaken" | "poopcoin" | "cuiter";
  title: string;
  message: string;
  logId?: string;
  userId?: string;
  userName?: string;
  points?: number;
  amount?: number;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "@privadin:poop_notifications";
const MAX_NOTIFICATIONS = 30;

export function usePoopNotifications(
  currentUser: AppUser | null,
  onNewScoreSound?: () => void
) {
  const [notifications, setNotifications] = useState<PoopNotification[]>([]);
  const [permission, setPermission] = useState<string>(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window) {
      return (window as any).Notification?.permission || "default";
    }
    return "granted";
  });

  const isInitialLogsRef = useRef(true);
  const seenLogIdsRef = useRef<Set<string>>(new Set());
  const isInitialTxsRef = useRef(true);
  const seenTxIdsRef = useRef<Set<string>>(new Set());

  // Carregar notificações salvas no AsyncStorage
  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (isMounted && raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setNotifications(parsed);
          }
        } catch {
          // ignora erro de parse
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Salvar notificações no AsyncStorage ao alterar
  useEffect(() => {
    if (notifications.length > 0) {
      void AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS))
      );
    }
  }, [notifications]);

  // Solicitar permissão de notificação (Web)
  const requestNotificationPermission = useCallback(async () => {
    if (Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window) {
      try {
        const result = await (window as any).Notification.requestPermission();
        setPermission(result);
        return result;
      } catch {
        return "denied";
      }
    }
    return "granted";
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  // Escuta novos registros de cagada de competidores
  useEffect(() => {
    if (!currentUser) return;

    isInitialLogsRef.current = true;
    seenLogIdsRef.current.clear();

    const q = query(logsRef, orderBy("createdAt", "desc"), limit(25));
    const unsubscribeLogs = onSnapshot(
      q,
      (snapshot) => {
        if (isInitialLogsRef.current) {
          snapshot.docs.forEach((docSnap) => {
            seenLogIdsRef.current.add(docSnap.id);
          });
          isInitialLogsRef.current = false;
          return;
        }

        const newItems: PoopNotification[] = [];

        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;

          const docId = change.doc.id;
          if (seenLogIdsRef.current.has(docId)) return;
          seenLogIdsRef.current.add(docId);

          const data = change.doc.data() as PoopLog;

          // Não notifica sobre as próprias cagadas
          if (data.userId === currentUser.uid) return;

          const nowMs = Date.now();
          const logTimeMs =
            data.createdAt?.toMillis?.() ??
            (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : nowMs);

          // Apenas eventos recentes (últimos 5 minutos)
          if (nowMs - logTimeMs > 5 * 60 * 1000) return;

          const userName = data.userName?.trim() || "Um competidor";
          const points = data.points || 10;

          const item: PoopNotification = {
            id: `notif_log_${docId}_${Date.now()}`,
            type: "score",
            title: "Ponto no Trono! 🚽",
            message: `${userName} acabou de pontuar! (+${points} pts na tabela)`,
            logId: docId,
            userId: data.userId,
            userName,
            points,
            timestamp: logTimeMs,
            read: false,
          };

          newItems.push(item);

          // Efeito sonoro
          if (onNewScoreSound) {
            onNewScoreSound();
          } else {
            void playNotificationSound();
          }

          // Notificação do navegador no Web/PWA
          if (
            Platform.OS === "web" &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            (window as any).Notification.permission === "granted"
          ) {
            try {
              new (window as any).Notification("🚽 PrivadIn - Ponto no Trono!", {
                body: `${userName} acabou de pontuar (+${points} pts)!`,
              });
            } catch {
              // ignora erro se permissão expirou
            }
          }
        });

        if (newItems.length > 0) {
          setNotifications((prev) => [...newItems, ...prev].slice(0, MAX_NOTIFICATIONS));
        }
      },
      (error) => {
        console.warn("Erro ao escutar notificações de pontuação:", error);
      }
    );

    // Escuta transferências de Poopcoins recebidas
    isInitialTxsRef.current = true;
    seenTxIdsRef.current.clear();

    const qTx = query(
      poopcoinTransactionsRef,
      where("toUserId", "==", currentUser.uid),
      orderBy("sequence", "desc"),
      limit(10)
    );

    const unsubscribeTx = onSnapshot(
      qTx,
      (snapshot) => {
        if (isInitialTxsRef.current) {
          snapshot.docs.forEach((d) => seenTxIdsRef.current.add(d.id));
          isInitialTxsRef.current = false;
          return;
        }

        const newTxItems: PoopNotification[] = [];

        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const docId = change.doc.id;
          if (seenTxIdsRef.current.has(docId)) return;
          seenTxIdsRef.current.add(docId);

          const tx = change.doc.data() as PoopcoinTransaction;
          const amount = tx.amount || 0;

          const item: PoopNotification = {
            id: `notif_tx_${docId}_${Date.now()}`,
            type: "poopcoin",
            title: "Poopcoins Recebidos! 🪙",
            message: `Você recebeu +${amount} Poopcoin(s)!`,
            amount,
            timestamp: Date.now(),
            read: false,
          };

          newTxItems.push(item);
          void playNotificationSound();
        });

        if (newTxItems.length > 0) {
          setNotifications((prev) => [...newTxItems, ...prev].slice(0, MAX_NOTIFICATIONS));
        }
      },
      (err) => {
        console.warn("Erro ao escutar transferencias recebidas de Poopcoin:", err);
      }
    );

    return () => {
      unsubscribeLogs();
      unsubscribeTx();
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
