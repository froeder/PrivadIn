import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { AppUser, CuiterPost, CuiterReactionType } from "../types";
import {
  CUITER_MAX_CHARS,
  DEFAULT_CUITER_POST_COST,
  createCuiterPost,
  fetchCuiterPostCost,
  formatTimeAgo,
  subscribeCuiterFeed,
  togglePostReaction,
} from "../services/cuiterService";
import { formatPoopcoins } from "../services/poopcoinService";
import UserProfileModal from "../components/UserProfileModal";
import TransferPoopcoinsModal from "../components/TransferPoopcoinsModal";
import CuiterThreadModal from "../components/CuiterThreadModal";

interface CuiterScreenProps {
  user: AppUser;
  onRefreshUser: () => void;
  onNavigateToPoopcoins?: () => void;
}

export default function CuiterScreen({
  user,
  onRefreshUser,
  onNavigateToPoopcoins,
}: CuiterScreenProps) {
  const [posts, setPosts] = useState<CuiterPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [postCost, setPostCost] = useState(DEFAULT_CUITER_POST_COST);

  // Profile modal state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  // Transfer modal state
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState<AppUser | null>(null);

  // Reaction processing state (to prevent rapid double-taps)
  const [reactingPostId, setReactingPostId] = useState<string | null>(null);

  // Thread modal state
  const [threadPost, setThreadPost] = useState<CuiterPost | null>(null);
  const [threadModalVisible, setThreadModalVisible] = useState(false);

  // Sync threadPost if posts feed updates
  useEffect(() => {
    if (threadPost) {
      const updated = posts.find((p) => p.id === threadPost.id);
      if (updated) {
        setThreadPost(updated);
      }
    }
  }, [posts]);



  const handleOpenThread = (post: CuiterPost) => {
    setThreadPost(post);
    setThreadModalVisible(true);
  };

  // Load post cost
  useEffect(() => {
    fetchCuiterPostCost().then(setPostCost);
  }, []);

  // Subscribe to real-time feed
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeCuiterFeed(
      (feedPosts) => {
        setPosts(feedPosts);
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    const cost = await fetchCuiterPostCost();
    setPostCost(cost);
    onRefreshUser();
    // feed will auto-refresh through snapshot, but give a 600ms grace period for UX
    setTimeout(() => setRefreshing(false), 600);
  };

  const handlePublish = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      Alert.alert("Aviso", "Escreva um pensamento para postar no Cuiter.");
      return;
    }

    if (trimmed.length > CUITER_MAX_CHARS) {
      Alert.alert("Aviso", `O limite é de ${CUITER_MAX_CHARS} caracteres.`);
      return;
    }

    const currentBalance = Number(user.poopcoinBalance ?? 0);
    if (currentBalance < postCost) {
      Alert.alert(
        "Saldo Insuficiente",
        `Postar no Cuiter custa ${formatPoopcoins(postCost)} PC. Seu saldo é de ${formatPoopcoins(currentBalance)} PC.`,
        [
          { text: "Entendi", style: "cancel" },
          onNavigateToPoopcoins
            ? {
                text: "Ver Moedas",
                onPress: onNavigateToPoopcoins,
              }
            : { text: "OK" },
        ]
      );
      return;
    }

    setPublishing(true);
    try {
      await createCuiterPost(user, trimmed);
      setMessage("");
      onRefreshUser();
      Alert.alert("Sucesso! 🐦", "Seu pensamento do trono foi publicado no feed!");
    } catch (error: any) {
      console.error("Erro ao publicar no Cuiter:", error);
      Alert.alert("Erro ao Publicar", error.message || "Não foi possível publicar seu pensamento.");
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleReaction = async (postId: string, type: CuiterReactionType) => {
    if (reactingPostId === postId) return;
    setReactingPostId(postId);

    // Optimistic UI update
    setPosts((prevPosts) =>
      prevPosts.map((p) => {
        if (p.id !== postId) return p;
        const currentReactions = { ...(p.reactions || {}) };
        if (currentReactions[user.uid] === type) {
          delete currentReactions[user.uid];
        } else {
          currentReactions[user.uid] = type;
        }
        return { ...p, reactions: currentReactions };
      })
    );

    try {
      await togglePostReaction(postId, user.uid, type);
    } catch (error) {
      console.error("Erro ao reagir ao post:", error);
    } finally {
      setReactingPostId(null);
    }
  };

  const handleOpenAuthorProfile = (authorId: string) => {
    setSelectedUserId(authorId);
    setProfileModalVisible(true);
  };

  const handleOpenTransferToColleague = (colleague: AppUser) => {
    setTransferRecipient(colleague);
    setTransferModalVisible(true);
  };

  const currentBalance = Number(user.poopcoinBalance ?? 0);
  const canPost = currentBalance >= postCost;
  const charsRemaining = CUITER_MAX_CHARS - message.length;

  const renderPostItem = ({ item }: { item: CuiterPost }) => {
    const reactions = item.reactions || {};
    let likeCount = 0;
    let poopCount = 0;
    let laughCount = 0;

    Object.values(reactions).forEach((reactionType) => {
      if (reactionType === "like") likeCount++;
      else if (reactionType === "poop") poopCount++;
      else if (reactionType === "laugh") laughCount++;
    });

    const userReaction = reactions[user.uid];

    return (
      <View style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.authorRow}
            onPress={() => handleOpenAuthorProfile(item.userId)}
            activeOpacity={0.7}
          >
            <View style={styles.authorAvatarCircle}>
              <Text style={styles.authorAvatarText}>
                {item.userBadge
                  ? item.userBadge
                  : (item.userName || "C").charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.authorInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {item.userName}
                </Text>
                {item.userTitle ? (
                  <View style={styles.postTitleBadge}>
                    <Text style={styles.postTitleText} numberOfLines={1}>
                      {item.userTitle}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.postTimeText}>
                {formatTimeAgo(item.createdAt)}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.postCostBadge}>
            <Text style={styles.postCostText}>🪙 1 PC</Text>
          </View>
        </View>

        {/* Post Body */}
        <Text style={styles.postMessage}>{item.message}</Text>

        {/* Reactions Bar */}
        <View style={styles.reactionsBar}>
          {/* Curtir */}
          <TouchableOpacity
            style={[
              styles.reactionButton,
              userReaction === "like" && styles.reactionButtonActive,
            ]}
            onPress={() => handleToggleReaction(item.id, "like")}
            activeOpacity={0.7}
          >
            <Text style={styles.reactionEmoji}>❤️</Text>
            {likeCount > 0 && (
              <Text
                style={[
                  styles.reactionCount,
                  userReaction === "like" && styles.reactionCountActive,
                ]}
              >
                {likeCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Cocô */}
          <TouchableOpacity
            style={[
              styles.reactionButton,
              userReaction === "poop" && styles.reactionButtonActive,
            ]}
            onPress={() => handleToggleReaction(item.id, "poop")}
            activeOpacity={0.7}
          >
            <Text style={styles.reactionEmoji}>💩</Text>
            {poopCount > 0 && (
              <Text
                style={[
                  styles.reactionCount,
                  userReaction === "poop" && styles.reactionCountActive,
                ]}
              >
                {poopCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Risada */}
          <TouchableOpacity
            style={[
              styles.reactionButton,
              userReaction === "laugh" && styles.reactionButtonActive,
            ]}
            onPress={() => handleToggleReaction(item.id, "laugh")}
            activeOpacity={0.7}
          >
            <Text style={styles.reactionEmoji}>😂</Text>
            {laughCount > 0 && (
              <Text
                style={[
                  styles.reactionCount,
                  userReaction === "laugh" && styles.reactionCountActive,
                ]}
              >
                {laughCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Comentários / Tópico */}
          <TouchableOpacity
            style={styles.commentButton}
            onPress={() => handleOpenThread(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.commentEmoji}>💬</Text>
            <Text style={styles.commentCount}>
              {item.commentsCount && item.commentsCount > 0
                ? item.commentsCount
                : "Responder"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.feedHeaderContainer}>
      {/* Top Banner */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerTop}>
          <View>
            <Text style={styles.bannerEyebrow}>FEED SOCIAL DO TRONO</Text>
            <Text style={styles.bannerTitle}>🐦 Cuiter</Text>
          </View>
          <View style={styles.bannerIconBox}>
            <Text style={styles.bannerIcon}>🚽</Text>
          </View>
        </View>
        <Text style={styles.bannerDescription}>
          Compartilhe pensamentos direto do vaso sanitário corporativo. Cada post queima Poopcoins!
        </Text>
      </View>

      {/* Composer Card */}
      <View style={styles.composerCard}>
        <View style={styles.composerTopRow}>
          <View style={styles.composerUserRow}>
            <View style={styles.composerAvatar}>
              <Text style={styles.composerAvatarText}>
                {user.equippedBadge
                  ? user.equippedBadge
                  : (user.name || "C").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.composerUserName}>
                {user.nickname?.trim() || user.name || "Você"}
              </Text>
              <Text style={styles.composerBalanceText}>
                Saldo: {formatPoopcoins(currentBalance)} PC
              </Text>
            </View>
          </View>

          <View style={styles.costBadge}>
            <Text style={styles.costBadgeText}>
              🪙 Custo: {formatPoopcoins(postCost)} PC
            </Text>
          </View>
        </View>

        <TextInput
          style={styles.composerInput}
          placeholder="O que você está pensando no trono agora? (máx 80 caracteres)"
          placeholderTextColor="#64748b"
          value={message}
          onChangeText={(val) => {
            if (val.length <= CUITER_MAX_CHARS) {
              setMessage(val);
            }
          }}
          multiline
          maxLength={CUITER_MAX_CHARS}
          editable={!publishing}
        />

        <View style={styles.composerFooter}>
          <Text
            style={[
              styles.charCounter,
              charsRemaining <= 10 && styles.charCounterWarning,
            ]}
          >
            {charsRemaining} caracteres restantes
          </Text>

          <TouchableOpacity
            style={[
              styles.publishButton,
              (!message.trim() || publishing || !canPost) && styles.publishButtonDisabled,
            ]}
            onPress={handlePublish}
            disabled={!message.trim() || publishing || !canPost}
            activeOpacity={0.8}
          >
            {publishing ? (
              <ActivityIndicator size="small" color="#020617" />
            ) : (
              <>
                <Text style={styles.publishButtonIcon}>🐦</Text>
                <Text style={styles.publishButtonText}>Publicar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {!canPost && (
          <View style={styles.insufficientBalanceWarning}>
            <Text style={styles.warningText}>
              ⚠️ Saldo insuficiente ({formatPoopcoins(currentBalance)}/{formatPoopcoins(postCost)} PC). Registre pausas no Trono ou transfira para postar!
            </Text>
            {onNavigateToPoopcoins && (
              <TouchableOpacity
                style={styles.warningButton}
                onPress={onNavigateToPoopcoins}
              >
                <Text style={styles.warningButtonText}>Ir para Moedas 🪙</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Feed Divider / Title */}
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineTitle}>Linha do Tempo ao Vivo</Text>
        <Text style={styles.timelineSubtitle}>
          {posts.length} {posts.length === 1 ? "pensamento" : "pensamentos"}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#eab308" />
          <Text style={styles.loadingText}>Sintonizando a rede do trono...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPostItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#eab308"
              colors={["#eab308"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyFeed}>
              <Text style={styles.emptyFeedIcon}>🐦</Text>
              <Text style={styles.emptyFeedTitle}>Silêncio no banheiro...</Text>
              <Text style={styles.emptyFeedSubtitle}>
                Nenhum pensamento foi postado ainda. Seja o pioneiro e publique seu pensamento do trono acima!
              </Text>
            </View>
          }
        />
      )}

      {/* Colleague User Profile Modal */}
      <UserProfileModal
        visible={profileModalVisible}
        userId={selectedUserId}
        currentUserId={user.uid}
        onClose={() => {
          setProfileModalVisible(false);
          setSelectedUserId(null);
        }}
        onOpenTransfer={handleOpenTransferToColleague}
      />

      {/* Transfer Poopcoins Modal */}
      <TransferPoopcoinsModal
        visible={transferModalVisible}
        currentUser={user}
        onClose={() => {
          setTransferModalVisible(false);
          setTransferRecipient(null);
        }}
        onSuccess={() => {
          onRefreshUser();
          handleRefresh();
        }}
      />

      {/* Cuiter Thread Modal */}
      <CuiterThreadModal
        visible={threadModalVisible}
        post={threadPost}
        currentUser={user}
        onClose={() => {
          setThreadModalVisible(false);
          setThreadPost(null);
        }}
        onOpenAuthorProfile={handleOpenAuthorProfile}
        onToggleReaction={handleToggleReaction}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#020617",
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  feedHeaderContainer: {
    marginBottom: 16,
  },
  bannerCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  bannerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  bannerEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#eab308",
    letterSpacing: 0.8,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#f8fafc",
    marginTop: 2,
  },
  bannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  bannerIcon: {
    fontSize: 22,
  },
  bannerDescription: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  composerCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  composerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  composerUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  composerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e293b",
    borderWidth: 1.5,
    borderColor: "#eab308",
    alignItems: "center",
    justifyContent: "center",
  },
  composerAvatarText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#eab308",
  },
  composerUserName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },
  composerBalanceText: {
    fontSize: 11,
    color: "#eab308",
    fontWeight: "600",
  },
  costBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  costBadgeText: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "800",
  },
  composerInput: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    padding: 12,
    color: "#f8fafc",
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  composerFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  charCounter: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  charCounterWarning: {
    color: "#f87171",
    fontWeight: "700",
  },
  publishButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eab308",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  publishButtonDisabled: {
    opacity: 0.5,
  },
  publishButtonIcon: {
    fontSize: 15,
  },
  publishButtonText: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "800",
  },
  insufficientBalanceWarning: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
  },
  warningText: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  warningButton: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  warningButtonText: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "700",
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginTop: 8,
  },
  timelineTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f8fafc",
  },
  timelineSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  postCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  authorAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1e293b",
    borderWidth: 1.5,
    borderColor: "#eab308",
    alignItems: "center",
    justifyContent: "center",
  },
  authorAvatarText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#eab308",
  },
  authorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  authorName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },
  postTitleBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  postTitleText: {
    fontSize: 10,
    color: "#facc15",
    fontWeight: "700",
  },
  postTimeText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  postCostBadge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  postCostText: {
    fontSize: 11,
    color: "#eab308",
    fontWeight: "700",
  },
  commentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: "auto",
  },
  commentEmoji: {
    fontSize: 14,
  },
  commentCount: {
    fontSize: 12,
    color: "#38bdf8",
    fontWeight: "700",
  },
  postMessage: {
    fontSize: 15,
    color: "#f1f5f9",
    lineHeight: 22,
    marginBottom: 14,
  },
  reactionsBar: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  reactionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  reactionButtonActive: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderColor: "#eab308",
  },
  reactionEmoji: {
    fontSize: 15,
  },
  reactionCount: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "700",
  },
  reactionCountActive: {
    color: "#facc15",
  },
  emptyFeed: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyFeedIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyFeedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 6,
  },
  emptyFeedSubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
});
