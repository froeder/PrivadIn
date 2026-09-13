import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
} from "react-native";
import type {
  AnnualEstimate,
  HourlyBucket,
  WeekdayBucket,
} from "../utils/analytics";

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// -------------------------------------------------------------
// 1. CompanyCostCard (A FIRMA PAGA)
// -------------------------------------------------------------
export interface CompanyCostCardProps {
  estimate: AnnualEstimate;
  hourlyRate: number;
  style?: ViewStyle;
}

export function CompanyCostCard({
  estimate,
  hourlyRate,
  style,
}: CompanyCostCardProps) {
  return (
    <View style={[styles.heroCard, style]}>
      <View style={styles.heroBadgeRow}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>💸 A FIRMA PAGA</Text>
        </View>
        <Text style={styles.heroHint}>252 dias úteis / ano</Text>
      </View>

      <Text style={styles.heroTitle}>Estimativa Anual no Trono</Text>
      <Text style={styles.heroValue}>
        {formatCurrency(estimate.annualCost)}
        <Text style={styles.heroValueUnit}> /ano</Text>
      </Text>
      <Text style={styles.heroDescription}>
        Projeção estimada do valor que a firma transfere para o seu bolso durante
        as pausas fisiológicas corporativas.
      </Text>

      <View style={styles.heroStatsGrid}>
        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatValue}>
            {estimate.averageDailyMinutes} min
          </Text>
          <Text style={styles.heroStatLabel}>Média Diária</Text>
        </View>

        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatValue}>
            {estimate.annualBathroomHours} h
          </Text>
          <Text style={styles.heroStatLabel}>Horas Anuais</Text>
        </View>

        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatValue}>{formatCurrency(hourlyRate)}</Text>
          <Text style={styles.heroStatLabel}>Sua Taxa/Hora</Text>
        </View>
      </View>
    </View>
  );
}

// -------------------------------------------------------------
// 2. HourlyFrequencyChart
// -------------------------------------------------------------
export interface HourlyFrequencyChartProps {
  buckets: HourlyBucket[];
  peakHour: number | null;
  peakCount: number;
  style?: ViewStyle;
}

