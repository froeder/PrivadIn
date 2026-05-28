import i18n from "../i18n";
import type { Achievement, AppUser, PoopLog } from "../types";
import { getBusinessHoursCount } from "./date";

export function getAchievements(user?: AppUser | null, logs: PoopLog[] = []): Achievement[] {
  const total = user?.totalPoints ?? 0;
  const businessHours = getBusinessHoursCount(logs);
  const streak = user?.currentDailyStreak ?? 0;

  return [
    {
      id: "rookie",
      name: i18n.t("stats:achievements.rookie.name"),
      description: i18n.t("stats:achievements.rookie.description"),
      icon: "🚽",
      unlocked: total >= 1,
    },
    {
      id: "clt",
      name: i18n.t("stats:achievements.clt.name"),
      description: i18n.t("stats:achievements.clt.description"),
      icon: "💼",
      unlocked: total >= 5,
    },
    {
      id: "ghost",
      name: i18n.t("stats:achievements.ghost.name"),
      description: i18n.t("stats:achievements.ghost.description"),
      icon: "👻",
      unlocked: total >= 10,
    },
    {
      id: "master",
      name: i18n.t("stats:achievements.master.name"),
      description: i18n.t("stats:achievements.master.description"),
      icon: "🔥",
      unlocked: streak >= 5,
    },
    {
      id: "corporate",
      name: i18n.t("stats:achievements.corporate.name"),
      description: i18n.t("stats:achievements.corporate.description"),
      icon: "🧻",
      unlocked: businessHours >= 3,
    },
  ];
}
