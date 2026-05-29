import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import type { Achievement } from "../types";

export function AchievementGrid({ achievements }: { achievements: Achievement[] }) {
  const { t } = useTranslation("stats");

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {achievements.map((achievement) => (
        <div
          key={achievement.id}
          className={clsx(
            "rounded-2xl border p-4 transition",
            achievement.unlocked
              ? "border-accent/25 bg-accent-soft/25"
              : "border-line/10 bg-panel-strong/50 opacity-70",
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-3xl">{achievement.icon}</span>
            <span className="rounded-full bg-canvas-elevated/70 px-2 py-1 text-xs font-bold text-fg-muted">
              {achievement.unlocked ? t("achievementUnlocked") : t("achievementLocked")}
            </span>
          </div>
          <h3 className="font-black text-fg">{achievement.name}</h3>
          <p className="mt-1 text-sm text-fg-muted">{achievement.description}</p>
        </div>
      ))}
    </div>
  );
}
