import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { AppSettings, AppUser, AdminAuditLog, AdminAuditAction } from "../types";
import {
  listenAllUsers,
  listenAppSettings,
  listenAuditLogs,
  deactivateUser,
  reactivateUser,
  setUserRole,
  setUserCooldown,
  updateCompetitionSettings,
  resetWeeklyCompetition,
  formatAuditLogMessage,
} from "../services/adminService";
import { toRoman } from "../utils/roman";
import UserAvatar from "../components/UserAvatar";
import UserProfileModal from "../components/UserProfileModal";

interface AdminScreenProps {
  user: AppUser;
  onBack: () => void;
  onRefreshUser?: () => void;
}

type AdminSection = "users" | "settings" | "reset" | "audit";

export default function AdminScreen({ user, onBack, onRefreshUser }: AdminScreenProps) {
  // If not admin, block screen immediately
  const isAdmin = user.role === "admin";

  const [activeSection, setActiveSection] = useState<AdminSection>("users");

  // Real-time state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // User Management State
  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "active" | "banned" | "admin">("all");
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<string | null>(null);
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  // Custom Cooldown Modal State
  const [cooldownModalUser, setCooldownModalUser] = useState<AppUser | null>(null);
  const [customCooldownInput, setCustomCooldownInput] = useState("30");
  const [savingCooldown, setSavingCooldown] = useState(false);

  // Competition Settings Form State
  const [cooldownMinutesInput, setCooldownMinutesInput] = useState("15");
  const [pointsPerLogInput, setPointsPerLogInput] = useState("2000");
  const [cuiterPostCostInput, setCuiterPostCostInput] = useState("5");
  const [poopcoinsPerLogInput, setPoopcoinsPerLogInput] = useState("1");
  const [announcementInput, setAnnouncementInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState("");

  // Weekly Reset Modal State
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ newEdition: number; usersReset: number } | null>(
    null
  );

  // Audit Logs Filter
  const [auditFilter, setAuditFilter] = useState<"all" | "users" | "rules" | "reset">("all");

  // Map of users for fast name resolution
  const usersMap = useMemo(() => {
    const map = new Map<string, AppUser>();
    users.forEach((u) => map.set(u.uid, u));
    return map;
  }, [users]);

  // Subscribe to real-time streams
  useEffect(() => {
    if (!isAdmin) return;

    const unsubUsers = listenAllUsers((userList) => {
      setUsers(userList);
      setLoadingData(false);
    });

    const unsubSettings = listenAppSettings((settings) => {
      setAppSettings(settings);
      setCooldownMinutesInput(String(settings.cooldownMinutes));
      setPointsPerLogInput(String(settings.pointsPerLog ?? 2000));
      setCuiterPostCostInput(String(settings.cuiterPostCost ?? 5));
      setPoopcoinsPerLogInput(String(settings.poopcoinsPerLog ?? 1));
      setAnnouncementInput(settings.competitionAnnouncement || "");
    });

    const unsubLogs = listenAuditLogs((logs) => {
      setAuditLogs(logs);
    });

    return () => {
      unsubUsers();
      unsubSettings();
      unsubLogs();
    };
  }, [isAdmin]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      // 1. Text match
      const nameMatch = (u.name || "").toLowerCase().includes(query);
      const nickMatch = (u.nickname || "").toLowerCase().includes(query);
      const emailMatch = (u.email || "").toLowerCase().includes(query);
      const uidMatch = (u.uid || "").toLowerCase().includes(query);
      const matchesSearch = !query || nameMatch || nickMatch || emailMatch || uidMatch;

      if (!matchesSearch) return false;

      // 2. Status match
      if (userFilter === "active") return u.isActive !== false;
      if (userFilter === "banned") return u.isActive === false;
      if (userFilter === "admin") return u.role === "admin";
      return true;
    });
  }, [users, searchQuery, userFilter]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    if (auditFilter === "all") return auditLogs;
    if (auditFilter === "users") {
      return auditLogs.filter((l) =>
        ["deactivate_user", "reactivate_user", "promote_admin", "demote_admin"].includes(l.action)
      );
    }
    if (auditFilter === "rules") {
      return auditLogs.filter((l) =>
        [
          "update_cooldown",
          "update_points_per_log",
          "update_poopcoin_rules",
          "update_competition_announcement",
        ].includes(l.action)
      );
    }
    if (auditFilter === "reset") {
      return auditLogs.filter((l) => l.action === "reset_weekly");
    }
    return auditLogs;
  }, [auditLogs, auditFilter]);

  // Handler: Toggle Ban / Reactivate
  const handleToggleUserBan = (targetUser: AppUser) => {
    if (targetUser.uid === user.uid) {
      Alert.alert("Ação Inválida", "Você não pode desativar ou banir a sua própria conta.");
      return;
    }

    const isCurrentlyBanned = targetUser.isActive === false;
    const actionLabel = isCurrentlyBanned ? "Reativar" : "Banir/Desativar";

    Alert.alert(
      `${actionLabel} Usuário`,
      isCurrentlyBanned
        ? `Deseja reativar o acesso de ${targetUser.name || "este usuário"}? Ele poderá logar e registrar cagadas normalmente.`
        : `Deseja banir/desativar ${targetUser.name || "este usuário"}? Ele perderá o acesso à plataforma.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: actionLabel,
          style: isCurrentlyBanned ? "default" : "destructive",
          onPress: async () => {
            setProcessingUid(targetUser.uid);
            try {
              if (isCurrentlyBanned) {
                await reactivateUser(user, targetUser);
                Alert.alert("Sucesso", `Usuário ${targetUser.name || ""} reativado.`);
              } else {
                await deactivateUser(user, targetUser);
                Alert.alert("Sucesso", `Usuário ${targetUser.name || ""} banido.`);
              }
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Falha ao alterar status do usuário.");
            } finally {
              setProcessingUid(null);
            }
          },
        },
      ]
    );
  };

  // Handler: Promote / Demote Role
  const handleToggleUserRole = (targetUser: AppUser) => {
    const isTargetAdmin = targetUser.role === "admin";

    if (targetUser.uid === user.uid && isTargetAdmin) {
      Alert.alert("Ação Inválida", "Você não pode remover seu próprio privilégio de administrador.");
      return;
    }

    const newRole = isTargetAdmin ? "player" : "admin";
    const title = isTargetAdmin ? "Rebaixar a Jogador" : "Promover a Administrador";
    const message = isTargetAdmin
      ? `Tem certeza que deseja remover as permissões de Administrador de ${targetUser.name || "este usuário"}?`
      : `Tem certeza que deseja conceder privilégios de Administrador Master para ${targetUser.name || "este usuário"}? Ele terá acesso irrestrito ao painel.`;

    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        style: isTargetAdmin ? "destructive" : "default",
        onPress: async () => {
          setProcessingUid(targetUser.uid);
          try {
            await setUserRole(user, targetUser, newRole);
            Alert.alert(
              "Permissões Atualizadas",
              isTargetAdmin
                ? `${targetUser.name || "Usuário"} agora é um Jogador comum.`
                : `${targetUser.name || "Usuário"} foi promovido a Administrador!`
            );
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao atualizar papel do usuário.");
          } finally {
            setProcessingUid(null);
          }
        },
      },
    ]);
  };

  // Handler: Save Custom Cooldown
  const handleSaveCustomCooldown = async () => {
    if (!cooldownModalUser) return;
    const mins = parseInt(customCooldownInput, 10);
    if (isNaN(mins) || mins < 0 || mins > 1440) {
      Alert.alert("Valor Inválido", "O tempo de cooldown deve estar entre 0 e 1440 minutos.");
      return;
    }

    setSavingCooldown(true);
    try {
      await setUserCooldown(user, cooldownModalUser.uid, cooldownModalUser.name || "", mins);
      Alert.alert(
        "Cooldown Aplicado",
        mins === 0
          ? `Cooldown removido para ${cooldownModalUser.name}.`
          : `Novo cooldown de ${mins} minutos aplicado para ${cooldownModalUser.name}.`
      );
      setCooldownModalUser(null);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao definir cooldown.");
    } finally {
      setSavingCooldown(false);
    }
  };

  // Handler: Save Competition Settings
  const handleSaveSettings = async () => {
    const cd = parseInt(cooldownMinutesInput, 10);
    const pts = parseInt(pointsPerLogInput, 10);
    const cuiter = parseInt(cuiterPostCostInput, 10);
    const pcLog = parseInt(poopcoinsPerLogInput, 10);

    if (isNaN(cd) || cd < 1 || cd > 1440) {
      Alert.alert("Validação", "O cooldown deve estar entre 1 e 1440 minutos.");
      return;
    }
    if (isNaN(pts) || pts < 1 || pts > 100000) {
      Alert.alert("Validação", "Os pontos por log devem estar entre 1 e 100.000.");
      return;
    }
    if (isNaN(cuiter) || cuiter < 1 || cuiter > 100000) {
      Alert.alert("Validação", "O custo do Cuiter deve estar entre 1 e 100.000 PoopCoins.");
      return;
    }
    if (isNaN(pcLog) || pcLog < 1 || pcLog > 100000) {
      Alert.alert("Validação", "PoopCoins por log devem estar entre 1 e 100.000.");
      return;
    }

    setSavingSettings(true);
    setSettingsSuccessMsg("");
    try {
      await updateCompetitionSettings(user, {
        cooldownMinutes: cd,
        pointsPerLog: pts,
        cuiterPostCost: cuiter,
        poopcoinsPerLog: pcLog,
        competitionAnnouncement: announcementInput,
      });
      setSettingsSuccessMsg("✅ Parâmetros da competição salvos com sucesso!");
      setTimeout(() => setSettingsSuccessMsg(""), 4000);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar configurações.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Handler: Trigger Weekly Reset
  const handleTriggerWeeklyReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== "RESETAR") {
      Alert.alert("Confirmação Incorreta", 'Digite a palavra "RESETAR" para confirmar a operação.');
      return;
    }

    setResetting(true);
    try {
      const result = await resetWeeklyCompetition(user);
      setResetModalVisible(false);
      setResetConfirmText("");
      setResetResult(result);
      if (onRefreshUser) onRefreshUser();
    } catch (err: any) {
      Alert.alert("Erro no Reset", err.message || "Falha ao executar reset semanal.");
    } finally {
      setResetting(false);
    }
  };

  // If user is not admin
  if (!isAdmin) {
    return (
      <View style={styles.forbiddenContainer}>
        <Text style={styles.forbiddenIcon}>🚫</Text>
        <Text style={styles.forbiddenTitle}>Acesso Restrito</Text>
        <Text style={styles.forbiddenText}>
          Este painel é reservado exclusivamente para administradores master do PrivadIn.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.navBackBtn} onPress={onBack}>
            <Text style={styles.navBackText}>← Voltar</Text>
          </TouchableOpacity>
          <View style={styles.masterBadge}>
            <Text style={styles.masterBadgeText}>👑 ADMIN MASTER</Text>
          </View>
        </View>

        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>🛡️ Painel do Administrador</Text>
          <Text style={styles.subtitle}>
            Gestão da plataforma, ajustes de competição, reset e auditoria.
          </Text>
        </View>

        {/* Section Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionTabsContainer}
        >
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "users" && styles.sectionTabActive]}
            onPress={() => setActiveSection("users")}
          >
            <Text style={styles.sectionTabIcon}>👥</Text>
            <Text
              style={[
                styles.sectionTabText,
                activeSection === "users" && styles.sectionTabTextActive,
              ]}
            >
              Usuários ({users.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "settings" && styles.sectionTabActive]}
            onPress={() => setActiveSection("settings")}
          >
            <Text style={styles.sectionTabIcon}>⚙️</Text>
            <Text
              style={[
                styles.sectionTabText,
                activeSection === "settings" && styles.sectionTabTextActive,
              ]}
            >
              Competição
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "reset" && styles.sectionTabActive]}
            onPress={() => setActiveSection("reset")}
          >
            <Text style={styles.sectionTabIcon}>🏆</Text>
            <Text
              style={[
                styles.sectionTabText,
                activeSection === "reset" && styles.sectionTabTextActive,
              ]}
            >
              Reset Semanal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "audit" && styles.sectionTabActive]}
            onPress={() => setActiveSection("audit")}
          >
            <Text style={styles.sectionTabIcon}>📜</Text>
            <Text
              style={[
                styles.sectionTabText,
                activeSection === "audit" && styles.sectionTabTextActive,
              ]}
            >
              Auditoria ({auditLogs.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {loadingData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#eab308" />
          <Text style={styles.loadingText}>Sincronizando painel administrativo...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {/* ================= SECTION 1: GESTÃO DE USUÁRIOS ================= */}
          {activeSection === "users" && (
            <View style={styles.sectionBody}>
              {/* Search Bar */}
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nome, apelido, email ou UID..."
                  placeholderTextColor="#64748b"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Text style={styles.clearSearchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Status Filter Chips */}
              <View style={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[styles.chip, userFilter === "all" && styles.chipActive]}
                  onPress={() => setUserFilter("all")}
                >
                  <Text style={[styles.chipText, userFilter === "all" && styles.chipTextActive]}>
                    Todos ({users.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, userFilter === "active" && styles.chipActive]}
                  onPress={() => setUserFilter("active")}
                >
                  <Text style={[styles.chipText, userFilter === "active" && styles.chipTextActive]}>
                    🟢 Ativos ({users.filter((u) => u.isActive !== false).length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, userFilter === "banned" && styles.chipActive]}
                  onPress={() => setUserFilter("banned")}
                >
                  <Text style={[styles.chipText, userFilter === "banned" && styles.chipTextActive]}>
                    🔴 Banidos ({users.filter((u) => u.isActive === false).length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, userFilter === "admin" && styles.chipActive]}
                  onPress={() => setUserFilter("admin")}
                >
                  <Text style={[styles.chipText, userFilter === "admin" && styles.chipTextActive]}>
                    👑 Admins ({users.filter((u) => u.role === "admin").length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* User Cards List */}
              {filteredUsers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>👤</Text>
                  <Text style={styles.emptyTitle}>Nenhum usuário encontrado</Text>
                  <Text style={styles.emptyText}>Tente outro termo na busca ou mude o filtro.</Text>
                </View>
              ) : (
                filteredUsers.map((item) => {
                  const isCurrentUser = item.uid === user.uid;
                  const isItemAdmin = item.role === "admin";
                  const isItemBanned = item.isActive === false;
                  const isBusy = processingUid === item.uid;

                  return (
                    <View
                      key={item.uid}
                      style={[styles.userCard, isItemBanned && styles.userCardBanned]}
                    >
                      {/* Top row: Avatar, Names, Badges */}
                      <View style={styles.userCardHeader}>
                        <TouchableOpacity
                          onPress={() => setSelectedUserForProfile(item.uid)}
                          style={styles.avatarTouchable}
                        >
                          <UserAvatar
                            avatar={item.avatar}
                            name={item.name}
                            badge={item.equippedBadge}
                            size={48}
                            borderColor={
                              isItemAdmin ? "#eab308" : isItemBanned ? "#ef4444" : "#334155"
                            }
                          />
                        </TouchableOpacity>

                        <View style={styles.userInfoCol}>
                          <View style={styles.userNameRow}>
                            <Text style={styles.userNameText} numberOfLines={1}>
                              {item.nickname ? `${item.name} (${item.nickname})` : item.name}
                            </Text>
                            {isCurrentUser && (
                              <View style={styles.youBadge}>
                                <Text style={styles.youBadgeText}>VOCÊ</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.userEmailText} numberOfLines={1}>
                            {item.email}
                          </Text>

                          {/* Role & Status Pill row */}
                          <View style={styles.pillsRow}>
                            <View
                              style={[
                                styles.pill,
                                isItemAdmin ? styles.pillAdmin : styles.pillPlayer,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.pillText,
                                  isItemAdmin ? styles.pillTextAdmin : styles.pillTextPlayer,
                                ]}
                              >
                                {isItemAdmin ? "👑 Admin" : "👤 Jogador"}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.pill,
                                isItemBanned ? styles.pillBanned : styles.pillActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.pillText,
                                  isItemBanned ? styles.pillTextBanned : styles.pillTextActive,
                                ]}
                              >
                                {isItemBanned ? "🔴 Banido / Inativo" : "🟢 Ativo"}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Stats snippet */}
                      <View style={styles.userStatsSnippet}>
                        <View style={styles.snippetCol}>
                          <Text style={styles.snippetLabel}>Pontos Totais</Text>
                          <Text style={styles.snippetVal}>
                            {(item.totalPoints || 0).toLocaleString()}
                          </Text>
                        </View>
                        <View style={styles.snippetDivider} />
                        <View style={styles.snippetCol}>
                          <Text style={styles.snippetLabel}>Pontos Semanais</Text>
                          <Text style={styles.snippetVal}>
                            {(item.weeklyPoints || 0).toLocaleString()}
                          </Text>
                        </View>
                        <View style={styles.snippetDivider} />
                        <View style={styles.snippetCol}>
                          <Text style={styles.snippetLabel}>PoopCoins</Text>
                          <Text style={[styles.snippetVal, { color: "#eab308" }]}>
                            🪙 {(item.poopcoinBalance || 0).toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      {/* Actions row */}
                      <View style={styles.userActionsRow}>
                        {/* Ban / Reativar */}
                        <TouchableOpacity
                          style={[
                            styles.userActionBtn,
                            isItemBanned ? styles.userActionBtnSuccess : styles.userActionBtnDanger,
                            (isCurrentUser || isBusy) && styles.btnDisabled,
                          ]}
                          disabled={isCurrentUser || isBusy}
                          onPress={() => handleToggleUserBan(item)}
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text
                              style={[
                                styles.userActionBtnText,
                                isItemBanned
                                  ? styles.userActionBtnTextSuccess
                                  : styles.userActionBtnTextDanger,
                              ]}
                            >
                              {isItemBanned ? "✅ Reativar" : "🚫 Banir"}
                            </Text>
                          )}
                        </TouchableOpacity>

                        {/* Promover / Rebaixar Role */}
                        <TouchableOpacity
                          style={[
                            styles.userActionBtn,
                            isItemAdmin ? styles.userActionBtnWarning : styles.userActionBtnPurple,
                            (isCurrentUser && isItemAdmin) || isBusy ? styles.btnDisabled : null,
                          ]}
                          disabled={(isCurrentUser && isItemAdmin) || isBusy}
                          onPress={() => handleToggleUserRole(item)}
                        >
                          <Text
                            style={[
                              styles.userActionBtnText,
                              isItemAdmin
                                ? styles.userActionBtnTextWarning
                                : styles.userActionBtnTextPurple,
                            ]}
                          >
                            {isItemAdmin ? "⬇️ Rebaixar" : "👑 Promover Admin"}
                          </Text>
                        </TouchableOpacity>

                        {/* Set Cooldown */}
                        <TouchableOpacity
                          style={[styles.userActionBtn, styles.userActionBtnNeutral]}
                          onPress={() => {
                            setCooldownModalUser(item);
                            setCustomCooldownInput("30");
                          }}
                        >
                          <Text style={styles.userActionBtnTextNeutral}>⏱️ Cooldown</Text>
                        </TouchableOpacity>

                        {/* View Profile */}
                        <TouchableOpacity
                          style={[styles.userActionBtn, styles.userActionBtnOutline]}
                          onPress={() => setSelectedUserForProfile(item.uid)}
                        >
                          <Text style={styles.userActionBtnTextOutline}>Ver Perfil →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ================= SECTION 2: AJUSTES DA COMPETIÇÃO ================= */}
          {activeSection === "settings" && (
            <View style={styles.sectionBody}>
              <View style={styles.settingsHeaderCard}>
                <Text style={styles.settingsHeaderEyebrow}>PARÂMETROS GLOBAIS</Text>
                <Text style={styles.settingsHeaderTitle}>Regras da Competição</Text>
                <Text style={styles.settingsHeaderDesc}>
                  Estas configurações afetam imediatamente o cronômetro, a pontuação e os custos em
                  todo o aplicativo para todos os participantes.
                </Text>
              </View>

              {settingsSuccessMsg.length > 0 && (
                <View style={styles.successBanner}>
                  <Text style={styles.successBannerText}>{settingsSuccessMsg}</Text>
                </View>
              )}

              {/* Form Card */}
              <View style={styles.formCard}>
                {/* Cooldown */}
                <View style={styles.formGroup}>
                  <View style={styles.formLabelRow}>
                    <Text style={styles.formLabel}>⏱️ Cooldown Entre Cagadas (minutos)</Text>
                    <Text style={styles.formHint}>Padrão: 15 min · Limite: 1 a 1440 min</Text>
                  </View>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="number-pad"
                    value={cooldownMinutesInput}
                    onChangeText={setCooldownMinutesInput}
                    placeholder="15"
                    placeholderTextColor="#64748b"
                  />
                  <Text style={styles.formSubhint}>
                    Tempo mínimo de espera que um usuário deve aguardar antes de registrar um novo
                    cocô remunerado.
                  </Text>
                </View>

                {/* Pontos por log */}
                <View style={styles.formGroup}>
                  <View style={styles.formLabelRow}>
                    <Text style={styles.formLabel}>🎯 Pontos Base por Registro de Cagada</Text>
                    <Text style={styles.formHint}>Padrão: 2.000 pts · Limite: 1 a 100.000</Text>
                  </View>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="number-pad"
                    value={pointsPerLogInput}
                    onChangeText={setPointsPerLogInput}
                    placeholder="2000"
                    placeholderTextColor="#64748b"
                  />
                  <Text style={styles.formSubhint}>
                    Pontuação base concedida a cada conclusão de cagada válida no app.
                  </Text>
                </View>

                {/* Custo do Cuiter */}
                <View style={styles.formGroup}>
                  <View style={styles.formLabelRow}>
                    <Text style={styles.formLabel}>🐦 Custo para Postar no Cuiter (PoopCoins)</Text>
                    <Text style={styles.formHint}>Padrão: 5 PC · Limite: 1 a 100.000</Text>
                  </View>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="number-pad"
                    value={cuiterPostCostInput}
                    onChangeText={setCuiterPostCostInput}
                    placeholder="5"
                    placeholderTextColor="#64748b"
                  />
                  <Text style={styles.formSubhint}>
                    Taxa queimada da circulação pública do Ledger a cada publicação enviada na rede
                    social do trono.
                  </Text>
                </View>

                {/* Poopcoins por log */}
                <View style={styles.formGroup}>
                  <View style={styles.formLabelRow}>
                    <Text style={styles.formLabel}>🪙 Recompensa em PoopCoins por Registro</Text>
                    <Text style={styles.formHint}>Padrão: 1 PC · Limite: 1 a 100.000</Text>
                  </View>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="number-pad"
                    value={poopcoinsPerLogInput}
                    onChangeText={setPoopcoinsPerLogInput}
                    placeholder="1"
                    placeholderTextColor="#64748b"
                  />
                  <Text style={styles.formSubhint}>
                    Quantidade de moedas mineradas pelo usuário a cada registro concluído com sucesso.
                  </Text>
                </View>

                {/* Comunicado da Competição */}
                <View style={styles.formGroup}>
                  <View style={styles.formLabelRow}>
                    <Text style={styles.formLabel}>📢 Comunicado Oficial da Competição (Banner)</Text>
                    <Text style={styles.formHint}>{announcementInput.length}/280</Text>
                  </View>
                  <TextInput
                    style={[styles.formInput, styles.formInputArea]}
                    multiline
                    numberOfLines={3}
                    maxLength={280}
                    value={announcementInput}
                    onChangeText={setAnnouncementInput}
                    placeholder="Ex: Edição especial de aniversário da firma! Pontos extras durante a semana..."
                    placeholderTextColor="#64748b"
                  />
                  <Text style={styles.formSubhint}>
                    Este comunicado é exibido com destaque no topo da tela do Trono de todos os
                    usuários.
                  </Text>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.saveSettingsBtn, savingSettings && styles.btnDisabled]}
                  disabled={savingSettings}
                  onPress={handleSaveSettings}
                >
                  {savingSettings ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.saveSettingsBtnText}>💾 Salvar Ajustes da Competição</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================= SECTION 3: RESET SEMANAL ================= */}
          {activeSection === "reset" && (
            <View style={styles.sectionBody}>
              {/* Edition Overview Card */}
              <View style={styles.editionHeroCard}>
                <View style={styles.editionRomanBadge}>
                  <Text style={styles.editionRomanText}>
                    👑 EDIÇÃO {toRoman(appSettings?.edition ?? 17)}
                  </Text>
                </View>
                <Text style={styles.editionHeroTitle}>Fechamento da Edição Semanal</Text>
                <Text style={styles.editionHeroSubtitle}>
                  Controle de encerramento de ciclo para apuração do ranking semanal e coroação dos
                  campeões da semana.
                </Text>

                <View style={styles.editionDetailsRow}>
                  <View style={styles.editionDetailCol}>
                    <Text style={styles.editionDetailLabel}>Edição Vigente</Text>
                    <Text style={styles.editionDetailVal}>
                      #{appSettings?.edition ?? 17} ({toRoman(appSettings?.edition ?? 17)})
                    </Text>
                  </View>
                  <View style={styles.editionDetailDivider} />
                  <View style={styles.editionDetailCol}>
                    <Text style={styles.editionDetailLabel}>Próxima Edição</Text>
                    <Text style={styles.editionDetailVal}>
                      #{((appSettings?.edition ?? 17) + 1)} (
                      {toRoman((appSettings?.edition ?? 17) + 1)})
                    </Text>
                  </View>
                </View>
              </View>

              {/* What happens guide */}
              <View style={styles.resetImpactCard}>
                <Text style={styles.resetImpactTitle}>⚡ O que acontece ao disparar o Reset?</Text>
                <View style={styles.impactItem}>
                  <Text style={styles.impactBullet}>1.</Text>
                  <Text style={styles.impactText}>
                    <Text style={styles.impactBold}>Zera a pontuação semanal</Text> de todos os
                    participantes da plataforma. Os pontos totais (vitalícios) permanecem intactos.
                  </Text>
                </View>

                <View style={styles.impactItem}>
                  <Text style={styles.impactBullet}>2.</Text>
                  <Text style={styles.impactText}>
                    <Text style={styles.impactBold}>Arquiva os registros semanais ativos</Text>{" "}
                    marcando-os como históricos da edição concluída.
                  </Text>
                </View>

                <View style={styles.impactItem}>
                  <Text style={styles.impactBullet}>3.</Text>
                  <Text style={styles.impactText}>
                    <Text style={styles.impactBold}>Avança a Edição Global</Text> (ex:{" "}
                    {toRoman(appSettings?.edition ?? 17)} →{" "}
                    {toRoman((appSettings?.edition ?? 17) + 1)}) e atualiza todas as Ligas Privadas
                    simultaneamente.
                  </Text>
                </View>

                <View style={styles.impactItem}>
                  <Text style={styles.impactBullet}>4.</Text>
                  <Text style={styles.impactText}>
                    <Text style={styles.impactBold}>Registra log de auditoria</Text> com seu ID de
                    administrador para controle de conformidade.
                  </Text>
                </View>
              </View>

              {/* Danger Warning Callout */}
              <View style={styles.warningCallout}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <View style={styles.warningTextCol}>
                  <Text style={styles.warningTitle}>Ação Irreversível</Text>
                  <Text style={styles.warningDesc}>
                    O encerramento semanal não pode ser desfeito. Recomenda-se disparar apenas aos
                    domingos à noite ou no horário oficial de fechamento da sua liga.
                  </Text>
                </View>
              </View>

              {/* Trigger Reset Button */}
              <TouchableOpacity
                style={styles.triggerResetBtn}
                onPress={() => {
                  setResetConfirmText("");
                  setResetModalVisible(true);
                }}
              >
                <Text style={styles.triggerResetBtnText}>
                  🚨 Disparar Fechamento da Edição {toRoman(appSettings?.edition ?? 17)}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= SECTION 4: LOGS DE AUDITORIA ================= */}
          {activeSection === "audit" && (
            <View style={styles.sectionBody}>
              <View style={styles.auditHeaderCard}>
                <Text style={styles.auditHeaderEyebrow}>TRANSPARÊNCIA E CONFORMIDADE</Text>
                <Text style={styles.auditHeaderTitle}>Trilha de Auditoria (Audit Logs)</Text>
                <Text style={styles.auditHeaderDesc}>
                  Registro criptográfico e cronológico de todas as modificações realizadas por
                  administradores na plataforma.
                </Text>
              </View>

              {/* Filter Chips */}
              <View style={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[styles.chip, auditFilter === "all" && styles.chipActive]}
                  onPress={() => setAuditFilter("all")}
                >
                  <Text style={[styles.chipText, auditFilter === "all" && styles.chipTextActive]}>
                    Todos ({auditLogs.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, auditFilter === "users" && styles.chipActive]}
                  onPress={() => setAuditFilter("users")}
                >
                  <Text style={[styles.chipText, auditFilter === "users" && styles.chipTextActive]}>
                    👥 Usuários
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, auditFilter === "rules" && styles.chipActive]}
                  onPress={() => setAuditFilter("rules")}
                >
                  <Text style={[styles.chipText, auditFilter === "rules" && styles.chipTextActive]}>
                    ⚙️ Regras
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, auditFilter === "reset" && styles.chipActive]}
                  onPress={() => setAuditFilter("reset")}
                >
                  <Text style={[styles.chipText, auditFilter === "reset" && styles.chipTextActive]}>
                    🏆 Reset Semanal
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Logs List */}
              {filteredAuditLogs.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>📜</Text>
                  <Text style={styles.emptyTitle}>Nenhum log de auditoria encontrado</Text>
                  <Text style={styles.emptyText}>
                    As ações administrativas realizadas aparecerão aqui em tempo real.
                  </Text>
                </View>
              ) : (
                filteredAuditLogs.map((log) => {
                  const message = formatAuditLogMessage(log, usersMap);
                  const dateStr = log.createdAt?.toDate
                    ? log.createdAt.toDate().toLocaleString("pt-BR")
                    : log.createdAt?.seconds
                    ? new Date(log.createdAt.seconds * 1000).toLocaleString("pt-BR")
                    : "Data desconhecida";

                  // Category icon
                  let icon = "⚙️";
                  let badgeColor = "#64748b";
                  let actionText: string = log.action;

                  if (log.action === "reset_weekly") {
                    icon = "🏆";
                    badgeColor = "#eab308";
                    actionText = "RESET SEMANAL";
                  } else if (log.action === "deactivate_user") {
                    icon = "🚫";
                    badgeColor = "#ef4444";
                    actionText = "BANIMENTO";
                  } else if (log.action === "reactivate_user") {
                    icon = "✅";
                    badgeColor = "#10b981";
                    actionText = "REATIVAÇÃO";
                  } else if (log.action === "promote_admin") {
                    icon = "👑";
                    badgeColor = "#8b5cf6";
                    actionText = "PROMOÇÃO ADMIN";
                  } else if (log.action === "demote_admin") {
                    icon = "⬇️";
                    badgeColor = "#f97316";
                    actionText = "REBAIXAMENTO";
                  } else if (log.action === "update_cooldown") {
                    icon = "⏱️";
                    badgeColor = "#06b6d4";
                    actionText = "AJUSTE COOLDOWN";
                  } else if (log.action === "update_points_per_log") {
                    icon = "🎯";
                    badgeColor = "#3b82f6";
                    actionText = "PONTOS BASE";
                  } else if (log.action === "update_poopcoin_rules") {
                    icon = "🪙";
                    badgeColor = "#eab308";
                    actionText = "REGRAS POOPCOIN";
                  }

                  return (
                    <View key={log.id} style={styles.auditCard}>
                      <View style={styles.auditCardHeader}>
                        <View style={[styles.auditBadge, { backgroundColor: `${badgeColor}22` }]}>
                          <Text style={[styles.auditBadgeText, { color: badgeColor }]}>
                            {icon} {actionText}
                          </Text>
                        </View>
                        <Text style={styles.auditDateText}>{dateStr}</Text>
                      </View>

                      <Text style={styles.auditMessageText}>{message}</Text>

                      {/* Technical payload snippet if available */}
                      <View style={styles.auditMetaRow}>
                        <Text style={styles.auditAdminSnippet}>
                          Admin: {usersMap.get(log.adminId)?.name || log.adminName || log.adminId}
                        </Text>
                        {typeof log.edition === "number" && (
                          <Text style={styles.auditEditionSnippet}>
                            Ed. {toRoman(log.edition)}
                          </Text>
                        )}
                        {typeof log.cooldownMinutes === "number" && (
                          <Text style={styles.auditEditionSnippet}>
                            {log.cooldownMinutes} min
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ================= MODAL: AJUSTE DE COOLDOWN INDIVIDUAL ================= */}
      <Modal
        visible={!!cooldownModalUser}
        transparent
        animationType="fade"
        onRequestClose={() => setCooldownModalUser(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⏱️ Ajustar Cooldown</Text>
            <Text style={styles.modalSubtitle}>
              Defina minutos de espera específicos para{" "}
              <Text style={{ fontWeight: "700", color: "#eab308" }}>
                {cooldownModalUser?.name || "este usuário"}
              </Text>
              .
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Minutos de Cooldown (0 a 1440):</Text>
              <TextInput
                style={styles.modalTextInput}
                keyboardType="number-pad"
                value={customCooldownInput}
                onChangeText={setCustomCooldownInput}
                placeholder="Ex: 30 (ou 0 para liberar)"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCooldownModalUser(null)}
                disabled={savingCooldown}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, savingCooldown && styles.btnDisabled]}
                onPress={handleSaveCustomCooldown}
                disabled={savingCooldown}
              >
                {savingCooldown ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Aplicar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: CONFIRMAÇÃO DE RESET SEMANAL ================= */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !resetting && setResetModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, styles.resetModalBorder]}>
            <Text style={styles.resetModalDangerIcon}>🚨</Text>
            <Text style={styles.resetModalTitle}>Confirmar Fechamento Semanal</Text>
            <Text style={styles.resetModalDesc}>
              Você está prestes a fechar a{" "}
              <Text style={{ fontWeight: "bold", color: "#eab308" }}>
                EDIÇÃO {toRoman(appSettings?.edition ?? 17)}
              </Text>{" "}
              e inaugurar a{" "}
              <Text style={{ fontWeight: "bold", color: "#eab308" }}>
                EDIÇÃO {toRoman((appSettings?.edition ?? 17) + 1)}
              </Text>
              .
            </Text>

            <View style={styles.resetChallengeBox}>
              <Text style={styles.resetChallengeLabel}>
                Para confirmar a operação, digite <Text style={{ color: "#ef4444" }}>RESETAR</Text>{" "}
                abaixo:
              </Text>
              <TextInput
                style={styles.resetChallengeInput}
                value={resetConfirmText}
                onChangeText={setResetConfirmText}
                placeholder="RESETAR"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setResetModalVisible(false)}
                disabled={resetting}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.resetConfirmBtn,
                  (resetConfirmText.trim().toUpperCase() !== "RESETAR" || resetting) &&
                    styles.btnDisabled,
                ]}
                disabled={resetConfirmText.trim().toUpperCase() !== "RESETAR" || resetting}
                onPress={handleTriggerWeeklyReset}
              >
                {resetting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.resetConfirmBtnText}>Disparar Reset Agora</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: SUCESSO DO RESET SEMANAL ================= */}
      <Modal
        visible={!!resetResult}
        transparent
        animationType="fade"
        onRequestClose={() => setResetResult(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.successModalIcon}>🎉</Text>
            <Text style={styles.modalTitle}>Fechamento Concluído!</Text>
            <Text style={styles.modalSubtitle}>
              A nova{" "}
              <Text style={{ color: "#eab308", fontWeight: "bold" }}>
                EDIÇÃO {toRoman(resetResult?.newEdition ?? 1)}
              </Text>{" "}
              da competição foi inaugurada com sucesso.
            </Text>
            <Text style={styles.successStatsText}>
              • {resetResult?.usersReset} participante(s) tiveram sua pontuação semanal zerada.{"\n"}
              • As ligas privadas foram promovidas para a nova edição.{"\n"}• O evento foi registrado
              na trilha de auditoria.
            </Text>

            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => setResetResult(null)}
            >
              <Text style={styles.modalConfirmBtnText}>Excelente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: PERFIL PÚBLICO DO USUÁRIO ================= */}
      <UserProfileModal
        visible={!!selectedUserForProfile}
        userId={selectedUserForProfile}
        currentUserId={user.uid}
        onClose={() => setSelectedUserForProfile(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f19",
  },
  forbiddenContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#0b0f19",
  },
  forbiddenIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  forbiddenTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ef4444",
    marginBottom: 8,
  },
  forbiddenText: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  backButton: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#eab308",
    fontWeight: "bold",
    fontSize: 16,
  },

  // Header
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  navBackBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  navBackText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  masterBadge: {
    backgroundColor: "#eab30822",
    borderWidth: 1,
    borderColor: "#eab308",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  masterBadgeText: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  headerTitleRow: {
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },

  // Section Tabs
  sectionTabsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
  sectionTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#1e293b",
  },
  sectionTabActive: {
    backgroundColor: "#eab308",
  },
  sectionTabIcon: {
    fontSize: 15,
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
  },
  sectionTabTextActive: {
    color: "#0f172a",
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#94a3b8",
  },

  // Scroll Area
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionBody: {
    gap: 16,
  },

  // Search Box
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 14,
    padding: 0,
  },
  clearSearchText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 4,
  },

  // Filter Chips
  filterChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  chipActive: {
    backgroundColor: "#334155",
    borderColor: "#eab308",
  },
  chipText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#f8fafc",
    fontWeight: "700",
  },

  // Empty Card
  emptyCard: {
    backgroundColor: "#1e293b55",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },

  // User Card
  userCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
  },
  userCardBanned: {
    borderColor: "#ef444455",
    backgroundColor: "#1a1622",
  },
  userCardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avatarTouchable: {
    alignSelf: "flex-start",
  },
  userInfoCol: {
    flex: 1,
    gap: 2,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userNameText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#f8fafc",
    flexShrink: 1,
  },
  youBadge: {
    backgroundColor: "#3b82f633",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youBadgeText: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: "bold",
  },
  userEmailText: {
    fontSize: 12,
    color: "#64748b",
  },
  pillsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pillAdmin: {
    backgroundColor: "#eab30822",
  },
  pillPlayer: {
    backgroundColor: "#33415555",
  },
  pillBanned: {
    backgroundColor: "#ef444422",
  },
  pillActive: {
    backgroundColor: "#10b98122",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  pillTextAdmin: {
    color: "#eab308",
  },
  pillTextPlayer: {
    color: "#94a3b8",
  },
  pillTextBanned: {
    color: "#ef4444",
  },
  pillTextActive: {
    color: "#10b981",
  },

  // Stats snippet
  userStatsSnippet: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  snippetCol: {
    flex: 1,
    alignItems: "center",
  },
  snippetDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#1e293b",
  },
  snippetLabel: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 2,
  },
  snippetVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f8fafc",
  },

  // Actions row
  userActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  userActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  userActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  userActionBtnSuccess: {
    backgroundColor: "#10b98122",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  userActionBtnTextSuccess: {
    color: "#10b981",
  },
  userActionBtnDanger: {
    backgroundColor: "#ef444422",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  userActionBtnTextDanger: {
    color: "#ef4444",
  },
  userActionBtnWarning: {
    backgroundColor: "#f59e0b22",
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  userActionBtnTextWarning: {
    color: "#f59e0b",
  },
  userActionBtnPurple: {
    backgroundColor: "#8b5cf622",
    borderWidth: 1,
    borderColor: "#8b5cf6",
  },
  userActionBtnTextPurple: {
    color: "#a78bfa",
  },
  userActionBtnNeutral: {
    backgroundColor: "#334155",
  },
  userActionBtnTextNeutral: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  userActionBtnOutline: {
    borderWidth: 1,
    borderColor: "#475569",
  },
  userActionBtnTextOutline: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  btnDisabled: {
    opacity: 0.4,
  },

  // Settings Header Card
  settingsHeaderCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  settingsHeaderEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#eab308",
    letterSpacing: 1,
    marginBottom: 4,
  },
  settingsHeaderTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: 4,
  },
  settingsHeaderDesc: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  successBanner: {
    backgroundColor: "#10b98122",
    borderWidth: 1,
    borderColor: "#10b981",
    borderRadius: 12,
    padding: 12,
  },
  successBannerText: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },

  // Form Card
  formCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  formLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  formHint: {
    fontSize: 11,
    color: "#64748b",
  },
  formInput: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    color: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  formInputArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  formSubhint: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 15,
  },
  saveSettingsBtn: {
    backgroundColor: "#eab308",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveSettingsBtnText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
  },

  // Section 3: Reset Semanal
  editionHeroCard: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eab30855",
  },
  editionRomanBadge: {
    backgroundColor: "#eab30822",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#eab308",
    marginBottom: 12,
  },
  editionRomanText: {
    color: "#eab308",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  editionHeroTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 6,
  },
  editionHeroSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  editionDetailsRow: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: "100%",
  },
  editionDetailCol: {
    flex: 1,
    alignItems: "center",
  },
  editionDetailDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#334155",
  },
  editionDetailLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 2,
  },
  editionDetailVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },

  resetImpactCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  resetImpactTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
  },
  impactItem: {
    flexDirection: "row",
    gap: 8,
  },
  impactBullet: {
    fontSize: 13,
    color: "#eab308",
    fontWeight: "bold",
  },
  impactText: {
    flex: 1,
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  impactBold: {
    color: "#f8fafc",
    fontWeight: "bold",
  },
  warningCallout: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#ef444418",
    borderWidth: 1,
    borderColor: "#ef444455",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  warningIcon: {
    fontSize: 28,
  },
  warningTextCol: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ef4444",
    marginBottom: 2,
  },
  warningDesc: {
    fontSize: 12,
    color: "#fca5a5",
    lineHeight: 16,
  },
  triggerResetBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  triggerResetBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  // Section 4: Audit Logs
  auditHeaderCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  auditHeaderEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#06b6d4",
    letterSpacing: 1,
    marginBottom: 4,
  },
  auditHeaderTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: 4,
  },
  auditHeaderDesc: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  auditCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 8,
  },
  auditCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  auditBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  auditBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  auditDateText: {
    fontSize: 11,
    color: "#64748b",
  },
  auditMessageText: {
    fontSize: 14,
    color: "#f8fafc",
    lineHeight: 20,
    fontWeight: "500",
  },
  auditMetaRow: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
    paddingTop: 6,
  },
  auditAdminSnippet: {
    fontSize: 11,
    color: "#64748b",
  },
  auditEditionSnippet: {
    fontSize: 11,
    color: "#eab308",
    fontWeight: "700",
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "#000000aa",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  modalInputGroup: {
    gap: 6,
    marginVertical: 6,
  },
  modalInputLabel: {
    fontSize: 13,
    color: "#f8fafc",
    fontWeight: "600",
  },
  modalTextInput: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 15,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#334155",
  },
  modalCancelBtnText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "bold",
  },
  modalConfirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#eab308",
  },
  modalConfirmBtnText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "900",
  },

  // Reset Modal Special
  resetModalBorder: {
    borderColor: "#ef4444",
  },
  resetModalDangerIcon: {
    fontSize: 36,
    textAlign: "center",
  },
  resetModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ef4444",
    textAlign: "center",
  },
  resetModalDesc: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
  },
  resetChallengeBox: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  resetChallengeLabel: {
    fontSize: 12,
    color: "#cbd5e1",
    fontWeight: "600",
  },
  resetChallengeInput: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 2,
    textAlign: "center",
  },
  resetConfirmBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  resetConfirmBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },

  // Success Modal Special
  successModalIcon: {
    fontSize: 48,
    textAlign: "center",
  },
  successStatsText: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 20,
    backgroundColor: "#0f172a",
    padding: 12,
    borderRadius: 10,
  },
});
