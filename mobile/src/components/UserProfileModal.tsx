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
import { AppUser, CuiterPost } from "../types";
import { fetchUserCuiterPosts, fetchUserProfile, formatTimeAgo } from "../services/cuiterService";
import { formatPoopcoins } from "../services/poopcoinService";
import UserAvatar from "./UserAvatar";

interface UserProfileModalProps {
  visible: boolean;
  userId: string | null;
  currentUserId: string;
  onClose: () => void;
  onOpenTransfer?: (recipientUser: AppUser) => void;
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

  useEffect(() => {
    if (!visible || !userId) {
      setProfileUser(null);
      setUserPosts([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    async function loadData() {
      try {
        const [userDoc, posts] = await Promise.all([
          fetchUserProfile(userId!),
          fetchUserCuiterPosts(userId!, 8),
        ]);
        if (isMounted) {
          setProfileUser(userDoc);
          setUserPosts(posts);
        }
      } catch (error) {
        console.error("Erro ao carregar perfil do colega:", error);
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
            <Text style={styles.modalTitle}>Perfil do Colega</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#eab308" />
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
                  size={84}
                  borderColor="#eab308"
                  borderWidth={3}
                  backgroundColor="#1e293b"
                  textColor="#eab308"
                  fontSize={36}
                />

                <Text style={styles.userName}>
                  {profileUser.nickname?.trim() || profileUser.name || "Cagador Anônimo"}
                </Text>

                {profileUser.nickname && profileUser.name ? (
                  <Text style={styles.userFullName}>{profileUser.name}</Text>
                ) : null}

                {profileUser.equippedTitle ? (
                  <View style={styles.titleBadge}>
                    <Text style={styles.titleText}>👑 {profileUser.equippedTitle}</Text>
                  </View>
                ) : null}

                {profileUser.role === "admin" && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>🛡️ Administrador</Text>
                  </View>
                )}
              </View>

              {/* Stats Grid */}
              <View style={styles.statsCard}>
                <Text style={styles.statsCardTitle}>Estatísticas de Carreira</Text>
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
                    <Text style={styles.statLabel}>Dias Seguidos</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {profileUser.currentWeeklyStreak || 0} ⚡
                    </Text>
                    <Text style={styles.statLabel}>Semanas Seguidas</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {formatPoopcoins(profileUser.poopcoinBalance || 0)} 🪙
                    </Text>
                    <Text style={styles.statLabel}>Poopcoins</Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {userPosts.length} 🐦
                    </Text>
                    <Text style={styles.statLabel}>Pensamentos</Text>
                  </View>
                </View>
              </View>

              {/* Bio Section */}
              {profileUser.bio ? (
                <View style={styles.bioSection}>
                  <Text style={styles.bioTitle}>Biografia</Text>
                  <Text style={styles.bioText}>"{profileUser.bio}"</Text>
                </View>
              ) : null}

              {/* Action Button: Transfer Poopcoins (if not self) */}
              {!isSelf && onOpenTransfer && (
                <TouchableOpacity
                  style={styles.transferButton}
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

              {/* Recent Thoughts Section */}
              <View style={styles.thoughtsSection}>
                <View style={styles.thoughtsHeader}>
                  <Text style={styles.thoughtsTitle}>Pensamentos no Trono 🐦</Text>
                  <Text style={styles.thoughtsCount}>
                    {userPosts.length} {userPosts.length === 1 ? "post" : "posts"}
                  </Text>
                </View>

                {userPosts.length === 0 ? (
                  <View style={styles.emptyThoughts}>
                    <Text style={styles.emptyThoughtsText}>
                      Este colega ainda não publicou nenhum pensamento no Cuiter.
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
    maxHeight: "90%",
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
    marginBottom: 20,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1e293b",
    borderWidth: 3,
    borderColor: "#eab308",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#eab308",
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
  },
  userFullName: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  titleBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
  },
  titleText: {
    color: "#facc15",
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
  statsCard: {
    backgroundColor: "#1e293b",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statsCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
  bioSection: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  bioTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bioText: {
    fontSize: 13,
    color: "#f1f5f9",
    fontStyle: "italic",
    lineHeight: 19,
  },
  transferButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eab308",
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 20,
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
  thoughtsSection: {
    marginTop: 4,
  },
  thoughtsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  thoughtsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
  },
  thoughtsCount: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  emptyThoughts: {
    padding: 20,
    backgroundColor: "#1e293b",
    borderRadius: 14,
    alignItems: "center",
  },
  emptyThoughtsText: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
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
});
