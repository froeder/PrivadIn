import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { toRoman } from "../utils/roman";

interface PoopRewardModalProps {
  visible: boolean;
  onClose: () => void;
  points: number;
  poopcoins: number;
  durationSeconds: number;
  earnedAmount: number;
  streak: number;
  edition?: number;
}

export default function PoopRewardModal({
  visible,
  onClose,
  points,
  poopcoins,
  durationSeconds,
  earnedAmount,
  streak,
  edition = 1,
}: PoopRewardModalProps) {
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🚽✨</Text>
          </View>

          <Text style={styles.title}>TRONO CONCLUÍDO!</Text>
          <Text style={styles.subtitle}>
            Sua pausa sagrada foi remunerada e computada na firma.
          </Text>

          {/* Edition Tag */}
          <View style={styles.editionBadge}>
            <Text style={styles.editionText}>
              👑 EDIÇÃO {toRoman(edition)}
            </Text>
          </View>

          {/* Rewards Grid */}
          <View style={styles.rewardsGrid}>
            <View style={[styles.rewardItem, styles.rewardItemAccent]}>
              <Text style={styles.rewardIcon}>🏆</Text>
              <Text style={styles.rewardValue}>+{points.toLocaleString("pt-BR")}</Text>
              <Text style={styles.rewardLabel}>Pontos na Edição</Text>
            </View>

            <View style={[styles.rewardItem, styles.rewardItemCoins]}>
              <Text style={styles.rewardIcon}>🪙</Text>
              <Text style={styles.rewardValue}>+{poopcoins} PC</Text>
              <Text style={styles.rewardLabel}>Poopcoin Minerada</Text>
            </View>
          </View>

          {/* Secondary stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statRow}>
              <Text style={styles.statRowLabel}>⏱️ Duração da Sessão:</Text>
              <Text style={styles.statRowValue}>{formatTime(durationSeconds)}</Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statRowLabel}>💰 Faturado no Expediente:</Text>
              <Text style={[styles.statRowValue, { color: "#10b981" }]}>
                R$ {earnedAmount.toFixed(2).replace(".", ",")}
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statRowLabel}>🔥 Sequência Atual:</Text>
              <Text style={[styles.statRowValue, { color: "#f59e0b" }]}>
                {streak} {streak === 1 ? "dia" : "dias"}
              </Text>
            </View>
          </View>

          {/* Button */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>🎉 GLÓRIA AO TRONO</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: Math.min(width - 40, 380),
    backgroundColor: "#0f172a",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    padding: 24,
    alignItems: "center",
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 2,
    borderColor: "#eab308",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  iconEmoji: {
    fontSize: 34,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  editionBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderColor: "rgba(234, 179, 8, 0.5)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  editionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#facc15",
    letterSpacing: 0.5,
  },
  rewardsGrid: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginBottom: 16,
  },
  rewardItem: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  rewardItemAccent: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  rewardItemCoins: {
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  rewardIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  rewardValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
  },
  rewardLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    fontWeight: "600",
  },
  statsContainer: {
    width: "100%",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statRowLabel: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
  },
  statRowValue: {
    fontSize: 13,
    color: "#f8fafc",
    fontWeight: "700",
  },
  confirmButton: {
    width: "100%",
    backgroundColor: "#eab308",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
