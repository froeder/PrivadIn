import { clsx } from "clsx";
import type { Achievement } from "../types";

export function AchievementGrid({ achievements }: { achievements: Achievement[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {achievements.map((achievement) => (
        <div
          key={achievement.id}
          className={clsx(
            "rounded-2xl border p-4 transition",
            achievement.unlocked
              ? "border-yellow-200/25 bg-yellow-300/12"
              : "border-white/10 bg-white/5 opacity-60",
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-3xl">{achievement.icon}</span>
            <span className="rounded-full bg-slate-950/50 px-2 py-1 text-xs font-bold text-slate-300">
              {achievement.unlocked ? "Liberada" : "Bloqueada"}
            </span>
          </div>
          <h3 className="font-black text-white">{achievement.name}</h3>
          <p className="mt-1 text-sm text-slate-400">{achievement.description}</p>
        </div>
      ))}
    </div>
  );
}
