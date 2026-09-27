import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  where,
  writeBatch,
} from "@firebase/firestore";
import { db } from "./firebase";
import type { AdminAuditAction, AppUser, BonusTimeRange, PoopLocation, PoopLog, RankingGroup, EditionRecord, EditionCompetitor } from "../types";
import { toRoman } from "../utils/roman";
import {
  DAILY_LIMIT,
  calculateDailyStreak,
  calculateWeeklyStreak,
  countToday,
  getCooldownSeconds,
} from "../utils/date";
import {
  assertActiveWorkTime,
  hasCompleteWorkSchedule,
  isBetweenMinutes,
  minutesOfDay,
  resolveWorkSchedule,
} from "../utils/workSchedule";
import i18n from "../i18n";
import { RegisterPoopError } from "../utils/registerPoopError";
import { getCurrentTermsVersion, hasAcceptedCurrentTerms } from "../utils/terms";
import {
  appendPoopcoinTransaction,
  poopcoinChainHeadRef,
  resolveMintablePoopcoins,
} from "./poopcoinService";

export const usersRef = collection(db, "users");
export const logsRef = collection(db, "poop_logs");
export const adminLogsRef = collection(db, "admin_audit_logs");

export function createAuditLog({
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
  targetUser?: Pick<AppUser, "uid">;
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
    targetUserId: targetUser?.uid ?? null,
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

export function usersQuery() {
  return query(usersRef, orderBy("totalPoints", "desc"));
}

export function userLogsQuery(uid: string) {
  return query(logsRef, where("userId", "==", uid));
}

export function latestUserLogQuery(uid: string) {
  return query(logsRef, where("userId", "==", uid), orderBy("createdAt", "desc"), limit(1));
}

export function allLogsQuery() {
  return query(logsRef, orderBy("createdAt", "desc"));
}

export function adminAuditLogsQuery() {
  return query(adminLogsRef, orderBy("createdAt", "desc"));
}

export function competitionResetAuditLogsQuery() {
  return query(adminLogsRef, where("action", "==", "reset_weekly"), orderBy("createdAt", "desc"));
}

function resolvePointsPerLog(
  settings: Record<string, unknown> | undefined,
  localTime: string,
  fallback: number,
) {
  let pointsPerLog = Math.max(1, Number(settings?.pointsPerLog ?? fallback));
  const bonusRanges = Array.isArray(settings?.bonusTimeRanges)
    ? (settings.bonusTimeRanges as BonusTimeRange[])
    : [];
  const currentMinutes = minutesOfDay(localTime);

  for (const range of bonusRanges) {
    const start = typeof range.start === "string" ? range.start : "00:00";
    const end = typeof range.end === "string" ? range.end : "00:00";
    const points = Number(range.points) || pointsPerLog;
    if (isBetweenMinutes(currentMinutes, minutesOfDay(start), minutesOfDay(end))) {
      pointsPerLog = Math.max(pointsPerLog, Math.trunc(points));
    }
  }

  return pointsPerLog;
}

function resolvePoopcoinsPerLog(settings: Record<string, unknown> | undefined) {
  const value = Number(settings?.poopcoinsPerLog ?? 1);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(100000, Math.trunc(value)));
}

function resolveLogPoopcoins(log: Partial<PoopLog>) {
  if (typeof log.poopcoinsEarned === "number") {
    return Math.max(0, Math.trunc(log.poopcoinsEarned));
  }

  return log.poopcoinTransactionHash ? 1 : 0;
}

function assertLocation(location: PoopLocation) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const accuracy = location.accuracy == null ? null : Number(location.accuracy);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RegisterPoopError("location_invalid", "Latitude invalida.");
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RegisterPoopError("location_invalid", "Longitude invalida.");
  }

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
  };
}

