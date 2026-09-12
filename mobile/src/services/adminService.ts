import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { AdminAuditLog, AdminAuditAction, AppSettings, AppUser, RankingGroup } from "../types";
import { toRoman } from "../utils/roman";

export const adminLogsRef = collection(db, "admin_audit_logs");
export const appSettingsDocRef = doc(db, "app_settings", "global");

export function createAuditLogRecord({
  action,
  admin,
  targetUser,
  delta,
  points,
  removedLogId,
  cooldownMinutes,
  pointsPerLog,
  poopcoinsPerLog,
  cuiterPostCost,
  edition,
  poopcoins,
  poopcoinTransactionHash,
}: {
  action: AdminAuditAction;
  admin: AppUser;
  targetUser?: Pick<AppUser, "uid" | "name"> | null;
  delta?: number;
  points?: number;
  removedLogId?: string;
  cooldownMinutes?: number;
  pointsPerLog?: number;
  poopcoinsPerLog?: number;
  cuiterPostCost?: number;
  edition?: number;
  poopcoins?: number;
  poopcoinTransactionHash?: string;
}) {
  return {
    action,
    adminId: admin.uid,
    adminName: admin.name || "Admin",
    targetUserId: targetUser?.uid ?? null,
    targetUserName: targetUser?.name ?? null,
    delta: delta ?? null,
    points: points ?? null,
    removedLogId: removedLogId ?? null,
    cooldownMinutes: cooldownMinutes ?? null,
    pointsPerLog: pointsPerLog ?? null,
    poopcoinsPerLog: poopcoinsPerLog ?? null,
    cuiterPostCost: cuiterPostCost ?? null,
    edition: edition ?? null,
    poopcoins: poopcoins ?? null,
    poopcoinTransactionHash: poopcoinTransactionHash ?? null,
    createdAt: Timestamp.now(),
  };
}

/**
 * Escuta todos os usuários cadastrados em tempo real
 */
export function listenAllUsers(callback: (users: AppUser[]) => void): () => void {
  const usersRef = collection(db, "users");
  return onSnapshot(
    usersRef,
    (snapshot) => {
      const users: AppUser[] = [];
      snapshot.forEach((d) => {
        users.push({
          ...(d.data() as AppUser),
          uid: d.id,
        });
      });
      // Ordena por nome ou pontos
      users.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
      callback(users);
    },
    (err) => {
      console.warn("Erro ao escutar usuários:", err);
    }
  );
}

/**
 * Escuta as configurações globais em tempo real
 */
export function listenAppSettings(callback: (settings: AppSettings) => void): () => void {
  return onSnapshot(
    appSettingsDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          cooldownMinutes: Number(data.cooldownMinutes ?? 15),
          pointsPerLog: Number(data.pointsPerLog ?? 2000),
          poopcoinsPerLog: Number(data.poopcoinsPerLog ?? 1),
          cuiterPostCost: Number(data.cuiterPostCost ?? 5),
          edition: Number(data.edition ?? 1),
          overallRankingVisible: Boolean(data.overallRankingVisible),
          termsOfUseText: data.termsOfUseText,
          termsOfUseVersion: Number(data.termsOfUseVersion ?? 1),
          competitionAnnouncement: data.competitionAnnouncement || "",
        });
      } else {
        callback({
          cooldownMinutes: 15,
          pointsPerLog: 2000,
          poopcoinsPerLog: 1,
          cuiterPostCost: 5,
          edition: 1,
          termsOfUseVersion: 1,
          competitionAnnouncement: "",
        });
      }
    },
    (err) => {
      console.warn("Erro ao escutar app_settings:", err);
    }
  );
}

/**
 * Escuta os logs de auditoria em tempo real
 */
export function listenAuditLogs(
  callback: (logs: AdminAuditLog[]) => void,
  limitCount: number = 60
): () => void {
  const q = query(adminLogsRef, orderBy("createdAt", "desc"), limit(limitCount));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AdminAuditLog[] = [];
      snapshot.forEach((d) => {
        logs.push({
          id: d.id,
          ...(d.data() as Omit<AdminAuditLog, "id">),
        });
      });
      callback(logs);
    },
    (err) => {
      console.warn("Erro ao escutar logs de auditoria:", err);
    }
  );
}

