import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export interface MetricCardProps {
  icon: string;
  label: string;
  value: React.ReactNode;
  hint?: string;
  style?: ViewStyle;
}

export function MetricCard({
  icon,
  label,
  value,
  hint,
  style,
}: MetricCardProps) {
  return (
    <Card style={style}>
      <View style={styles.metricRow}>
        <View style={styles.metricLeft}>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text style={styles.metricValue}>{value}</Text>
          {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
        </View>
        <View style={styles.metricIconBox}>
          <Text style={styles.metricIcon}>{icon}</Text>
        </View>
      </View>
    </Card>
  );
}

export default Card;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  metricLeft: {
    flex: 1,
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  metricValue: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  metricHint: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 4,
  },
  metricIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  metricIcon: {
    fontSize: 20,
  },
});
