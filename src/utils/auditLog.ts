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
    case "update_poopcoin_rules":
      return t("auditMessages.updatePoopcoinRules", {
        admin: adminName,
        poopcoins: auditLog.poopcoinsPerLog ?? 0,
        cost: auditLog.cuiterPostCost ?? 0,
      });
    case "deactivate_user":
      if (targetName) {
        return t("auditMessages.deactivateUser", {
          admin: adminName,
          target: targetName,
        });
      }
      break;
    case "reactivate_user":
      if (targetName) {
        return t("auditMessages.reactivateUser", {
          admin: adminName,
          target: targetName,
        });
      }
      break;
    case "promote_admin":
      if (targetName) {
        return `${adminName} promoveu o usuário ${targetName} a Administrador.`;
      }
      break;
    case "demote_admin":
      if (targetName) {
        return `${adminName} rebaixou o usuário ${targetName} a Jogador.`;
      }
      break;
    case "update_competition_announcement":
      return t("auditMessages.updateCompetitionAnnouncement", {
        admin: adminName,
      });
    case "update_terms_of_use":
      return t("auditMessages.updateTermsOfUse", {
        admin: adminName,
      });
    case "adjust_poopcoins":
      if (typeof auditLog.poopcoins === "number" && targetName) {
        return t("auditMessages.adjustPoopcoins", {
          admin: adminName,
          target: targetName,
          count: Math.abs(auditLog.poopcoins),
          direction: auditLog.poopcoins > 0 ? "+" : "-",
        });
      }
      break;
    case "reverse_poopcoin_transaction":
      return t("auditMessages.reversePoopcoinTransaction", {
        admin: adminName,
        hash: auditLog.poopcoinTransactionHash ?? "",
      });
    case "migrate_poopcoins":
      return t("auditMessages.migratePoopcoins", {
        admin: adminName,
        count: auditLog.poopcoins ?? auditLog.delta ?? 0,
      });
    case "recalculate_poopcoin_supply":
      return t("auditMessages.recalculatePoopcoinSupply", {
        admin: adminName,
        count: auditLog.poopcoins ?? auditLog.delta ?? 0,
      });
  }

  return auditLog.description ?? t("auditMessages.unknown");
}
