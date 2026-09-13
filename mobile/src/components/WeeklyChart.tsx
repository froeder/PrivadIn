import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { DailyBucket } from "../utils/analytics";

interface WeeklyChartProps {
  buckets: DailyBucket[];
  officeHoursCount: number;
  totalSessions: number;
}

export default function WeeklyChart({
  buckets,
  officeHoursCount,
  totalSessions,
}: WeeklyChartProps) {
  const [selectedDay, setSelectedDay] = useState<DailyBucket | null>(null);

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const totalWeeklyPoints = buckets.reduce((sum, b) => sum + b.points, 0);
  const totalWeeklySessions = buckets.reduce((sum, b) => sum + b.count, 0);

  const officePercentage =
    totalSessions > 0 ? Math.round((officeHoursCount / totalSessions) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Chart Card */}
      <View style={styles.chartCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>DESEMPENHO SEMANAL</Text>
            <Text style={styles.title}>Volume por Dia (Últimos 7 Dias)</Text>
          </View>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsBadgeText}>
              ⚡ {totalWeeklyPoints.toLocaleString()} pts
            </Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          {totalWeeklySessions} {totalWeeklySessions === 1 ? "sessão" : "sessões"} nos últimos 7 dias. Toque para inspecionar:
        </Text>

        {/* Vertical Bars Container */}
        <View style={styles.barsRow}>
          {buckets.map((b, idx) => {
            const heightPercent =
              b.count > 0 ? Math.max(16, Math.min(100, (b.count / maxCount) * 100)) : 8;
            const isSelected = selectedDay?.dateStr === b.dateStr;

            return (
              <TouchableOpacity
                key={idx}
                style={styles.barCol}
                onPress={() => setSelectedDay(isSelected ? null : b)}
                activeOpacity={0.7}
              >
                {/* Count badge above bar */}
                <Text style={[styles.barCountLabel, b.count > 0 && styles.barCountLabelActive]}>
                  {b.count > 0 ? b.count : "-"}
                </Text>

                {/* Bar Track */}
                <View style={[styles.barTrack, isSelected && styles.barTrackSelected]}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${heightPercent}%` },
                      b.isToday && styles.barFillToday,
                      isSelected && styles.barFillSelected,
                    ]}
                  />
                </View>

                {/* Day label */}
                <Text
                  style={[
                    styles.barDayLabel,
                    b.isToday && styles.barDayLabelToday,
                    isSelected && styles.barDayLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {b.dayShort}
                </Text>

                {/* Date snippet */}
                <Text style={styles.barDateSnippet}>{b.dateStr.split("/")[0]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Day Info Card */}
        {selectedDay && (
          <View style={styles.selectedCard}>
            <View style={styles.selectedCardHeader}>
              <Text style={styles.selectedCardTitle}>
                📅 {selectedDay.dayShort} ({selectedDay.dateStr})
                {selectedDay.isToday ? " • Hoje" : ""}
              </Text>
              <TouchableOpacity onPress={() => setSelectedDay(null)}>
                <Text style={styles.selectedCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.selectedStatsRow}>
              <View style={styles.selectedStatItem}>
                <Text style={styles.selectedStatVal}>{selectedDay.count}</Text>
                <Text style={styles.selectedStatLbl}>Cagadas</Text>
              </View>
              <View style={styles.selectedStatItem}>
                <Text style={styles.selectedStatVal}>
                  {selectedDay.points.toLocaleString()}
                </Text>
                <Text style={styles.selectedStatLbl}>Pontos</Text>
              </View>
              <View style={styles.selectedStatItem}>
                <Text style={styles.selectedStatVal}>
                  R$ {selectedDay.earnedAmount.toFixed(2).replace(".", ",")}
                </Text>
                <Text style={styles.selectedStatLbl}>Faturado</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Office Hours (Expediente Corporativo) Card */}
      <View style={styles.officeCard}>
        <View style={styles.officeHeader}>
          <View style={styles.officeIconBox}>
            <Text style={styles.officeIcon}>💼</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>EXPEDIENTE CORPORATIVO</Text>
            <Text style={styles.officeTitle}>
              {officeHoursCount} {officeHoursCount === 1 ? "Sessão" : "Sessões"} em Horário Comercial
            </Text>
          </View>
        </View>

        <Text style={styles.officeDescription}>
          Cagadas remuneradas executadas entre 08:00 e 18:00 durante o expediente.
          Representam{" "}
          <Text style={styles.officeHighlight}>{officePercentage}%</Text> do seu histórico
          total de idas ao banheiro.
        </Text>

        {/* Office Progress Bar */}
        <View style={styles.officeProgressTrack}>
          <View style={[styles.officeProgressFill, { width: `${officePercentage}%` }]} />
        </View>
        <View style={styles.officeProgressMeta}>
          <Text style={styles.officeMetaText}>💼 {officeHoursCount} no trabalho</Text>
          <Text style={styles.officeMetaText}>
            🏠 {Math.max(0, totalSessions - officeHoursCount)} fora de hora
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  chartCard: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#eab308",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 16,
  },
  pointsBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  pointsBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fde047",
  },
  barsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 150,
    paddingTop: 10,
    paddingBottom: 4,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  barCountLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 6,
  },
  barCountLabelActive: {
    color: "#fde047",
    fontWeight: "800",
  },
  barTrack: {
    width: "70%",
    height: 90,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155",
  },
  barTrackSelected: {
    borderColor: "#eab308",
  },
  barFill: {
    width: "100%",
    backgroundColor: "#38bdf8",
    borderRadius: 6,
  },
  barFillToday: {
    backgroundColor: "#eab308",
  },
  barFillSelected: {
    backgroundColor: "#f59e0b",
  },
  barDayLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: 8,
  },
  barDayLabelToday: {
    color: "#fde047",
    fontWeight: "900",
  },
  barDayLabelSelected: {
    color: "#38bdf8",
  },
  barDateSnippet: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },
  selectedCard: {
    marginTop: 14,
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  selectedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  selectedCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f8fafc",
  },
  selectedCloseText: {
    fontSize: 14,
    color: "#64748b",
    paddingHorizontal: 4,
  },
  selectedStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  selectedStatItem: {
    alignItems: "center",
  },
  selectedStatVal: {
    fontSize: 15,
    fontWeight: "900",
    color: "#eab308",
  },
  selectedStatLbl: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
  },
  officeCard: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  officeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  officeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  officeIcon: {
    fontSize: 22,
  },
  officeTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#f8fafc",
  },
  officeDescription: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 19,
    marginBottom: 14,
  },
  officeHighlight: {
    fontWeight: "800",
    color: "#10b981",
  },
  officeProgressTrack: {
    height: 10,
    backgroundColor: "#0f172a",
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155",
  },
  officeProgressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 6,
  },
  officeProgressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  officeMetaText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
});
