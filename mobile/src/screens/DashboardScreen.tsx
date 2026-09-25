import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppUser, PoopLog, AppSettings } from "../types";
import {
  registerPoopLog,
  getUserRecentLogs,
  getLeaderboard,
  resolvePointsPerLog,
} from "../services/poopService";
import { fetchAppSettings } from "../services/authService";
import { toRoman } from "../utils/roman";
import { checkWorkScheduleStatus, ScheduleStatus } from "../utils/workSchedule";
import { playFlushSound } from "../services/soundService";
import { requestCurrentLocation } from "../services/locationService";
import { shareWeeklyRanking } from "../utils/weeklyRankingShare";
import PoopcoinWalletCard from "../components/PoopcoinWalletCard";
import TransferPoopcoinsModal from "../components/TransferPoopcoinsModal";
import PoopRewardModal from "../components/PoopRewardModal";
import UserProfileModal from "../components/UserProfileModal";
import UserAvatar from "../components/UserAvatar";
import ConfettiEffect from "../components/ConfettiEffect";

interface DashboardScreenProps {
  user: AppUser;
  onRefreshUser: () => void;
  onNavigateToPoopcoins?: () => void;
  onNavigateToCuiter?: () => void;
  onNavigateToAnalytics?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToRanking?: () => void;
}

const ACTIVE_TIMER_STORAGE_KEY = "@privadin:active_timer";