/**
 * Desativa/Bane um usuário
 */
export async function deactivateUser(admin: AppUser, targetUser: AppUser): Promise<void> {
  if (admin.uid === targetUser.uid) {
    throw new Error("Você não pode desativar ou banir a sua própria conta.");
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "users", targetUser.uid), {
    isActive: false,
    deactivatedAt: Timestamp.now(),
    deactivatedBy: admin.uid,
  });

  const newLogRef = doc(adminLogsRef);
  batch.set(
    newLogRef,
    createAuditLogRecord({
      action: "deactivate_user",
      admin,
      targetUser,
    })
  );

  await batch.commit();
}

/**
 * Reativa um usuário anteriormente banido/desativado
 */
export async function reactivateUser(admin: AppUser, targetUser: AppUser): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", targetUser.uid), {
    isActive: true,
    deactivatedAt: null,
    deactivatedBy: null,
  });

  const newLogRef = doc(adminLogsRef);
  batch.set(
    newLogRef,
    createAuditLogRecord({
      action: "reactivate_user",
      admin,
      targetUser,
    })
  );

  await batch.commit();
}

/**
 * Altera o papel (role) de um usuário: Promove a admin ou rebaixa a jogador
 */
export async function setUserRole(
  admin: AppUser,
  targetUser: AppUser,
  newRole: "player" | "admin"
): Promise<void> {
  if (admin.uid === targetUser.uid && newRole !== "admin") {
    throw new Error("Você não pode remover seu próprio privilégio de administrador.");
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "users", targetUser.uid), { role: newRole });

  const action: AdminAuditAction = newRole === "admin" ? "promote_admin" : "demote_admin";
  const newLogRef = doc(adminLogsRef);
  batch.set(
    newLogRef,
    createAuditLogRecord({
      action,
      admin,
      targetUser,
    })
  );

  await batch.commit();
}

/**
 * Ajusta cooldown customizado para um usuário específico
 */
export async function setUserCooldown(
  admin: AppUser,
  targetUid: string,
  targetName: string,
  cooldownMinutes: number
): Promise<void> {
  const batch = writeBatch(db);
  const ms = Math.max(0, Math.trunc(cooldownMinutes)) * 60_000;
  const until = Timestamp.fromMillis(Date.now() + ms);

  batch.update(doc(db, "users", targetUid), { cooldownUntil: until });

  const newLogRef = doc(adminLogsRef);
  batch.set(
    newLogRef,
    createAuditLogRecord({
      action: "update_cooldown",
      admin,
      targetUser: { uid: targetUid, name: targetName },
      cooldownMinutes,
    })
  );

  await batch.commit();
}

/**
 * Atualiza os parâmetros globais da competição:
 * - Cooldown entre cagadas (minutos)
 * - Pontos por log
 * - Custo de postagem do Cuiter (PoopCoins)
 * - PoopCoins recebidas por log
 * - Comunicado oficial do Admin
 */