export async function registerPoopWithValidation(
  user: AppUser,
  userLogs: PoopLog[],
  location: PoopLocation,
  cooldownMinutes: number,
  pointsPerLog: number,
) {
  if (user.isActive === false) {
    throw new RegisterPoopError("deactivated_user", i18n.t("auth:deactivated_user"));
  }

  if (!hasCompleteWorkSchedule(user.workSchedule)) {
    throw new RegisterPoopError(
      "missing_work_schedule",
      i18n.t("services:poop.missingWorkSchedule", {
        defaultValue: "Preencha seu horario de expediente no perfil antes de registrar.",
      }),
      "profile",
    );
  }

  const cooldown = getCooldownSeconds(userLogs, cooldownMinutes);
  if (cooldown > 0) {
    throw new RegisterPoopError(
      "cooldown",
      i18n.t("services:poop.cooldown", { count: Math.ceil(cooldown / 60) }),
    );
  }

  if (user.cooldownUntil && user.cooldownUntil.toMillis() > Date.now()) {
    throw new RegisterPoopError(
      "cooldown",
      `Usuario em cooldown ate ${user.cooldownUntil.toDate().toLocaleString("pt-BR")}.`,
    );
  }

  if (countToday(userLogs) >= DAILY_LIMIT) {
    throw new RegisterPoopError(
      "daily_limit",
      i18n.t("services:poop.dailyLimit", { count: DAILY_LIMIT }),
    );
  }

  const validatedLocation = assertLocation(location);
  const schedule = resolveWorkSchedule(user.workSchedule);
  const now = Timestamp.now();
  const nowDate = now.toDate();
  const localTime = assertActiveWorkTime(schedule, nowDate);
  const userRef = doc(db, "users", user.uid);
  const settingsRef = doc(db, "app_settings", APP_SETTINGS_DOC_ID);
  const logRef = doc(logsRef);

  await runTransaction(db, async (transaction) => {
    const [userSnapshot, settingsSnapshot, headSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(settingsRef),
      transaction.get(poopcoinChainHeadRef),
    ]);
    const currentUser = userSnapshot.data() as AppUser | undefined;
    if (!currentUser) {
      throw new RegisterPoopError("invalid_work_schedule", "Perfil do usuario nao encontrado.");
    }

    if (!hasCompleteWorkSchedule(currentUser.workSchedule)) {
      throw new RegisterPoopError(
        "missing_work_schedule",
        i18n.t("services:poop.missingWorkSchedule", {
          defaultValue: "Preencha seu horario de expediente no perfil antes de registrar.",
        }),
        "profile",
      );
    }

    const settings = settingsSnapshot.data();
    const currentTermsVersion = getCurrentTermsVersion({
      termsOfUseVersion: Number(settings?.termsOfUseVersion ?? undefined),
    });
    if (!hasAcceptedCurrentTerms(currentUser, { termsOfUseVersion: currentTermsVersion })) {
      throw new RegisterPoopError(
        "missing_terms",
        i18n.t("services:poop.missingTerms", {
          defaultValue: "Aceite os termos atualizados para continuar registrando.",
        }),
        "terms",
      );
    }
    const resolvedPoints = resolvePointsPerLog(settings, localTime, pointsPerLog);
    const poopcoinsEarned = resolveMintablePoopcoins(
      headSnapshot.data() as Record<string, unknown> | undefined,
      resolvePoopcoinsPerLog(settings),
    );
    const resolvedCooldownMinutes = Math.max(0, Number(settings?.cooldownMinutes ?? cooldownMinutes));
    const currentEdition = Math.max(1, Math.trunc(Number(settings?.edition ?? 1)));
    const durationMinutes = Math.max(1, Math.min(180, Number(currentUser.bathroomDurationMinutes ?? 10)));
    const nextCooldown = Timestamp.fromMillis(now.toMillis() + resolvedCooldownMinutes * 60_000);
    const nextLogs = [
      {
        id: "pending",
        userId: user.uid,
        userName: currentUser.name,
        createdAt: now,
        points: resolvedPoints,
        isWeeklyActive: true,
        competitionEdition: currentEdition,
      },
      ...userLogs,
    ];

    const poopcoinTransaction =
      poopcoinsEarned > 0
        ? await appendPoopcoinTransaction(transaction, {
            type: "mint_log",
            entries: [{ userId: user.uid, delta: poopcoinsEarned }],
            amount: poopcoinsEarned,
            createdBy: user.uid,
            createdByRole: currentUser.role,
            toUserId: user.uid,
            linkedLogId: logRef.id,
            createdAt: now,
            supplyEffect: {
              mintedDelta: poopcoinsEarned,
              circulatingDelta: poopcoinsEarned,
              requireMigratedSupply: true,
            },
          })
        : null;

    transaction.set(logRef, {
      userId: user.uid,
      userName: currentUser.name,
      createdAt: now,
      points: resolvedPoints,
      poopcoinsEarned,
      isWeeklyActive: true,
      location: validatedLocation,
      timezone: schedule.timezone,
      localTime,
      durationMinutes,
      competitionEdition: currentEdition,
      poopcoinTransactionHash: poopcoinTransaction?.hash ?? null,
    });
    transaction.update(userRef, {
      totalPoints: increment(resolvedPoints),
      weeklyPoints: increment(resolvedPoints),
      ...(poopcoinsEarned > 0 ? { poopcoinBalance: increment(poopcoinsEarned) } : {}),
      firstLogAt: currentUser.firstLogAt ?? now,
      lastLogAt: now,
      cooldownUntil: nextCooldown,
      currentDailyStreak: calculateDailyStreak(nextLogs),
      currentWeeklyStreak: calculateWeeklyStreak(nextLogs),
      bestStreak: Math.max(currentUser.bestStreak ?? 0, calculateDailyStreak(nextLogs)),
    });
  });
}

