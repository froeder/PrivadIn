import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { AppUser } from "../types";
import { toRoman } from "../utils/roman";

export const SHARE_CARD_WIDTH = 540;
const PADDING = 20;
const HEADER_HEIGHT = 110;
const FOOTER_HEIGHT = 37;
const ROW_HEIGHT = 46;
export const SHARE_RANKING_LIMIT = 10;

export function getShareCardHeight(userCount: number): number {
  const rows = Math.max(Math.min(userCount, SHARE_RANKING_LIMIT), 1);
  return HEADER_HEIGHT + PADDING + rows * ROW_HEIGHT + FOOTER_HEIGHT;
}

function medalFor(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "🏅";
}

interface Props {
  users: AppUser[];
  edition: number;
  currentUserId?: string;
}

/**
 * Cartão visual do ranking semanal (mesmo layout da imagem gerada no PWA).
 * É renderizado fora da tela e capturado como PNG via react-native-view-shot.
 */
const RankingShareCard = forwardRef<View, Props>(({ users, edition, currentUserId }, ref) => {
  const top = users.slice(0, SHARE_RANKING_LIMIT);
  const height = getShareCardHeight(users.length);

  return (
    <View
      ref={ref}
      collapsable={false}
      pointerEvents="none"
      style={[styles.card, { height }]}
    >
      <View style={styles.glow} />
      <Text style={styles.watermark}>🚽</Text>

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.brand}>PRIVADIN</Text>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {top.length}/{users.length}
            </Text>
          </View>
        </View>
        <Text style={styles.title}>Ranking semanal</Text>
        <Text style={styles.edition}>Edição {toRoman(edition)}</Text>
      </View>

      <View style={styles.board}>
        {top.length === 0 ? (
          <Text style={styles.empty}>Sem jogadores no ranking ainda.</Text>
        ) : (
          top.map((u, i) => {
            const rank = i + 1;
            const isMe = u.uid === currentUserId;
            const nickname = u.nickname?.trim();
            const secondary = [nickname, isMe ? "você" : ""].filter(Boolean).join(" • ");
            return (
              <View key={u.uid} style={[styles.row, isMe && styles.rowMe]}>
                <View style={styles.medalBox}>
                  <Text style={styles.medal}>{medalFor(rank)}</Text>
                </View>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{rank}</Text>
                </View>
                <View style={styles.nameCol}>
                  <Text style={styles.name} numberOfLines={1}>
                    {u.name || "Cagador Anônimo"}
                  </Text>
                  <Text style={styles.secondary} numberOfLines={1}>
                    {secondary || " "}
                  </Text>
                </View>
                <View style={styles.pointsCol}>
                  <Text style={styles.points}>
                    {(u.weeklyPoints || 0).toLocaleString("pt-BR")}
                  </Text>
                  <Text style={styles.pointsLabel}>pontos</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      <Text style={styles.footer}>Top {top.length} da semana</Text>
    </View>
  );
});

RankingShareCard.displayName = "RankingShareCard";
export default RankingShareCard;

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: -5000,
    top: 0,
    width: SHARE_CARD_WIDTH,
    backgroundColor: "#111827",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(245, 158, 11, 0.18)",
  },
  watermark: {
    position: "absolute",
    top: 50,
    right: 40,
    fontSize: 80,
    opacity: 0.1,
  },
  header: { height: HEADER_HEIGHT, paddingHorizontal: PADDING, paddingTop: 22 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#facc15", fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  counter: {
    paddingHorizontal: 12,
    height: 25,
    borderRadius: 13,
    justifyContent: "center",
    backgroundColor: "rgba(250, 204, 21, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.28)",
  },
  counterText: { color: "#fef3c7", fontSize: 14, fontWeight: "700" },
  title: { color: "#f8fafc", fontSize: 32, fontWeight: "900", marginTop: 8 },
  edition: { color: "#cbd5e1", fontSize: 14, fontWeight: "500", marginTop: 2 },
  board: {
    marginHorizontal: PADDING,
    marginTop: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  empty: { color: "#f8fafc", fontSize: 18, fontWeight: "700", padding: 16 },
  row: {
    height: ROW_HEIGHT - 6,
    marginVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
  },
  rowMe: {
    backgroundColor: "rgba(20, 184, 166, 0.18)",
    borderColor: "rgba(45, 212, 191, 0.55)",
  },
  medalBox: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  medal: { fontSize: 14 },
  rankBadge: {
    marginLeft: 9,
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    backgroundColor: "rgba(250, 204, 21, 0.15)",
  },
  rankText: { color: "#facc15", fontSize: 11, fontWeight: "700" },
  nameCol: { flex: 1, marginLeft: 9, marginRight: 8 },
  name: { color: "#f8fafc", fontSize: 14, fontWeight: "900" },
  secondary: { color: "#94a3b8", fontSize: 10, fontWeight: "600" },
  pointsCol: { alignItems: "flex-end" },
  points: { color: "#facc15", fontSize: 15, fontWeight: "900" },
  pointsLabel: { color: "#cbd5e1", fontSize: 9, fontWeight: "700" },
  footer: {
    position: "absolute",
    left: PADDING,
    bottom: 12,
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
  },
});