export default function DashboardScreen({
  user,
  onRefreshUser,
  onNavigateToPoopcoins,
  onNavigateToCuiter,
  onNavigateToAnalytics,
  onNavigateToHistory,
  onNavigateToRanking,
}: DashboardScreenProps) {
  const [saving, setSaving] = useState(false);
  const [recentLogs, setRecentLogs] = useState<PoopLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);

  // App Settings (edition, announcement, cooldown, pointsPerLog)
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Weekly Leaderboard State
  const [weeklyLeaders, setWeeklyLeaders] = useState<AppUser[]>([]);
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [sharingRanking, setSharingRanking] = useState(false);

  // Antifraud Cooldown State
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

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

  // Hourly rate calculation
  const hourlyRate = user.hourlyRate || (user.salary ? user.salary / 176 : 20);

  // Standard duration (user-defined bathroomDurationMinutes or default 10 minutes)
  const standardMinutes =
    user.bathroomDurationMinutes && user.bathroomDurationMinutes > 0
      ? Math.min(180, user.bathroomDurationMinutes)
      : 10;
  const standardSeconds = standardMinutes * 60;
  const standardEarned = (standardSeconds / 3600) * hourlyRate;

  // Resolve points per log currently in effect (base 2000 or database setting, plus peak hour bonus if active)
  const currentPointsPerLog = resolvePointsPerLog(
    appSettings as any,
    scheduleStatus.localTime,
    appSettings?.pointsPerLog ?? 2000
  );

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

  // Load weekly leaderboard
  const loadWeeklyLeaders = async () => {
    setLoadingLeaders(true);
    try {
      const leaders = await getLeaderboard("weekly", 5);
      setWeeklyLeaders(leaders);
    } catch (error) {
      console.warn("Error loading weekly leaderboard:", error);
    } finally {
      setLoadingLeaders(false);
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
      let remaining = Math.max(0, Math.ceil((cooldownMs - Date.now()) / 1000));

      if (recentLogs.length > 0 && appSettings?.cooldownMinutes) {
        const lastLogMs = parseTimestampMs(recentLogs[0]?.createdAt);
        if (lastLogMs > 0) {
          const logRemaining = Math.max(
            0,
            Math.ceil((lastLogMs + appSettings.cooldownMinutes * 60_000 - Date.now()) / 1000)
          );
          remaining = Math.max(remaining, logRemaining);
        }
      }

      setCooldownRemaining(remaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [user.cooldownUntil, recentLogs, appSettings?.cooldownMinutes]);

  // Work schedule check interval
  useEffect(() => {
    const updateSchedule = () => {
      setScheduleStatus(checkWorkScheduleStatus(user.workSchedule));
    };

    updateSchedule();
    const interval = setInterval(updateSchedule, 30000);
    return () => clearInterval(interval);
  }, [user.workSchedule]);

  // Initial load + clean up any leftover active timer storage
  useEffect(() => {
    loadSettings();
    loadRecentLogs();
    loadWeeklyLeaders();
    AsyncStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY).catch(() => {});
  }, [user.uid]);

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

  const handleRegisterPoop = async () => {
    if (saving) return;

    // 1. Antifraud Cooldown Check
    if (cooldownRemaining > 0) {
      Alert.alert(
        "🛡️ Cooldown Antifraude Ativo",
        `Aguarde ${formatTime(cooldownRemaining)} para registrar um novo trono. Respeite o tempo de descanso entre registros!`
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
            text: "Registrar Mesmo Assim",
            onPress: () => executeRegisterPoop(),
          },
        ]
      );
      return;
    }

    await executeRegisterPoop();
  };

  const executeRegisterPoop = async () => {
    setSaving(true);
    try {
      // Play flush sound effect
      void playFlushSound();

      // Capture optional geolocation
      let location: any = null;
      try {
        location = await requestCurrentLocation();
      } catch (locErr) {
        console.warn("Location capture skipped:", locErr);
      }

      // Register poop log with business logic + location + points from database/2000
      const result = await registerPoopLog(
        user,
        standardSeconds,
        standardEarned,
        undefined,
        location
      );
      await AsyncStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY).catch(() => {});

      // Open celebration reward modal & trigger festive confetti shower
      setShowConfetti(true);
      setRewardModalData({
        visible: true,
        points: result.points,
        poopcoins: result.poopcoinsEarned,
        durationSeconds: standardSeconds,
        earnedAmount: standardEarned,
        streak: result.newStreak,
        edition: result.competitionEdition || appSettings?.edition || 1,
      });

      onRefreshUser();
      loadRecentLogs();
      loadSettings();
      loadWeeklyLeaders();
    } catch (error: any) {
      console.error("Erro ao registrar cagada:", error);
      Alert.alert("Erro", "Não foi possível registrar o trono.");
    } finally {
      setSaving(false);
    }
  };

  const handleShareRanking = async () => {
    if (sharingRanking) return;
    setSharingRanking(true);
    try {
      await shareWeeklyRanking({
        users: weeklyLeaders,
        edition: appSettings?.edition || 1,
        currentUserId: user.uid,
        announcement: appSettings?.competitionAnnouncement,
      });
    } finally {
      setSharingRanking(false);
    }
  };

  const handleOpenProfile = (uid: string) => {
    setSelectedProfileUserId(uid);
    setProfileModalVisible(true);
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

  const isOnCooldown = cooldownRemaining > 0;

  const POOPCOIN_RULE_BANNER_MS = 24 * 60 * 60 * 1000;
  const poopcoinRuleUpdatedAtMs = parseTimestampMs(appSettings?.poopcoinsPerLogUpdatedAt);
  const showPoopcoinRuleBanner =
    poopcoinRuleUpdatedAtMs > 0 &&
    Date.now() - poopcoinRuleUpdatedAtMs < POOPCOIN_RULE_BANNER_MS;

  return (
    <View style={{ flex: 1, backgroundColor: "#020617" }}>
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

          {showPoopcoinRuleBanner ? (
            <View style={styles.poopcoinRuleCard}>
              <View style={styles.poopcoinRuleHeader}>
                <Text style={styles.poopcoinRuleIcon}>🪙</Text>
                <Text style={styles.poopcoinRuleTitle}>Regra PoopCoin Atualizada</Text>
              </View>
              <Text style={styles.poopcoinRuleBody}>
                Cada registro validado agora gera {appSettings?.poopcoinsPerLog ?? 1} PC enquanto houver suprimento disponível.
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

      {/* 🚽 Card de Registro de Trono */}
      <View
        style={[
          styles.actionCard,
          isOnCooldown && styles.actionCardCooldown,
        ]}
      >
        <Text
          style={[
            styles.actionCardTitle,
            isOnCooldown && { color: "#f59e0b" },
          ]}
        >
          {isOnCooldown
            ? "🛡️ SISTEMA ANTIFRAUDE ATIVO"
            : "🚽 REGISTRO DE TRONO"}
        </Text>

        {isOnCooldown ? (
          <>
            <Text style={[styles.timerDisplay, styles.timerDisplayCooldown]}>
              {formatTime(cooldownRemaining)}
            </Text>
            <View style={styles.cooldownInfoBox}>
              <Text style={styles.cooldownInfoTitle}>Tempo de Espera Obrigatório</Text>
              <Text style={styles.cooldownInfoSubtitle}>
                Descanse o esfíncter antes do próximo trono remunerado.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.rewardPreviewContainer}>
            <View style={styles.pointsHighlightBox}>
              <Text style={styles.pointsHighlightBadge}>PONTOS POR REGISTRO</Text>
              <Text style={styles.pointsHighlightValue}>
                +{currentPointsPerLog.toLocaleString("pt-BR")}{" "}
                <Text style={styles.pointsHighlightUnit}>PTS</Text>
              </Text>
              <Text style={styles.pointsHighlightSub}>
                Computados automaticamente ao registrar
              </Text>
            </View>

            <View style={styles.earningsEstimateRow}>
              <View style={styles.earningsEstimateCol}>
                <Text style={styles.earningsEstimateLabel}>💰 Faturado Estimado</Text>
                <Text style={styles.earningsEstimateValue}>
                  R$ {standardEarned.toFixed(2).replace(".", ",")}
                </Text>
              </View>
              <View style={styles.earningsEstimateDivider} />
              <View style={styles.earningsEstimateCol}>
                <Text style={styles.earningsEstimateLabel}>⏱️ Duração Padrão</Text>
                <Text style={styles.earningsEstimateValue}>
                  {standardMinutes} min
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Botão de Ação Principal */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            isOnCooldown
              ? styles.actionButtonCooldown
              : styles.actionButtonStart,
          ]}
          onPress={handleRegisterPoop}
          disabled={saving || isOnCooldown}
          activeOpacity={0.85}
        >
          {saving ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={isOnCooldown ? "#facc15" : "#020617"} />
              <Text
                style={[
                  styles.actionButtonText,
                  !isOnCooldown && styles.actionButtonTextStart,
                  isOnCooldown && styles.actionButtonTextCooldown,
                ]}
              >
                REGISTRANDO TRONO...
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.actionButtonText,
                !isOnCooldown && styles.actionButtonTextStart,
                isOnCooldown && styles.actionButtonTextCooldown,
              ]}
            >
              {isOnCooldown
                ? `⏳ AGUARDE ${formatTime(cooldownRemaining)} (COOLDOWN)`
                : "💩 REGISTRAR CAGADA"}
            </Text>
          )}
        </TouchableOpacity>
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

      {/* 🏆 Ranking Semanal & Pódio dos Campeões */}
      <View style={styles.rankingCard}>
        <View style={styles.rankingHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <View style={styles.rankingBadge}>
                <Text style={styles.rankingBadgeText}>⚡ RODADA SEMANAL</Text>
              </View>
              <Text style={styles.rankingEditionText}>
                Edição {toRoman(appSettings?.edition ?? 1)}
              </Text>
            </View>
            <Text style={styles.rankingTitle}>Pódio da Semana</Text>
          </View>
          <TouchableOpacity
            style={styles.shareRankingBtn}
            onPress={handleShareRanking}
            disabled={sharingRanking || weeklyLeaders.length === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.shareRankingBtnText}>
              {sharingRanking ? "⏳" : "📤 Compartilhar"}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingLeaders ? (
          <ActivityIndicator size="small" color="#eab308" style={{ marginVertical: 20 }} />
        ) : weeklyLeaders.length === 0 ? (
          <Text style={styles.emptyRankingText}>
            Nenhum registro ainda nesta rodada. Seja o primeiro a ocupar o trono!
          </Text>
        ) : (
          <View style={styles.rankingContent}>
            {/* Top 3 Podium Row */}
            <View style={styles.dashboardPodiumRow}>
              {weeklyLeaders.slice(0, 3).map((leader, idx) => {
                const medals = ["🥇", "🥈", "🥉"];
                const borderColors = ["#eab308", "#94a3b8", "#d97706"];
                const isMe = leader.uid === user.uid;

                return (
                  <TouchableOpacity
                    key={leader.uid}
                    style={[
                      styles.dashboardPodiumItem,
                      { borderColor: borderColors[idx] },
                      isMe && styles.dashboardPodiumItemMe,
                    ]}
                    onPress={() => handleOpenProfile(leader.uid)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.podiumMedalIcon}>{medals[idx]}</Text>
                    <UserAvatar
                      name={leader.name}
                      avatar={leader.avatar}
                      size={44}
                      borderColor={borderColors[idx]}
                    />
                    <Text style={styles.podiumUserName} numberOfLines={1}>
                      {leader.name?.split(" ")[0] || "Cagador"}
                    </Text>
                    <Text style={styles.podiumPoints}>
                      {(leader.weeklyPoints || 0).toLocaleString("pt-BR")} pts
                    </Text>
                    {idx === 0 && (
                      <View style={styles.kingBadge}>
                        <Text style={styles.kingBadgeText}>👑 Rei do Trono</Text>
                      </View>
                    )}
                    {leader.currentDailyStreak && leader.currentDailyStreak > 1 ? (
                      <Text style={styles.podiumStreakText}>🔥 {leader.currentDailyStreak}d</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* If 4th & 5th exist, show compact rows */}
            {weeklyLeaders.slice(3, 5).map((leader, idx) => {
              const rank = idx + 4;
              const isMe = leader.uid === user.uid;

              return (
                <TouchableOpacity
                  key={leader.uid}
                  style={[styles.rankingCompactRow, isMe && styles.rankingCompactRowMe]}
                  onPress={() => handleOpenProfile(leader.uid)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.rankingCompactRank}>#{rank}</Text>
                  <UserAvatar name={leader.name} avatar={leader.avatar} size={28} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.rankingCompactName} numberOfLines={1}>
                      {leader.name} {isMe ? "(Você)" : ""}
                    </Text>
                  </View>
                  <Text style={styles.rankingCompactPoints}>
                    {(leader.weeklyPoints || 0).toLocaleString("pt-BR")} pts
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Navigation Button to Full Ranking */}
            {onNavigateToRanking && (
              <TouchableOpacity
                style={styles.viewFullRankingBtn}
                onPress={onNavigateToRanking}
                activeOpacity={0.8}
              >
                <Text style={styles.viewFullRankingBtnText}>
                  Ver Ranking Completo da Firma 🏆 ›
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Recent Logs Section */}
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>📜 Histórico Recente</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {loadingLogs && <ActivityIndicator size="small" color="#eab308" />}
            {(onNavigateToHistory || onNavigateToAnalytics) && (
              <TouchableOpacity
                onPress={onNavigateToHistory || onNavigateToAnalytics}
                style={{
                  backgroundColor: "rgba(234, 179, 8, 0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(234, 179, 8, 0.3)",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#facc15", fontSize: 11, fontWeight: "800" }}>
                  Ver Histórico 📜 ›
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  <Text style={styles.historyPoints}>
                    +{log.points || 2000} pts
                  </Text>
                  {((typeof log.poopcoinsEarned === "number" && log.poopcoinsEarned > 0) ||
                    Boolean(log.poopcoinTransactionHash)) && (
                    <Text style={{ fontSize: 10, color: "#facc15", fontWeight: "800" }}>
                      • 🪙+{log.poopcoinsEarned ?? 1}
                    </Text>
                  )}
                </View>
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

      {/* User Profile Modal */}
      {selectedProfileUserId && (
        <UserProfileModal
          visible={profileModalVisible}
          userId={selectedProfileUserId}
          currentUserId={user.uid}
          onClose={() => {
            setProfileModalVisible(false);
            setSelectedProfileUserId(null);
          }}
        />
      )}

      {/* 🎉 Celebratory Reward Modal */}
      {rewardModalData && (
        <PoopRewardModal
          visible={rewardModalData.visible}
          onClose={() => {
            setRewardModalData(null);
            setShowConfetti(false);
          }}
          points={rewardModalData.points}
          poopcoins={rewardModalData.poopcoins}
          durationSeconds={rewardModalData.durationSeconds}
          earnedAmount={rewardModalData.earnedAmount}
          streak={rewardModalData.streak}
          edition={rewardModalData.edition}
        />
      )}
      </ScrollView>
      {/* ConfettiEffect only shown when modal is NOT open to avoid duplication */}
      {showConfetti && !rewardModalData && (
        <ConfettiEffect active={showConfetti} onEnd={() => setShowConfetti(false)} />
      )}
    </View>
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
  poopcoinRuleCard: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  poopcoinRuleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  poopcoinRuleIcon: {
    fontSize: 15,
  },
  poopcoinRuleTitle: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "800",
  },
  poopcoinRuleBody: {
    color: "#e2e8f0",
    fontSize: 12,
    lineHeight: 16,
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

  // Action / Registration Card
  actionCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 4,
  },
  actionCardCooldown: {
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 1.2,
    marginBottom: 16,
    textAlign: "center",
  },
  rewardPreviewContainer: {
    width: "100%",
    alignItems: "center",
  },
  pointsHighlightBox: {
    width: "100%",
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.35)",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  pointsHighlightBadge: {
    fontSize: 10,
    fontWeight: "900",
    color: "#facc15",
    letterSpacing: 1,
    backgroundColor: "rgba(234, 179, 8, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  pointsHighlightValue: {
    fontSize: 42,
    fontWeight: "900",
    color: "#facc15",
    letterSpacing: -0.5,
  },
  pointsHighlightUnit: {
    fontSize: 20,
    fontWeight: "800",
    color: "#eab308",
  },
  pointsHighlightSub: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "center",
  },
  earningsEstimateRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: "100%",
  },
  earningsEstimateCol: {
    flex: 1,
    alignItems: "center",
  },
  earningsEstimateLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 2,
  },
  earningsEstimateValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#4ade80",
  },
  earningsEstimateDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: "900",
    color: "#f8fafc",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
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

  // Actions
  actionButton: {
    marginTop: 18,
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonStart: {
    backgroundColor: "#eab308",
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
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
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  actionButtonTextStart: {
    color: "#020617",
  },
  actionButtonTextCooldown: {
    color: "#facc15",
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

  // Weekly Ranking Card Styles
  rankingCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  rankingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  rankingBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderColor: "#eab308",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankingBadgeText: {
    color: "#facc15",
    fontSize: 10,
    fontWeight: "800",
  },
  rankingEditionText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  rankingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
  },
  shareRankingBtn: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "#eab308",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shareRankingBtnText: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyRankingText: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    marginVertical: 14,
    fontStyle: "italic",
  },
  rankingContent: {
    marginTop: 4,
  },
  dashboardPodiumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  dashboardPodiumItem: {
    flex: 1,
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
  },
  dashboardPodiumItemMe: {
    backgroundColor: "rgba(20, 184, 166, 0.15)",
    borderColor: "#14b8a6",
  },
  podiumMedalIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  podiumUserName: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  podiumPoints: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  kingBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: 4,
  },
  kingBadgeText: {
    color: "#fde047",
    fontSize: 9,
    fontWeight: "800",
  },
  podiumStreakText: {
    color: "#f97316",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  rankingCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  rankingCompactRowMe: {
    backgroundColor: "rgba(20, 184, 166, 0.12)",
    borderColor: "rgba(20, 184, 166, 0.4)",
  },
  rankingCompactRank: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    width: 26,
  },
  rankingCompactName: {
    color: "#f1f5f9",
    fontSize: 12,
    fontWeight: "700",
  },
  rankingCompactPoints: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "800",
  },
  viewFullRankingBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.2)",
  },
  viewFullRankingBtnText: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "800",
  },
});
