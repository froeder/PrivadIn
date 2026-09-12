import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { AppUser } from "../types";
import { getLeaderboard } from "../services/poopService";

export default function RankingScreen() {
  const [leaders, setLeaders] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaders = async () => {
    try {
      const data = await getLeaderboard(30);
      setLeaders(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaders();
  };

  const renderMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#eab308" />
        <Text style={styles.loadingText}>Carregando ranking dos mestres...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Hall da Fama</Text>
        <Text style={styles.subtitle}>Os maiores especialistas em cagada remunerada</Text>
      </View>

      <FlatList
        data={leaders}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eab308" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🚽</Text>
            <Text style={styles.emptyText}>Nenhum registro no ranking ainda.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.leaderCard,
              index === 0 && styles.leaderCardFirst,
              index < 3 && styles.leaderCardTop3,
            ]}
          >
            <View style={styles.positionBadge}>
              <Text
                style={[
                  styles.positionText,
                  index < 3 && styles.positionTextMedal,
                ]}
              >
                {renderMedal(index)}
              </Text>
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.name || "Cagador Anônimo"}
              </Text>
              <View style={styles.userMeta}>
                <Text style={styles.userStreak}>
                  🔥 {item.currentDailyStreak || 0} dias de sequência
                </Text>
              </View>
            </View>

            <View style={styles.scoreContainer}>
              <Text style={styles.scorePoints}>{item.totalPoints || 0}</Text>
              <Text style={styles.scoreLabel}>pts</Text>
            </View>
          </View>
        )}
      />
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
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  leaderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  leaderCardTop3: {
    borderColor: "#334155",
  },
  leaderCardFirst: {
    borderColor: "#eab308",
    backgroundColor: "rgba(234, 179, 8, 0.05)",
  },
  positionBadge: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  positionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  positionTextMedal: {
    fontSize: 20,
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc",
  },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  userStreak: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "600",
  },
  scoreContainer: {
    alignItems: "flex-end",
  },
  scorePoints: {
    fontSize: 17,
    fontWeight: "800",
    color: "#eab308",
  },
  scoreLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 50,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
  },
});