export async function registerPoop(
  user: AppUser,
  userLogs: PoopLog[],
  cooldownMinutes: number,
  pointsPerLog: number,
) {
  if (user.isActive === false) {
    throw new RegisterPoopError("deactivated_user", i18n.t("auth:deactivated_user"));
  }

  const cooldown = getCooldownSeconds(userLogs, cooldownMinutes);
  if (cooldown > 0) {
    throw new RegisterPoopError(
      "cooldown",
      i18n.t("services:poop.cooldown", { count: Math.ceil(cooldown / 60) }),
    );
  }

  if (countToday(userLogs) >= DAILY_LIMIT) {
    throw new RegisterPoopError(
      "daily_limit",
      i18n.t("services:poop.dailyLimit", { count: DAILY_LIMIT }),
    );
  }

  const now = Timestamp.now();
  const settingsSnapshot = await getDoc(appSettingsDocRef);
  const settings = settingsSnapshot.data();
  const currentEdition = Math.max(1, Math.trunc(Number(settingsSnapshot.data()?.edition ?? 1)));
  const resolvedPoopcoinsPerLog = resolvePoopcoinsPerLog(settings);
  const nextLogs = [
    {
      id: "pending",
      userId: user.uid,
      userName: user.name,
      createdAt: now,
      points: pointsPerLog,
      isWeeklyActive: true,
      competitionEdition: currentEdition,
    },
    ...userLogs,
  ];

  const userDoc = doc(db, "users", user.uid);
  const logDoc = doc(logsRef);

  await runTransaction(db, async (transaction) => {
    const [userSnapshot, headSnapshot] = await Promise.all([
      transaction.get(userDoc),
      transaction.get(poopcoinChainHeadRef),
    ]);
    const currentUser = userSnapshot.data() as AppUser | undefined;
    const role = currentUser?.role ?? user.role;
    const poopcoinsEarned = resolveMintablePoopcoins(
      headSnapshot.data() as Record<string, unknown> | undefined,
      resolvedPoopcoinsPerLog,
    );
    const poopcoinTransaction =
      poopcoinsEarned > 0
        ? await appendPoopcoinTransaction(transaction, {
            type: "mint_log",
            entries: [{ userId: user.uid, delta: poopcoinsEarned }],
            amount: poopcoinsEarned,
            createdBy: user.uid,
            createdByRole: role,
            toUserId: user.uid,
            linkedLogId: logDoc.id,
            createdAt: now,
            supplyEffect: {
              mintedDelta: poopcoinsEarned,
              circulatingDelta: poopcoinsEarned,
              requireMigratedSupply: true,
            },
          })
        : null;

    transaction.set(logDoc, {
      userId: user.uid,
      userName: user.name,
      createdAt: now,
      points: pointsPerLog,
      poopcoinsEarned,
      isWeeklyActive: true,
      competitionEdition: currentEdition,
      poopcoinTransactionHash: poopcoinTransaction?.hash ?? null,
    });

    transaction.update(userDoc, {
      totalPoints: increment(pointsPerLog),
      weeklyPoints: increment(pointsPerLog),
      ...(poopcoinsEarned > 0 ? { poopcoinBalance: increment(poopcoinsEarned) } : {}),
      firstLogAt: user.firstLogAt ?? now,
      lastLogAt: now,
      currentDailyStreak: calculateDailyStreak(nextLogs),
      currentWeeklyStreak: calculateWeeklyStreak(nextLogs),
      bestStreak: Math.max(user.bestStreak ?? 0, calculateDailyStreak(nextLogs)),
    });
  });

  return logDoc.id;
}

