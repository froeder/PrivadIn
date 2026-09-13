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
  Switch,
} from "react-native";
import {
  AppSettings,
  AppUser,
  AdminAuditLog,
  AdminAuditAction,
  PoopLog,
  RankingGroup,
  RegistrationAttempt,
  PoopcoinTransaction,
  PoopcoinSupplySummary,
  BonusTimeRange,
} from "../types";
import {
  listenAllUsers,
  listenAppSettings,
  listenAuditLogs,
  listenAllPoopLogs,
  listenAllGroups,
  listenRegistrationAttempts,
  deactivateUser,
  reactivateUser,
  setUserRole,
  setUserCooldown,
  adjustUserPoints,
  removePoopLogAsAdmin,
  deleteGroupAsAdmin,
  updateCompetitionSettings,
  updateOverallRankingVisibility,
  updateBonusTimeRanges,
  updateTermsOfUse,
  resetWeeklyCompetition,
  formatAuditLogMessage,
} from "../services/adminService";
import {
  listenPoopcoinChainHead,
  listenPoopcoinTransactions,
  adjustPoopcoins,
  reversePoopcoinTransaction,
  recalculatePoopcoinSupply,
  migratePoopcoinsForLogs,
  formatPoopcoins,
} from "../services/poopcoinService";
import { toRoman } from "../utils/roman";
import UserAvatar from "../components/UserAvatar";
import UserProfileModal from "../components/UserProfileModal";

interface AdminScreenProps {
  user: AppUser;
  onBack: () => void;
  onRefreshUser?: () => void;
}

type AdminSection =
  | "users"
  | "logs"
  | "economy"
  | "settings"
  | "groups"
  | "attempts"
  | "reset"
  | "audit";