export async function updateCompetitionSettings(
  admin: AppUser,
  settings: {
    cooldownMinutes: number;
    pointsPerLog: number;
    cuiterPostCost: number;
    poopcoinsPerLog: number;
    competitionAnnouncement?: string;
  }
): Promise<void> {
  const normalizedCooldown = Math.max(1, Math.min(1440, Math.trunc(settings.cooldownMinutes)));
  const normalizedPoints = Math.max(1, Math.min(100000, Math.trunc(settings.pointsPerLog)));
  const normalizedCuiterCost = Math.max(1, Math.min(100000, Math.trunc(settings.cuiterPostCost)));
  const normalizedPoopcoinsPerLog = Math.max(1, Math.min(100000, Math.trunc(settings.poopcoinsPerLog)));
  const normalizedAnnouncement = (settings.competitionAnnouncement || "").trim().slice(0, 280);

  const batch = writeBatch(db);

  batch.set(
    appSettingsDocRef,
    {
      cooldownMinutes: normalizedCooldown,
      pointsPerLog: normalizedPoints,
      cuiterPostCost: normalizedCuiterCost,
      poopcoinsPerLog: normalizedPoopcoinsPerLog,
      competitionAnnouncement: normalizedAnnouncement,
      updatedAt: Timestamp.now(),
      updatedBy: admin.uid,
    },
    { merge: true }
  );

  // Registra logs de auditoria
  const logRef1 = doc(adminLogsRef);
  batch.set(
    logRef1,
    createAuditLogRecord({
      action: "update_cooldown",
      admin,
      cooldownMinutes: normalizedCooldown,
    })
  );

  const logRef2 = doc(adminLogsRef);
  batch.set(
    logRef2,
    createAuditLogRecord({
      action: "update_points_per_log",
      admin,
      pointsPerLog: normalizedPoints,
    })
  );

  const logRef3 = doc(adminLogsRef);
  batch.set(
    logRef3,
    createAuditLogRecord({
      action: "update_poopcoin_rules",
      admin,
      poopcoinsPerLog: normalizedPoopcoinsPerLog,
      cuiterPostCost: normalizedCuiterCost,
    })
  );

  if (normalizedAnnouncement) {
    const logRef4 = doc(adminLogsRef);
    batch.set(
      logRef4,
      createAuditLogRecord({
        action: "update_competition_announcement",
        admin,
      })
    );
  }

  await batch.commit();
}

/**
 * Dispara o fechamento da edição semanal da competição:
 * 1. Zera o saldo de weeklyPoints de todos os usuários
 * 2. Desativa os logs ativos da semana (isWeeklyActive: false)
 * 3. Incrementa a edição global em app_settings
 * 4. Incrementa a edição em todos os grupos/ligas
 * 5. Registra o fechamento nos logs de auditoria
 */
export async function resetWeeklyCompetition(
  admin: AppUser
): Promise<{ newEdition: number; usersReset: number }> {
  // 1. Carrega dados atuais
  const settingsSnap = await getDoc(appSettingsDocRef);
  const currentEdition = Number(settingsSnap.data()?.edition ?? 17);
  const nextEdition = Math.max(1, Math.trunc(currentEdition)) + 1;

  // Carrega usuários, logs semanais ativos e grupos
  const [usersSnap, activeLogsSnap, groupsSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(query(collection(db, "poop_logs"), where("isWeeklyActive", "==", true))),
    getDocs(collection(db, "groups")),
  ]);

  // Executa em lotes (Firestore suporta até 500 operações por batch)
  const MAX_BATCH_SIZE = 400;
  let currentBatch = writeBatch(db);
  let opCount = 0;

  const commitBatchIfNeeded = async () => {
    if (opCount >= MAX_BATCH_SIZE) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  };

  // Zerar weeklyPoints dos usuários
  usersSnap.forEach((userDoc) => {
    currentBatch.update(userDoc.ref, { weeklyPoints: 0 });
    opCount++;
  });
  await commitBatchIfNeeded();

  // Desativar logs ativos da semana
  activeLogsSnap.forEach((logDoc) => {
    currentBatch.update(logDoc.ref, { isWeeklyActive: false });
    opCount++;
  });
  await commitBatchIfNeeded();

  // Atualizar edição de todos os grupos
  groupsSnap.forEach((groupDoc) => {
    const groupData = groupDoc.data() as RankingGroup;
    currentBatch.update(groupDoc.ref, {
      edition: Math.max(1, Math.trunc(Number(groupData.edition ?? currentEdition))) + 1,
      updatedAt: Timestamp.now(),
    });
    opCount++;
  });
  await commitBatchIfNeeded();

  // Atualizar app_settings
  currentBatch.set(
    appSettingsDocRef,
    {
      edition: nextEdition,
      overallRankingVisible: true,
      lastWeeklyResetAt: Timestamp.now(),
      lastWeeklyResetBy: admin.uid,
      updatedAt: Timestamp.now(),
      updatedBy: admin.uid,
    },
    { merge: true }
  );
  opCount++;

  // Gravar log de auditoria
  const auditDocRef = doc(adminLogsRef);
  currentBatch.set(
    auditDocRef,
    createAuditLogRecord({
      action: "reset_weekly",
      admin,
      edition: nextEdition,
    })
  );
  opCount++;

  await currentBatch.commit();

  return {
    newEdition: nextEdition,
    usersReset: usersSnap.size,
  };
}

