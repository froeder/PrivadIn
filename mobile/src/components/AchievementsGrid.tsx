import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
} from "react-native";
import { AchievementBadge } from "../utils/achievements";

interface AchievementsGridProps {
  achievements: AchievementBadge[];
}

export default function AchievementsGrid({ achievements }: AchievementsGridProps) {
  const [selectedBadge, setSelectedBadge] = useState<AchievementBadge | null>(null);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const overallPercentage =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Header & Overall Progress */}
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>METAS CORPORATIVAS</Text>
            <Text style={styles.title}>🏆 Sistema de Conquistas</Text>
          </View>
          <View style={styles.counterBadge}>
            <Text style={styles.counterBadgeText}>
              {unlockedCount} / {totalCount}
            </Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          Badges desbloqueáveis por pontuação, horários de expediente e consistência diária:
        </Text>

        {/* Global Progress Bar */}
        <View style={styles.overallTrack}>
          <View
            style={[styles.overallFill, { width: `${overallPercentage}%` }]}
          />
        </View>
        <View style={styles.overallMeta}>
          <Text style={styles.overallMetaText}>
            {overallPercentage}% da carreira completada
          </Text>
          <Text style={styles.overallMetaHint}>Toque em um badge para ver requisitos</Text>
        </View>
      </View>

      {/* Grid of Badges */}
      <View style={styles.grid}>
        {achievements.map((badge) => {
          return (
            <TouchableOpacity
              key={badge.id}
              style={[
                styles.badgeCard,
                badge.unlocked ? styles.badgeCardUnlocked : styles.badgeCardLocked,
              ]}
              onPress={() => setSelectedBadge(badge)}
              activeOpacity={0.75}
            >
              {/* Icon Container with glowing or muted ring */}
              <View
                style={[
                  styles.iconBox,
                  badge.unlocked
                    ? { backgroundColor: `${badge.levelColor}22`, borderColor: badge.levelColor }
                    : styles.iconBoxLocked,
                ]}
              >
                <Text style={[styles.iconText, !badge.unlocked && styles.iconTextLocked]}>
                  {badge.icon}
                </Text>
                {!badge.unlocked && (
                  <View style={styles.lockPill}>
                    <Text style={styles.lockText}>🔒</Text>
                  </View>
                )}
              </View>

              {/* Title and Short Progress */}
              <Text
                style={[styles.badgeTitle, !badge.unlocked && styles.badgeTitleLocked]}
                numberOfLines={1}
              >
                {badge.title}
              </Text>

              <Text
                style={[styles.badgeProgressSnippet, badge.unlocked && styles.badgeProgressSnippetDone]}
                numberOfLines={1}
              >
                {badge.progressText}
              </Text>

              {/* Mini progress bar */}
              <View style={styles.miniTrack}>
                <View
                  style={[
                    styles.miniFill,
                    {
                      width: `${badge.progressPercent}%`,
                      backgroundColor: badge.unlocked ? badge.levelColor : "#64748b",
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Detail Modal */}
      {selectedBadge && (
        <Modal
          visible={Boolean(selectedBadge)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedBadge(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View
                style={[
                  styles.modalIconBox,
                  {
                    backgroundColor: selectedBadge.unlocked
                      ? `${selectedBadge.levelColor}25`
                      : "#334155",
                    borderColor: selectedBadge.unlocked
                      ? selectedBadge.levelColor
                      : "#475569",
                  },
                ]}
              >
                <Text style={styles.modalIconText}>{selectedBadge.icon}</Text>
              </View>

              <Text style={styles.modalTitle}>{selectedBadge.title}</Text>
              <View
                style={[
                  styles.modalStatusBadge,
                  selectedBadge.unlocked
                    ? styles.statusUnlocked
                    : styles.statusLocked,
                ]}
              >
                <Text
                  style={[
                    styles.modalStatusText,
                    selectedBadge.unlocked
                      ? styles.statusUnlockedText
                      : styles.statusLockedText,
                  ]}
                >
                  {selectedBadge.unlocked
                    ? "✨ Conquista Desbloqueada"
                    : "🔒 Em Andamento"}
                </Text>
              </View>

              <Text style={styles.modalDescription}>
                {selectedBadge.description}
              </Text>

              <View style={styles.requirementCard}>
                <Text style={styles.requirementHeader}>🎯 Requisito da Meta:</Text>
                <Text style={styles.requirementText}>
                  {selectedBadge.requirementHint}
                </Text>
                <View style={styles.modalProgressMeta}>
                  <Text style={styles.modalProgressLabel}>Progresso Atual:</Text>
                  <Text style={styles.modalProgressVal}>
                    {selectedBadge.progressText}
                  </Text>
                </View>
                <View style={styles.modalTrack}>
                  <View
                    style={[
                      styles.modalFill,
                      {
                        width: `${selectedBadge.progressPercent}%`,
                        backgroundColor: selectedBadge.unlocked
                          ? selectedBadge.levelColor
                          : "#eab308",
                      },
                    ]}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedBadge(null)}
              >
                <Text style={styles.closeBtnText}>Entendi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardHeader: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
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
  counterBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  counterBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fde047",
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    marginBottom: 12,
  },
  overallTrack: {
    height: 8,
    backgroundColor: "#0f172a",
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155",
  },
  overallFill: {
    height: "100%",
    backgroundColor: "#eab308",
    borderRadius: 6,
  },
  overallMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  overallMetaText: {
    fontSize: 11,
    color: "#eab308",
    fontWeight: "700",
  },
  overallMetaHint: {
    fontSize: 10,
    color: "#64748b",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgeCard: {
    width: "48%",
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  badgeCardUnlocked: {
    borderColor: "rgba(234, 179, 8, 0.3)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
  badgeCardLocked: {
    borderColor: "#1e293b",
    opacity: 0.65,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 8,
    position: "relative",
  },
  iconBoxLocked: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
  },
  iconText: {
    fontSize: 22,
  },
  iconTextLocked: {
    opacity: 0.5,
  },
  lockPill: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    paddingHorizontal: 2,
  },
  lockText: {
    fontSize: 10,
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 4,
  },
  badgeTitleLocked: {
    color: "#94a3b8",
  },
  badgeProgressSnippet: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
    marginBottom: 8,
  },
  badgeProgressSnippetDone: {
    color: "#10b981",
    fontWeight: "700",
  },
  miniTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "#1e293b",
    borderRadius: 2,
    overflow: "hidden",
  },
  miniFill: {
    height: "100%",
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 12,
  },
  modalIconText: {
    fontSize: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 6,
  },
  modalStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 12,
  },
  statusUnlocked: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusLocked: {
    backgroundColor: "rgba(100, 116, 139, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.3)",
  },
  modalStatusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statusUnlockedText: {
    color: "#10b981",
  },
  statusLockedText: {
    color: "#94a3b8",
  },
  modalDescription: {
    fontSize: 13,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  requirementCard: {
    width: "100%",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 16,
  },
  requirementHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#eab308",
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    color: "#f8fafc",
    lineHeight: 16,
    marginBottom: 10,
  },
  modalProgressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalProgressLabel: {
    fontSize: 11,
    color: "#94a3b8",
  },
  modalProgressVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fde047",
  },
  modalTrack: {
    height: 6,
    backgroundColor: "#1e293b",
    borderRadius: 3,
    overflow: "hidden",
  },
  modalFill: {
    height: "100%",
    borderRadius: 3,
  },
  closeBtn: {
    width: "100%",
    backgroundColor: "#eab308",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
});
