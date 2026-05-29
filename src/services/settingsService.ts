import { Timestamp, doc, writeBatch } from "firebase/firestore";
import type { AppSettings, AppUser } from "../types";
import { db } from "./firebase";
import { adminLogsRef, createAuditLog } from "./poopService";
import { DEFAULT_COOLDOWN_MINUTES } from "../utils/date";

export const APP_SETTINGS_DOC_ID = "global";
export const appSettingsDocRef = doc(db, "app_settings", APP_SETTINGS_DOC_ID);

const MIN_COOLDOWN_MINUTES = 1;
const MAX_COOLDOWN_MINUTES = 1440;
const DEFAULT_POINTS_PER_LOG = 2000;
const MIN_POINTS_PER_LOG = 1;
const MAX_POINTS_PER_LOG = 100000;
const DEFAULT_EDITION = 17;

export const defaultAppSettings: AppSettings = {
  cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
  pointsPerLog: DEFAULT_POINTS_PER_LOG,
  edition: DEFAULT_EDITION,
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
    edition: normalizeEdition(Number(data?.edition ?? DEFAULT_EDITION)),
  };
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
