import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import { AppUser, CuiterComment, CuiterPost, CuiterReactionType } from "../types";
import {
  CUITER_MAX_CHARS,
  createCuiterComment,
  deleteCuiterComment,
  formatTimeAgo,
  subscribeCuiterComments,
} from "../services/cuiterService";

interface CuiterThreadModalProps {
  visible: boolean;
  post: CuiterPost | null;
  currentUser: AppUser;
  onClose: () => void;
  onOpenAuthorProfile: (userId: string) => void;
  onToggleReaction: (postId: string, type: CuiterReactionType) => void;
}

export default function CuiterThreadModal({
  visible,
  post,
  currentUser,
  onClose,
  onOpenAuthorProfile,
  onToggleReaction,
}: CuiterThreadModalProps) {
  const [comments, setComments] = useState<CuiterComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    userName: string;
  } | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible || !post) {
      setComments([]);
      setReplyText("");
      setReplyingTo(null);
      return;
    }

    setLoadingComments(true);
    const unsubscribe = subscribeCuiterComments(
      post.id,
      (loadedComments) => {
        setComments(loadedComments);
        setLoadingComments(false);
      },
      () => {
        setLoadingComments(false);
      }
    );

    return () => unsubscribe();
  }, [visible, post?.id]);

  if (!post) return null;

  const handleSendComment = async () => {
    const trimmed = replyText.trim();
    if (!trimmed) {
      Alert.alert("Aviso", "Escreva uma resposta para enviar.");
      return;
    }
    if (trimmed.length > CUITER_MAX_CHARS) {
      Alert.alert("Aviso", `O limite é de ${CUITER_MAX_CHARS} caracteres.`);
      return;
    }

    setSending(true);
    try {
      await createCuiterComment(post.id, currentUser, trimmed, replyingTo);
      setReplyText("");
      setReplyingTo(null);
      // Rola para o final da lista após enviar
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    } catch (error: any) {
      console.error("Erro ao enviar resposta no Cuiter:", error);
      Alert.alert("Erro", error.message || "Não foi possível enviar a resposta.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = (comment: CuiterComment) => {
    Alert.alert(
      "Excluir Comentário",
      "Deseja realmente apagar esta resposta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCuiterComment(post.id, comment.id);
            } catch (error: any) {
              Alert.alert("Erro", error.message || "Não foi possível apagar a resposta.");
            }
          },
        },
      ]
    );
  };

  // Reactions calculations for main post
  const reactions = post.reactions || {};
  let likeCount = 0;
  let poopCount = 0;
  let laughCount = 0;
  Object.values(reactions).forEach((reactionType) => {
    if (reactionType === "like") likeCount++;
    else if (reactionType === "poop") poopCount++;
    else if (reactionType === "laugh") laughCount++;
  });
  const userReaction = reactions[currentUser.uid];

  const renderHeader = () => (
    <View style={styles.headerPostContainer}>
      {/* Post Original Card */}
      <View style={styles.originalPostCard}>
        <View style={styles.postHeaderRow}>
          <TouchableOpacity
            style={styles.authorRow}
            onPress={() => onOpenAuthorProfile(post.userId)}
            activeOpacity={0.7}
          >
            <View style={styles.authorAvatarCircle}>
              <Text style={styles.authorAvatarText}>
                {post.userBadge
                  ? post.userBadge
                  : (post.userName || "C").charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.authorInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {post.userName}
                </Text>
                {post.userTitle ? (
                  <View style={styles.postTitleBadge}>
                    <Text style={styles.postTitleText} numberOfLines={1}>
                      {post.userTitle}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.postTimeText}>
                {formatTimeAgo(post.createdAt)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Message */}
        <Text style={styles.postMessage}>{post.message}</Text>

        {/* Reactions in Thread Header */}
        <View style={styles.threadReactionsBar}>
          <TouchableOpacity
            style={[
              styles.reactionButton,
              userReaction === "like" && styles.reactionButtonActive,
            ]}
            onPress={() => onToggleReaction(post.id, "like")}
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

          <TouchableOpacity
            style={[
              styles.reactionButton,
              userReaction === "poop" && styles.reactionButtonActive,
            ]}
            onPress={() => onToggleReaction(post.id, "poop")}
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

          <TouchableOpacity
            style={[
              styles.reactionButton,
              userReaction === "laugh" && styles.reactionButtonActive,
            ]}
            onPress={() => onToggleReaction(post.id, "laugh")}
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
        </View>
      </View>

      {/* Replies Divider */}
      <View style={styles.repliesTitleRow}>
        <Text style={styles.repliesTitle}>Respostas Encadeadas</Text>
        <View style={styles.repliesBadge}>
          <Text style={styles.repliesBadgeText}>
            {comments.length} {comments.length === 1 ? "resposta" : "respostas"}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderCommentItem = ({ item }: { item: CuiterComment }) => {
    const isCommentOwner = item.userId === currentUser.uid;
    const canDelete = isCommentOwner || currentUser.role === "admin";
    const isReplyingToThis = replyingTo?.commentId === item.id;

    return (
      <View
        style={[
          styles.commentCard,
          item.replyToUserName ? styles.commentCardIndented : null,
          isReplyingToThis ? styles.commentCardReplying : null,
        ]}
      >
        {/* Encadeamento / Chained Header */}
        {item.replyToUserName && (
          <View style={styles.replyChainTag}>
            <Text style={styles.replyChainTagIcon}>↳</Text>
            <Text style={styles.replyChainTagText}>
              Em resposta a{" "}
              <Text style={styles.replyChainTarget}>@{item.replyToUserName}</Text>
            </Text>
          </View>
        )}

        <View style={styles.commentHeader}>
          <TouchableOpacity
            style={styles.commentAuthorRow}
            onPress={() => onOpenAuthorProfile(item.userId)}
            activeOpacity={0.7}
          >
            <View style={styles.commentAvatarCircle}>
              <Text style={styles.commentAvatarText}>
                {item.userBadge
                  ? item.userBadge
                  : (item.userName || "C").charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.commentAuthorInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.commentAuthorName} numberOfLines={1}>
                  {item.userName}
                </Text>
                {item.userTitle ? (
                  <View style={styles.commentTitleBadge}>
                    <Text style={styles.commentTitleText} numberOfLines={1}>
                      {item.userTitle}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.commentTimeText}>
                {formatTimeAgo(item.createdAt)}
              </Text>
            </View>
          </TouchableOpacity>

          {canDelete && (
            <TouchableOpacity
              style={styles.deleteCommentButton}
              onPress={() => handleDeleteComment(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteCommentText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Message */}
        <Text style={styles.commentMessage}>{item.message}</Text>

        {/* Reply Action button */}
        <View style={styles.commentFooter}>
          <TouchableOpacity
            style={styles.replyActionButton}
            onPress={() =>
              setReplyingTo({
                commentId: item.id,
                userName: item.userName,
              })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.replyActionIcon}>💬</Text>
            <Text style={styles.replyActionText}>Responder</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const charsRemaining = CUITER_MAX_CHARS - replyText.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Modal Top Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕ Fechar</Text>
          </TouchableOpacity>

          <Text style={styles.navTitle}>Tópico do Cuit 🐦</Text>

          <View style={styles.navPlaceholder} />
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          {loadingComments ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#eab308" />
              <Text style={styles.loadingText}>Carregando respostas...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={renderCommentItem}
              ListHeaderComponent={renderHeader}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyCommentsBox}>
                  <Text style={styles.emptyCommentsIcon}>💭</Text>
                  <Text style={styles.emptyCommentsTitle}>
                    Nenhuma resposta ainda
                  </Text>
                  <Text style={styles.emptyCommentsSubtitle}>
                    Inicie a conversa no banheiro! Envie a primeira resposta do trono abaixo.
                  </Text>
                </View>
              }
            />
          )}

          {/* Fixed Footer: Reply Input Box */}
          <View style={styles.inputContainer}>
            {replyingTo && (
              <View style={styles.replyingToBanner}>
                <View style={styles.replyingToLeft}>
                  <Text style={styles.replyingToIcon}>💬</Text>
                  <Text style={styles.replyingToText}>
                    Respondendo a{" "}
                    <Text style={styles.replyingToTarget}>
                      @{replyingTo.userName}
                    </Text>
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelReplyButton}
                  onPress={() => setReplyingTo(null)}
                >
                  <Text style={styles.cancelReplyText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                placeholder={
                  replyingTo
                    ? `Responda a @${replyingTo.userName}...`
                    : "Responda a este Cuit..."
                }
                placeholderTextColor="#64748b"
                value={replyText}
                onChangeText={(val) => {
                  if (val.length <= CUITER_MAX_CHARS) {
                    setReplyText(val);
                  }
                }}
                maxLength={CUITER_MAX_CHARS}
                editable={!sending}
              />

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!replyText.trim() || sending) && styles.sendButtonDisabled,
                ]}
                onPress={handleSendComment}
                disabled={!replyText.trim() || sending}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#020617" />
                ) : (
                  <Text style={styles.sendButtonText}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputFooterInfo}>
              <Text
                style={[
                  styles.charCounter,
                  charsRemaining <= 10 && styles.charCounterWarning,
                ]}
              >
                {charsRemaining} caracteres restantes
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  keyboardContainer: {
    flex: 1,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#1e293b",
  },
  closeButtonText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  navTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
  },
  navPlaceholder: {
    width: 65,
  },
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  headerPostContainer: {
    marginBottom: 16,
  },
  originalPostCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
    padding: 16,
    marginBottom: 16,
  },
  postHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  authorAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    borderWidth: 1.5,
    borderColor: "#eab308",
    alignItems: "center",
    justifyContent: "center",
  },
  authorAvatarText: {
    fontSize: 18,
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
    fontSize: 15,
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
  postMessage: {
    fontSize: 16,
    color: "#f1f5f9",
    lineHeight: 24,
    marginBottom: 14,
  },
  threadReactionsBar: {
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
  repliesTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  repliesTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
  },
  repliesBadge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  repliesBadgeText: {
    fontSize: 11,
    color: "#38bdf8",
    fontWeight: "700",
  },
  commentCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  commentCardIndented: {
    marginLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#38bdf8",
  },
  commentCardReplying: {
    borderColor: "#eab308",
  },
  replyChainTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  replyChainTagIcon: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "900",
  },
  replyChainTagText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },
  replyChainTarget: {
    color: "#38bdf8",
    fontWeight: "700",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  commentAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  commentAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#38bdf8",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#38bdf8",
  },
  commentAuthorInfo: {
    flex: 1,
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f8fafc",
  },
  commentTitleBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  commentTitleText: {
    fontSize: 9,
    color: "#38bdf8",
    fontWeight: "700",
  },
  commentTimeText: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 1,
  },
  deleteCommentButton: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  deleteCommentText: {
    fontSize: 12,
  },
  commentMessage: {
    fontSize: 14,
    color: "#e2e8f0",
    lineHeight: 20,
    marginBottom: 8,
  },
  commentFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  replyActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  replyActionIcon: {
    fontSize: 11,
  },
  replyActionText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "700",
  },
  emptyCommentsBox: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCommentsIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyCommentsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
  },
  emptyCommentsSubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 16,
  },
  inputContainer: {
    backgroundColor: "#0f172a",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    padding: 12,
  },
  replyingToBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  replyingToLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  replyingToIcon: {
    fontSize: 12,
  },
  replyingToText: {
    fontSize: 12,
    color: "#cbd5e1",
    fontWeight: "600",
  },
  replyingToTarget: {
    color: "#38bdf8",
    fontWeight: "800",
  },
  cancelReplyButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cancelReplyText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: "#eab308",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#020617",
    fontSize: 13,
    fontWeight: "800",
  },
  inputFooterInfo: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  charCounter: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  charCounterWarning: {
    color: "#f87171",
    fontWeight: "700",
  },
});
