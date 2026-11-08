import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { AppSettings, AppUser, BonusTimeRange } from "../types";
import {
  adminLogsRef,
  appSettingsDocRef,
  createAuditLogRecord,
  listenAppSettings,
  updateBonusTimeRanges,
  updateTermsOfUse,
  updateOverallRankingVisibility,
} from "./adminService";
import { fetchAppSettings } from "./authService";

export const APP_SETTINGS_DOC_ID = "global";
export { appSettingsDocRef };

export const DEFAULT_POOPCOINS_PER_LOG = 1;
export const DEFAULT_CUITER_POST_COST = 1;
export const MAX_COMPETITION_ANNOUNCEMENT_LENGTH = 280;
export const MAX_TERMS_OF_USE_LENGTH = 10000;

export const defaultAppSettings: AppSettings = {
  cooldownMinutes: 15,
  pointsPerLog: 2000,
  poopcoinsPerLog: 1,
  cuiterPostCost: 1,
  edition: 1,
  overallRankingVisible: true,
  termsOfUseVersion: 1,
};

export function normalizeCooldownMinutes(value: number): number {
  if (!Number.isFinite(value)) return 15;
  return Math.max(1, Math.min(180, Math.trunc(value)));
}

export function normalizePointsPerLog(value: number): number {
  if (!Number.isFinite(value)) return 2000;
  return Math.max(100, Math.min(50000, Math.trunc(value)));
}

export function normalizePoopcoinRuleValue(
  value: number,
  fallback = DEFAULT_POOPCOINS_PER_LOG
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(1000, Math.trunc(value)));
}

export function normalizeCompetitionAnnouncement(value: string): string {
  return value.trim().slice(0, MAX_COMPETITION_ANNOUNCEMENT_LENGTH);
}

export function normalizeTermsOfUseText(value: string): string {
  return value.trim().slice(0, MAX_TERMS_OF_USE_LENGTH);
}

export function parseAppSettings(data?: Record<string, unknown> | null): AppSettings {
  if (!data) return defaultAppSettings;

  return {
    cooldownMinutes: normalizeCooldownMinutes(Number(data.cooldownMinutes ?? 15)),
    pointsPerLog: normalizePointsPerLog(Number(data.pointsPerLog ?? 2000)),
    poopcoinsPerLog: normalizePoopcoinRuleValue(
      Number(data.poopcoinsPerLog ?? DEFAULT_POOPCOINS_PER_LOG),
      DEFAULT_POOPCOINS_PER_LOG
    ),
    cuiterPostCost: normalizePoopcoinRuleValue(
      Number(data.cuiterPostCost ?? DEFAULT_CUITER_POST_COST),
      DEFAULT_CUITER_POST_COST
    ),
    edition: Number(data.edition ?? 1),
    overallRankingVisible:
      typeof data.overallRankingVisible === "boolean" ? data.overallRankingVisible : true,
    termsOfUseText: typeof data.termsOfUseText === "string" ? data.termsOfUseText : undefined,
    termsOfUseVersion: Number(data.termsOfUseVersion ?? 1),
    competitionAnnouncement:
      typeof data.competitionAnnouncement === "string" ? data.competitionAnnouncement : undefined,
    bonusTimeRanges: Array.isArray(data.bonusTimeRanges) ? (data.bonusTimeRanges as BonusTimeRange[]) : [],
  };
}

/**
 * Lê as configurações globais do aplicativo.
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const snap = await getDoc(appSettingsDocRef);
    if (snap.exists()) {
      return parseAppSettings(snap.data());
    }
  } catch (err) {
    console.warn("Erro ao buscar app_settings:", err);
  }
  return defaultAppSettings;
}

export { fetchAppSettings, listenAppSettings, updateBonusTimeRanges, updateTermsOfUse, updateOverallRankingVisibility };

/**
 * Atualiza o tempo de cooldown padrão no aplicativo.
 */
export async function updateCooldownMinutes(
  admin: AppUser,
  minutes: number
): Promise<void> {
  const normalized = normalizeCooldownMinutes(minutes);
  const batch = writeBatch(db);

  batch.update(appSettingsDocRef, {
    cooldownMinutes: normalized,
    updatedAt: serverTimestamp(),
  });

  const auditRef = doc(adminLogsRef);
  batch.set(
    auditRef,
    createAuditLogRecord({
      action: "update_cooldown",
      admin,
      cooldownMinutes: normalized,
    })
  );

  await batch.commit();
}

/**
 * Atualiza a pontuação base por cagada.
 */
export async function updatePointsPerLog(
  admin: AppUser,
  points: number
): Promise<void> {
  const normalized = normalizePointsPerLog(points);
  const batch = writeBatch(db);

  batch.update(appSettingsDocRef, {
    pointsPerLog: normalized,
    updatedAt: serverTimestamp(),
  });

  const auditRef = doc(adminLogsRef);
  batch.set(
    auditRef,
    createAuditLogRecord({
      action: "update_points_per_log",
      admin,
      pointsPerLog: normalized,
    })
  );

  await batch.commit();
}

/**
 * Atualiza as regras de emissão e custos de Poopcoins.
 */
export async function updatePoopcoinRules(
  admin: AppUser,
  rules: {
    poopcoinsPerLog?: number;
    cuiterPostCost?: number;
  }
): Promise<void> {
  const updates: Record<string, any> = { updatedAt: serverTimestamp() };
  let normalizedPoopcoins: number | undefined;
  let normalizedCuiterCost: number | undefined;

  if (typeof rules.poopcoinsPerLog === "number") {
    normalizedPoopcoins = normalizePoopcoinRuleValue(rules.poopcoinsPerLog);
    updates.poopcoinsPerLog = normalizedPoopcoins;
    updates.poopcoinsPerLogUpdatedAt = serverTimestamp();
  }
  if (typeof rules.cuiterPostCost === "number") {
    normalizedCuiterCost = normalizePoopcoinRuleValue(rules.cuiterPostCost);
    updates.cuiterPostCost = normalizedCuiterCost;
  }

  const batch = writeBatch(db);
  batch.update(appSettingsDocRef, updates);

  const auditRef = doc(adminLogsRef);
  batch.set(
    auditRef,
    createAuditLogRecord({
      action: "update_poopcoin_rules",
      admin,
      poopcoinsPerLog: normalizedPoopcoins,
      cuiterPostCost: normalizedCuiterCost,
    })
  );

  await batch.commit();
}

/**
 * Atualiza o anúncio da competição / mensagem de boas-vindas.
 */
export async function updateCompetitionAnnouncement(
  admin: AppUser,
  announcement: string
): Promise<void> {
  const normalized = normalizeCompetitionAnnouncement(announcement);
  const batch = writeBatch(db);

  batch.update(appSettingsDocRef, {
    competitionAnnouncement: normalized,
    updatedAt: serverTimestamp(),
  });

  const auditRef = doc(adminLogsRef);
  batch.set(
    auditRef,
    createAuditLogRecord({
      action: "update_competition_announcement",
      admin,
    })
  );

  await batch.commit();
}
