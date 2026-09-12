import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { AppUser, CuiterPost, PoopLog } from "../types";
import { fetchUserCuiterPosts, fetchUserProfile, formatTimeAgo } from "../services/cuiterService";
import { formatPoopcoins } from "../services/poopcoinService";
import { getUserLogs } from "../services/poopService";
import UserAvatar from "./UserAvatar";

interface UserProfileModalProps {
  visible: boolean;
  userId: string | null;
  currentUserId: string;
  onClose: () => void;
  onOpenTransfer?: (recipientUser: AppUser) => void;
}

interface AchievementBadge {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  levelColor: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
}

export default function UserProfileModal({
  visible,
  userId,
  currentUserId,
  onClose,
  onOpenTransfer,
}: UserProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [profileUser, setProfileUser] = useState<AppUser | null>(null);
  const [userPosts, setUserPosts] = useState<CuiterPost[]>([]);
  const [userLogs, setUserLogs] = useState<PoopLog[]>([]);
  const [activeTab, setActiveTab] = useState<"stats" | "history" | "cuiter">("stats");

  useEffect(() => {
    if (!visible || !userId) {
      setProfileUser(null);
      setUserPosts([]);
      setUserLogs([]);
      setActiveTab("stats");
      return;
    }

    let isMounted = true;
    setLoading(true);

    async function loadData() {
      try {
        const [userDoc, posts, logs] = await Promise.all([
          fetchUserProfile(userId!),
          fetchUserCuiterPosts(userId!, 10),
          getUserLogs(userId!, 10),
        ]);
        if (isMounted) {
          setProfileUser(userDoc);
          setUserPosts(posts);
          setUserLogs(logs);
        }
      } catch (error) {
        console.error("Erro ao carregar perfil público do colega:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [visible, userId]);

  if (!visible) return null;

  const isSelf = currentUserId === userId;
  const themeColor = profileUser?.themeColor || "#eab308";

  // Calculate dynamic achievement medals
  const achievements: AchievementBadge[] = profileUser
    ? [
        {
          id: "pioneer",
          icon: "🚽",
          title: "Pioneiro do Trono",
          description: "Iniciou sua jornada remunerada no PrivadIn",
          unlocked: (profileUser.totalPoints || 0) > 0 || userLogs.length > 0,
          levelColor: "#38bdf8",
        },
        {
          id: "streak_3",
          icon: "🔥",
          title: "Cagador Fiel",
          description: "Manteve uma sequência de pelo menos 3 dias",
          unlocked: (profileUser.currentDailyStreak || 0) >= 3 || (profileUser.bestStreak || 0) >= 3,
          levelColor: "#f97316",
        },
        {
          id: "streak_7",
          icon: "⚡",
          title: "Mestre do Relâmpago",
          description: "Alcançou 7+ dias consecutivos de cagada remunerada",
          unlocked: (profileUser.currentDailyStreak || 0) >= 7 || (profileUser.bestStreak || 0) >= 7,
          levelColor: "#eab308",
        },
        {
          id: "points_100",
          icon: "👑",
          title: "Lorde das Fezes",
          description: "Superou 100 pontos acumulados no ranking",
          unlocked: (profileUser.totalPoints || 0) >= 100,
          levelColor: "#a855f7",
        },
        {
          id: "crypto_whale",
          icon: "🪙",
          title: "Magnata Poopcoin",
          description: "Possui mais de 10 Poopcoins em carteira",
          unlocked: (profileUser.poopcoinBalance || 0) >= 10,
          levelColor: "#10b981",
        },
        {
          id: "high_roller",
          icon: "💼",
          title: "Hora Nobre",
          description: "Valor de hora configurado acima de R$ 25/h",
          unlocked: (profileUser.hourlyRate || 0) >= 25,
          levelColor: "#ec4899",
        },
        {
          id: "speaker",
          icon: "🐦",
          title: "Filósofo de Banheiro",
          description: "Publicou pensamentos na comunidade Cuiter",
          unlocked: userPosts.length > 0,
          levelColor: "#38bdf8",
        },
        {
          id: "league_member",
          icon: "🏢",
          title: "Trabalhador em Equipe",
          description: "Membro de uma liga corporativa privada",
          unlocked: Boolean(profileUser.ownedGroupId),
          levelColor: "#64748b",
        },
      ]
    : [];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 20 }}>👤</Text>
              <Text style={styles.modalTitle}>
                {isSelf ? "Seu Perfil Público" : "Perfil do Colega"}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={themeColor} />
              <Text style={styles.loadingText}>Buscando dados no trono...</Text>
            </View>
          ) : !profileUser ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🚽</Text>
              <Text style={styles.emptyText}>Usuário não encontrado.</Text>
              <TouchableOpacity style={styles.backButton} onPress={onClose}>
                <Text style={styles.backButtonText}>Voltar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* User Avatar & Identity */}
              <View style={styles.identitySection}>
                <UserAvatar
                  avatar={profileUser.avatar}
                  badge={profileUser.equippedBadge}
                  name={profileUser.name}
                  size={86}
                  borderColor={themeColor}
                  borderWidth={3}
                  backgroundColor="#1e293b"
                  textColor={themeColor}
                  fontSize={36}
                />

                <Text style={styles.userName}>
                  {profileUser.nickname?.trim() || profileUser.name || "Cagador Anônimo"}
                </Text>

                {profileUser.nickname && profileUser.name ? (
                  <Text style={styles.userFullName}>{profileUser.name}</Text>
                ) : null}

                {profileUser.equippedTitle ? (
                  <View style={[styles.titleBadge, { borderColor: `${themeColor}60` }]}>
                    <Text style={[styles.titleText, { color: themeColor }]}>
                      👑 {profileUser.equippedTitle}
                    </Text>
                  </View>
                ) : null}

                {profileUser.role === "admin" && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>🛡️ Administrador</Text>
                  </View>
                )}

                {/* Bio */}
                {profileUser.bio ? (
                  <View style={styles.bioCard}>
                    <Text style={styles.bioText}>“{profileUser.bio}”</Text>
                  </View>
                ) : null}
              </View>

              {/* Action: Transfer button if viewing another user */}
              {!isSelf && onOpenTransfer && (
                <TouchableOpacity
                  style={[styles.transferButton, { backgroundColor: themeColor }]}
                  onPress={() => {
                    onClose();
                    onOpenTransfer(profileUser);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.transferButtonIcon}>💸</Text>
                  <Text style={styles.transferButtonText}>
                    Enviar Gorjeta em Poopcoins
                  </Text>
                </TouchableOpacity>
              )}

              {/* Navigation Tabs */}
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tabItem, activeTab === "stats" && styles.tabItemActive]}
                  onPress={() => setActiveTab("stats")}
                >
                  <Text
                    style={[
                      styles.tabItemText,
                      activeTab === "stats" && { color: themeColor, fontWeight: "800" },
                    ]}
                  >
                    🏆 Medalhas & Stats
                  </Text>
                  {activeTab === "stats" && (
                    <View style={[styles.activeIndicator, { backgroundColor: themeColor }]} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabItem, activeTab === "history" && styles.tabItemActive]}
                  onPress={() => setActiveTab("history")}
                >
                  <Text
                    style={[
                      styles.tabItemText,
                      activeTab === "history" && { color: themeColor, fontWeight: "800" },
                    ]}
                  >
                    📜 Sessões ({userLogs.length})
                  </Text>
                  {activeTab === "history" && (
                    <View style={[styles.activeIndicator, { backgroundColor: themeColor }]} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabItem, activeTab === "cuiter" && styles.tabItemActive]}
                  onPress={() => setActiveTab("cuiter")}
                >
                  <Text
                    style={[
                      styles.tabItemText,
                      activeTab === "cuiter" && { color: themeColor, fontWeight: "800" },
                    ]}
                  >
                    🐦 Cuiter ({userPosts.length})
                  </Text>
                  {activeTab === "cuiter" && (
                    <View style={[styles.activeIndicator, { backgroundColor: themeColor }]} />
                  )}
                </TouchableOpacity>
              </View>

              {/* TAB 1: STATS & MEDALS */}
              {activeTab === "stats" && (
                <View style={styles.tabContent}>
                  {/* Career Stats Grid */}
                  <View style={styles.statsCard}>
                    <Text style={styles.sectionHeading}>Estatísticas da Carreira</Text>
                    <View style={styles.statsGrid}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {formatPoopcoins(profileUser.totalPoints || 0)}
                        </Text>
                        <Text style={styles.statLabel}>🏆 Pontos Totais</Text>
                      </View>

                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {formatPoopcoins(profileUser.weeklyPoints || 0)}
                        </Text>
                        <Text style={styles.statLabel}>⚡ Esta Semana</Text>
                      </View>

                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {profileUser.currentDailyStreak || 0} 🔥
                        </Text>
                        <Text style={styles.statLabel}>Streak Diário</Text>
                      </View>

                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {profileUser.bestStreak || profileUser.currentDailyStreak || 0} ⭐
                        </Text>
                        <Text style={styles.statLabel}>Melhor Streak</Text>
                      </View>

                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {formatPoopcoins(profileUser.poopcoinBalance || 0)} 🪙
                        </Text>
                        <Text style={styles.statLabel}>Poopcoins</Text>
                      </View>

                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {userLogs.length} 🚽
                        </Text>
                        <Text style={styles.statLabel}>Sessões Salvas</Text>
                      </View>
                    </View>
                  </View>

                  {/* Badges / Medals Gallery */}
                  <View style={styles.medalsCard}>
                    <View style={styles.medalsHeader}>
                      <Text style={styles.sectionHeading}>Medalhas & Conquistas</Text>
                      <View style={styles.badgeCounter}>
                        <Text style={styles.badgeCounterText}>
                          {unlockedCount}/{achievements.length} Desbloqueadas
                        </Text>
                      </View>
                    </View>

                    <View style={styles.medalsGrid}>
                      {achievements.map((item) => (
                        <View
                          key={item.id}
                          style={[
                            styles.medalBadgeItem,
                            !item.unlocked && styles.medalBadgeItemLocked,
                          ]}
                        >
                          <View
                            style={[
                              styles.medalIconCircle,
                              item.unlocked
                                ? { borderColor: item.levelColor, backgroundColor: `${item.levelColor}15` }
                                : styles.medalIconCircleLocked,
                            ]}
                          >
                            <Text style={styles.medalIconText}>{item.icon}</Text>
                          </View>
                          <Text
                            style={[
                              styles.medalBadgeTitle,
                              !item.unlocked && styles.medalBadgeTitleLocked,
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text style={styles.medalBadgeDesc} numberOfLines={2}>
                            {item.description}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 2: PUBLIC SESSION HISTORY */}
              {activeTab === "history" && (
                <View style={styles.tabContent}>
                  <Text style={styles.sectionHeading}>Histórico Público de Sessões</Text>
                  <Text style={styles.sectionSubtext}>
                    Registros oficiais de tempo no trono validados pela empresa. Notas pessoais permanecem privadas.
                  </Text>

                  {userLogs.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyIconSmall}>🚽</Text>
                      <Text style={styles.emptyBoxText}>Nenhuma sessão registrada recentemente.</Text>
                    </View>
                  ) : (
                    userLogs.map((log, index) => {
                      const timeAgo = formatTimeAgo(log.createdAt);
                      return (
                        <View key={log.id || index} style={styles.logCard}>
                          <View style={styles.logLeft}>
                            <View style={styles.logIconBox}>
                              <Text style={{ fontSize: 18 }}>⏱️</Text>
                            </View>
                            <View>
                              <Text style={styles.logDuration}>
                                {formatDuration(log.durationSeconds || 0)} no Trono
                              </Text>
                              <Text style={styles.logTimeAgo}>{timeAgo}</Text>
                            </View>
                          </View>

                          <View style={styles.logRight}>
                            <View style={styles.pointsBadge}>
                              <Text style={styles.pointsBadgeText}>+{log.points || 10} pts</Text>
                            </View>
                            <Text style={styles.poopcoinsEarnedText}>
                              +{(log.poopcoinsEarned || 1)} 🪙
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* TAB 3: CUITER POSTS */}
              {activeTab === "cuiter" && (
                <View style={styles.tabContent}>
                  <Text style={styles.sectionHeading}>Pensamentos no Trono</Text>
                  <Text style={styles.sectionSubtext}>
                    Reflexões e insights compartilhados direto da cabine.
                  </Text>

                  {userPosts.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyIconSmall}>🐦</Text>
                      <Text style={styles.emptyBoxText}>
                        Este colega ainda não publicou no Cuiter.
                      </Text>
                    </View>
                  ) : (
                    userPosts.map((post) => (
                      <View key={post.id} style={styles.thoughtCard}>
                        <View style={styles.thoughtMeta}>
                          <Text style={styles.thoughtTime}>
                            {formatTimeAgo(post.createdAt)}
                          </Text>
                          <Text style={styles.thoughtSpendBadge}>🪙 1 PC</Text>
                        </View>
                        <Text style={styles.thoughtMessage}>{post.message}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#1e293b",
    maxHeight: "92%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingContainer: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#94a3b8",
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    padding: 48,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 15,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#f8fafc",
    fontWeight: "700",
  },
  scrollContent: {
    padding: 20,
  },
  identitySection: {
    alignItems: "center",
    marginBottom: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
    marginTop: 10,
  },
  userFullName: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  titleBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
  },
  titleText: {
    fontSize: 12,
    fontWeight: "800",
  },
  adminBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.4)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  adminBadgeText: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "700",
  },
  bioCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#334155",
    maxWidth: "90%",
  },
  bioText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
  },
  transferButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 18,
    gap: 8,
  },
  transferButtonIcon: {
    fontSize: 18,
  },
  transferButtonText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "800",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabItemActive: {},
  tabItemText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  activeIndicator: {
    position: "absolute",
    bottom: -1,
    left: 10,
    right: 10,
    height: 3,
    borderRadius: 2,
  },
  tabContent: {
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  sectionSubtext: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 14,
    lineHeight: 17,
  },
  statsCard: {
    backgroundColor: "#1e293b",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  statItem: {
    width: "48%",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f8fafc",
  },
  statLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "600",
  },
  medalsCard: {
    backgroundColor: "#1e293b",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  medalsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badgeCounter: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  badgeCounterText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
  },
  medalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  medalBadgeItem: {
    width: "48%",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  medalBadgeItemLocked: {
    opacity: 0.45,
    borderColor: "#1e293b",
  },
  medalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  medalIconCircleLocked: {
    borderColor: "#475569",
    backgroundColor: "#1e293b",
  },
  medalIconText: {
    fontSize: 20,
  },
  medalBadgeTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 2,
  },
  medalBadgeTitleLocked: {
    color: "#64748b",
  },
  medalBadgeDesc: {
    fontSize: 10,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 13,
  },
  logCard: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  logDuration: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },
  logTimeAgo: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  logRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  pointsBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  pointsBadgeText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "800",
  },
  poopcoinsEarnedText: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "700",
  },
  thoughtCard: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  thoughtMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  thoughtTime: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },
  thoughtSpendBadge: {
    fontSize: 10,
    color: "#eab308",
    fontWeight: "700",
  },
  thoughtMessage: {
    fontSize: 14,
    color: "#f8fafc",
    lineHeight: 20,
  },
  emptyBox: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  emptyIconSmall: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyBoxText: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
  },
});
