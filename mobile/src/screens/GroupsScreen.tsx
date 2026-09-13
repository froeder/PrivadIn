import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { AppUser, RankingGroup } from "../types";
import UserProfileModal from "../components/UserProfileModal";
import TransferPoopcoinsModal from "../components/TransferPoopcoinsModal";
import {
  createGroup,
  joinGroup,
  getUserGroups,
  getGroupMembers,
  updateGroup,
  removeGroupMember,
  deleteGroup,
  GROUP_NAME_MAX_LENGTH,
  GROUP_DESCRIPTION_MAX_LENGTH,
  normalizeGroupName,
  normalizeGroupDescription,
} from "../services/groupService";

interface GroupsScreenProps {
  user: AppUser;
  onRefreshUser?: () => void;
}

function toRoman(num: number): string {
  const romanMap: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let n = Math.max(1, Math.floor(num));
  let result = "";
  for (const [val, letter] of romanMap) {
    while (n >= val) {
      result += letter;
      n -= val;
    }
  }
  return result || "I";
}

export default function GroupsScreen({ user, onRefreshUser }: GroupsScreenProps) {
  const [groups, setGroups] = useState<RankingGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState<AppUser | null>(null);

  // Create form
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Join form
  const [joinCode, setJoinCode] = useState("");

  // Admin edit form
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isAdminSectionOpen, setIsAdminSectionOpen] = useState(false);

  // Ranking view mode: weekly (default) or overall
  const [rankingMode, setRankingMode] = useState<"weekly" | "overall">("weekly");

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || groups[0] || null;
  const isOwner = selectedGroup ? selectedGroup.ownerId === user.uid : false;
  const isAdmin = isOwner || user.role === "admin";
  const userOwnedGroup = groups.find((g) => g.ownerId === user.uid) || null;

  // Load groups
  const loadGroups = useCallback(
    async (preferredGroupId?: string) => {
      try {
        const userGroups = await getUserGroups(user.uid);
        setGroups(userGroups);

        if (userGroups.length > 0) {
          const targetId =
            preferredGroupId && userGroups.some((g) => g.id === preferredGroupId)
              ? preferredGroupId
              : selectedGroupId && userGroups.some((g) => g.id === selectedGroupId)
              ? selectedGroupId
              : userGroups[0].id;

          setSelectedGroupId(targetId);
        } else {
          setSelectedGroupId(null);
          setMembers([]);
        }
      } catch (err) {
        console.error("Erro ao carregar grupos:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user.uid, selectedGroupId]
  );

  // Load members when selectedGroup changes
  const loadGroupMembers = useCallback(
    async (group: RankingGroup) => {
      try {
        const groupMembers = await getGroupMembers(group.memberIds, rankingMode);
        setMembers(groupMembers);
        setEditName(group.name);
        setEditDescription(group.description || "");
      } catch (err) {
        console.error("Erro ao carregar membros do grupo:", err);
      }
    },
    [rankingMode]
  );

  useEffect(() => {
    loadGroups();
  }, [user.uid]);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMembers(selectedGroup);
    }
  }, [selectedGroup?.id, selectedGroup?.memberCount, rankingMode]);

  // Sort members in real-time based on rankingMode
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const ptsA = (rankingMode === "weekly" ? a.weeklyPoints : a.totalPoints) ?? 0;
      const ptsB = (rankingMode === "weekly" ? b.weeklyPoints : b.totalPoints) ?? 0;
      if (ptsB !== ptsA) return ptsB - ptsA;
      return (b.currentDailyStreak ?? 0) - (a.currentDailyStreak ?? 0);
    });
  }, [members, rankingMode]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    if (onRefreshUser) onRefreshUser();
  };

  // Copy Group ID
  const handleCopyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    } catch (_err) {
      Alert.alert("Código", code);
    }
  };

  // Share Group Code
  const handleShareCode = async (group: RankingGroup) => {
    try {
      await Share.share({
        message: `🏆 Junte-se à minha liga "${group.name}" no PrivadIn!\nCódigo de acesso: ${group.id}\nBaixe o app e venha disputar a liderança da cagada remunerada!`,
      });
    } catch (err: any) {
      console.error("Erro ao compartilhar código:", err.message);
    }
  };

  // Paste from Clipboard
  const handlePasteCode = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setJoinCode(text.trim().toUpperCase());
      }
    } catch (_err) {
      // Ignore
    }
  };

  // Create Group action
  const handleCreate = async () => {
    const normName = normalizeGroupName(newName);
    if (!normName) {
      Alert.alert("Atenção", "Por favor, informe o nome da sua liga.");
      return;
    }

    setActionLoading(true);
    try {
      const newGroupId = await createGroup(user, normName, newDescription);
      setCreateModalVisible(false);
      setNewName("");
      setNewDescription("");
      Alert.alert(
        "🎉 Liga Criada!",
        `Sua liga "${normName}" foi criada com sucesso. Compartilhe o código ${newGroupId} com sua equipe.`
      );
      if (onRefreshUser) onRefreshUser();
      await loadGroups(newGroupId);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível criar o grupo.");
    } finally {
      setActionLoading(false);
    }
  };

  // Join Group action
  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert("Atenção", "Informe o código de 8 caracteres.");
      return;
    }

    setActionLoading(true);
    try {
      const joinedId = await joinGroup(user, code);
      setJoinModalVisible(false);
      setJoinCode("");
      Alert.alert("🎉 Sucesso!", `Você ingressou na liga ${joinedId}!`);
      if (onRefreshUser) onRefreshUser();
      await loadGroups(joinedId);
    } catch (err: any) {
      Alert.alert("Erro ao entrar", err.message || "Não foi possível ingressar na liga.");
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Update group details
  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;
    const normName = normalizeGroupName(editName);
    if (!normName) {
      Alert.alert("Atenção", "O nome do grupo não pode ficar vazio.");
      return;
    }

    setActionLoading(true);
    try {
      await updateGroup(user, selectedGroup, {
        name: normName,
        description: editDescription,
      });
      Alert.alert("Sucesso", "Informações da liga atualizadas com sucesso.");
      await loadGroups(selectedGroup.id);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível atualizar a liga.");
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Remove member
  const handleRemoveMember = (member: AppUser) => {
    if (!selectedGroup) return;
    if (member.uid === selectedGroup.ownerId) {
      Alert.alert("Não permitido", "O criador da liga não pode ser removido.");
      return;
    }

    Alert.alert(
      "Remover Membro",
      `Deseja realmente remover ${member.name || "este membro"} da liga "${selectedGroup.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await removeGroupMember(user, selectedGroup, member.uid);
              Alert.alert("Membro Removido", `${member.name} foi removido da liga.`);
              await loadGroups(selectedGroup.id);
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Não foi possível remover o membro.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Admin: Delete group
  const handleDeleteGroup = () => {
    if (!selectedGroup) return;

    Alert.alert(
      "Excluir Liga",
      `Deseja realmente excluir permanentemente a liga "${selectedGroup.name}"? Esta ação removerá a liga e todos os seus membros.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, Excluir",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await deleteGroup(user, selectedGroup);
              Alert.alert("Liga Excluída", `A liga "${selectedGroup.name}" foi excluída com sucesso.`);
              if (onRefreshUser) onRefreshUser();
              await loadGroups();
            } catch (err: any) {
              Alert.alert("Erro ao excluir", err.message || "Não foi possível excluir a liga.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
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
        <Text style={styles.loadingText}>Carregando suas ligas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>🏢 Grupos & Ligas</Text>
          <Text style={styles.subtitle}>Competições privadas entre equipes da empresa</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtnSecondary}
            onPress={() => setJoinModalVisible(true)}
          >
            <Text style={styles.headerBtnSecondaryText}>🔑 Entrar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerBtnPrimary}
            onPress={() => setCreateModalVisible(true)}
          >
            <Text style={styles.headerBtnPrimaryText}>+ Criar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notification Banner when Copied */}
      {copiedNotification && (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>✅ Código da liga copiado para a área de transferência!</Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eab308" />
        }
      >
        {groups.length === 0 ? (
          /* Empty State */
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏢</Text>
            <Text style={styles.emptyTitle}>Nenhuma Liga Encontrada</Text>
            <Text style={styles.emptySubtitle}>
              Você ainda não faz parte de nenhuma liga privada. Crie uma para sua equipe ou entre com o código compartilhado pelo seu colega.
            </Text>

            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={() => setCreateModalVisible(true)}
              >
                <Text style={styles.primaryActionText}>Criar Nova Liga</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => setJoinModalVisible(true)}
              >
                <Text style={styles.secondaryActionText}>Entrar com Código</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Multiple Groups Selector Tabs */}
            {groups.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsScroll}
              >
                {groups.map((group) => {
                  const active = selectedGroup?.id === group.id;
                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.groupTab, active && styles.groupTabActive]}
                      onPress={() => setSelectedGroupId(group.id)}
                    >
                      <Text
                        style={[styles.groupTabText, active && styles.groupTabTextActive]}
                        numberOfLines={1}
                      >
                        {group.name}
                      </Text>
                      <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                          {group.memberCount}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Selected Group Card */}
            {selectedGroup && (
              <View style={styles.groupInfoCard}>
                <View style={styles.groupHeaderRow}>
                  <View style={styles.groupMainInfo}>
                    <View style={styles.groupNameRow}>
                      <Text style={styles.groupName} numberOfLines={1}>
                        {selectedGroup.name}
                      </Text>
                      <View style={styles.editionBadge}>
                        <Text style={styles.editionText}>
                          Ed. {toRoman(selectedGroup.edition || 1)}
                        </Text>
                      </View>
                    </View>

                    {selectedGroup.description ? (
                      <Text style={styles.groupDescription}>
                        {selectedGroup.description}
                      </Text>
                    ) : null}

                    <Text style={styles.groupMetaText}>
                      👥 {selectedGroup.memberCount} membro(s) {isOwner && " · 👑 Você é o admin"}
                    </Text>
                  </View>
                </View>

                {/* Code Sharing Row */}
                <View style={styles.codeShareSection}>
                  <View style={styles.codeDisplayBox}>
                    <Text style={styles.codeLabel}>CÓDIGO DA LIGA</Text>
                    <Text style={styles.codeValue}>{selectedGroup.id}</Text>
                  </View>

                  <View style={styles.codeActions}>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => handleCopyCode(selectedGroup.id)}
                    >
                      <Text style={styles.copyBtnText}>📋 Copiar ID</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.shareBtn}
                      onPress={() => handleShareCode(selectedGroup)}
                    >
                      <Text style={styles.shareBtnText}>📤 Compartilhar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Admin Management Toggle */}
                {isAdmin && (
                  <TouchableOpacity
                    style={styles.adminToggleBtn}
                    onPress={() => setIsAdminSectionOpen(!isAdminSectionOpen)}
                  >
                    <Text style={styles.adminToggleText}>
                      ⚙️ {isAdminSectionOpen ? "Ocultar Gestão da Liga" : "Administrar Liga (Editar / Membros)"}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Admin Section */}
                {isAdmin && isAdminSectionOpen && (
                  <View style={styles.adminPanel}>
                    <Text style={styles.adminSectionTitle}>Editar Detalhes da Liga</Text>

                    <Text style={styles.inputLabel}>Nome da Liga</Text>
                    <TextInput
                      style={styles.input}
                      value={editName}
                      onChangeText={setEditName}
                      maxLength={GROUP_NAME_MAX_LENGTH}
                      placeholder="Nome da liga..."
                      placeholderTextColor="#64748b"
                    />

                    <Text style={styles.inputLabel}>Descrição</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={editDescription}
                      onChangeText={setEditDescription}
                      maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
                      placeholder="Descrição ou regras..."
                      placeholderTextColor="#64748b"
                      multiline
                    />

                    <TouchableOpacity
                      style={[
                        styles.saveBtn,
                        actionLoading && styles.btnDisabled,
                      ]}
                      onPress={handleUpdateGroup}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#020617" />
                      ) : (
                        <Text style={styles.saveBtnText}>💾 Salvar Alterações</Text>
                      )}
                    </TouchableOpacity>

                    {/* Danger Zone: Delete Group */}
                    <View style={styles.dangerZoneDivider} />
                    <Text style={styles.dangerZoneTitle}>Zona de Perigo</Text>
                    <Text style={styles.dangerZoneDesc}>
                      Excluir permanentemente esta liga e remover todos os participantes.
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.deleteGroupBtn,
                        actionLoading && styles.btnDisabled,
                      ]}
                      onPress={handleDeleteGroup}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Text style={styles.deleteGroupBtnText}>🗑️ Excluir Liga</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Internal League Ranking */}
            <View style={styles.rankingSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>🏆 Ranking Interno da Liga</Text>
                  <Text style={styles.sectionSubtitle}>
                    {rankingMode === "weekly"
                      ? `Classificação semanal entre os ${members.length} membros`
                      : `Classificação geral entre os ${members.length} membros`}
                  </Text>
                </View>

                {/* Mode Toggle: Semanal vs Geral */}
                <View style={styles.modeToggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.modeToggleBtn,
                      rankingMode === "weekly" && styles.modeToggleBtnActive,
                    ]}
                    onPress={() => setRankingMode("weekly")}
                  >
                    <Text
                      style={[
                        styles.modeToggleText,
                        rankingMode === "weekly" && styles.modeToggleTextActive,
                      ]}
                    >
                      Semanal
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeToggleBtn,
                      rankingMode === "overall" && styles.modeToggleBtnActive,
                    ]}
                    onPress={() => setRankingMode("overall")}
                  >
                    <Text
                      style={[
                        styles.modeToggleText,
                        rankingMode === "overall" && styles.modeToggleTextActive,
                      ]}
                    >
                      Geral
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {sortedMembers.length === 0 ? (
                <View style={styles.emptyMembersBox}>
                  <ActivityIndicator size="small" color="#eab308" />
                  <Text style={styles.emptyMembersText}>Carregando membros do ranking...</Text>
                </View>
              ) : (
                sortedMembers.map((member, index) => {
                  const isCurrentUser = member.uid === user.uid;
                  const isMemberOwner = selectedGroup && member.uid === selectedGroup.ownerId;
                  const points =
                    rankingMode === "weekly"
                      ? member.weeklyPoints || 0
                      : member.totalPoints || 0;

                  return (
                    <TouchableOpacity
                      key={member.uid}
                      style={[
                        styles.leaderCard,
                        index === 0 && styles.leaderCardFirst,
                        index < 3 && styles.leaderCardTop3,
                        isCurrentUser && styles.leaderCardSelf,
                      ]}
                      onPress={() => {
                        setSelectedMemberId(member.uid);
                        setProfileModalVisible(true);
                      }}
                      activeOpacity={0.8}
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
                        <View style={styles.nameRow}>
                          <Text style={styles.userName} numberOfLines={1}>
                            {member.nickname?.trim() || member.name || "Cagador Anônimo"}
                          </Text>
                          {isMemberOwner && (
                            <View style={styles.ownerBadge}>
                              <Text style={styles.ownerBadgeText}>ADMIN</Text>
                            </View>
                          )}
                          {isCurrentUser && (
                            <View style={styles.selfBadge}>
                              <Text style={styles.selfBadgeText}>VOCÊ</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.userMeta}>
                          🔥 {member.currentDailyStreak || 0} dias de sequência
                        </Text>
                      </View>

                      <View style={styles.scoreContainer}>
                        <Text style={styles.scorePoints}>{points}</Text>
                        <Text style={styles.scoreLabel}>
                          {rankingMode === "weekly" ? "pts sem" : "pts tot"}
                        </Text>
                      </View>

                      {/* Admin action: remove member button */}
                      {isAdmin && !isMemberOwner && (
                        <TouchableOpacity
                          style={styles.removeMemberBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleRemoveMember(member);
                          }}
                          disabled={actionLoading}
                        >
                          <Text style={styles.removeMemberBtnText}>❌</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal: Create Group */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Criar Liga Privada</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {userOwnedGroup ? (
              <View style={styles.ownedWarningBox}>
                <Text style={styles.ownedWarningTitle}>⚠️ Limite de Criação</Text>
                <Text style={styles.ownedWarningDesc}>
                  Você já é o administrador da liga "{userOwnedGroup.name}". Cada usuário pode administrar apenas uma liga simultaneamente.
                </Text>
                <TouchableOpacity
                  style={styles.closeWarningBtn}
                  onPress={() => setCreateModalVisible(false)}
                >
                  <Text style={styles.closeWarningBtnText}>Entendi</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView>
                <Text style={styles.modalDesc}>
                  Crie uma liga fechada para sua equipe, departamento ou empresa. Você será o administrador e poderá gerenciar participantes.
                </Text>

                <Text style={styles.inputLabel}>
                  Nome da Liga <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Squad Mobile, Financeiro..."
                  placeholderTextColor="#64748b"
                  value={newName}
                  onChangeText={setNewName}
                  maxLength={GROUP_NAME_MAX_LENGTH}
                />
                <Text style={styles.charCount}>
                  {newName.length}/{GROUP_NAME_MAX_LENGTH}
                </Text>

                <Text style={styles.inputLabel}>Descrição (Opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ex: Ranking semanal dos melhores no trono..."
                  placeholderTextColor="#64748b"
                  value={newDescription}
                  onChangeText={setNewDescription}
                  maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
                  multiline
                />
                <Text style={styles.charCount}>
                  {newDescription.length}/{GROUP_DESCRIPTION_MAX_LENGTH}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.primaryActionButton,
                    actionLoading && styles.btnDisabled,
                  ]}
                  onPress={handleCreate}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#020617" />
                  ) : (
                    <Text style={styles.primaryActionText}>Criar Liga e Gerar Código</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Join Group */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Entrar por Código</Text>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Digite ou cole o código de 8 caracteres compartilhado pelo administrador da liga.
            </Text>

            <View style={styles.codeFieldRow}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="EX: ABCD1234"
                placeholderTextColor="#64748b"
                value={joinCode}
                onChangeText={(text) => setJoinCode(text.toUpperCase())}
                maxLength={32}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={styles.pasteBtn}
                onPress={handlePasteCode}
              >
                <Text style={styles.pasteBtnText}>📋 Colar</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                actionLoading && styles.btnDisabled,
              ]}
              onPress={handleJoin}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#020617" />
              ) : (
                <Text style={styles.primaryActionText}>Ingressar na Liga</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* User Public Profile Modal */}
      <UserProfileModal
        visible={profileModalVisible}
        userId={selectedMemberId}
        currentUserId={user.uid}
        onClose={() => setProfileModalVisible(false)}
        onOpenTransfer={(recipient) => {
          setTransferRecipient(recipient);
          setTransferModalVisible(true);
        }}
      />

      {/* Transfer Poopcoins Modal */}
      <TransferPoopcoinsModal
        visible={transferModalVisible}
        currentUser={user}
        initialRecipientUser={transferRecipient}
        onClose={() => setTransferModalVisible(false)}
        onSuccess={() => {
          onRefreshUser?.();
          if (selectedGroup) {
            loadGroupMembers(selectedGroup);
          }
        }}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  headerBtnSecondary: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  headerBtnSecondaryText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  headerBtnPrimary: {
    backgroundColor: "#eab308",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  headerBtnPrimaryText: {
    color: "#020617",
    fontSize: 12,
    fontWeight: "800",
  },
  toastBanner: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "#22c55e",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  toastText: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  emptyCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyActions: {
    width: "100%",
    gap: 10,
  },
  tabsScroll: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  groupTab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 8,
  },
  groupTabActive: {
    borderColor: "#eab308",
    backgroundColor: "rgba(234, 179, 8, 0.1)",
  },
  groupTabText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  groupTabTextActive: {
    color: "#eab308",
    fontWeight: "800",
  },
  tabBadge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: "#eab308",
  },
  tabBadgeText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  tabBadgeTextActive: {
    color: "#020617",
  },
  groupInfoCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  groupHeaderRow: {
    marginBottom: 12,
  },
  groupMainInfo: {
    gap: 4,
  },
  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f8fafc",
    flexShrink: 1,
  },
  editionBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  editionText: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "800",
  },
  groupDescription: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  groupMetaText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  codeShareSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
    gap: 8,
  },
  codeDisplayBox: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 16,
    fontFamily: "monospace",
    fontWeight: "800",
    color: "#eab308",
    letterSpacing: 1,
  },
  codeActions: {
    flexDirection: "row",
    gap: 6,
  },
  copyBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  copyBtnText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "700",
  },
  shareBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  shareBtnText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
  },
  adminToggleBtn: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  adminToggleText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  adminPanel: {
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  adminSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: "#eab308",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnText: {
    color: "#020617",
    fontWeight: "800",
    fontSize: 13,
  },
  dangerZoneDivider: {
    height: 1,
    backgroundColor: "#1e293b",
    marginVertical: 14,
  },
  dangerZoneTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f87171",
    marginBottom: 2,
  },
  dangerZoneDesc: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 10,
  },
  deleteGroupBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  deleteGroupBtnText: {
    color: "#ef4444",
    fontWeight: "800",
    fontSize: 13,
  },
  rankingSection: {
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  sectionHeader: {
    flex: 1,
    minWidth: 160,
  },
  modeToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 3,
  },
  modeToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 7,
  },
  modeToggleBtnActive: {
    backgroundColor: "#eab308",
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
  },
  modeToggleTextActive: {
    color: "#020617",
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  emptyMembersBox: {
    backgroundColor: "#0f172a",
    padding: 24,
    borderRadius: 14,
    alignItems: "center",
    gap: 8,
  },
  emptyMembersText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  leaderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  leaderCardTop3: {
    borderColor: "#334155",
  },
  leaderCardFirst: {
    borderColor: "#eab308",
    backgroundColor: "rgba(234, 179, 8, 0.05)",
  },
  leaderCardSelf: {
    borderColor: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  positionBadge: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  positionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  positionTextMedal: {
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  userName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  ownerBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ownerBadgeText: {
    color: "#eab308",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  selfBadge: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  selfBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  userMeta: {
    fontSize: 11,
    color: "#f59e0b",
    fontWeight: "600",
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: "flex-end",
    marginRight: 6,
  },
  scorePoints: {
    fontSize: 16,
    fontWeight: "800",
    color: "#eab308",
  },
  scoreLabel: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "600",
  },
  removeMemberBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  removeMemberBtnText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
  },
  modalCloseText: {
    fontSize: 18,
    color: "#94a3b8",
    fontWeight: "700",
    padding: 4,
  },
  modalDesc: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#cbd5e1",
    marginBottom: 6,
    marginTop: 8,
  },
  requiredAsterisk: {
    color: "#ef4444",
  },
  input: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "right",
    marginTop: 2,
    marginBottom: 4,
  },
  codeFieldRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  codeInput: {
    flex: 1,
    fontFamily: "monospace",
    letterSpacing: 2,
    fontWeight: "800",
    fontSize: 16,
  },
  pasteBtn: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  pasteBtnText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 12,
  },
  primaryActionButton: {
    backgroundColor: "#eab308",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  primaryActionText: {
    color: "#020617",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryActionButton: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryActionText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  ownedWarningBox: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderRadius: 14,
    padding: 16,
    marginVertical: 10,
  },
  ownedWarningTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fbbf24",
    marginBottom: 6,
  },
  ownedWarningDesc: {
    fontSize: 13,
    color: "#d1d5db",
    lineHeight: 18,
    marginBottom: 14,
  },
  closeWarningBtn: {
    backgroundColor: "#f59e0b",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  closeWarningBtnText: {
    color: "#020617",
    fontWeight: "800",
    fontSize: 13,
  },
});