export default function AdminScreen({ user, onBack, onRefreshUser }: AdminScreenProps) {
  // Se não for admin, bloqueia a tela imediatamente
  const isAdmin = user.role === "admin";

  const [activeSection, setActiveSection] = useState<AdminSection>("users");

  // Real-time state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [poopLogs, setPoopLogs] = useState<PoopLog[]>([]);
  const [groups, setGroups] = useState<RankingGroup[]>([]);
  const [registrationAttempts, setRegistrationAttempts] = useState<RegistrationAttempt[]>([]);
  const [poopcoinSupply, setPoopcoinSupply] = useState<PoopcoinSupplySummary | null>(null);
  const [poopcoinTransactions, setPoopcoinTransactions] = useState<PoopcoinTransaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // User Management State
  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "active" | "banned" | "admin">("all");
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<string | null>(null);
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  // Adjust Points Modal State
  const [adjustPointsUser, setAdjustPointsUser] = useState<AppUser | null>(null);
  const [customDeltaInput, setCustomDeltaInput] = useState("2000");
  const [savingPoints, setSavingPoints] = useState(false);

  // Adjust Poopcoins Modal State
  const [adjustPoopcoinsUser, setAdjustPoopcoinsUser] = useState<AppUser | null>(null);
  const [adjustPoopcoinsAmount, setAdjustPoopcoinsAmount] = useState("10");
  const [adjustPoopcoinsReason, setAdjustPoopcoinsReason] = useState("");
  const [savingPoopcoins, setSavingPoopcoins] = useState(false);

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
  const [overallRankingVisible, setOverallRankingVisible] = useState(false);
  const [bonusRanges, setBonusRanges] = useState<BonusTimeRange[]>([]);
  const [termsInput, setTermsInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingBonus, setSavingBonus] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState("");

  // Poopcoin Economy State
  const [reverseHashInput, setReverseHashInput] = useState("");
  const [reverseReasonInput, setReverseReasonInput] = useState("");
  const [reversingTx, setReversingTx] = useState(false);
  const [recalculatingSupply, setRecalculatingSupply] = useState(false);
  const [migratingCoins, setMigratingCoins] = useState(false);

  // Search & Filter States
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [attemptFilter, setAttemptFilter] = useState<
    "all" | "account_created" | "code_requested" | "invalid_code" | "failed"
  >("all");

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
      setOverallRankingVisible(Boolean(settings.overallRankingVisible));
      setBonusRanges(settings.bonusTimeRanges || []);
      setTermsInput(settings.termsOfUseText || "");
    });

    const unsubLogs = listenAuditLogs((logs) => {
      setAuditLogs(logs);
    });

    const unsubPoopLogs = listenAllPoopLogs((logs) => {
      setPoopLogs(logs);
    });

    const unsubGroups = listenAllGroups((groupList) => {
      setGroups(groupList);
    });

    const unsubAttempts = listenRegistrationAttempts((attempts) => {
      setRegistrationAttempts(attempts);
    });

    const unsubChain = listenPoopcoinChainHead((summary) => {
      setPoopcoinSupply(summary);
    });

    const unsubTxs = listenPoopcoinTransactions((txs) => {
      setPoopcoinTransactions(txs);
    });

    return () => {
      unsubUsers();
      unsubSettings();
      unsubLogs();
      unsubPoopLogs();
      unsubGroups();
      unsubAttempts();
      unsubChain();
      unsubTxs();
    };
  }, [isAdmin]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      const nameMatch = (u.name || "").toLowerCase().includes(query);
      const nickMatch = (u.nickname || "").toLowerCase().includes(query);
      const emailMatch = (u.email || "").toLowerCase().includes(query);
      const uidMatch = (u.uid || "").toLowerCase().includes(query);
      const matchesSearch = !query || nameMatch || nickMatch || emailMatch || uidMatch;

      if (!matchesSearch) return false;

      if (userFilter === "active") return u.isActive !== false;
      if (userFilter === "banned") return u.isActive === false;
      if (userFilter === "admin") return u.role === "admin";
      return true;
    });
  }, [users, searchQuery, userFilter]);

  // Filtered Poop Logs List
  const filteredPoopLogs = useMemo(() => {
    const query = logSearchQuery.trim().toLowerCase();
    if (!query) return poopLogs;
    return poopLogs.filter((log) => {
      const author = (usersMap.get(log.userId)?.name || log.userName || "").toLowerCase();
      const note = (log.note || "").toLowerCase();
      return author.includes(query) || note.includes(query);
    });
  }, [poopLogs, logSearchQuery, usersMap]);

  // Filtered Groups List
  const filteredGroups = useMemo(() => {
    const query = groupSearchQuery.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((g) => {
      const name = (g.name || "").toLowerCase();
      const desc = (g.description || "").toLowerCase();
      const owner = (usersMap.get(g.ownerId)?.name || g.ownerId || "").toLowerCase();
      return name.includes(query) || desc.includes(query) || owner.includes(query);
    });
  }, [groups, groupSearchQuery, usersMap]);

  // Filtered Registration Attempts List
  const filteredAttempts = useMemo(() => {
    if (attemptFilter === "all") return registrationAttempts;
    return registrationAttempts.filter((a) => a.status === attemptFilter);
  }, [registrationAttempts, attemptFilter]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    if (auditFilter === "all") return auditLogs;
    if (auditFilter === "users") {
      return auditLogs.filter((l) =>
        ["deactivate_user", "reactivate_user", "promote_admin", "demote_admin", "adjust_points", "adjust_poopcoins"].includes(l.action)
      );
    }
    if (auditFilter === "rules") {
      return auditLogs.filter((l) =>
        [
          "update_cooldown",
          "update_points_per_log",
          "update_poopcoin_rules",
          "update_competition_announcement",
          "update_terms_of_use",
        ].includes(l.action)
      );
    }
    if (auditFilter === "reset") {
      return auditLogs.filter((l) => l.action === "reset_weekly");
    }
    return auditLogs;
  }, [auditLogs, auditFilter]);

  // Contagem de logs pendentes de Poopcoin
  const pendingLegacyCoinsCount = useMemo(() => {
    return poopLogs.filter((l) => !l.poopcoinTransactionHash && l.poopcoinsEarned == null && l.userId).length;
  }, [poopLogs]);

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

  // Handler: Adjust User Points
  const handleApplyAdjustPoints = async (delta: number) => {
    if (!adjustPointsUser) return;
    setSavingPoints(true);
    try {
      await adjustUserPoints(user, adjustPointsUser, delta);
      Alert.alert("Sucesso", `${delta > 0 ? `+${delta}` : delta} pontos aplicados para ${adjustPointsUser.name}.`);
      setAdjustPointsUser(null);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao ajustar pontos.");
    } finally {
      setSavingPoints(false);
    }
  };

  // Handler: Adjust User Poopcoins
  const handleApplyAdjustPoopcoins = async () => {
    if (!adjustPoopcoinsUser) return;
    const amount = parseInt(adjustPoopcoinsAmount, 10);
    const reason = adjustPoopcoinsReason.trim();

    if (isNaN(amount) || amount === 0) {
      Alert.alert("Valor Inválido", "Informe uma quantidade de PoopCoins diferente de zero.");
      return;
    }
    if (!reason) {
      Alert.alert("Motivo Obrigatório", "Informe a justificativa/motivo do ajuste administrativo.");
      return;
    }

    setSavingPoopcoins(true);
    try {
      await adjustPoopcoins(user, adjustPoopcoinsUser, amount, reason);
      Alert.alert(
        "Sucesso",
        `Ajuste de ${amount > 0 ? `+${amount}` : amount} PoopCoins registrado no Ledger para ${adjustPoopcoinsUser.name}.`
      );
      setAdjustPoopcoinsUser(null);
      setAdjustPoopcoinsReason("");
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao ajustar PoopCoins.");
    } finally {
      setSavingPoopcoins(false);
    }
  };

  // Handler: Delete Poop Log as Admin
  const handleDeletePoopLog = (log: PoopLog) => {
    Alert.alert(
      "Excluir Registro",
      `Deseja realmente excluir este registro de cagada de ${log.userName || "um colaborador"}? Os pontos (${log.points || 0} pts) e as moedas recebidas serão estornados automaticamente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir Registro",
          style: "destructive",
          onPress: async () => {
            try {
              await removePoopLogAsAdmin(user, log);
              Alert.alert("Registro Excluído", "O log de cagada foi removido e os pontos estornados.");
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Falha ao excluir registro.");
            }
          },
        },
      ]
    );
  };

  // Handler: Delete Group as Admin
  const handleDeleteGroup = (group: RankingGroup) => {
    Alert.alert(
      "Excluir Grupo",
      `Deseja excluir o grupo "${group.name}"? Esta ação remove a liga privada para todos os ${group.memberCount || 1} membros participantes.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir Grupo",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGroupAsAdmin(user, group);
              Alert.alert("Grupo Excluído", `O grupo "${group.name}" foi removido com sucesso.`);
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Falha ao excluir grupo.");
            }
          },
        },
      ]
    );
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

  // Handler: Toggle Overall Ranking Visibility
  const handleToggleOverallRanking = async (value: boolean) => {
    try {
      setOverallRankingVisible(value);
      await updateOverallRankingVisibility(user, value);
    } catch (err: any) {
      setOverallRankingVisible(!value);
      Alert.alert("Erro", err.message || "Falha ao alternar visibilidade do ranking geral.");
    }
  };

  // Handler: Save Bonus Ranges
  const handleSaveBonusRanges = async () => {
    setSavingBonus(true);
    try {
      await updateBonusTimeRanges(user, bonusRanges);
      Alert.alert("Sucesso", "Faixas de horário bônus salvas com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao salvar faixas bônus.");
    } finally {
      setSavingBonus(false);
    }
  };

  // Handler: Save Terms of Use
  const handleSaveTermsOfUse = async () => {
    if (!termsInput.trim()) {
      Alert.alert("Validação", "O texto dos Termos de Uso não pode ficar vazio.");
      return;
    }

    Alert.alert(
      "Publicar Nova Versão",
      "Ao salvar, uma nova versão será gerada e todos os usuários serão obrigados a aceitá-la novamente antes de continuar usando o app. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Publicar",
          style: "default",
          onPress: async () => {
            setSavingTerms(true);
            try {
              const nextVer = await updateTermsOfUse(user, termsInput);
              Alert.alert("Sucesso", `Versão v${nextVer} dos Termos de Uso publicada com sucesso!`);
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Falha ao atualizar Termos de Uso.");
            } finally {
              setSavingTerms(false);
            }
          },
        },
      ]
    );
  };

  // Handler: Recalculate Poopcoin Supply
  const handleRecalculateSupply = () => {
    Alert.alert(
      "Recalcular Suprimento",
      "Esta ação audita a soma de saldos de todas as carteiras e sincroniza o supply emitido e circulante no Ledger da rede. Deseja executar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Recalcular",
          onPress: async () => {
            setRecalculatingSupply(true);
            try {
              const summary = await recalculatePoopcoinSupply(user);
              Alert.alert(
                "Suprimento Recalculado",
                `Suprimento auditado com sucesso!\n• Circulante: ${formatPoopcoins(summary.circulatingSupply)} PC\n• Disponível: ${formatPoopcoins(summary.availableSupply)} PC`
              );
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Falha ao recalcular suprimento.");
            } finally {
              setRecalculatingSupply(false);
            }
          },
        },
      ]
    );
  };

  // Handler: Migrate Coins for Legacy Logs
  const handleMigrateCoins = async () => {
    setMigratingCoins(true);
    try {
      const processed = await migratePoopcoinsForLogs(user, poopLogs);
      if (processed === 0) {
        Alert.alert("Migração", "Nenhum registro antigo pendente para migrar moedas neste lote.");
      } else {
        Alert.alert("Sucesso", `Lote de ${processed} registro(s) antigos minerado e creditado com sucesso!`);
      }
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao migrar moedas.");
    } finally {
      setMigratingCoins(false);
    }
  };

  // Handler: Reverse Transaction
  const handleReverseTransaction = async () => {
    const hash = reverseHashInput.trim();
    const reason = reverseReasonInput.trim();

    if (!hash) {
      Alert.alert("Validação", "Cole o hash da transação que deseja reverter.");
      return;
    }
    if (!reason) {
      Alert.alert("Validação", "Informe o motivo comprovado da reversão.");
      return;
    }

    Alert.alert(
      "Confirmar Reversão",
      `Deseja reverter a transação de hash:\n${hash.slice(0, 16)}...\n\nMotivo: "${reason}"\nOs saldos das contas envolvidas serão estornados no Ledger.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reverter",
          style: "destructive",
          onPress: async () => {
            setReversingTx(true);
            try {
              await reversePoopcoinTransaction(user, hash, reason);
              Alert.alert("Transação Revertida", "O bloco de estorno foi emitido no Ledger.");
              setReverseHashInput("");
              setReverseReasonInput("");
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Falha ao reverter transação.");
            } finally {
              setReversingTx(false);
            }
          },
        },
      ]
    );
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

  // Se não for admin, bloqueia visualização
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
            Gestão da plataforma, economia, cagadas, competição, reset e auditoria.
          </Text>
        </View>

        {/* Section Tabs Horizontais */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionTabsContainer}
        >
          {/* Usuários */}
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "users" && styles.sectionTabActive]}
            onPress={() => setActiveSection("users")}
          >
            <Text style={styles.sectionTabIcon}>👥</Text>
            <Text style={[styles.sectionTabText, activeSection === "users" && styles.sectionTabTextActive]}>
              Usuários ({users.length})
            </Text>
          </TouchableOpacity>

          {/* Cagadas */}
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "logs" && styles.sectionTabActive]}
            onPress={() => setActiveSection("logs")}
          >
            <Text style={styles.sectionTabIcon}>🧻</Text>
            <Text style={[styles.sectionTabText, activeSection === "logs" && styles.sectionTabTextActive]}>
              Cagadas ({poopLogs.length})
            </Text>
          </TouchableOpacity>

          {/* Economia Poopcoin */}
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "economy" && styles.sectionTabActive]}
            onPress={() => setActiveSection("economy")}
          >
            <Text style={styles.sectionTabIcon}>🪙</Text>
            <Text style={[styles.sectionTabText, activeSection === "economy" && styles.sectionTabTextActive]}>
              Poopcoins
            </Text>
          </TouchableOpacity>

          {/* Competição / Regras */}
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "settings" && styles.sectionTabActive]}
            onPress={() => setActiveSection("settings")}
          >
            <Text style={styles.sectionTabIcon}>⚙️</Text>
            <Text style={[styles.sectionTabText, activeSection === "settings" && styles.sectionTabTextActive]}>
              Competição
            </Text>
          </TouchableOpacity>

          {/* Grupos */}
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "groups" && styles.sectionTabActive]}
            onPress={() => setActiveSection("groups")}
          >
            <Text style={styles.sectionTabIcon}>🛡️</Text>
            <Text style={[styles.sectionTabText, activeSection === "groups" && styles.sectionTabTextActive]}>
              Grupos ({groups.length})
            </Text>
          </TouchableOpacity>

          {/* Tentativas de Registro */}
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "attempts" && styles.sectionTabActive]}
            onPress={() => setActiveSection("attempts")}
          >
            <Text style={styles.sectionTabIcon}>📋</Text>
            <Text style={[styles.sectionTabText, activeSection === "attempts" && styles.sectionTabTextActive]}>
              Cadastros ({registrationAttempts.length})
            </Text>
          </TouchableOpacity>

          {/* Reset Semanal */}
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "reset" && styles.sectionTabActive]}
            onPress={() => setActiveSection("reset")}
          >
            <Text style={styles.sectionTabIcon}>🏆</Text>
            <Text style={[styles.sectionTabText, activeSection === "reset" && styles.sectionTabTextActive]}>
              Reset Semanal
            </Text>
          </TouchableOpacity>

          {/* Auditoria */}
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === "audit" && styles.sectionTabActive]}
            onPress={() => setActiveSection("audit")}
          >
            <Text style={styles.sectionTabIcon}>📜</Text>
            <Text style={[styles.sectionTabText, activeSection === "audit" && styles.sectionTabTextActive]}>
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

                        {/* Ajustar Pontos */}
                        <TouchableOpacity
                          style={[styles.userActionBtn, styles.userActionBtnNeutral]}
                          onPress={() => {
                            setAdjustPointsUser(item);
                            setCustomDeltaInput("2000");
                          }}
                        >
                          <Text style={styles.userActionBtnTextNeutral}>🎯 Pontos</Text>
                        </TouchableOpacity>

                        {/* Ajustar PoopCoins */}
                        <TouchableOpacity
                          style={[styles.userActionBtn, styles.userActionBtnGold]}
                          onPress={() => {
                            setAdjustPoopcoinsUser(item);
                            setAdjustPoopcoinsAmount("10");
                            setAdjustPoopcoinsReason("");
                          }}
                        >
                          <Text style={styles.userActionBtnTextGold}>🪙 PoopCoins</Text>
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

          {/* ================= SECTION 2: REGISTROS DE CAGADAS (POOP LOGS) ================= */}
          {activeSection === "logs" && (
            <View style={styles.sectionBody}>
              <View style={styles.sectionHeaderCard}>
                <Text style={styles.sectionHeaderEyebrow}>ORGANIZAÇÃO EM TEMPO REAL</Text>
                <Text style={styles.sectionHeaderTitle}>Registros de Cagadas</Text>
                <Text style={styles.sectionHeaderDesc}>
                  Visualize todos os logs da empresa com opção de exclusão manual. A exclusão estorna
                  automaticamente os pontos e moedas acumulados na cagada.
                </Text>
              </View>

              {/* Search bar */}
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Filtrar por nome do autor ou observação..."
                  placeholderTextColor="#64748b"
                  value={logSearchQuery}
                  onChangeText={setLogSearchQuery}
                />
                {logSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setLogSearchQuery("")}>
                    <Text style={styles.clearSearchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Logs List */}
              {filteredPoopLogs.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>🧻</Text>
                  <Text style={styles.emptyTitle}>Nenhum registro encontrado</Text>
                  <Text style={styles.emptyText}>
                    Os registros enviados pelos colaboradores aparecerão aqui em tempo real.
                  </Text>
                </View>
              ) : (
                filteredPoopLogs.map((log) => {
                  const author = usersMap.get(log.userId) || { name: log.userName, email: "" };
                  const durationMin = Math.floor((log.durationSeconds || 0) / 60);
                  const durationSec = (log.durationSeconds || 0) % 60;
                  const dateStr = log.createdAt?.toDate
                    ? log.createdAt.toDate().toLocaleString("pt-BR")
                    : log.createdAt?.seconds
                    ? new Date(log.createdAt.seconds * 1000).toLocaleString("pt-BR")
                    : "Recentemente";

                  return (
                    <View key={log.id} style={styles.logCard}>
                      <View style={styles.logCardHeader}>
                        <View style={styles.logAvatarCircle}>
                          <Text style={{ fontSize: 20 }}>🧻</Text>
                        </View>
                        <View style={styles.logInfoCol}>
                          <Text style={styles.logAuthorText}>
                            {author.name || log.userName || "Colaborador"}
                          </Text>
                          <Text style={styles.logDateText}>{dateStr}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.logDeleteBtn}
                          onPress={() => handleDeletePoopLog(log)}
                        >
                          <Text style={styles.logDeleteBtnText}>🗑️ Excluir</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Log details metrics */}
                      <View style={styles.logMetricsRow}>
                        <View style={styles.logMetricCol}>
                          <Text style={styles.logMetricLabel}>Duração</Text>
                          <Text style={styles.logMetricVal}>
                            {durationMin}m {durationSec}s
                          </Text>
                        </View>
                        <View style={styles.logMetricDivider} />
                        <View style={styles.logMetricCol}>
                          <Text style={styles.logMetricLabel}>Rendimento</Text>
                          <Text style={[styles.logMetricVal, { color: "#10b981" }]}>
                            R$ {(log.earnedAmount || 0).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.logMetricDivider} />
                        <View style={styles.logMetricCol}>
                          <Text style={styles.logMetricLabel}>Pontos</Text>
                          <Text style={[styles.logMetricVal, { color: "#38bdf8" }]}>
                            +{(log.points || 0).toLocaleString()}
                          </Text>
                        </View>
                        <View style={styles.logMetricDivider} />
                        <View style={styles.logMetricCol}>
                          <Text style={styles.logMetricLabel}>PoopCoins</Text>
                          <Text style={[styles.logMetricVal, { color: "#eab308" }]}>
                            +{(log.poopcoinsEarned ?? (log.poopcoinTransactionHash ? 1 : 0))} PC
                          </Text>
                        </View>
                      </View>

                      {log.note ? (
                        <View style={styles.logNoteBox}>
                          <Text style={styles.logNoteText}>💬 "{log.note}"</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ================= SECTION 3: ECONOMIA POOPCOIN ================= */}
          {activeSection === "economy" && (
            <View style={styles.sectionBody}>
              <View style={styles.sectionHeaderCard}>
                <Text style={styles.sectionHeaderEyebrow}>ECONOMIA CRIPTO & LEDGER</Text>
                <Text style={styles.sectionHeaderTitle}>Gestão de PoopCoins</Text>
                <Text style={styles.sectionHeaderDesc}>
                  Acompanhe o supply global, histórico da blockchain do trono, reverta transações
                  indevidas e execute migrações e auditorias atômicas.
                </Text>
              </View>

              {/* Supply Global Cards */}
              <View style={styles.supplyCardsGrid}>
                <View style={styles.supplyCard}>
                  <Text style={styles.supplyCardLabel}>OFERTA TOTAL</Text>
                  <Text style={styles.supplyCardVal}>
                    {formatPoopcoins(poopcoinSupply?.totalSupply ?? 1000000)} PC
                  </Text>
                  <Text style={styles.supplyCardSub}>Limite fixo do protocolo</Text>
                </View>

                <View style={styles.supplyCard}>
                  <Text style={styles.supplyCardLabel}>EMITIDAS</Text>
                  <Text style={[styles.supplyCardVal, { color: "#eab308" }]}>
                    {formatPoopcoins(poopcoinSupply?.mintedSupply ?? 0)} PC
                  </Text>
                  <Text style={styles.supplyCardSub}>Mineradas em cagadas</Text>
                </View>

                <View style={styles.supplyCard}>
                  <Text style={styles.supplyCardLabel}>QUEIMADAS</Text>
                  <Text style={[styles.supplyCardVal, { color: "#ef4444" }]}>
                    {formatPoopcoins(poopcoinSupply?.burnedSupply ?? 0)} PC
                  </Text>
                  <Text style={styles.supplyCardSub}>Gastas no Cuiter/Loja</Text>
                </View>

                <View style={styles.supplyCard}>
                  <Text style={styles.supplyCardLabel}>DISPONÍVEIS</Text>
                  <Text style={[styles.supplyCardVal, { color: "#10b981" }]}>
                    {formatPoopcoins(poopcoinSupply?.availableSupply ?? 0)} PC
                  </Text>
                  <Text style={styles.supplyCardSub}>Prontas para emissão</Text>
                </View>
              </View>

              {/* Atomic Supply Actions */}
              <View style={styles.cardBox}>
                <Text style={styles.cardBoxTitle}>⚡ Ações de Auditoria do Suprimento</Text>

                <View style={styles.actionRowItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionItemTitle}>🔄 Recálculo Atômico do Suprimento</Text>
                    <Text style={styles.actionItemDesc}>
                      Varre os saldos de todas as carteiras de usuários e sincroniza a ponta da
                      corrente com a verdade contábil.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.smallBtn, recalculatingSupply && styles.btnDisabled]}
                    disabled={recalculatingSupply}
                    onPress={handleRecalculateSupply}
                  >
                    {recalculatingSupply ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.smallBtnText}>Recalcular</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={[styles.actionRowItem, { borderTopWidth: 1, borderTopColor: "#334155" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionItemTitle}>📦 Migração Retroativa de Moedas</Text>
                    <Text style={styles.actionItemDesc}>
                      Emite PoopCoins em lote (até 25) para registros legados que não geraram moedas.
                      {"\n"}
                      <Text style={{ color: "#eab308", fontWeight: "bold" }}>
                        Pendentes: {pendingLegacyCoinsCount} registro(s)
                      </Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.smallBtnGold, migratingCoins && styles.btnDisabled]}
                    disabled={migratingCoins}
                    onPress={handleMigrateCoins}
                  >
                    {migratingCoins ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={styles.smallBtnGoldText}>Migrar Lote</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reversão de Transações */}
              <View style={styles.cardBox}>
                <Text style={styles.cardBoxTitle}>🚨 Reversão de Transação no Ledger</Text>
                <Text style={styles.cardBoxDesc}>
                  Reverte de forma criptográfica uma transação indevida ou fraudulenta, estornando os
                  valores de volta para as partes envolvidas.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Hash da Transação (SHA-256)</Text>
                  <TextInput
                    style={[styles.formInput, { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }]}
                    placeholder="Cole o hash de 64 caracteres..."
                    placeholderTextColor="#64748b"
                    value={reverseHashInput}
                    onChangeText={setReverseHashInput}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Justificativa / Motivo da Reversão</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ex: Fraude comprovada, erro operacional..."
                    placeholderTextColor="#64748b"
                    value={reverseReasonInput}
                    onChangeText={setReverseReasonInput}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.dangerBtn, reversingTx && styles.btnDisabled]}
                  disabled={reversingTx}
                  onPress={handleReverseTransaction}
                >
                  {reversingTx ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.dangerBtnText}>🚨 Executar Reversão no Ledger</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Histórico Recente de Transações */}
              <View style={styles.cardBox}>
                <Text style={styles.cardBoxTitle}>📜 Histórico da Blockchain ({poopcoinTransactions.length})</Text>
                {poopcoinTransactions.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma transação registrada no ledger ainda.</Text>
                ) : (
                  poopcoinTransactions.slice(0, 30).map((tx) => {
                    const isReversed = tx.status === "reversed";
                    return (
                      <View key={tx.hash} style={[styles.txItem, isReversed && styles.txItemReversed]}>
                        <View style={styles.txHeaderRow}>
                          <View style={styles.txBadge}>
                            <Text style={styles.txBadgeText}>#{tx.sequence}</Text>
                          </View>
                          <View style={[styles.txTypePill, isReversed && { backgroundColor: "#ef444433" }]}>
                            <Text style={[styles.txTypeText, isReversed && { color: "#ef4444" }]}>
                              {isReversed ? "REVERTIDA" : tx.type.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.txAmountText}>
                            {formatPoopcoins(tx.amount)} PC
                          </Text>
                        </View>
                        <Text style={styles.txHashText} numberOfLines={1} ellipsizeMode="middle">
                          Hash: {tx.hash}
                        </Text>
                        {tx.reason ? (
                          <Text style={styles.txReasonText}>Motivo: {tx.reason}</Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ================= SECTION 4: AJUSTES DA COMPETIÇÃO ================= */}
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

              {/* Toggle de Ranking Geral (All-Time) */}
              <View style={styles.cardBox}>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.cardBoxTitle}>🌐 Ranking Geral (All-Time)</Text>
                    <Text style={styles.cardBoxDesc}>
                      Exibe ou oculta a aba de Ranking Geral Vitalício para todos os colaboradores.
                      {"\n"}
                      Status atual:{" "}
                      <Text style={{ color: overallRankingVisible ? "#10b981" : "#ef4444", fontWeight: "bold" }}>
                        {overallRankingVisible ? "Visível" : "Oculto"}
                      </Text>
                    </Text>
                  </View>
                  <Switch
                    value={overallRankingVisible}
                    onValueChange={handleToggleOverallRanking}
                    trackColor={{ false: "#334155", true: "#eab308" }}
                    thumbColor={overallRankingVisible ? "#0f172a" : "#94a3b8"}
                  />
                </View>
              </View>

              {/* Faixas de Horário Bônus */}
              <View style={styles.cardBox}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardBoxTitle}>⏰ Faixas de Horário de Pico Bônus</Text>
                    <Text style={styles.cardBoxDesc}>
                      Defina períodos com pontuação especial durante o expediente (HH:MM).
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.smallAddBtn}
                    onPress={() => {
                      setBonusRanges((cur) => [
                        ...cur,
                        { start: "12:00", end: "13:00", points: Number(pointsPerLogInput) || 2000 },
                      ]);
                    }}
                  >
                    <Text style={styles.smallAddBtnText}>+ Adicionar</Text>
                  </TouchableOpacity>
                </View>

                {bonusRanges.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma faixa bônus configurada.</Text>
                ) : (
                  bonusRanges.map((range, idx) => (
                    <View key={idx} style={styles.bonusRangeRow}>
                      <TextInput
                        style={[styles.formInput, styles.bonusTimeInput]}
                        value={range.start}
                        placeholder="Início"
                        placeholderTextColor="#64748b"
                        onChangeText={(txt) =>
                          setBonusRanges((cur) =>
                            cur.map((v, i) => (i === idx ? { ...v, start: txt } : v))
                          )
                        }
                      />
                      <Text style={{ color: "#94a3b8", fontWeight: "bold" }}>até</Text>
                      <TextInput
                        style={[styles.formInput, styles.bonusTimeInput]}
                        value={range.end}
                        placeholder="Fim"
                        placeholderTextColor="#64748b"
                        onChangeText={(txt) =>
                          setBonusRanges((cur) =>
                            cur.map((v, i) => (i === idx ? { ...v, end: txt } : v))
                          )
                        }
                      />
                      <TextInput
                        style={[styles.formInput, styles.bonusPointsInput]}
                        keyboardType="number-pad"
                        value={String(range.points)}
                        placeholder="Pontos"
                        placeholderTextColor="#64748b"
                        onChangeText={(txt) =>
                          setBonusRanges((cur) =>
                            cur.map((v, i) => (i === idx ? { ...v, points: parseInt(txt, 10) || 0 } : v))
                          )
                        }
                      />
                      <TouchableOpacity
                        style={styles.bonusRemoveBtn}
                        onPress={() => setBonusRanges((cur) => cur.filter((_, i) => i !== idx))}
                      >
                        <Text style={styles.bonusRemoveBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {bonusRanges.length > 0 && (
                  <TouchableOpacity
                    style={[styles.smallBtn, savingBonus && styles.btnDisabled, { marginTop: 12 }]}
                    disabled={savingBonus}
                    onPress={handleSaveBonusRanges}
                  >
                    {savingBonus ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.smallBtnText}>💾 Salvar Faixas de Horário</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Editor de Termos de Uso */}
              <View style={styles.cardBox}>
                <Text style={styles.cardBoxTitle}>📜 Editor de Termos de Uso</Text>
                <Text style={styles.cardBoxDesc}>
                  Versão atual:{" "}
                  <Text style={{ color: "#eab308", fontWeight: "bold" }}>
                    v{appSettings?.termsOfUseVersion ?? 1}
                  </Text>
                  . Ao salvar uma nova versão, todos os usuários serão obrigados a aceitar os novos
                  termos no aplicativo.
                </Text>

                <TextInput
                  style={[styles.formInput, styles.termsTextArea]}
                  multiline
                  value={termsInput}
                  onChangeText={setTermsInput}
                  placeholder="Escreva os termos de uso da plataforma..."
                  placeholderTextColor="#64748b"
                />

                <TouchableOpacity
                  style={[styles.saveSettingsBtn, savingTerms && styles.btnDisabled, { marginTop: 12 }]}
                  disabled={savingTerms}
                  onPress={handleSaveTermsOfUse}
                >
                  {savingTerms ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.saveSettingsBtnText}>
                      📜 Publicar Nova Versão dos Termos (v{(appSettings?.termsOfUseVersion ?? 1) + 1})
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================= SECTION 5: GESTÃO DE GRUPOS ================= */}
          {activeSection === "groups" && (
            <View style={styles.sectionBody}>
              <View style={styles.sectionHeaderCard}>
                <Text style={styles.sectionHeaderEyebrow}>COMUNIDADES & LIGAS</Text>
                <Text style={styles.sectionHeaderTitle}>Grupos da Plataforma</Text>
                <Text style={styles.sectionHeaderDesc}>
                  Acompanhe todos os grupos privados criados pelos colaboradores com opção de moderação
                  e exclusão definitiva.
                </Text>
              </View>

              {/* Search Bar */}
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Filtrar grupos por nome, descrição ou dono..."
                  placeholderTextColor="#64748b"
                  value={groupSearchQuery}
                  onChangeText={setGroupSearchQuery}
                />
                {groupSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setGroupSearchQuery("")}>
                    <Text style={styles.clearSearchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Group List */}
              {filteredGroups.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>🛡️</Text>
                  <Text style={styles.emptyTitle}>Nenhum grupo encontrado</Text>
                  <Text style={styles.emptyText}>Nenhum grupo corresponde à busca realizada.</Text>
                </View>
              ) : (
                filteredGroups.map((group) => {
                  const owner = usersMap.get(group.ownerId);
                  const dateStr = group.createdAt?.toDate
                    ? group.createdAt.toDate().toLocaleDateString("pt-BR")
                    : group.createdAt?.seconds
                    ? new Date(group.createdAt.seconds * 1000).toLocaleDateString("pt-BR")
                    : "Data desconhecida";

                  return (
                    <View key={group.id} style={styles.groupCard}>
                      <View style={styles.groupCardHeader}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.groupNameRow}>
                            <Text style={styles.groupNameText}>{group.name}</Text>
                            <View style={styles.groupMemberBadge}>
                              <Text style={styles.groupMemberBadgeText}>
                                👥 {group.memberCount || 1} membro(s)
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.groupDescText}>{group.description || "Sem descrição."}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.groupDeleteBtn}
                          onPress={() => handleDeleteGroup(group)}
                        >
                          <Text style={styles.groupDeleteBtnText}>🗑️ Excluir</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.groupMetaRow}>
                        <Text style={styles.groupMetaSnippet}>
                          ID: <Text style={{ color: "#eab308", fontWeight: "bold" }}>{group.id}</Text>
                        </Text>
                        <Text style={styles.groupMetaSnippet}>
                          Dono: {owner?.name || group.ownerId}
                        </Text>
                        <Text style={styles.groupMetaSnippet}>Criado em: {dateStr}</Text>
                        <Text style={styles.groupMetaSnippet}>Ed. {toRoman(group.edition || 1)}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ================= SECTION 6: TENTATIVAS DE REGISTRO ================= */}
          {activeSection === "attempts" && (
            <View style={styles.sectionBody}>
              <View style={styles.sectionHeaderCard}>
                <Text style={styles.sectionHeaderEyebrow}>SEGURANÇA & ONBOARDING</Text>
                <Text style={styles.sectionHeaderTitle}>Tentativas de Cadastro</Text>
                <Text style={styles.sectionHeaderDesc}>
                  Monitore tentativas de registro em tempo real, validação de códigos corporativos de
                  aprovação e e-mails duplicados bloqueados.
                </Text>
              </View>

              {/* Status Filters */}
              <View style={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[styles.chip, attemptFilter === "all" && styles.chipActive]}
                  onPress={() => setAttemptFilter("all")}
                >
                  <Text style={[styles.chipText, attemptFilter === "all" && styles.chipTextActive]}>
                    Todos ({registrationAttempts.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, attemptFilter === "account_created" && styles.chipActive]}
                  onPress={() => setAttemptFilter("account_created")}
                >
                  <Text style={[styles.chipText, attemptFilter === "account_created" && styles.chipTextActive]}>
                    🟢 Contas Criadas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, attemptFilter === "code_requested" && styles.chipActive]}
                  onPress={() => setAttemptFilter("code_requested")}
                >
                  <Text style={[styles.chipText, attemptFilter === "code_requested" && styles.chipTextActive]}>
                    🟡 Código Solicitado
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, attemptFilter === "invalid_code" && styles.chipActive]}
                  onPress={() => setAttemptFilter("invalid_code")}
                >
                  <Text style={[styles.chipText, attemptFilter === "invalid_code" && styles.chipTextActive]}>
                    🔴 Código Inválido
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Attempts List */}
              {filteredAttempts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyTitle}>Nenhuma tentativa encontrada</Text>
                  <Text style={styles.emptyText}>Novas tentativas de cadastro aparecerão aqui.</Text>
                </View>
              ) : (
                filteredAttempts.map((att) => {
                  const dateStr = att.createdAt?.toDate
                    ? att.createdAt.toDate().toLocaleString("pt-BR")
                    : att.createdAt?.seconds
                    ? new Date(att.createdAt.seconds * 1000).toLocaleString("pt-BR")
                    : "Recentemente";

                  let statusBadgeColor = "#3b82f6";
                  let statusText: string = att.status;

                  if (att.status === "account_created") {
                    statusBadgeColor = "#10b981";
                    statusText = "CONTA CRIADA";
                  } else if (att.status === "code_requested") {
                    statusBadgeColor = "#eab308";
                    statusText = "CÓDIGO SOLICITADO";
                  } else if (att.status === "invalid_code") {
                    statusBadgeColor = "#ef4444";
                    statusText = "CÓDIGO INVÁLIDO";
                  } else if (att.status === "failed") {
                    statusBadgeColor = "#ef4444";
                    statusText = "FALHA";
                  }

                  const codeUsed = att.groupCodeProvided || att.approvalCodeProvided;

                  return (
                    <View key={att.id} style={styles.attemptCard}>
                      <View style={styles.attemptHeaderRow}>
                        <View style={[styles.attemptBadge, { backgroundColor: `${statusBadgeColor}22` }]}>
                          <Text style={[styles.attemptBadgeText, { color: statusBadgeColor }]}>
                            {statusText}
                          </Text>
                        </View>
                        <Text style={styles.attemptDateText}>{dateStr}</Text>
                      </View>

                      <Text style={styles.attemptEmailText}>{att.email}</Text>

                      <View style={styles.attemptDetailsRow}>
                        <Text style={styles.attemptSnippet}>
                          Código Usado:{" "}
                          <Text style={{ color: codeUsed ? "#eab308" : "#64748b", fontWeight: "bold" }}>
                            {codeUsed || "Nenhum"}
                          </Text>
                        </Text>
                        {att.message ? (
                          <Text style={styles.attemptSnippet}>• {att.message}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ================= SECTION 7: RESET SEMANAL ================= */}
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

          {/* ================= SECTION 8: LOGS DE AUDITORIA ================= */}
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
                  } else if (log.action === "adjust_points") {
                    icon = "🎯";
                    badgeColor = "#3b82f6";
                    actionText = "AJUSTE PONTOS";
                  } else if (log.action === "adjust_poopcoins") {
                    icon = "🪙";
                    badgeColor = "#eab308";
                    actionText = "AJUSTE POOPCOINS";
                  } else if (log.action === "remove_log") {
                    icon = "🧻";
                    badgeColor = "#ef4444";
                    actionText = "EXCLUSÃO LOG";
                  } else if (log.action === "delete_group") {
                    icon = "🛡️";
                    badgeColor = "#ef4444";
                    actionText = "EXCLUSÃO GRUPO";
                  } else if (log.action === "update_terms_of_use") {
                    icon = "📜";
                    badgeColor = "#10b981";
                    actionText = "NOVA VERSÃO TERMOS";
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

                      <View style={styles.auditMetaRow}>
                        <Text style={styles.auditAdminSnippet}>
                          Admin: {usersMap.get(log.adminId)?.name || log.adminName || log.adminId}
                        </Text>
                        {typeof log.edition === "number" && (
                          <Text style={styles.auditEditionSnippet}>
                            Ed. {toRoman(log.edition)}
                          </Text>
                        )}
                        {typeof log.delta === "number" && (
                          <Text style={[styles.auditEditionSnippet, { color: log.delta > 0 ? "#10b981" : "#ef4444" }]}>
                            {log.delta > 0 ? `+${log.delta}` : log.delta} pts
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

      {/* ================= MODAL: AJUSTE DE PONTOS MANUAL ================= */}
      <Modal
        visible={!!adjustPointsUser}
        transparent
        animationType="fade"
        onRequestClose={() => setAdjustPointsUser(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎯 Ajustar Pontos do Usuário</Text>
            <Text style={styles.modalSubtitle}>
              Ajuste manual da pontuação vitalícia e semanal de{" "}
              <Text style={{ fontWeight: "700", color: "#eab308" }}>
                {adjustPointsUser?.name || "este usuário"}
              </Text>
              .
            </Text>

            {/* Quick buttons */}
            <Text style={styles.modalInputLabel}>Atalhos rápidos:</Text>
            <View style={styles.quickButtonsGrid}>
              <TouchableOpacity
                style={[styles.quickBtn, { backgroundColor: "#10b98122", borderColor: "#10b981" }]}
                onPress={() => handleApplyAdjustPoints(2000)}
                disabled={savingPoints}
              >
                <Text style={[styles.quickBtnText, { color: "#10b981" }]}>+2.000 pts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickBtn, { backgroundColor: "#10b98122", borderColor: "#10b981" }]}
                onPress={() => handleApplyAdjustPoints(5000)}
                disabled={savingPoints}
              >
                <Text style={[styles.quickBtnText, { color: "#10b981" }]}>+5.000 pts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickBtn, { backgroundColor: "#ef444422", borderColor: "#ef4444" }]}
                onPress={() => handleApplyAdjustPoints(-2000)}
                disabled={savingPoints}
              >
                <Text style={[styles.quickBtnText, { color: "#ef4444" }]}>-2.000 pts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickBtn, { backgroundColor: "#ef444422", borderColor: "#ef4444" }]}
                onPress={() => handleApplyAdjustPoints(-5000)}
                disabled={savingPoints}
              >
                <Text style={[styles.quickBtnText, { color: "#ef4444" }]}>-5.000 pts</Text>
              </TouchableOpacity>
            </View>

            {/* Custom Input */}
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Ou digite um valor customizado (+ ou -):</Text>
              <TextInput
                style={styles.modalTextInput}
                keyboardType="numeric"
                value={customDeltaInput}
                onChangeText={setCustomDeltaInput}
                placeholder="Ex: 1500 ou -1500"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAdjustPointsUser(null)}
                disabled={savingPoints}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, savingPoints && styles.btnDisabled]}
                onPress={() => {
                  const val = parseInt(customDeltaInput, 10);
                  if (!isNaN(val) && val !== 0) {
                    handleApplyAdjustPoints(val);
                  } else {
                    Alert.alert("Erro", "Digite um valor inteiro diferente de zero.");
                  }
                }}
                disabled={savingPoints}
              >
                {savingPoints ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Aplicar Ajuste</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: AJUSTE DE POOPCOINS ================= */}
      <Modal
        visible={!!adjustPoopcoinsUser}
        transparent
        animationType="fade"
        onRequestClose={() => setAdjustPoopcoinsUser(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🪙 Ajuste de PoopCoins</Text>
            <Text style={styles.modalSubtitle}>
              Crédito ou débito administrativo no saldo de{" "}
              <Text style={{ fontWeight: "700", color: "#eab308" }}>
                {adjustPoopcoinsUser?.name || "este usuário"}
              </Text>
              . Saldo atual: {(adjustPoopcoinsUser?.poopcoinBalance || 0).toLocaleString()} PC.
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Quantidade (+ para crédito, - para débito):</Text>
              <TextInput
                style={styles.modalTextInput}
                keyboardType="numeric"
                value={adjustPoopcoinsAmount}
                onChangeText={setAdjustPoopcoinsAmount}
                placeholder="Ex: 10 ou -10"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Motivo / Justificativa (Obrigatório):</Text>
              <TextInput
                style={styles.modalTextInput}
                value={adjustPoopcoinsReason}
                onChangeText={setAdjustPoopcoinsReason}
                placeholder="Ex: Bônus por destaque, estorno de postagem..."
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAdjustPoopcoinsUser(null)}
                disabled={savingPoopcoins}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, savingPoopcoins && styles.btnDisabled]}
                onPress={handleApplyAdjustPoopcoins}
                disabled={savingPoopcoins}
              >
                {savingPoopcoins ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Registrar no Ledger</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

  // Section Header Card
  sectionHeaderCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 4,
  },
  sectionHeaderEyebrow: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#eab308",
    letterSpacing: 1,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
  },
  sectionHeaderDesc: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
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
    gap: 3,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userNameText: {
    fontSize: 16,
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
    color: "#38bdf8",
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
    marginTop: 2,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillAdmin: {
    backgroundColor: "#eab30822",
  },
  pillPlayer: {
    backgroundColor: "#334155",
  },
  pillActive: {
    backgroundColor: "#10b98122",
  },
  pillBanned: {
    backgroundColor: "#ef444422",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  pillTextAdmin: {
    color: "#eab308",
  },
  pillTextPlayer: {
    color: "#94a3b8",
  },
  pillTextActive: {
    color: "#10b981",
  },
  pillTextBanned: {
    color: "#ef4444",
  },

  // Stats snippet
  userStatsSnippet: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  snippetCol: {
    flex: 1,
    alignItems: "center",
  },
  snippetLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  snippetVal: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#f8fafc",
    marginTop: 2,
  },
  snippetDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#1e293b",
  },

  // User Actions Row
  userActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  userActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  userActionBtnDanger: {
    borderColor: "#ef444455",
    backgroundColor: "#ef444415",
  },
  userActionBtnSuccess: {
    borderColor: "#10b98155",
    backgroundColor: "#10b98115",
  },
  userActionBtnWarning: {
    borderColor: "#f9731655",
    backgroundColor: "#f9731615",
  },
  userActionBtnPurple: {
    borderColor: "#a855f755",
    backgroundColor: "#a855f715",
  },
  userActionBtnNeutral: {
    borderColor: "#475569",
    backgroundColor: "#334155",
  },
  userActionBtnGold: {
    borderColor: "#eab30855",
    backgroundColor: "#eab30815",
  },
  userActionBtnOutline: {
    borderColor: "#3b82f655",
    backgroundColor: "transparent",
  },
  userActionBtnText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  userActionBtnTextDanger: {
    color: "#ef4444",
  },
  userActionBtnTextSuccess: {
    color: "#10b981",
  },
  userActionBtnTextWarning: {
    color: "#f97316",
  },
  userActionBtnTextPurple: {
    color: "#c084fc",
  },
  userActionBtnTextNeutral: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "bold",
  },
  userActionBtnTextGold: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "bold",
  },
  userActionBtnTextOutline: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "bold",
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // Log Card
  logCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  logCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  logInfoCol: {
    flex: 1,
  },
  logAuthorText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  logDateText: {
    fontSize: 11,
    color: "#64748b",
  },
  logDeleteBtn: {
    backgroundColor: "#ef444422",
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logDeleteBtnText: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "bold",
  },
  logMetricsRow: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
  },
  logMetricCol: {
    flex: 1,
    alignItems: "center",
  },
  logMetricLabel: {
    fontSize: 10,
    color: "#64748b",
  },
  logMetricVal: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#f8fafc",
    marginTop: 2,
  },
  logMetricDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#1e293b",
  },
  logNoteBox: {
    backgroundColor: "#0f172a88",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logNoteText: {
    fontSize: 12,
    color: "#cbd5e1",
    fontStyle: "italic",
  },

  // Supply Cards Grid
  supplyCardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  supplyCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 4,
  },
  supplyCardLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#94a3b8",
    letterSpacing: 1,
  },
  supplyCardVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f8fafc",
  },
  supplyCardSub: {
    fontSize: 11,
    color: "#64748b",
  },

  // Card Box (general reusable)
  cardBox: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
  },
  cardBoxTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  cardBoxDesc: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 18,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    gap: 12,
  },
  actionItemTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  actionItemDesc: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
    lineHeight: 16,
  },
  smallBtn: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  smallBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  smallBtnGold: {
    backgroundColor: "#eab308",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  smallBtnGoldText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "900",
  },
  smallAddBtn: {
    backgroundColor: "#eab30822",
    borderWidth: 1,
    borderColor: "#eab308",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  smallAddBtnText: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "bold",
  },
  dangerBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  dangerBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },

  // Blockchain Tx Item
  txItem: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  txItemReversed: {
    borderColor: "#ef444455",
    borderWidth: 1,
  },
  txHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  txBadge: {
    backgroundColor: "#334155",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  txBadgeText: {
    color: "#eab308",
    fontSize: 10,
    fontWeight: "bold",
  },
  txTypePill: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txTypeText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "bold",
  },
  txAmountText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#eab308",
    marginLeft: "auto",
  },
  txHashText: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  txReasonText: {
    fontSize: 11,
    color: "#94a3b8",
    fontStyle: "italic",
  },

  // Toggle Row
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // Bonus Range Row
  bonusRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  bonusTimeInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  bonusPointsInput: {
    width: 80,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  bonusRemoveBtn: {
    backgroundColor: "#ef444422",
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  bonusRemoveBtnText: {
    color: "#ef4444",
    fontWeight: "bold",
    fontSize: 14,
  },

  // Terms of Use
  termsTextArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  // Group Card
  groupCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  groupCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  groupNameText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  groupMemberBadge: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  groupMemberBadgeText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "bold",
  },
  groupDescText: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  groupDeleteBtn: {
    backgroundColor: "#ef444422",
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  groupDeleteBtnText: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "bold",
  },
  groupMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
    paddingTop: 8,
  },
  groupMetaSnippet: {
    fontSize: 11,
    color: "#64748b",
  },

  // Attempt Card
  attemptCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 6,
  },
  attemptHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attemptBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  attemptBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  attemptDateText: {
    fontSize: 11,
    color: "#64748b",
  },
  attemptEmailText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  attemptDetailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attemptSnippet: {
    fontSize: 11,
    color: "#94a3b8",
  },

  // Settings Header Card
  settingsHeaderCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 4,
  },
  settingsHeaderEyebrow: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#eab308",
    letterSpacing: 1,
  },
  settingsHeaderTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
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
    padding: 12,
    borderRadius: 12,
  },
  successBannerText: {
    color: "#10b981",
    fontWeight: "bold",
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  formHint: {
    fontSize: 11,
    color: "#94a3b8",
  },
  formSubhint: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 15,
  },
  formInput: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 14,
  },
  formInputArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  saveSettingsBtn: {
    backgroundColor: "#eab308",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveSettingsBtnText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },

  // Reset Semanal Cards
  editionHeroCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eab30844",
    gap: 8,
  },
  editionRomanBadge: {
    backgroundColor: "#eab30822",
    borderWidth: 1,
    borderColor: "#eab308",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  editionRomanText: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  editionHeroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
    textAlign: "center",
  },
  editionHeroSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
  },
  editionDetailsRow: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: "100%",
    marginTop: 8,
  },
  editionDetailCol: {
    flex: 1,
    alignItems: "center",
  },
  editionDetailLabel: {
    fontSize: 10,
    color: "#64748b",
  },
  editionDetailVal: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#eab308",
    marginTop: 2,
  },
  editionDetailDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#1e293b",
  },

  resetImpactCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
  },
  resetImpactTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#f8fafc",
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
    backgroundColor: "#ef444415",
    borderWidth: 1,
    borderColor: "#ef444444",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  warningIcon: {
    fontSize: 22,
  },
  warningTextCol: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#ef4444",
  },
  warningDesc: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
    lineHeight: 16,
  },
  triggerResetBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  triggerResetBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },

  // Audit Logs
  auditHeaderCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 4,
  },
  auditHeaderEyebrow: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#eab308",
    letterSpacing: 1,
  },
  auditHeaderTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
  },
  auditHeaderDesc: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  auditCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
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
    fontWeight: "bold",
  },
  auditDateText: {
    fontSize: 11,
    color: "#64748b",
  },
  auditMessageText: {
    fontSize: 13,
    color: "#f8fafc",
    lineHeight: 18,
  },
  auditMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
    paddingTop: 8,
  },
  auditAdminSnippet: {
    fontSize: 11,
    color: "#94a3b8",
  },
  auditEditionSnippet: {
    fontSize: 11,
    color: "#eab308",
    fontWeight: "bold",
  },

  // Modals Common
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
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
    marginVertical: 4,
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

  // Quick buttons grid
  quickButtonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 4,
  },
  quickBtn: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: "bold",
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