export async function adjustUserPoints(admin: AppUser, targetUser: AppUser, delta: number) {
  const userDoc = doc(db, "users", targetUser.uid);
  const targetSnapshot = await getDoc(userDoc);
  const settingsSnapshot = await getDoc(appSettingsDocRef);
  const targetData = targetSnapshot.data() as AppUser | undefined;
  const targetName = targetData?.name ?? targetUser.name;
  const settings = settingsSnapshot.data();
  const currentEdition = Math.max(1, Math.trunc(Number(settings?.edition ?? 1)));
  const resolvedPoopcoinsPerLog = resolvePoopcoinsPerLog(settings);
  const now = Timestamp.now();

  if (delta > 0) {
    const logRef = doc(logsRef);
    await runTransaction(db, async (transaction) => {
      const headSnapshot = await transaction.get(poopcoinChainHeadRef);
      const poopcoinsEarned = resolveMintablePoopcoins(
        headSnapshot.data() as Record<string, unknown> | undefined,
        resolvedPoopcoinsPerLog,
      );
      const poopcoinTransaction =
        poopcoinsEarned > 0
          ? await appendPoopcoinTransaction(transaction, {
              type: "mint_log",
              entries: [{ userId: targetUser.uid, delta: poopcoinsEarned }],
              amount: poopcoinsEarned,
              createdBy: admin.uid,
              createdByRole: admin.role,
              toUserId: targetUser.uid,
              linkedLogId: logRef.id,
              createdAt: now,
              reason: "Ajuste manual de pontos.",
              supplyEffect: {
                mintedDelta: poopcoinsEarned,
                circulatingDelta: poopcoinsEarned,
                requireMigratedSupply: true,
              },
            })
          : null;

      transaction.set(logRef, {
        userId: targetUser.uid,
        userName: targetName,
        createdAt: now,
        points: delta,
        poopcoinsEarned,
        isWeeklyActive: true,
        competitionEdition: currentEdition,
        poopcoinTransactionHash: poopcoinTransaction?.hash ?? null,
      });
      transaction.update(userDoc, {
        totalPoints: increment(delta),
        weeklyPoints: increment(delta),
        ...(poopcoinsEarned > 0 ? { poopcoinBalance: increment(poopcoinsEarned) } : {}),
        firstLogAt: targetData?.firstLogAt ?? now,
        lastLogAt: now,
      });
      transaction.set(
        doc(adminLogsRef),
        createAuditLog({
          action: "adjust_points",
          admin,
          targetUser,
          delta,
          poopcoins: poopcoinsEarned,
          poopcoinTransactionHash: poopcoinTransaction?.hash,
        }),
      );
    });
    return;
  }

  if (delta < 0) {
    const latestSnapshot = await getDocs(latestUserLogQuery(targetUser.uid));
    const latestLog = latestSnapshot.docs[0];
    if (!latestLog) {
      throw new Error(i18n.t("services:poop.noLogToRemove"));
    }

    const logData = latestLog.data() as Omit<PoopLog, "id">;
    await runTransaction(db, async (transaction) => {
      const poopcoinsToRemove = resolveLogPoopcoins(logData);
      const poopcoinTransaction =
        poopcoinsToRemove > 0
          ? await appendPoopcoinTransaction(transaction, {
              type: "admin_adjustment",
              entries: [{ userId: targetUser.uid, delta: -poopcoinsToRemove }],
              amount: poopcoinsToRemove,
              createdBy: admin.uid,
              createdByRole: admin.role,
              fromUserId: targetUser.uid,
              linkedLogId: latestLog.id,
              reason: "Remocao de pontos sincronizada com Poopcoins.",
              supplyEffect: {
                burnedDelta: poopcoinsToRemove,
                circulatingDelta: -poopcoinsToRemove,
              },
            })
          : null;

      transaction.delete(latestLog.ref);
      transaction.update(userDoc, {
        totalPoints: increment(delta),
        weeklyPoints: logData.isWeeklyActive ? increment(delta) : increment(0),
        ...(poopcoinsToRemove > 0 ? { poopcoinBalance: increment(-poopcoinsToRemove) } : {}),
      });
      transaction.set(
        doc(adminLogsRef),
        createAuditLog({
          action: "adjust_points",
          admin,
          targetUser,
          delta,
          poopcoins: -poopcoinsToRemove,
          poopcoinTransactionHash: poopcoinTransaction?.hash,
        }),
      );
    });
  }
}

