import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import type { AppUser, RankedUser } from "../types";
import UserAvatar from "./UserAvatar";
import { medalFor, titleFor } from "../utils/ranking";

export interface RankingListProps {
  users: (RankedUser | AppUser)[];
  mode?: "overall" | "weekly";
  currentUid?: string;
  onViewProfile?: (uid: string) => void;
  onTipUser?: (user: AppUser) => void;
  style?: ViewStyle;
}

export default function RankingList({
  users,
  mode = "overall",
  currentUid,
  onViewProfile,
  onTipUser,
  style,
}: RankingListProps) {
  // Sort users based on mode
  const sorted = [...users].sort((a: any, b: any) => {
    if (mode === "weekly") {
      const rankA = a.weeklyRank ?? 999;
      const rankB = b.weeklyRank ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      return (b.weeklyPoints ?? 0) - (a.weeklyPoints ?? 0);
    }
    const rankA = a.rank ?? 999;
    const rankB = b.rank ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    return (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
  });

  return (
    <View style={[styles.container, style]}>
      {sorted.map((user: any, index) => {
        const rank =
          mode === "weekly"
            ? user.weeklyRank ?? index + 1
            : user.rank ?? index + 1;
        const points =
          mode === "weekly"
            ? user.weeklyPoints ?? 0
            : user.totalPoints ?? 0;

        const isCurrentUser = user.uid === currentUid;
        const isTop3 = rank <= 3;

        return (
          <TouchableOpacity
            key={user.uid}
            style={[
              styles.itemRow,
              isTop3 && styles.itemRowTop3,
              isCurrentUser && styles.itemRowSelf,
            ]}
            onPress={() => onViewProfile?.(user.uid)}
            activeOpacity={onViewProfile ? 0.75 : 1}
            disabled={!onViewProfile}
          >
            {/* Rank / Medal Badge */}
            <View
              style={[
                styles.medalBox,
                rank === 1 && styles.medalBoxGold,
                rank === 2 && styles.medalBoxSilver,
                rank === 3 && styles.medalBoxBronze,
              ]}
            >
              <Text style={styles.medalEmoji}>{medalFor(rank)}</Text>
              {rank > 3 && <Text style={styles.rankNumberText}>#{rank}</Text>}
            </View>

            {/* Avatar */}
            <UserAvatar
              avatar={user.avatar}
              badge={user.equippedBadge}
              name={user.name}
              size={42}
              borderColor={
                rank === 1
                  ? "#eab308"
                  : rank === 2
                  ? "#94a3b8"
                  : rank === 3
                  ? "#b45309"
                  : "#334155"
              }
              borderWidth={isTop3 ? 2 : 1}
            />

            {/* Info */}
            <View style={styles.infoCol}>
              <View style={styles.nameRow}>
                <Text
                  style={[
                    styles.userName,
                    isCurrentUser && styles.userNameSelf,
                  ]}
                  numberOfLines={1}
                >
                  {user.name || "Competidor"}
                </Text>
                {isCurrentUser && (
                  <View style={styles.selfChip}>
                    <Text style={styles.selfChipText}>VOCÊ</Text>
                  </View>
                )}
              </View>

              {user.nickname?.trim() ? (
                <Text style={styles.userNickname} numberOfLines={1}>
                  {user.nickname.trim()}
                </Text>
              ) : null}

              <Text style={styles.rankTitle} numberOfLines={1}>
                {user.equippedTitle || titleFor(rank)}
              </Text>
            </View>

            {/* Points & Actions */}
            <View style={styles.pointsCol}>
              <Text style={styles.pointsValue}>
                {Number(points).toLocaleString("pt-BR")}
              </Text>
              <Text style={styles.pointsUnit}>pontos</Text>

              {onTipUser && !isCurrentUser && (
                <TouchableOpacity
                  style={styles.tipBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onTipUser(user);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tipBtnText}>🪙 Gorjeta</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 12,
    gap: 12,
  },
  itemRowTop3: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderColor: "rgba(234, 179, 8, 0.25)",
  },
  itemRowSelf: {
    borderColor: "#eab308",
    backgroundColor: "rgba(234, 179, 8, 0.08)",
  },
  medalBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  medalBoxGold: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.5)",
  },
  medalBoxSilver: {
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.5)",
  },
  medalBoxBronze: {
    backgroundColor: "rgba(180, 83, 9, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.5)",
  },
  medalEmoji: {
    fontSize: 18,
  },
  rankNumberText: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "800",
    marginTop: -2,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userName: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
  },
  userNameSelf: {
    color: "#facc15",
  },
  selfChip: {
    backgroundColor: "rgba(234, 179, 8, 0.25)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  selfChipText: {
    color: "#eab308",
    fontSize: 9,
    fontWeight: "900",
  },
  userNickname: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1,
  },
  rankTitle: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 1,
  },
  pointsCol: {
    alignItems: "flex-end",
  },
  pointsValue: {
    color: "#eab308",
    fontSize: 17,
    fontWeight: "900",
  },
  pointsUnit: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
  },
  tipBtn: {
    marginTop: 4,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.25)",
  },
  tipBtnText: {
    color: "#eab308",
    fontSize: 10,
    fontWeight: "800",
  },
});
