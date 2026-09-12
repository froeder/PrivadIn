import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppUser, PoopLog } from "../types";
import { registerPoopLog, getUserRecentLogs } from "../services/poopService";

interface DashboardScreenProps {
  user: AppUser;
  onRefreshUser: () => void;
}

const ACTIVE_TIMER_STORAGE_KEY = "@privadin:active_timer";

export default function DashboardScreen({ user, onRefreshUser }: DashboardScreenProps) {
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [recentLogs, setRecentLogs] = useState<PoopLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [lastFinishedBreak, setLastFinishedBreak] = useState<{
    duration: number;
    earned: number;
  } | null>(null);

  const startTimeRef = useRef<number | null>(null);
  startTimeRef.current = startTime;

  // Hourly rate calculation
  const hourlyRate = user.hourlyRate || (user.salary ? user.salary / 176 : 20);
  const currentEarned = (seconds / 3600) * hourlyRate;

  // Load recent logs
  const loadRecentLogs = async () => {
    if (!user?.uid) return;
    setLoadingLogs(true);
    try {
      const logs = await getUserRecentLogs(user.uid, 5);
      setRecentLogs(logs);
    } catch (error) {
      console.error("Error loading recent logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Restore any persisted active timer on mount
  useEffect(() => {
    loadRecentLogs();

    const restoreTimer = async () => {
      try {
        const stored = await AsyncStorage.getItem(ACTIVE_TIMER_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.startTime === "number") {
            const now = Date.now();
            const elapsed = Math.max(0, Math.floor((now - parsed.startTime) / 1000));
            // Only restore if less than 8 hours old
            if (elapsed < 8 * 3600) {
              setStartTime(parsed.startTime);
              setSeconds(elapsed);
              setIsActive(true);
            } else {
              await AsyncStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
            }
          }
        }
      } catch (err) {
        console.error("Error restoring timer:", err);
      }
    };

    restoreTimer();
  }, [user.uid]);

  // Handle AppState changes (coming from background / phone lock)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && startTimeRef.current) {
        const elapsed = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
        setSeconds(elapsed);
      }
    });

    return () => subscription.remove();
  }, []);

  // Timer interval with real timestamp delta calculation
  useEffect(() => {
    let interval: any = null;
    if (isActive && startTime) {
      // Immediate sync
      setSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));

      interval = setInterval(() => {
        setSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
      }, 1000);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const startTimer = async () => {
    const now = Date.now();
    setStartTime(now);
    setSeconds(0);
    setLastFinishedBreak(null);
    setIsActive(true);
    try {
      await AsyncStorage.setItem(
        ACTIVE_TIMER_STORAGE_KEY,
        JSON.stringify({ startTime: now })
      );
    } catch (e) {
      console.error("Failed to persist timer:", e);
    }
  };

  const handleCancelTimer = () => {
    Alert.alert(
      "Cancelar Trono",
      "Deseja descartar a cagada em andamento?",
      [
        { text: "Continuar no Trono", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: async () => {
            setIsActive(false);
            setStartTime(null);
            setSeconds(0);
            await AsyncStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
          },
        },
      ]
    );
  };

  const handleToggleTimer = async () => {
    if (!isActive) {
      await startTimer();
    } else {
      const currentElapsed = startTime
        ? Math.max(0, Math.floor((Date.now() - startTime) / 1000))
        : seconds;

      if (currentElapsed < 10) {
        Alert.alert(
          "Cagada muito rápida!",
          "Você ficou menos de 10 segundos. Deseja cancelar ou salvar?",
          [
            {
              text: "Cancelar",
              style: "cancel",
              onPress: async () => {
                setIsActive(false);
                setStartTime(null);
                setSeconds(0);
                await AsyncStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
              },
            },
            {
              text: "Salvar Mesmo Assim",
              onPress: () => finalizeBreak(currentElapsed),
            },
          ]
        );
      } else {
        await finalizeBreak(currentElapsed);
      }
    }
  };

  const finalizeBreak = async (finalSeconds: number) => {
    setIsActive(false);
    setSaving(true);
    try {
      const earned = (finalSeconds / 3600) * hourlyRate;
      await registerPoopLog(user, finalSeconds, earned);
      await AsyncStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
      setLastFinishedBreak({
        duration: finalSeconds,
        earned,
      });
      onRefreshUser();
      loadRecentLogs();
    } catch (error: any) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível registrar o intervalo.");
    } finally {
      setSaving(false);
      setStartTime(null);
      setSeconds(0);
    }
  };

  const formatLogDate = (createdAt: any) => {
    if (!createdAt) return "Hoje";
    let d: Date;
    if (typeof createdAt.toDate === "function") {
      d = createdAt.toDate();
    } else if (createdAt.seconds) {
      d = new Date(createdAt.seconds * 1000);
    } else {
      d = new Date(createdAt);
    }
    if (isNaN(d.getTime())) return "Hoje";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month} às ${hours}:${minutes}`;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Top Profile Summary */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Olá, {user.name || "Cagador"} 👋</Text>
          <Text style={styles.subgreeting}>Hora do expediente sagrado</Text>
        </View>
        <View style={styles.streakBadge}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakCount}>{user.currentDailyStreak || 0} dias</Text>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pontos</Text>
          <Text style={styles.statValue}>{user.totalPoints || 0} 🏆</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Taxa / Hora</Text>
          <Text style={styles.statValue}>R$ {hourlyRate.toFixed(2).replace(".", ",")}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Poopcoins</Text>
          <Text style={styles.statValue}>{user.poopcoinBalance || 0} 💩</Text>
        </View>
      </View>

      {/* Live Earnings & Timer Card */}
      <View style={[styles.timerCard, isActive && styles.timerCardActive]}>
        <Text style={styles.timerCardTitle}>
          {isActive ? "CAGADA EM ANDAMENTO" : "PRONTO PARA O TRONO?"}
        </Text>

        <Text style={styles.timerDisplay}>{formatTime(seconds)}</Text>

        <View style={styles.earningsBox}>
          <Text style={styles.earningsLabel}>Faturado neste trono:</Text>
          <Text style={styles.earningsValue}>
            R$ {currentEarned.toFixed(2).replace(".", ",")}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.actionButton,
            isActive ? styles.actionButtonStop : styles.actionButtonStart,
          ]}
          onPress={handleToggleTimer}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={isActive ? "#fff" : "#020617"} />
          ) : (
            <Text
              style={[
                styles.actionButtonText,
                !isActive && styles.actionButtonTextStart,
              ]}
            >
              {isActive ? "🚽 FINALIZAR CAGADA" : "🚀 INICIAR TRONO"}
            </Text>
          )}
        </TouchableOpacity>

        {isActive && !saving && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelTimer}
          >
            <Text style={styles.cancelButtonText}>Descartar / Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Finished Summary Feedback */}
      {lastFinishedBreak && (
        <View style={styles.congratsCard}>
          <Text style={styles.congratsTitle}>🎉 Cagada Registrada com Sucesso!</Text>
          <Text style={styles.congratsText}>
            Duração: {formatTime(lastFinishedBreak.duration)} | Faturou:{" "}
            <Text style={styles.congratsHighlight}>
              R$ {lastFinishedBreak.earned.toFixed(2).replace(".", ",")}
            </Text>
          </Text>
        </View>
      )}

      {/* Recent Logs Section */}
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>📜 Histórico Recente</Text>
          {loadingLogs && <ActivityIndicator size="small" color="#eab308" />}
        </View>

        {recentLogs.length === 0 ? (
          <Text style={styles.emptyHistoryText}>
            Nenhuma cagada registrada ainda. Comece sua jornada no botão acima!
          </Text>
        ) : (
          recentLogs.map((log, idx) => (
            <View key={log.id || String(idx)} style={styles.historyItem}>
              <View style={styles.historyIconBox}>
                <Text style={styles.historyIcon}>🚽</Text>
              </View>
              <View style={styles.historyInfo}>
                <Text style={styles.historyDate}>{formatLogDate(log.createdAt)}</Text>
                <Text style={styles.historyDuration}>
                  Duração: {formatTime(log.durationSeconds)}
                </Text>
              </View>
              <View style={styles.historyEarned}>
                <Text style={styles.historyEarnedText}>
                  + R$ {(log.earnedAmount || 0).toFixed(2).replace(".", ",")}
                </Text>
                <Text style={styles.historyPoints}>+{log.points || 10} pts</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Fun Tip */}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 Sabedoria Corporativa</Text>
        <Text style={styles.tipBody}>
          "O chefe ganha em dólar e eu ganho em real. Por isso eu cago no horário comercial."
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#020617",
    flexGrow: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
  },
  subgreeting: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderColor: "rgba(234, 179, 8, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  streakCount: {
    color: "#facc15",
    fontWeight: "700",
    fontSize: 13,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },
  timerCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 4,
  },
  timerCardActive: {
    borderColor: "#eab308",
    shadowColor: "#eab308",
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  timerCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: "900",
    color: "#f8fafc",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  earningsBox: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 16,
    alignItems: "center",
  },
  earningsLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
  },
  earningsValue: {
    fontSize: 26,
    fontWeight: "900",
    color: "#4ade80",
    marginTop: 2,
  },
  actionButton: {
    marginTop: 24,
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  actionButtonStart: {
    backgroundColor: "#eab308",
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  actionButtonStop: {
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  actionButtonTextStart: {
    color: "#020617",
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  historyCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.5,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
    paddingVertical: 8,
    textAlign: "center",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  historyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  historyIcon: {
    fontSize: 18,
  },
  historyInfo: {
    flex: 1,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  historyDuration: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  historyEarned: {
    alignItems: "flex-end",
  },
  historyEarnedText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4ade80",
  },
  historyPoints: {
    fontSize: 11,
    color: "#eab308",
    fontWeight: "700",
    marginTop: 2,
  },
  congratsCard: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  congratsTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#4ade80",
    marginBottom: 4,
  },
  congratsText: {
    fontSize: 13,
    color: "#cbd5e1",
  },
  congratsHighlight: {
    color: "#4ade80",
    fontWeight: "800",
  },
  tipCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#eab308",
    marginBottom: 4,
  },
  tipBody: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
    lineHeight: 18,
  },
});