export async function removeLog(admin: AppUser, log: PoopLog) {
  await runTransaction(db, async (transaction) => {
    const poopcoinsToRemove = resolveLogPoopcoins(log);
    const poopcoinTransaction =
      poopcoinsToRemove > 0
        ? await appendPoopcoinTransaction(transaction, {
            type: "admin_adjustment",
            entries: [{ userId: log.userId, delta: -poopcoinsToRemove }],
            amount: poopcoinsToRemove,
            createdBy: admin.uid,
            createdByRole: admin.role,
            fromUserId: log.userId,
            linkedLogId: log.id,
            reason: "Registro removido por admin.",
            supplyEffect: {
              burnedDelta: poopcoinsToRemove,
              circulatingDelta: -poopcoinsToRemove,
            },
          })
        : null;

    transaction.delete(doc(db, "poop_logs", log.id));
    transaction.update(doc(db, "users", log.userId), {
      totalPoints: increment(-log.points),
      weeklyPoints: log.isWeeklyActive ? increment(-log.points) : increment(0),
      ...(poopcoinsToRemove > 0 ? { poopcoinBalance: increment(-poopcoinsToRemove) } : {}),
    });
    transaction.set(
      doc(adminLogsRef),
      createAuditLog({
        action: "remove_log",
        admin,
        targetUser: { uid: log.userId },
        points: log.points,
        removedLogId: log.id,
        poopcoins: -poopcoinsToRemove,
        poopcoinTransactionHash: poopcoinTransaction?.hash,
      }),
    );
  });
}

const APP_SETTINGS_DOC_ID = "global";
const appSettingsDocRef = doc(db, "app_settings", APP_SETTINGS_DOC_ID);

function weeklyResetKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDueWeeklyResetKey(now = new Date()) {
  const sundayAt23 = new Date(now);
  sundayAt23.setHours(23, 0, 0, 0);
  sundayAt23.setDate(now.getDate() - now.getDay());

  if (now.getTime() < sundayAt23.getTime()) {
    sundayAt23.setDate(sundayAt23.getDate() - 7);
  }

  return weeklyResetKey(sundayAt23);
}

