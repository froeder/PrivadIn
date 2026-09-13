import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  Linking,
} from "react-native";
import { AppUser, PoopLog } from "../types";
import {
  getUserAllLogs,
  deleteUserPoopLog,
  editUserPoopLog,
} from "../services/poopService";
import {
  getHourlyDistribution,
  getWeekdayProfitability,
  getAverageSessionMinutes,
  getAnnualFirmCostEstimate,
  parseLogDate,
  getUserHourlyRate,
  buildDailyBuckets,
  getBusinessHoursCount,
  HourlyBucket,
  WeekdayBucket,
} from "../utils/analytics";
import { calculateAchievements } from "../utils/achievements";
import WeeklyChart from "../components/WeeklyChart";
import AchievementsGrid from "../components/AchievementsGrid";
import { toRoman } from "../utils/roman";

interface AnalyticsScreenProps {
  user: AppUser;
  onRefreshUser?: () => void;
  onBack?: () => void;
  initialMode?: "metrics" | "history";
}

type ViewMode = "metrics" | "history";

const ITEMS_PER_PAGE = 8;
const { width: screenWidth } = Dimensions.get("window");

export default function AnalyticsScreen({
  user,
  onRefreshUser,
  onBack,
  initialMode = "metrics",
}: AnalyticsScreenProps) {
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [logs, setLogs] = useState<PoopLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedHour, setSelectedHour] = useState<HourlyBucket | null>(null);
  const [selectedDay, setSelectedDay] = useState<WeekdayBucket | null>(null);

  // Edit / Delete states
  const [editingLog, setEditingLog] = useState<PoopLog | null>(null);
  const [editingSessionNumber, setEditingSessionNumber] = useState<number | null>(null);
  const [editMinutes, setEditMinutes] = useState<string>("10");
  const [editSeconds, setEditSeconds] = useState<string>("0");
  const [editNote, setEditNote] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  const hourlyRate = useMemo(() => getUserHourlyRate(user), [user]);

  const loadData = async () => {
    if (!user?.uid) return;
    try {
      const allLogs = await getUserAllLogs(user.uid);
      setLogs(allLogs);
    } catch (err) {
      console.error("Error loading all logs for analytics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.uid]);

  const onRefresh = () => {
    setRefreshing(true);
    onRefreshUser?.();
    loadData();
  };

  // Calculations
  const hourlyData = useMemo(() => getHourlyDistribution(logs), [logs]);
  const weekdayData = useMemo(
    () => getWeekdayProfitability(logs, hourlyRate),
    [logs, hourlyRate]
  );
  const avgSessionMinutes = useMemo(
    () =>
      getAverageSessionMinutes(
        logs,
        user.bathroomDurationMinutes && user.bathroomDurationMinutes > 0
          ? user.bathroomDurationMinutes
          : 10
      ),
    [logs, user.bathroomDurationMinutes]
  );
  const annualEstimate = useMemo(
    () =>
      getAnnualFirmCostEstimate(
        logs,
        hourlyRate,
        user.bathroomDurationMinutes && user.bathroomDurationMinutes > 0
          ? user.bathroomDurationMinutes
          : 10
      ),
    [logs, hourlyRate, user.bathroomDurationMinutes]
  );
  const dailyBuckets = useMemo(
    () => buildDailyBuckets(logs, hourlyRate),
    [logs, hourlyRate]
  );
  const businessHoursCount = useMemo(
    () => getBusinessHoursCount(logs),
    [logs]
  );
  const achievements = useMemo(
    () => calculateAchievements(user, logs),
    [user, logs]
  );

  // Pagination
  const totalPages = Math.max(1, Math.ceil(logs.length / ITEMS_PER_PAGE));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return logs.slice(start, start + ITEMS_PER_PAGE);
  }, [logs, currentPage]);

  const formatLogDuration = (durationSeconds?: number) => {
    const sec = durationSeconds && durationSeconds > 0 ? durationSeconds : 600;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (s === 0) return `${m}m`;
    return `${m}m ${s}s`;
  };

  const formatLogDateTime = (raw: any) => {
    const d = parseLogDate(raw);
    if (!d) return "Data não disponível";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} às ${hour}:${min}`;
  };

  const formatCurrency = (val: number) => {
    return `R$ ${val.toFixed(2).replace(".", ",")}`;
  };

  // Preview calculations for the Edit Modal
  const previewTotalSeconds = useMemo(() => {
    const m = parseInt(editMinutes, 10) || 0;
    const s = parseInt(editSeconds, 10) || 0;
    return Math.max(1, Math.min(10800, m * 60 + s));
  }, [editMinutes, editSeconds]);

  const previewEarned = useMemo(() => {
    return (previewTotalSeconds / 3600) * hourlyRate;
  }, [previewTotalSeconds, hourlyRate]);

  const previewPoints = useMemo(() => {
    if (!editingLog) return 2000;
    const oldDuration =
      typeof editingLog.durationSeconds === "number"
        ? editingLog.durationSeconds
        : 600;
    const oldBonus = Math.min(500, Math.floor(oldDuration / 60) * 10);
    const newBonus = Math.min(500, Math.floor(previewTotalSeconds / 60) * 10);
    const baseOldPoints =
      typeof editingLog.points === "number" ? editingLog.points : 2000;
    return Math.max(1, baseOldPoints - oldBonus + newBonus);
  }, [editingLog, previewTotalSeconds]);

  const previewDeltaPoints = useMemo(() => {
    if (!editingLog) return 0;
    const oldPoints =
      typeof editingLog.points === "number" ? editingLog.points : 2000;
    return previewPoints - oldPoints;
  }, [editingLog, previewPoints]);

  const openEditModal = (log: PoopLog, sessionNumber: number) => {
    setEditingLog(log);
    setEditingSessionNumber(sessionNumber);
    const totalSec =
      typeof log.durationSeconds === "number" && log.durationSeconds > 0
        ? log.durationSeconds
        : 600;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    setEditMinutes(String(mins));
    setEditSeconds(String(secs));
    setEditNote(log.note || "");
  };

  const openCoordinatesInMap = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        "📍 Coordenadas Geográficas",
        `Latitude: ${lat.toFixed(6)}\nLongitude: ${lng.toFixed(6)}`
      );
    });
  };

  const handleSaveEdit = async () => {
    if (!editingLog?.id) return;
    setIsSavingEdit(true);
    try {
      const { updatedLog, deltaPoints } = await editUserPoopLog(
        user,
        editingLog,
        {
          durationSeconds: previewTotalSeconds,
          note: editNote,
        }
      );

      // Update local logs list immediately
      setLogs((prev) =>
        prev.map((item) => (item.id === updatedLog.id ? updatedLog : item))
      );

      // Refresh top level user stats
      onRefreshUser?.();

      setEditingLog(null);
      Alert.alert(
        "✅ Registro Atualizado",
        `Sua sessão foi corrigida com sucesso!\nNovo rendimento: ${formatCurrency(
          updatedLog.earnedAmount || 0
        )}${
          deltaPoints !== 0
            ? ` (${deltaPoints > 0 ? `+${deltaPoints}` : deltaPoints} pts)`
            : ""
        }.`
      );
    } catch (err: any) {
      console.error("Error updating log:", err);
      Alert.alert("Erro", err?.message || "Não foi possível salvar as alterações.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const confirmDeleteLog = (log: PoopLog, sessionNumber: number) => {
    if (!log.id) return;
    const pts = typeof log.points === "number" ? log.points : 2000;
    const pc =
      typeof log.poopcoinsEarned === "number"
        ? log.poopcoinsEarned
        : log.poopcoinTransactionHash
        ? 1
        : 0;

    Alert.alert(
      "🗑️ Excluir Registro",
      `Deseja realmente remover a Sessão #${sessionNumber}?\n\nSerão deduzidos:\n• -${pts.toLocaleString()} pontos\n${
        pc > 0 ? `• -${pc} PoopCoin(s)\n` : ""
      }• Rendimento faturado correspondente\n\nEssa ação é irreversível e recalculará todas as suas estatísticas.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, Excluir",
          style: "destructive",
          onPress: async () => {
            setIsDeletingId(log.id!);
            try {
              await deleteUserPoopLog(user, log);
              setLogs((prev) => prev.filter((item) => item.id !== log.id));
              onRefreshUser?.();
              Alert.alert(
                "🗑️ Sucesso",
                "Registro removido e estatísticas recalculadas com sucesso!"
              );
            } catch (err: any) {
              console.error("Error deleting log:", err);
              Alert.alert("Erro", err?.message || "Não foi possível excluir o registro.");
            } finally {
              setIsDeletingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#eab308" />
        <Text style={styles.loadingText}>Calculando Analytics Corporativo...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>‹ Voltar</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>📊 Analytics & Rendimento</Text>
            <Text style={styles.subtitle}>
              Transparência total do seu rendimento e tempo no trono
            </Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[
              styles.switchTab,
              mode === "metrics" && styles.switchTabActive,
            ]}
            onPress={() => setMode("metrics")}
          >
            <Text
              style={[
                styles.switchTabText,
                mode === "metrics" && styles.switchTabTextActive,
              ]}
            >
              📈 Gráficos & Métricas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.switchTab,
              mode === "history" && styles.switchTabActive,
            ]}
            onPress={() => setMode("history")}
          >
            <Text
              style={[
                styles.switchTabText,
                mode === "history" && styles.switchTabTextActive,
              ]}
            >
              📜 Histórico ({logs.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#eab308"
            colors={["#eab308"]}
          />
        }
      >
        {mode === "metrics" ? (
          <>
            {/* HERO CARD: Estimativa Anual Paga Pela Firma */}
            <View style={styles.heroCard}>
              <View style={styles.heroBadgeRow}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>💸 A FIRMA PAGA</Text>
                </View>
                <Text style={styles.heroHint}>252 dias úteis / ano</Text>
              </View>

              <Text style={styles.heroTitle}>Estimativa Anual no Trono</Text>
              <Text style={styles.heroValue}>
                {formatCurrency(annualEstimate.annualCost)}
                <Text style={styles.heroValueUnit}> /ano</Text>
              </Text>
              <Text style={styles.heroDescription}>
                Projeção estimada do valor que a firma transfere para o seu bolso
                durante as pausas fisiológicas corporativas.
              </Text>

              <View style={styles.heroStatsGrid}>
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>
                    {annualEstimate.averageDailyMinutes} min
                  </Text>
                  <Text style={styles.heroStatLabel}>Média Diária</Text>
                </View>

                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>
                    {annualEstimate.annualBathroomHours} h
                  </Text>
                  <Text style={styles.heroStatLabel}>Horas Anuais</Text>
                </View>

                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatValue}>
                    {formatCurrency(hourlyRate)}
                  </Text>
                  <Text style={styles.heroStatLabel}>Sua Taxa/Hora</Text>
                </View>
              </View>
            </View>

            {/* Quick Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricIcon}>⏱️</Text>
                <Text style={styles.metricValue}>{avgSessionMinutes} min</Text>
                <Text style={styles.metricLabel}>Média por Sessão</Text>
                <View
                  style={[
                    styles.metricTag,
                    avgSessionMinutes <= 10
                      ? styles.tagSuccess
                      : styles.tagWarning,
                  ]}
                >
                  <Text
                    style={[
                      styles.metricTagText,
                      avgSessionMinutes <= 10
                        ? styles.tagSuccessText
                        : styles.tagWarningText,
                    ]}
                  >
                    {avgSessionMinutes <= 10 ? "Saudável" : "Longa Duração"}
                  </Text>
                </View>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricIcon}>💰</Text>
                <Text style={styles.metricValue}>
                  {formatCurrency(annualEstimate.totalHistoricalEarned)}
                </Text>
                <Text style={styles.metricLabel}>Faturamento Total</Text>
                <View style={[styles.metricTag, styles.tagGold]}>
                  <Text style={[styles.metricTagText, styles.tagGoldText]}>
                    Acumulado
                  </Text>
                </View>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricIcon}>🚽</Text>
                <Text style={styles.metricValue}>{logs.length}</Text>
                <Text style={styles.metricLabel}>Sessões Totais</Text>
                <View style={[styles.metricTag, styles.tagNeutral]}>
                  <Text style={styles.metricTagText}>Cagadas</Text>
                </View>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricIcon}>⏳</Text>
                <Text style={styles.metricValue}>
                  {annualEstimate.totalHistoricalMinutes} min
                </Text>
                <Text style={styles.metricLabel}>Tempo no Trono</Text>
                <View style={[styles.metricTag, styles.tagNeutral]}>
                  <Text style={styles.metricTagText}>Total</Text>
                </View>
              </View>
            </View>

            {/* WEEKLY VOLUME & OFFICE HOURS PERFORMANCE */}
            <WeeklyChart
              buckets={dailyBuckets}
              officeHoursCount={businessHoursCount}
              totalSessions={logs.length}
            />

            {/* CHART 1: Horários Mais Frequentes do Dia */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={styles.chartEyebrow}>DISTRIBUIÇÃO HORÁRIA</Text>
                  <Text style={styles.chartTitle}>
                    Horários Mais Frequentes do Dia
                  </Text>
                </View>
                {hourlyData.peakHour !== null && (
                  <View style={styles.peakPill}>
                    <Text style={styles.peakPillText}>
                      🔥 Pico: {String(hourlyData.peakHour).padStart(2, "0")}h (
                      {hourlyData.peakCount})
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.chartSubtitle}>
                Toque em uma barra para inspecionar os registros por hora:
              </Text>

              {/* Hourly Histogram (08h - 19h focused, with scroll or full bars) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.barChartScroll}
              >
                {hourlyData.buckets.map((b) => {
                  const maxCount = Math.max(1, hourlyData.peakCount);
                  const heightPercent =
                    b.count > 0 ? Math.max(16, (b.count / maxCount) * 100) : 6;
                  const isPeak =
                    hourlyData.peakHour !== null && b.hour === hourlyData.peakHour;
                  const isSelected = selectedHour?.hour === b.hour;

                  return (
                    <TouchableOpacity
                      key={b.hour}
                      style={styles.barColumn}
                      onPress={() => setSelectedHour(b)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.barCountLabel}>
                        {b.count > 0 ? b.count : ""}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${heightPercent}%` },
                            isPeak && styles.barFillPeak,
                            isSelected && styles.barFillSelected,
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.barXLabel,
                          isPeak && styles.barXLabelPeak,
                          isSelected && styles.barXLabelSelected,
                        ]}
                      >
                        {b.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {selectedHour && (
                <View style={styles.selectionCard}>
                  <Text style={styles.selectionTitle}>
                    Faixa das {selectedHour.label}:00
                  </Text>
                  <Text style={styles.selectionText}>
                    {selectedHour.count === 0
                      ? "Nenhuma sessão registrada neste horário."
                      : `${selectedHour.count} cagada(s) realizada(s) nessa janela de horário.`}
                  </Text>
                </View>
              )}
            </View>

            {/* CHART 2: Dias da Semana Mais Rentáveis */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={styles.chartEyebrow}>RENTABILIDADE SEMANAL</Text>
                  <Text style={styles.chartTitle}>
                    Dias Mais Rentáveis da Semana
                  </Text>
                </View>
                {weekdayData.bestDay && weekdayData.bestDay.earnedAmount > 0 && (
                  <View style={styles.goldPill}>
                    <Text style={styles.goldPillText}>
                      🏆 {weekdayData.bestDay.label}:{" "}
                      {formatCurrency(weekdayData.bestDay.earnedAmount)}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.chartSubtitle}>
                Ganhos acumulados e sessões por dia (Segunda a Domingo):
              </Text>

              <View style={styles.weekdayList}>
                {weekdayData.buckets.map((b) => {
                  const maxEarned = Math.max(
                    1,
                    ...weekdayData.buckets.map((item) => item.earnedAmount)
                  );
                  const widthPercent =
                    b.earnedAmount > 0
                      ? Math.max(12, (b.earnedAmount / maxEarned) * 100)
                      : 4;
                  const isBest =
                    weekdayData.bestDay?.dayIndex === b.dayIndex &&
                    b.earnedAmount > 0;
                  const isSelected = selectedDay?.dayIndex === b.dayIndex;

                  return (
                    <TouchableOpacity
                      key={b.dayIndex}
                      style={[
                        styles.weekdayRow,
                        isSelected && styles.weekdayRowSelected,
                      ]}
                      onPress={() => setSelectedDay(b)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.weekdayLabelBox}>
                        <Text
                          style={[
                            styles.weekdayName,
                            isBest && styles.weekdayNameBest,
                          ]}
                        >
                          {b.label}
                        </Text>
                        <Text style={styles.weekdaySessionsCount}>
                          {b.count} {b.count === 1 ? "sessão" : "sessões"}
                        </Text>
                      </View>

                      <View style={styles.weekdayBarTrack}>
                        <View
                          style={[
                            styles.weekdayBarFill,
                            { width: `${widthPercent}%` },
                            isBest && styles.weekdayBarFillBest,
                          ]}
                        />
                      </View>

                      <View style={styles.weekdayEarnedBox}>
                        <Text
                          style={[
                            styles.weekdayEarnedText,
                            isBest && styles.weekdayEarnedTextBest,
                          ]}
                        >
                          {formatCurrency(b.earnedAmount)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedDay && (
                <View style={styles.selectionCard}>
                  <Text style={styles.selectionTitle}>
                    {selectedDay.label}-feira em Detalhes
                  </Text>
                  <Text style={styles.selectionText}>
                    {selectedDay.count} sessões totalizando{" "}
                    {formatCurrency(selectedDay.earnedAmount)} ganhos. Média de{" "}
                    {selectedDay.count > 0
                      ? formatCurrency(
                          selectedDay.earnedAmount / selectedDay.count
                        )
                      : "R$ 0,00"}{" "}
                    por cagada neste dia.
                  </Text>
                </View>
              )}
            </View>

            {/* SISTEMA DE CONQUISTAS (ACHIEVEMENTS GRID) */}
            <AchievementsGrid achievements={achievements} />
          </>
        ) : (
          /* TAB 2: HISTÓRICO COMPLETO PAGINADO */
          <View style={styles.historyContainer}>
            <View style={styles.historyTopBar}>
              <Text style={styles.historySummaryText}>
                {logs.length} {logs.length === 1 ? "sessão" : "sessões"} no
                histórico
              </Text>
              <Text style={styles.pageIndicator}>
                Página {currentPage} de {totalPages}
              </Text>
            </View>

            {logs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🚽</Text>
                <Text style={styles.emptyTitle}>Nenhuma sessão encontrada</Text>
                <Text style={styles.emptyText}>
                  Suas idas ao banheiro serão registradas aqui com duração e
                  rendimento exatos em R$.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.logsList}>
                  {paginatedLogs.map((log, index) => {
                    const sessionNumber =
                      logs.length - ((currentPage - 1) * ITEMS_PER_PAGE + index);
                    const earned =
                      typeof log.earnedAmount === "number" && log.earnedAmount > 0
                        ? log.earnedAmount
                        : ((typeof log.durationSeconds === "number"
                            ? log.durationSeconds
                            : 600) /
                            3600) *
                          hourlyRate;

                    return (
                      <View
                        key={log.id || String(index)}
                        style={styles.logCard}
                      >
                        {/* Top Info Row */}
                        <View style={styles.logCardHeader}>
                          <View style={styles.logLeft}>
                            <View style={styles.logIconBox}>
                              <Text style={styles.logIcon}>🚽</Text>
                            </View>
                            <View style={styles.logDetails}>
                              <View style={styles.logTitleRow}>
                                <Text style={styles.logTitle}>
                                  Sessão #{sessionNumber}
                                </Text>
                                {log.competitionEdition && (
                                  <View style={styles.editionBadge}>
                                    <Text style={styles.editionBadgeText}>
                                      Ed. {toRoman(log.competitionEdition)}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              <Text style={styles.logDate}>
                                📅 {formatLogDateTime(log.createdAt)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.logRight}>
                            <Text style={styles.logEarnedText}>
                              + {formatCurrency(earned)}
                            </Text>
                            <Text style={styles.logEarnedHint}>faturado</Text>
                          </View>
                        </View>

                        {/* Metadata Badges: Duration, Points, PoopCoins, Geo-Coordinates */}
                        <View style={styles.logPillsWrap}>
                          <View style={styles.durationPill}>
                            <Text style={styles.durationPillText}>
                              ⏱️ {formatLogDuration(log.durationSeconds)}
                            </Text>
                          </View>

                          <View style={styles.pointsPill}>
                            <Text style={styles.pointsPillText}>
                              +{log.points || 2000} pts
                            </Text>
                          </View>

                          {((typeof log.poopcoinsEarned === "number" &&
                            log.poopcoinsEarned > 0) ||
                            Boolean(log.poopcoinTransactionHash)) && (
                            <View style={styles.poopcoinsPill}>
                              <Text style={styles.poopcoinsPillText}>
                                🪙 +{log.poopcoinsEarned ?? 1} PC
                              </Text>
                            </View>
                          )}

                          {log.location?.latitude != null &&
                            log.location?.longitude != null && (
                              <TouchableOpacity
                                style={styles.locationPill}
                                onPress={() =>
                                  openCoordinatesInMap(
                                    log.location!.latitude,
                                    log.location!.longitude
                                  )
                                }
                                activeOpacity={0.7}
                              >
                                <Text style={styles.locationPillText}>
                                  📍 {log.location.latitude.toFixed(4)},{" "}
                                  {log.location.longitude.toFixed(4)}
                                  {log.location.accuracy != null
                                    ? ` (±${Math.round(
                                        log.location.accuracy
                                      )}m)`
                                    : ""}
                                </Text>
                              </TouchableOpacity>
                            )}
                        </View>

                        {/* Note / Observação */}
                        {Boolean(log.note) && (
                          <View style={styles.noteBox}>
                            <Text style={styles.noteText} numberOfLines={2}>
                              💭 {log.note}
                            </Text>
                          </View>
                        )}

                        {/* Action Buttons: Edit & Delete */}
                        <View style={styles.logActionsRow}>
                          <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() => openEditModal(log, sessionNumber)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.editBtnText}>✏️ Corrigir</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.deleteBtn,
                              isDeletingId === log.id && { opacity: 0.6 },
                            ]}
                            onPress={() => confirmDeleteLog(log, sessionNumber)}
                            disabled={isDeletingId === log.id}
                            activeOpacity={0.7}
                          >
                            {isDeletingId === log.id ? (
                              <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                              <Text style={styles.deleteBtnText}>🗑️ Excluir</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Pagination Controls */}
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    style={[
                      styles.pageBtn,
                      currentPage === 1 && styles.pageBtnDisabled,
                    ]}
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <Text
                      style={[
                        styles.pageBtnText,
                        currentPage === 1 && styles.pageBtnTextDisabled,
                      ]}
                    >
                      ◀ Anterior
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.pageNumbersBox}>
                    <Text style={styles.pageNumbersText}>
                      {currentPage} / {totalPages}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.pageBtn,
                      currentPage === totalPages && styles.pageBtnDisabled,
                    ]}
                    onPress={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <Text
                      style={[
                        styles.pageBtnText,
                        currentPage === totalPages && styles.pageBtnTextDisabled,
                      ]}
                    >
                      Próxima ▶
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL DE EDIÇÃO E CORREÇÃO DE REGISTRO */}
      <Modal
        visible={editingLog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !isSavingEdit && setEditingLog(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>✏️ Corrigir Registro</Text>
                <Text style={styles.modalSubtitle}>
                  Sessão #{editingSessionNumber} •{" "}
                  {editingLog && formatLogDateTime(editingLog.createdAt)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => !isSavingEdit && setEditingLog(null)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {/* Duração */}
              <Text style={styles.inputLabel}>⏱️ Duração da Sessão</Text>
              <View style={styles.timeInputsRow}>
                <View style={styles.timeInputCol}>
                  <Text style={styles.timeInputSublabel}>Minutos</Text>
                  <TextInput
                    style={styles.timeTextInput}
                    keyboardType="number-pad"
                    value={editMinutes}
                    onChangeText={setEditMinutes}
                    maxLength={3}
                  />
                </View>

                <Text style={styles.timeColon}>:</Text>

                <View style={styles.timeInputCol}>
                  <Text style={styles.timeInputSublabel}>Segundos</Text>
                  <TextInput
                    style={styles.timeTextInput}
                    keyboardType="number-pad"
                    value={editSeconds}
                    onChangeText={setEditSeconds}
                    maxLength={2}
                  />
                </View>
              </View>

              {/* Quick chips */}
              <View style={styles.quickChipsRow}>
                {[5, 10, 15, 20, 30].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={[
                      styles.quickChip,
                      editMinutes === String(mins) &&
                        editSeconds === "0" &&
                        styles.quickChipActive,
                    ]}
                    onPress={() => {
                      setEditMinutes(String(mins));
                      setEditSeconds("0");
                    }}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        editMinutes === String(mins) &&
                          editSeconds === "0" &&
                          styles.quickChipTextActive,
                      ]}
                    >
                      {mins} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Observação / Nota */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                💭 Observação / Motivo
              </Text>
              <TextInput
                style={styles.noteTextInput}
                placeholder="Ex: Pausa reflexiva pós-almoço..."
                placeholderTextColor="#475569"
                value={editNote}
                onChangeText={setEditNote}
                maxLength={120}
                multiline
              />

              {/* Live Calculation Preview */}
              <View style={styles.previewBox}>
                <Text style={styles.previewBoxTitle}>📊 Recálculo Automático</Text>
                <View style={styles.previewStatsRow}>
                  <View style={styles.previewStatItem}>
                    <Text style={styles.previewStatLabel}>Tempo Corrigido</Text>
                    <Text style={styles.previewStatVal}>
                      {formatLogDuration(previewTotalSeconds)}
                    </Text>
                  </View>

                  <View style={styles.previewStatItem}>
                    <Text style={styles.previewStatLabel}>Novo Faturado</Text>
                    <Text style={[styles.previewStatVal, { color: "#4ade80" }]}>
                      {formatCurrency(previewEarned)}
                    </Text>
                  </View>

                  <View style={styles.previewStatItem}>
                    <Text style={styles.previewStatLabel}>Pontos Totais</Text>
                    <Text style={[styles.previewStatVal, { color: "#facc15" }]}>
                      {previewPoints.toLocaleString()} pts
                      {previewDeltaPoints !== 0 && (
                        <Text
                          style={{
                            fontSize: 10,
                            color: previewDeltaPoints > 0 ? "#4ade80" : "#ef4444",
                          }}
                        >
                          {" "}({previewDeltaPoints > 0 ? `+${previewDeltaPoints}` : previewDeltaPoints})
                        </Text>
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingLog(null)}
                disabled={isSavingEdit}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, isSavingEdit && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Salvar Correção</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 12,
    fontWeight: "600",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#020617",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  backButtonText: {
    color: "#eab308",
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 1,
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  switchTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  switchTabActive: {
    backgroundColor: "#eab308",
  },
  switchTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
  },
  switchTabTextActive: {
    color: "#020617",
    fontWeight: "900",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  heroCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#eab308",
    padding: 20,
    marginBottom: 16,
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  heroBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  heroBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroBadgeText: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  heroHint: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
  },
  heroValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#facc15",
    marginVertical: 4,
  },
  heroValueUnit: {
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: "600",
  },
  heroDescription: {
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 18,
    marginBottom: 16,
  },
  heroStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 12,
  },
  heroStatItem: {
    alignItems: "center",
    flex: 1,
  },
  heroStatValue: {
    fontSize: 15,
    fontWeight: "900",
    color: "#f8fafc",
  },
  heroStatLabel: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
    fontWeight: "600",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  metricIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
    textAlign: "center",
  },
  metricLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    fontWeight: "600",
    textAlign: "center",
  },
  metricTag: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  tagSuccessText: {
    color: "#4ade80",
    fontSize: 10,
    fontWeight: "800",
  },
  tagWarning: {
    backgroundColor: "rgba(249, 115, 22, 0.15)",
  },
  tagWarningText: {
    color: "#fb923c",
    fontSize: 10,
    fontWeight: "800",
  },
  tagGold: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
  },
  tagGoldText: {
    color: "#facc15",
    fontSize: 10,
    fontWeight: "800",
  },
  tagNeutral: {
    backgroundColor: "#1e293b",
  },
  metricTagText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700",
  },
  chartCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  chartEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: "#eab308",
    letterSpacing: 0.5,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#f8fafc",
    marginTop: 1,
  },
  chartSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 12,
  },
  peakPill: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  peakPillText: {
    color: "#f87171",
    fontSize: 11,
    fontWeight: "800",
  },
  goldPill: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  goldPillText: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "800",
  },
  barChartScroll: {
    paddingVertical: 8,
    gap: 8,
  },
  barColumn: {
    width: 32,
    alignItems: "center",
    justifyContent: "flex-end",
    height: 140,
  },
  barCountLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#eab308",
    marginBottom: 4,
    height: 12,
  },
  barTrack: {
    width: 14,
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  barFillPeak: {
    backgroundColor: "#ef4444",
  },
  barFillSelected: {
    backgroundColor: "#eab308",
  },
  barXLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 6,
    fontWeight: "700",
  },
  barXLabelPeak: {
    color: "#ef4444",
    fontWeight: "900",
  },
  barXLabelSelected: {
    color: "#eab308",
    fontWeight: "900",
  },
  selectionCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#eab308",
  },
  selectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f8fafc",
  },
  selectionText: {
    fontSize: 11,
    color: "#cbd5e1",
    marginTop: 2,
    lineHeight: 16,
  },
  weekdayList: {
    gap: 10,
  },
  weekdayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  weekdayRowSelected: {
    backgroundColor: "#1e293b",
  },
  weekdayLabelBox: {
    width: 65,
  },
  weekdayName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f8fafc",
  },
  weekdayNameBest: {
    color: "#facc15",
  },
  weekdaySessionsCount: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "600",
  },
  weekdayBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: "#1e293b",
    borderRadius: 6,
    overflow: "hidden",
  },
  weekdayBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 6,
  },
  weekdayBarFillBest: {
    backgroundColor: "#eab308",
  },
  weekdayEarnedBox: {
    width: 80,
    alignItems: "flex-end",
  },
  weekdayEarnedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
  },
  weekdayEarnedTextBest: {
    color: "#4ade80",
    fontWeight: "900",
  },
  historyContainer: {
    flex: 1,
  },
  historyTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historySummaryText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  pageIndicator: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
  },
  emptyText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  logsList: {
    gap: 10,
  },
  logCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  logCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  logIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  logIcon: {
    fontSize: 20,
  },
  logDetails: {
    flex: 1,
  },
  logTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },
  editionBadge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  editionBadgeText: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "700",
  },
  logDate: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  logPillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  durationPill: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  durationPillText: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "700",
  },
  pointsPill: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pointsPillText: {
    color: "#eab308",
    fontSize: 10,
    fontWeight: "800",
  },
  poopcoinsPill: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  poopcoinsPillText: {
    color: "#facc15",
    fontSize: 10,
    fontWeight: "800",
  },
  locationPill: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  locationPillText: {
    color: "#38bdf8",
    fontSize: 10,
    fontWeight: "700",
  },
  noteBox: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  noteText: {
    color: "#94a3b8",
    fontSize: 11,
    fontStyle: "italic",
  },
  logActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(30, 41, 59, 0.7)",
  },
  editBtn: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editBtnText: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "800",
  },
  deleteBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 62,
    alignItems: "center",
  },
  deleteBtnText: {
    color: "#f87171",
    fontSize: 11,
    fontWeight: "800",
  },
  logRight: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  logEarnedText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#4ade80",
  },
  logEarnedHint: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  pageBtnDisabled: {
    opacity: 0.4,
    borderColor: "#1e293b",
  },
  pageBtnText: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "800",
  },
  pageBtnTextDisabled: {
    color: "#64748b",
  },
  pageNumbersBox: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#0f172a",
    borderRadius: 8,
  },
  pageNumbersText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },

  // Edit Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0b1329",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#f8fafc",
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseBtnText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "bold",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#cbd5e1",
    marginBottom: 6,
  },
  timeInputsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeInputCol: {
    flex: 1,
  },
  timeInputSublabel: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 4,
    textAlign: "center",
  },
  timeTextInput: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 10,
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  timeColon: {
    fontSize: 20,
    fontWeight: "900",
    color: "#94a3b8",
    marginTop: 12,
  },
  quickChipsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  quickChip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  quickChipActive: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    borderColor: "#eab308",
  },
  quickChipText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  quickChipTextActive: {
    color: "#facc15",
    fontWeight: "800",
  },
  noteTextInput: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 10,
    color: "#f8fafc",
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: "top",
  },
  previewBox: {
    marginTop: 14,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
  },
  previewBoxTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94a3b8",
    marginBottom: 8,
  },
  previewStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  previewStatItem: {
    alignItems: "center",
  },
  previewStatLabel: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 2,
  },
  previewStatVal: {
    fontSize: 12,
    fontWeight: "900",
    color: "#f8fafc",
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  modalCancelBtnText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#eab308",
    alignItems: "center",
  },
  modalSaveBtnText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "900",
  },
});
