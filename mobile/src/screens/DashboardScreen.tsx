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
import { AppUser, PoopLog, AppSettings } from "../types";
import { registerPoopLog, getUserRecentLogs } from "../services/poopService";
import { fetchAppSettings } from "../services/authService";
import { toRoman } from "../utils/roman";
import { checkWorkScheduleStatus, ScheduleStatus } from "../utils/workSchedule";
import { playFlushSound } from "../services/soundService";
import PoopcoinWalletCard from "../components/PoopcoinWalletCard";
import TransferPoopcoinsModal from "../components/TransferPoopcoinsModal";
import PoopRewardModal from "../components/PoopRewardModal";

interface DashboardScreenProps {
  user: AppUser;
  onRefreshUser: () => void;
  onNavigateToPoopcoins?: () => void;
  onNavigateToCuiter?: () => void;
}

const ACTIVE_TIMER_STORAGE_KEY = "@privadin:active_timer";

export default function DashboardScreen({
  user,
  onRefreshUser,
  onNavigateToPoopcoins,
  onNavigateToCuiter,
}: DashboardScreenProps) {
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [recentLogs, setRecentLogs] = useState<PoopLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);

  // App Settings (edition, announcement, cooldown, pointsPerLog)
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Antifraud Cooldown State
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Work Schedule Status State
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>(() =>
    checkWorkScheduleStatus(user.workSchedule)
  );

  // Celebration Reward Modal State
  const [rewardModalData, setRewardModalData] = useState<{
    visible: boolean;
    points: number;
    poopcoins: number;
    durationSeconds: number;
    earnedAmount: number;
    streak: number;
    edition: number;
  } | null>(null);

  const startTimeRef = useRef<number | null>(null);
  startTimeRef.current = startTime;

  // Hourly rate calculation
  const hourlyRate = user.hourlyRate || (user.salary ? user.salary / 176 : 20);
  const currentEarned = (seconds / 3600) * hourlyRate;

  // Health Limit: 10 minutes default (or user-defined bathroomDurationMinutes)
  const maxSafeMinutes =
    user.bathroomDurationMinutes && user.bathroomDurationMinutes > 0
      ? Math.min(180, user.bathroomDurationMinutes)
      : 10;
  const maxSafeSeconds = maxSafeMinutes * 60;
  const isHealthAlert = isActive && seconds >= maxSafeSeconds;

  // Load app settings
  const loadSettings = async () => {
    try {
      const settings = await fetchAppSettings();
      setAppSettings(settings);
    } catch (e) {
      console.warn("Error fetching app settings:", e);
    }
  };

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

  // Parse any Timestamp or date safely to milliseconds
  const parseTimestampMs = (val: any): number => {
    if (!val) return 0;
    if (typeof val.toMillis === "function") return val.toMillis();
    if (typeof val.seconds === "number") return val.seconds * 1000;
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // Cooldown Countdown Effect
  useEffect(() => {
    const updateCooldown = () => {
      const cooldownMs = parseTimestampMs(user.cooldownUntil);
      const remaining = Math.max(0, Math.ceil((cooldownMs - Date.now()) / 1000));
      setCooldownRemaining(remaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [user.cooldownUntil]);

  // Work schedule check interval
  useEffect(() => {
    const updateSchedule = () => {
      setScheduleStatus(checkWorkScheduleStatus(user.workSchedule));
    };

    updateSchedule();
    const interval = setInterval(updateSchedule, 30000);
    return () => clearInterval(interval);
  }, [user.workSchedule]);

  // Restore any persisted active timer on mount
  useEffect(() => {
    loadSettings();
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
      // 1. Antifraud Cooldown Check
      if (cooldownRemaining > 0) {
        Alert.alert(
          "🛡️ Cooldown Antifraude Ativo",
          `Aguarde ${formatTime(cooldownRemaining)} para iniciar um novo trono. Respeite o tempo de descanso entre registros!`
        );
        return;
      }

      // 2. Work Schedule Check
      if (!scheduleStatus.isWorkTime) {
        Alert.alert(
          scheduleStatus.status === "lunch"
            ? "🥪 Horário de Almoço"
            : "🌙 Fora do Expediente",
          `${scheduleStatus.message}\n\nDeseja registrar o trono mesmo assim?`,
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Iniciar Mesmo Assim",
              onPress: () => startTimer(),
            },
          ]
        );
        return;
      }

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

      // Play flush sound effect
      void playFlushSound();

      // Register poop log with real business logic
      const result = await registerPoopLog(user, finalSeconds, earned);
      await AsyncStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);

      // Open celebration reward modal
      setRewardModalData({
        visible: true,
        points: result.points,
        poopcoins: result.poopcoinsEarned,
        durationSeconds: finalSeconds,
        earnedAmount: earned,
        streak: result.newStreak,
        edition: result.competitionEdition || appSettings?.edition || 1,
      });

      onRefreshUser();
      loadRecentLogs();
      loadSettings();
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

  const isOnCooldown = !isActive && cooldownRemaining > 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 👑 Banner da Competição: Edição em Romanos + Comunicado do Admin */}
      <View style={styles.competitionBanner}>
        <View style={styles.competitionHeader}>
          <View style={styles.competitionBadge}>
            <Text style={styles.competitionBadgeText}>
              👑 EDIÇÃO {toRoman(appSettings?.edition ?? 1)}
            </Text>
          </View>
          <Text style={styles.competitionTagline}>Campeonato Oficial do Trono</Text>
        </View>

        {appSettings?.competitionAnnouncement ? (
          <View style={styles.announcementCard}>
            <View style={styles.announcementHeader}>
              <Text style={styles.announcementIcon}>📢</Text>
              <Text style={styles.announcementTitle}>Comunicado da Diretoria</Text>
            </View>
            <Text style={styles.announcementBody}>
              {appSettings.competitionAnnouncement}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Top Profile Summary */}
      <View style={styles.topBar}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <Text style={styles.greeting}>Olá, {user.name || "Cagador"} 👋</Text>
            {user.equippedBadge && (
              <Text style={{ fontSize: 16 }}>{user.equippedBadge}</Text>
            )}
          </View>

          {user.equippedTitle ? (
            <TouchableOpacity
              onPress={onNavigateToPoopcoins}
              activeOpacity={0.7}
              style={styles.titleBadge}
            >
              <Text style={styles.titleBadgeText}>👑 {user.equippedTitle}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.subgreeting}>Hora do expediente sagrado</Text>
          )}

          {/* Badge de Horário de Expediente */}
          <View style={[styles.scheduleBadge, { borderColor: scheduleStatus.badgeColor }]}>
            <View
              style={[
                styles.scheduleIndicatorDot,
                { backgroundColor: scheduleStatus.badgeColor },
              ]}
            />
            <Text style={[styles.scheduleBadgeText, { color: scheduleStatus.badgeColor }]}>
              {scheduleStatus.badgeLabel} ({scheduleStatus.localTime})
            </Text>
          </View>
        </View>

        <View style={styles.streakBadge}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakCount}>{user.currentDailyStreak || 0} dias</Text>
        </View>
      </View>

      {/* Alerta de Expediente quando fora do expediente ou almoço */}
      {!scheduleStatus.isWorkTime && (
        <View
          style={[
            styles.scheduleAlertCard,
            scheduleStatus.status === "lunch"
              ? styles.scheduleAlertLunch
              : styles.scheduleAlertOutside,
          ]}
        >
          <Text style={styles.scheduleAlertIcon}>
            {scheduleStatus.status === "lunch" ? "🥪" : "🌙"}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.scheduleAlertTitle}>
              {scheduleStatus.status === "lunch"
                ? "Atenção: Horário de Almoço"
                : "Atenção: Fora do Expediente"}
            </Text>
            <Text style={styles.scheduleAlertMessage}>
              {scheduleStatus.message}
            </Text>
          </View>
        </View>
      )}

      {/* Metrics Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pontos Totais</Text>
          <Text style={styles.statValue}>{(user.totalPoints || 0).toLocaleString("pt-BR")} 🏆</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Taxa / Hora</Text>
          <Text style={styles.statValue}>R$ {hourlyRate.toFixed(2).replace(".", ",")}</Text>
        </View>
        <TouchableOpacity
          style={[styles.statCard, { borderColor: "rgba(234, 179, 8, 0.4)", borderWidth: 1 }]}
          onPress={onNavigateToPoopcoins || (() => setTransferModalVisible(true))}
          activeOpacity={0.7}
        >
          <Text style={styles.statLabel}>Poopcoins 🪙</Text>
          <Text style={[styles.statValue, { color: "#eab308" }]}>
            {user.poopcoinBalance || 0}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Live Earnings & Timer Card */}
      <View
        style={[
          styles.timerCard,
          isActive && styles.timerCardActive,
          isHealthAlert && styles.timerCardHealthAlert,
          isOnCooldown && styles.timerCardCooldown,
        ]}
      >
        <Text
          style={[
            styles.timerCardTitle,
            isHealthAlert && { color: "#ef4444" },
            isOnCooldown && { color: "#f59e0b" },
          ]}
        >
          {isActive
            ? isHealthAlert
              ? "🚨 SESSÃO PROLONGADA (LIMITE ULTRAPASSADO)"
              : "CAGADA EM ANDAMENTO"
            : isOnCooldown
            ? "🛡️ SISTEMA ANTIFRAUDE ATIVO"
            : "PRONTO PARA O TRONO?"}
        </Text>

        <Text
          style={[
            styles.timerDisplay,
            isHealthAlert && styles.timerDisplayAlert,
            isOnCooldown && styles.timerDisplayCooldown,
          ]}
        >
          {isOnCooldown ? formatTime(cooldownRemaining) : formatTime(seconds)}
        </Text>

        {isOnCooldown ? (
          <View style={styles.cooldownInfoBox}>
            <Text style={styles.cooldownInfoTitle}>Tempo de Espera Obrigatório</Text>
            <Text style={styles.cooldownInfoSubtitle}>
              Descanse o esfíncter antes do próximo trono remunerado.
            </Text>
          </View>
        ) : (
          <View style={styles.earningsBox}>
            <Text style={styles.earningsLabel}>Faturado neste trono:</Text>
            <Text style={styles.earningsValue}>
              R$ {currentEarned.toFixed(2).replace(".", ",")}
            </Text>
          </View>
        )}

        {/* 🚨 Alerta de Saúde (Prevenção de Hemorróidas) */}
        {isHealthAlert && (
          <View style={styles.healthAlertBanner}>
            <Text style={styles.healthAlertIcon}>🚨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.healthAlertTitle}>
                ALERTA DE SAÚDE: Prevenção de Hemorróidas!
              </Text>
              <Text style={styles.healthAlertText}>
                Você ultrapassou {maxSafeMinutes} minutos no trono. Permanecer sentado
                por tempo excessivo no vaso sanitário comprime as veias anorretais e
                favorece o desenvolvimento de hemorróidas. Finalize e levante-se!
              </Text>
            </View>
          </View>
        )}

        {/* Botão de Ação Principal */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            isActive
              ? styles.actionButtonStop
              : isOnCooldown
              ? styles.actionButtonCooldown
              : styles.actionButtonStart,
          ]}
          onPress={handleToggleTimer}
          disabled={saving || isOnCooldown}
        >
          {saving ? (
            <ActivityIndicator color={isActive ? "#fff" : "#020617"} />
          ) : (
            <Text
              style={[
                styles.actionButtonText,
                !isActive && !isOnCooldown && styles.actionButtonTextStart,
                isOnCooldown && styles.actionButtonTextCooldown,
              ]}
            >
              {isActive
                ? "🚽 FINALIZAR CAGADA"
                : isOnCooldown
                ? `⏳ AGUARDE ${formatTime(cooldownRemaining)} (COOLDOWN)`
                : "🚀 INICIAR TRONO"}
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

      {/* Poopcoin Wallet Card */}
      <PoopcoinWalletCard
        user={user}
        compact={true}
        onOpenTransfer={() => setTransferModalVisible(true)}
        onViewLedger={onNavigateToPoopcoins}
      />

      {/* Cuiter Shortcut Banner */}
      {onNavigateToCuiter && (
        <TouchableOpacity
          style={styles.cuiterBanner}
          onPress={onNavigateToCuiter}
          activeOpacity={0.8}
        >
          <View style={styles.cuiterBannerLeft}>
            <Text style={styles.cuiterBannerIcon}>🐦</Text>
            <View style={styles.cuiterBannerContent}>
              <Text style={styles.cuiterBannerTitle}>Pensamentos no Trono?</Text>
              <Text style={styles.cuiterBannerSubtitle}>
                Abra o Cuiter e compartilhe com a firma ao vivo!
              </Text>
            </View>
          </View>
          <Text style={styles.cuiterBannerArrow}>→</Text>
        </TouchableOpacity>
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
                  {log.competitionEdition ? ` • Ed. ${toRoman(log.competitionEdition)}` : ""}
                </Text>
              </View>
              <View style={styles.historyEarned}>
                <Text style={styles.historyEarnedText}>
                  + R$ {(log.earnedAmount || 0).toFixed(2).replace(".", ",")}
                </Text>
                <Text style={styles.historyPoints}>
                  +{log.points || 2000} pts
                </Text>
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

      {/* Transfer Modal */}
      <TransferPoopcoinsModal
        visible={transferModalVisible}
        currentUser={user}
        onClose={() => setTransferModalVisible(false)}
        onSuccess={() => {
          onRefreshUser();
        }}
      />

      {/* 🎉 Celebratory Reward Modal */}
      {rewardModalData && (
        <PoopRewardModal
          visible={rewardModalData.visible}
          onClose={() => setRewardModalData(null)}
          points={rewardModalData.points}
          poopcoins={rewardModalData.poopcoins}
          durationSeconds={rewardModalData.durationSeconds}
          earnedAmount={rewardModalData.earnedAmount}
          streak={rewardModalData.streak}
          edition={rewardModalData.edition}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#020617",
    flexGrow: 1,
  },
  // Competition Banner
  competitionBanner: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.35)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  competitionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  competitionBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    borderWidth: 1,
    borderColor: "#eab308",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  competitionBadgeText: {
    color: "#facc15",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  competitionTagline: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  announcementCard: {
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.25)",
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  announcementHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  announcementIcon: {
    fontSize: 15,
  },
  announcementTitle: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "800",
  },
  announcementBody: {
    color: "#f1f5f9",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  // Top Bar & Greetings
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
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
  titleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  titleBadgeText: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "800",
  },
  scheduleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
    alignSelf: "flex-start",
    gap: 6,
  },
  scheduleIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scheduleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
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

  // Schedule Alert
  scheduleAlertCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  scheduleAlertLunch: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  scheduleAlertOutside: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  scheduleAlertIcon: {
    fontSize: 20,
  },
  scheduleAlertTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 2,
  },
  scheduleAlertMessage: {
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 16,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
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

  // Timer Card
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
  timerCardCooldown: {
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  timerCardHealthAlert: {
    borderColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOpacity: 0.4,
    shadowRadius: 25,
  },
  timerCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 1.2,
    marginBottom: 16,
    textAlign: "center",
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: "900",
    color: "#f8fafc",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  timerDisplayAlert: {
    color: "#ef4444",
  },
  timerDisplayCooldown: {
    color: "#f59e0b",
    fontSize: 48,
  },
  cooldownInfoBox: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 14,
    alignItems: "center",
  },
  cooldownInfoTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#facc15",
  },
  cooldownInfoSubtitle: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    textAlign: "center",
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

  // Health Alert Banner
  healthAlertBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
    gap: 10,
    width: "100%",
  },
  healthAlertIcon: {
    fontSize: 24,
  },
  healthAlertTitle: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 4,
  },
  healthAlertText: {
    color: "#fee2e2",
    fontSize: 12,
    lineHeight: 16,
  },

  // Actions
  actionButton: {
    marginTop: 22,
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
  actionButtonCooldown: {
    backgroundColor: "rgba(51, 65, 85, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  actionButtonTextStart: {
    color: "#020617",
  },
  actionButtonTextCooldown: {
    color: "#facc15",
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

  // History
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

  // Corporate wisdom tip
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

  // Cuiter banner
  cuiterBanner: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cuiterBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  cuiterBannerIcon: {
    fontSize: 26,
  },
  cuiterBannerContent: {
    flex: 1,
  },
  cuiterBannerTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
  },
  cuiterBannerSubtitle: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  cuiterBannerArrow: {
    color: "#eab308",
    fontSize: 18,
    fontWeight: "800",
  },
});