export async function resetWeeklyRanking(admin: AppUser, logs: PoopLog[], users: AppUser[], groups: RankingGroup[] = []) {
  const settingsSnapshot = await getDoc(appSettingsDocRef);
  const currentEdition = Number(settingsSnapshot.data()?.edition ?? 17);
  const nextEdition = Math.max(1, Math.trunc(currentEdition)) + 1;
  const resetKey = getDueWeeklyResetKey();

  // Mapear pontuação dos logs ativos
  const logPointsMap = new Map<string, number>();
  logs.forEach((log) => {
    if (log.isWeeklyActive && log.userId) {
      logPointsMap.set(
        log.userId,
        (logPointsMap.get(log.userId) ?? 0) + Math.max(0, Number(log.points) || 0)
      );
    }
  });

  // Lista de competidores e cálculo da pontuação da edição
  const rawCompetitors = users.map((user) => {
    const weeklyPts = Math.max(
      0,
      Math.max(Number(user.weeklyPoints ?? 0), logPointsMap.get(user.uid) ?? 0)
    );
    return {
      uid: user.uid,
      name: user.name || "Competidor",
      nickname: user.nickname?.trim() || user.name || "Competidor",
      avatar: user.avatar || "🚿",
      points: weeklyPts,
      wonEditions: Array.isArray(user.wonEditions) ? user.wonEditions : [],
    };
  });

  rawCompetitors.sort((a, b) => b.points - a.points);
  const maxWeeklyPoints = rawCompetitors.length > 0 ? rawCompetitors[0].points : 0;

  let currentRank = 1;
  const competitors: EditionCompetitor[] = rawCompetitors.map((comp, idx) => {
    if (idx > 0 && comp.points < rawCompetitors[idx - 1].points) {
      currentRank = idx + 1;
    }
    const isWinner = maxWeeklyPoints > 0 && comp.points === maxWeeklyPoints;
    return {
      uid: comp.uid,
      name: comp.name,
      nickname: comp.nickname,
      avatar: comp.avatar,
      points: comp.points,
      rank: currentRank,
      isWinner,
    };
  });

  const winnersData = competitors
    .filter((c) => c.isWinner)
    .map((c) => ({
      uid: c.uid,
      name: c.name,
      nickname: c.nickname,
      avatar: c.avatar,
      points: c.points,
    }));
  const winnersList = winnersData.map((w) => w.nickname || w.name);
  const winnerUids = winnersData.map((w) => w.uid);

  const romanEdition = toRoman(currentEdition);
  const editionDocRef = doc(db, "editions", String(currentEdition));
  const editionRecord: EditionRecord = {
    id: String(currentEdition),
    edition: currentEdition,
    romanEdition,
    title: `Edição ${romanEdition}`,
    endedAt: Timestamp.now(),
    resetByUid: admin.uid,
    resetByName: admin.nickname?.trim() || admin.name || "Administrador",
    totalCompetitors: competitors.length,
    totalPoints: competitors.reduce((acc, c) => acc + c.points, 0),
    maxPoints: maxWeeklyPoints,
    winnerUids,
    winnerNames: winnersList,
    winners: winnersData,
    competitors,
    createdAt: Timestamp.now(),
  };

  const batch = writeBatch(db);

  // Salvar snapshot da edição
  batch.set(editionDocRef, editionRecord);

  // Atualizar usuários
  rawCompetitors.forEach((comp) => {
    const isWinner = maxWeeklyPoints > 0 && comp.points === maxWeeklyPoints;
    if (isWinner) {
      const existing = new Set(comp.wonEditions);
      existing.add(currentEdition);
      const updatedWonEditions = Array.from(existing).sort((a, b) => a - b);
      batch.update(doc(db, "users", comp.uid), {
        weeklyPoints: 0,
        wonEditions: updatedWonEditions,
      });
    } else {
      batch.update(doc(db, "users", comp.uid), { weeklyPoints: 0 });
    }
  });

  // Desativar logs
  logs.forEach((log) => {
    if (log.isWeeklyActive) {
      batch.update(doc(db, "poop_logs", log.id), { isWeeklyActive: false });
    }
  });

  // Atualizar grupos
  groups.forEach((group) => {
    batch.update(doc(db, "groups", group.id), {
      edition: Math.max(1, Math.trunc(Number(group.edition ?? currentEdition))) + 1,
      updatedAt: Timestamp.now(),
    });
  });

  batch.set(
    appSettingsDocRef,
    {
      edition: nextEdition,
      overallRankingVisible: true,
      lastWeeklyResetKey: resetKey,
      lastWeeklyResetAt: Timestamp.now(),
      lastWeeklyResetBy: admin.uid,
      updatedAt: Timestamp.now(),
      updatedBy: admin.uid,
    },
    { merge: true },
  );

  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "reset_weekly",
      admin,
      edition: nextEdition,
    }),
  );

  await batch.commit();
}
