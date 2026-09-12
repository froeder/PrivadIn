import { Timestamp, doc, getDoc, writeBatch } from "@firebase/firestore";
import type { AppSettings, AppUser } from "../types";
import { db } from "./firebase";
import { adminLogsRef, createAuditLog } from "./poopService";
import { DEFAULT_COOLDOWN_MINUTES } from "../utils/date";
import {
  DEFAULT_TERMS_OF_USE_TEXT,
  getCurrentTermsVersion,
  INITIAL_TERMS_OF_USE_VERSION,
  MAX_TERMS_OF_USE_LENGTH,
  normalizeTermsOfUseText,
} from "../utils/terms";

export const APP_SETTINGS_DOC_ID = "global";
export const appSettingsDocRef = doc(db, "app_settings", APP_SETTINGS_DOC_ID);

const MIN_COOLDOWN_MINUTES = 1;
const MAX_COOLDOWN_MINUTES = 1440;
const DEFAULT_POINTS_PER_LOG = 2000;
const MIN_POINTS_PER_LOG = 1;
const MAX_POINTS_PER_LOG = 100000;
export const DEFAULT_POOPCOINS_PER_LOG = 1;
export const DEFAULT_CUITER_POST_COST = 1;
const MIN_POOPCOIN_RULE_VALUE = 1;
const MAX_POOPCOIN_RULE_VALUE = 100000;
const DEFAULT_EDITION = 17;
export const MAX_COMPETITION_ANNOUNCEMENT_LENGTH = 280;

export const defaultAppSettings: AppSettings = {
  cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
  pointsPerLog: DEFAULT_POINTS_PER_LOG,
  poopcoinsPerLog: DEFAULT_POOPCOINS_PER_LOG,
  cuiterPostCost: DEFAULT_CUITER_POST_COST,
  edition: DEFAULT_EDITION,
  overallRankingVisible: false,
  termsOfUseText: DEFAULT_TERMS_OF_USE_TEXT,
  termsOfUseVersion: INITIAL_TERMS_OF_USE_VERSION,
  competitionAnnouncement: "",
};

export function normalizeCooldownMinutes(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_COOLDOWN_MINUTES;

  return Math.min(
    MAX_COOLDOWN_MINUTES,
    Math.max(MIN_COOLDOWN_MINUTES, Math.trunc(value)),
  );
}

export function normalizePointsPerLog(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_POINTS_PER_LOG;

  return Math.min(
    MAX_POINTS_PER_LOG,
    Math.max(MIN_POINTS_PER_LOG, Math.trunc(value)),
  );
}

export function normalizePoopcoinRuleValue(value: number, fallback = DEFAULT_POOPCOINS_PER_LOG) {
  if (!Number.isFinite(value)) return fallback;

  return Math.min(
    MAX_POOPCOIN_RULE_VALUE,
    Math.max(MIN_POOPCOIN_RULE_VALUE, Math.trunc(value)),
  );
}

function normalizeEdition(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_EDITION;
  return Math.max(1, Math.trunc(value));
}

export function parseAppSettings(
  data?: Partial<AppSettings> | null,
): AppSettings {
  return {
    ...defaultAppSettings,
    ...data,
    cooldownMinutes: normalizeCooldownMinutes(
      Number(data?.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES),
    ),
    pointsPerLog: normalizePointsPerLog(
      Number(data?.pointsPerLog ?? DEFAULT_POINTS_PER_LOG),
    ),
    poopcoinsPerLog: normalizePoopcoinRuleValue(
      Number(data?.poopcoinsPerLog ?? DEFAULT_POOPCOINS_PER_LOG),
      DEFAULT_POOPCOINS_PER_LOG,
    ),
    cuiterPostCost: normalizePoopcoinRuleValue(
      Number(data?.cuiterPostCost ?? DEFAULT_CUITER_POST_COST),
      DEFAULT_CUITER_POST_COST,
    ),
    edition: normalizeEdition(Number(data?.edition ?? DEFAULT_EDITION)),
    overallRankingVisible: data?.overallRankingVisible === true,
    termsOfUseText: normalizeTermsOfUseText(String(data?.termsOfUseText ?? DEFAULT_TERMS_OF_USE_TEXT)) || DEFAULT_TERMS_OF_USE_TEXT,
    termsOfUseVersion: getCurrentTermsVersion({
      termsOfUseVersion: Number(data?.termsOfUseVersion ?? INITIAL_TERMS_OF_USE_VERSION),
    }),
    competitionAnnouncement: String(data?.competitionAnnouncement ?? "").trim().slice(0, MAX_COMPETITION_ANNOUNCEMENT_LENGTH),
  };
}

export type BonusTimeRange = { start: string; end: string; points: number };

export async function updateBonusTimeRanges(admin: AppUser, ranges: BonusTimeRange[]) {
  const batch = writeBatch(db);

  batch.set(
    appSettingsDocRef,
    {
      bonusTimeRanges: ranges,
      updatedAt: Timestamp.now(),
      updatedBy: admin.uid,
    },
    { merge: true },
  );

  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "update_points_per_log",
      admin,
      // store as pointsPerLog for easier audit, not ideal but reuse existing action
      pointsPerLog: Number(ranges[0]?.points ?? 0),
    }),
  );

  await batch.commit();
}

