import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { AppUser } from "../types";
import { registerPoopLog } from "../services/poopService";

interface DashboardScreenProps {
  user: AppUser;
  onRefreshUser: () => void;
}

export default function DashboardScreen({ user, onRefreshUser }: DashboardScreenProps) {
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastFinishedBreak, setLastFinishedBreak] = useState<{
    duration: number;
    earned: number;
  } | null>(null);

  // Hourly rate calculation (default to R$ 20.00/h if not defined)
  const hourlyRate = user.hourlyRate || (user.salary ? user.salary / 176 : 20);
  const currentEarned = (seconds / 3600) * hourlyRate;

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

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

  const handleToggleTimer = async () => {
    if (!isActive) {
      // Start timer
      setSeconds(0);
      setLastFinishedBreak(null);
      setIsActive(true);
    } else {
      // Stop timer
      if (seconds < 10) {
        Alert.alert(
          "Cagada muito rápida!",
          "Você ficou menos de 10 segundos. Deseja cancelar ou salvar?",
          [
            { text: "Cancelar", style: "cancel", onPress: () => { setIsActive(false); setSeconds(0); } },
            { text: "Salvar Mesmo Assim", onPress: () => finalizeBreak() },
          ]
        );
      } else {
        await finalizeBreak();
      }
    }
  };

  const finalizeBreak = async () => {
    setIsActive(false);
    setSaving(true);
    try {
      const earned = (seconds / 3600) * hourlyRate;
      await registerPoopLog(user, seconds, earned);
      setLastFinishedBreak({
        duration: seconds,
        earned,
      });
      onRefreshUser();
    } catch (error: any) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível registrar o intervalo.");
    } finally {
      setSaving(false);
      setSeconds(0);
    }
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
          <Text style={styles.statValue}>R$ {hourlyRate.toFixed(2)}</Text>
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>
              {isActive ? "🚽 FINALIZAR CAGADA" : "🚀 INICIAR TRONO"}
            </Text>
          )}
        </TouchableOpacity>
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
    color: "#020617",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
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
