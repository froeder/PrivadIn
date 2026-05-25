import { Timestamp, doc, writeBatch } from "firebase/firestore";
import type { AppSettings, AppUser } from "../types";
import { db } from "./firebase";
import { adminLogsRef, createAuditLog } from "./poopService";
import { DEFAULT_COOLDOWN_MINUTES } from "../utils/date";

export const APP_SETTINGS_DOC_ID = "global";
export const appSettingsDocRef = doc(db, "app_settings", APP_SETTINGS_DOC_ID);

const MIN_COOLDOWN_MINUTES = 1;
const MAX_COOLDOWN_MINUTES = 1440;

export const defaultAppSettings: AppSettings = {
  cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
};

export function normalizeCooldownMinutes(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_COOLDOWN_MINUTES;

  return Math.min(
    MAX_COOLDOWN_MINUTES,
    Math.max(MIN_COOLDOWN_MINUTES, Math.trunc(value)),
  );
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
      description: `${admin.name} alterou o cooldown de registro para ${normalizedCooldown} minuto(s).`,
    }),
  );

  await batch.commit();
}