export async function updateCooldownMinutes(
  admin: AppUser,
  cooldownMinutes: number,
) {
  const normalizedCooldown = normalizeCooldownMinutes(cooldownMinutes);
  const batch = writeBatch(db);

  batch.set(
    appSettingsDocRef,
    {
      cooldownMinutes: normalizedCooldown,
      updatedAt: Timestamp.now(),
      updatedBy: admin.uid,
    },
    { merge: true },
  );

  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "update_cooldown",
      admin,
      cooldownMinutes: normalizedCooldown,
    }),
  );

  await batch.commit();
}

export async function updatePointsPerLog(
  admin: AppUser,
  pointsPerLog: number,
) {
  const normalizedPoints = normalizePointsPerLog(pointsPerLog);
  const batch = writeBatch(db);

  batch.set(
    appSettingsDocRef,
    {
      pointsPerLog: normalizedPoints,
      updatedAt: Timestamp.now(),
      updatedBy: admin.uid,
    },
    { merge: true },
  );

  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "update_points_per_log",
      admin,
      pointsPerLog: normalizedPoints,
    }),
  );

  await batch.commit();
}

export async function updatePoopcoinRules(
  admin: AppUser,
  poopcoinsPerLog: number,
  cuiterPostCost: number,
) {
  const normalizedPoopcoinsPerLog = normalizePoopcoinRuleValue(
    poopcoinsPerLog,
    DEFAULT_POOPCOINS_PER_LOG,
  );
  const normalizedCuiterPostCost = normalizePoopcoinRuleValue(
    cuiterPostCost,
    DEFAULT_CUITER_POST_COST,
  );
  const now = Timestamp.now();
  const currentSettingsSnapshot = await getDoc(appSettingsDocRef);
  const currentPoopcoinsPerLog = normalizePoopcoinRuleValue(
    Number(currentSettingsSnapshot.data()?.poopcoinsPerLog ?? DEFAULT_POOPCOINS_PER_LOG),
    DEFAULT_POOPCOINS_PER_LOG,
  );
  const batch = writeBatch(db);

  batch.set(
    appSettingsDocRef,
    {
      poopcoinsPerLog: normalizedPoopcoinsPerLog,
      cuiterPostCost: normalizedCuiterPostCost,
      poopcoinsPerLogUpdatedAt:
        normalizedPoopcoinsPerLog !== currentPoopcoinsPerLog
          ? now
          : currentSettingsSnapshot.data()?.poopcoinsPerLogUpdatedAt ?? now,
      poopcoinsPerLogUpdatedBy:
        normalizedPoopcoinsPerLog !== currentPoopcoinsPerLog
          ? admin.uid
          : currentSettingsSnapshot.data()?.poopcoinsPerLogUpdatedBy ?? admin.uid,
      updatedAt: now,
      updatedBy: admin.uid,
    },
    { merge: true },
  );

  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "update_poopcoin_rules",
      admin,
      poopcoinsPerLog: normalizedPoopcoinsPerLog,
      cuiterPostCost: normalizedCuiterPostCost,
    }),
  );

  await batch.commit();
}

export function normalizeCompetitionAnnouncement(value: string) {
  return value.trim().slice(0, MAX_COMPETITION_ANNOUNCEMENT_LENGTH);
}

export { MAX_TERMS_OF_USE_LENGTH, normalizeTermsOfUseText };

export async function updateTermsOfUse(admin: AppUser, termsOfUseText: string) {
  const normalizedTerms = normalizeTermsOfUseText(termsOfUseText) || DEFAULT_TERMS_OF_USE_TEXT;
  const currentSettingsSnapshot = await getDoc(appSettingsDocRef);
  const currentVersion = getCurrentTermsVersion({
    termsOfUseVersion: Number(currentSettingsSnapshot.data()?.termsOfUseVersion ?? INITIAL_TERMS_OF_USE_VERSION),
  });
  const batch = writeBatch(db);

  batch.set(
    appSettingsDocRef,
    {
      termsOfUseText: normalizedTerms,
      termsOfUseVersion: currentVersion + 1,
      termsOfUseUpdatedAt: Timestamp.now(),
      termsOfUseUpdatedBy: admin.uid,
      updatedAt: Timestamp.now(),
      updatedBy: admin.uid,
    },
    { merge: true },
  );

  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "update_terms_of_use",
      admin,
    }),
  );

  await batch.commit();
}

export async function updateCompetitionAnnouncement(admin: AppUser, announcement: string) {
  const normalizedAnnouncement = normalizeCompetitionAnnouncement(announcement);
  const batch = writeBatch(db);

  batch.set(
    appSettingsDocRef,
    {
      competitionAnnouncement: normalizedAnnouncement,
      competitionAnnouncementUpdatedAt: Timestamp.now(),
      competitionAnnouncementUpdatedBy: admin.uid,
      updatedAt: Timestamp.now(),
      updatedBy: admin.uid,
    },
    { merge: true },
  );

  batch.set(
    doc(adminLogsRef),
    createAuditLog({
      action: "update_competition_announcement",
      admin,
    }),
  );

  await batch.commit();
}