export function HourlyFrequencyChart({
  buckets,
  peakHour,
  peakCount,
  style,
}: HourlyFrequencyChartProps) {
  const [selectedHour, setSelectedHour] = useState<HourlyBucket | null>(null);
  const maxCount = Math.max(1, peakCount);

  return (
    <View style={[styles.chartCard, style]}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartEyebrow}>DISTRIBUIÇÃO HORÁRIA</Text>
          <Text style={styles.chartTitle}>Horários Mais Frequentes do Dia</Text>
        </View>
        {peakHour !== null && (
          <View style={styles.peakPill}>
            <Text style={styles.peakPillText}>
              🔥 Pico: {String(peakHour).padStart(2, "0")}h ({peakCount})
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.chartSubtitle}>
        Toque em uma barra para inspecionar os registros por hora:
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.barChartScroll}
      >
        {buckets.map((b) => {
          const heightPercent =
            b.count > 0 ? Math.max(16, (b.count / maxCount) * 100) : 6;
          const isPeak = peakHour !== null && b.hour === peakHour;
          const isSelected = selectedHour?.hour === b.hour;

          return (
            <TouchableOpacity
              key={b.hour}
              style={styles.barColumn}
              onPress={() => setSelectedHour(isSelected ? null : b)}
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
  );
}

// -------------------------------------------------------------
// 3. WeekdayProfitChart
// -------------------------------------------------------------
export interface WeekdayProfitChartProps {
  buckets: WeekdayBucket[];
  bestDay: WeekdayBucket | null;
  style?: ViewStyle;
}

export function WeekdayProfitChart({
  buckets,
  bestDay,
  style,
}: WeekdayProfitChartProps) {
  const [selectedDay, setSelectedDay] = useState<WeekdayBucket | null>(null);
  const maxEarned = Math.max(1, ...buckets.map((b) => b.earnedAmount));

  return (
    <View style={[styles.chartCard, style]}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartEyebrow}>RENTABILIDADE SEMANAL</Text>
          <Text style={styles.chartTitle}>Dias Mais Rentáveis da Semana</Text>
        </View>
        {bestDay && bestDay.earnedAmount > 0 && (
          <View style={styles.goldPill}>
            <Text style={styles.goldPillText}>
              🏆 {bestDay.label}: {formatCurrency(bestDay.earnedAmount)}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.chartSubtitle}>
        Lucro estimado gerado em cada dia da semana:
      </Text>

      <View style={styles.weekdayRow}>
        {buckets.map((b) => {
          const heightPercent =
            b.earnedAmount > 0
              ? Math.max(16, (b.earnedAmount / maxEarned) * 100)
              : 6;
          const isBest = bestDay && b.dayIndex === bestDay.dayIndex && b.earnedAmount > 0;
          const isSelected = selectedDay?.dayIndex === b.dayIndex;

          return (
            <TouchableOpacity
              key={b.dayIndex}
              style={styles.weekdayCol}
              onPress={() => setSelectedDay(isSelected ? null : b)}
              activeOpacity={0.7}
            >
              <Text style={styles.weekdayCountText}>
                {b.count > 0 ? `${b.count}` : "-"}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${heightPercent}%` },
                    isBest && styles.barFillGold,
                    isSelected && styles.barFillSelected,
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.barXLabel,
                  isBest && styles.barXLabelGold,
                  isSelected && styles.barXLabelSelected,
                ]}
              >
                {b.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedDay && (
        <View style={styles.selectionCard}>
          <Text style={styles.selectionTitle}>{selectedDay.label}</Text>
          <Text style={styles.selectionText}>
            {selectedDay.count} sessões registradas com retorno de{" "}
            {formatCurrency(selectedDay.earnedAmount)}.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "rgba(234, 179, 8, 0.35)",
    marginBottom: 16,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  heroBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  heroBadgeText: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "900",
  },
  heroHint: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  heroTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroValue: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 2,
  },
  heroValueUnit: {
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: "600",
  },
  heroDescription: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  heroStatsGrid: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
    justifyContent: "space-around",
  },
  heroStatItem: {
    alignItems: "center",
  },
  heroStatValue: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
  },
  heroStatLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  chartEyebrow: {
    color: "#eab308",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  chartTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  chartSubtitle: {
    color: "#64748b",
    fontSize: 11,
    marginBottom: 14,
  },
  peakPill: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  peakPillText: {
    color: "#ef4444",
    fontSize: 10,
    fontWeight: "800",
  },
  goldPill: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  goldPillText: {
    color: "#eab308",
    fontSize: 10,
    fontWeight: "800",
  },
  barChartScroll: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 6,
    alignItems: "flex-end",
    height: 140,
  },
  barColumn: {
    alignItems: "center",
    width: 28,
  },
  barCountLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 90,
    backgroundColor: "#1e293b",
    borderRadius: 7,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 7,
  },
  barFillPeak: {
    backgroundColor: "#ef4444",
  },
  barFillGold: {
    backgroundColor: "#eab308",
  },
  barFillSelected: {
    backgroundColor: "#facc15",
  },
  barXLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 6,
  },
  barXLabelPeak: {
    color: "#ef4444",
    fontWeight: "800",
  },
  barXLabelGold: {
    color: "#eab308",
    fontWeight: "800",
  },
  barXLabelSelected: {
    color: "#f8fafc",
    fontWeight: "800",
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
    paddingBottom: 6,
  },
  weekdayCol: {
    alignItems: "center",
    flex: 1,
  },
  weekdayCountText: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 4,
  },
  selectionCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  selectionTitle: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 2,
  },
  selectionText: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
  },
});
