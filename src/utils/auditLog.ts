import type { TFunction } from "i18next";
import type { AdminAuditLog, AppUser } from "../types";
import { toRoman } from "./roman";

export function buildUsersById(users: AppUser[]) {
  return new Map(users.map((user) => [user.uid, user]));
}

export function resolveUserDisplayName(
  usersById: Map<string, AppUser>,
  uid?: string | null,
  legacyName?: string | null,
) {
  if (!uid) return legacyName ?? "";
  return usersById.get(uid)?.name ?? legacyName ?? uid;
}

export function formatAuditLogMessage(
  auditLog: AdminAuditLog,
  usersById: Map<string, AppUser>,
  t: TFunction<"admin">,
) {
  const adminName = resolveUserDisplayName(usersById, auditLog.adminId, auditLog.adminName);
  const targetName = auditLog.targetUserId
    ? resolveUserDisplayName(usersById, auditLog.targetUserId, auditLog.targetUserName)
    : null;

  switch (auditLog.action) {
    case "adjust_points":
      if (typeof auditLog.delta === "number" && auditLog.delta > 0 && targetName) {
        return t("auditMessages.adjustAdd", {
          admin: adminName,
          target: targetName,
          count: auditLog.delta,
        });
      }
      if (typeof auditLog.delta === "number" && auditLog.delta < 0 && targetName) {
        return t("auditMessages.adjustRemove", {
          admin: adminName,
          target: targetName,
          count: Math.abs(auditLog.delta),
        });
      }
      break;
    case "remove_log":
      if (targetName && typeof auditLog.points === "number") {
        return t("auditMessages.removeLog", {
          admin: adminName,
          target: targetName,
          points: auditLog.points,
        });
      }
      break;
    case "reset_weekly":
      if (typeof auditLog.edition === "number") {
        return t("auditMessages.resetWeekly", {
          admin: adminName,
          edition: toRoman(auditLog.edition),
        });
      }
      break;
    case "update_cooldown":
      if (typeof auditLog.cooldownMinutes === "number") {
        return t("auditMessages.updateCooldown", {
          admin: adminName,
          minutes: auditLog.cooldownMinutes,
        });
      }
      break;
    case "update_points_per_log":
      if (typeof auditLog.pointsPerLog === "number") {
        return t("auditMessages.updatePointsPerLog", {
          admin: adminName,
          points: auditLog.pointsPerLog,
        });
      }
      break;
  }

  return auditLog.description ?? t("auditMessages.unknown");
}