/**
 * Formata amigavelmente a mensagem de um log de auditoria para exibição
 */
export function formatAuditLogMessage(
  log: AdminAuditLog,
  usersMap: Map<string, AppUser>
): string {
  const adminName =
    usersMap.get(log.adminId)?.name ||
    usersMap.get(log.adminId)?.nickname ||
    log.adminName ||
    "Administrador";

  const targetName = log.targetUserId
    ? usersMap.get(log.targetUserId)?.name ||
      usersMap.get(log.targetUserId)?.nickname ||
      log.targetUserName ||
      "Usuário"
    : null;

  switch (log.action) {
    case "reset_weekly":
      return typeof log.edition === "number"
        ? `${adminName} disparou o fechamento semanal da Edição ${toRoman(log.edition)}.`
        : `${adminName} disparou o fechamento da edição semanal.`;

    case "deactivate_user":
      return targetName
        ? `${adminName} baniu/desativou o usuário ${targetName}.`
        : `${adminName} desativou um usuário.`;

    case "reactivate_user":
      return targetName
        ? `${adminName} reativou o usuário ${targetName}.`
        : `${adminName} reativou um usuário.`;

    case "promote_admin":
      return targetName
        ? `${adminName} promoveu ${targetName} a Administrador.`
        : `${adminName} promoveu um usuário a Administrador.`;

    case "demote_admin":
      return targetName
        ? `${adminName} rebaixou ${targetName} a Jogador.`
        : `${adminName} removeu privilégio de Administrador de um usuário.`;

    case "update_cooldown":
      return typeof log.cooldownMinutes === "number"
        ? targetName
          ? `${adminName} ajustou cooldown de ${targetName} para ${log.cooldownMinutes} min.`
          : `${adminName} alterou o cooldown geral entre logs para ${log.cooldownMinutes} min.`
        : `${adminName} atualizou as configurações de cooldown.`;

    case "update_points_per_log":
      return typeof log.pointsPerLog === "number"
        ? `${adminName} alterou os pontos base por log para ${log.pointsPerLog.toLocaleString()} pts.`
        : `${adminName} alterou os pontos por log da competição.`;

    case "update_poopcoin_rules":
      return `${adminName} atualizou regras de PoopCoin (Custo Cuiter: ${
        log.cuiterPostCost ?? 5
      } PC, Ganho por log: ${log.poopcoinsPerLog ?? 1} PC).`;

    case "update_competition_announcement":
      return `${adminName} atualizou o comunicado oficial da competição.`;

    case "adjust_points":
      return targetName && typeof log.delta === "number"
        ? `${adminName} ajustou ${log.delta > 0 ? `+${log.delta}` : log.delta} pontos de ${targetName}.`
        : `${adminName} realizou um ajuste manual de pontos.`;

    case "adjust_poopcoins":
      return targetName && typeof log.poopcoins === "number"
        ? `${adminName} ajustou ${
            log.poopcoins > 0 ? `+${log.poopcoins}` : log.poopcoins
          } PoopCoins de ${targetName}.`
        : `${adminName} realizou um manual ajuste de PoopCoins.`;

    case "remove_log":
      return targetName
        ? `${adminName} removeu um registro de ${targetName}${
            typeof log.points === "number" ? ` (-${log.points} pts)` : ""
          }.`
        : `${adminName} removeu um registro de cagada.`;

    case "reverse_poopcoin_transaction":
      return `${adminName} reverteu uma transação no Ledger de PoopCoins.`;

    case "migrate_poopcoins":
      return `${adminName} executou uma migração em lote de PoopCoins.`;

    case "recalculate_poopcoin_supply":
      return `${adminName} recalculou o suprimento total da rede PoopCoin.`;

    default:
      return `${adminName} executou uma ação administrativa (${log.action}).`;
  }
}
