import { useTranslation } from "react-i18next";
import { AchievementGrid } from "../components/AchievementGrid";
import { Card, MetricCard } from "../components/Card";
import { WeeklyChart } from "../components/WeeklyChart";
import type { AppUser, PoopLog, RankedUser } from "../types";
import { buildDailyBuckets, getBusinessHoursCount, getDailyAverage, getProductiveHour } from "../utils/date";
import { getAchievements } from "../utils/achievements";
import { formatDecimal, formatNumber } from "../utils/format";

export function StatsPage({
  user,
  logs,
  allLogs,
  rankedUsers,
}: {
  user: AppUser;
  logs: PoopLog[];
  allLogs: PoopLog[];
  rankedUsers: RankedUser[];
}) {
  const { t } = useTranslation("stats");
  const king = rankedUsers[0];
  const streakLeader = [...rankedUsers].sort((a, b) => b.bestStreak - a.bestStreak)[0];
  const weeklyTotal = rankedUsers.reduce((sum, ranked) => sum + ranked.weeklyPoints, 0);
  const achievements = getAchievements(user, logs);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <MetricCard icon="👑" label={t("metric.king")} value={king?.name ?? "-"} hint={t("metric.kingHint", { points: formatNumber(king?.totalPoints ?? 0) })} />
        <MetricCard icon="🔥" label={t("metric.streakLeader")} value={formatNumber(streakLeader?.bestStreak ?? 0)} hint={streakLeader?.name ?? t("metric.streakLeaderFallback")} />
        <MetricCard icon="🚽" label={t("metric.productiveHour")} value={getProductiveHour(allLogs)} hint={t("metric.productiveHourHint")} />
        <MetricCard icon="📈" label={t("metric.weeklyTotal")} value={formatNumber(weeklyTotal)} hint={t("metric.weeklyTotalHint")} />
        <div className="col-span-2 xl:col-span-1">
          <MetricCard icon="⚖️" label={t("metric.dailyAverage")} value={formatDecimal(getDailyAverage(logs))} hint={t("metric.dailyAverageHint")} />
        </div>
      </section>

      <section className="grid gap-4 sm:gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-accent-strong">{t("performanceEyebrow")}</p>
            <h2 className="text-2xl font-black text-fg">{t("performanceTitle")}</h2>
          </div>
          <WeeklyChart buckets={buildDailyBuckets(logs)} />
        </Card>

        <Card>
          <p className="text-sm font-bold text-accent-strong">{t("officeHoursEyebrow")}</p>
          <h2 className="text-2xl font-black text-fg">{t("officeHoursTitle", { count: getBusinessHoursCount(logs) })}</h2>
          <p className="mt-3 text-sm text-fg-muted">
            {t("officeHoursDescription")}
          </p>
          <div className="mt-5 rounded-2xl bg-canvas-elevated/75 p-5 text-center text-5xl sm:text-6xl">💼</div>
        </Card>
      </section>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-accent-strong">{t("achievementsEyebrow")}</p>
          <h2 className="text-2xl font-black text-fg">{t("achievementsTitle")}</h2>
        </div>
        <AchievementGrid achievements={achievements} />
      </Card>
    </div>
  );
}
