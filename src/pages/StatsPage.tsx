import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AchievementGrid } from "../components/AchievementGrid";
import { Card, MetricCard } from "../components/Card";
import { WeeklyChart } from "../components/WeeklyChart";
import {
  CompanyCostCard,
  HourlyFrequencyChart,
  WeekdayProfitabilityChart,
} from "../components/AnalyticsCharts";
import type { AppUser, PoopLog, RankedUser } from "../types";
import { buildDailyBuckets, getBusinessHoursCount, getDailyAverage, getProductiveHour } from "../utils/date";
import { getAchievements } from "../utils/achievements";
import { formatDecimal, formatNumber } from "../utils/format";
import {
  getAnnualFirmCostEstimate,
  getAverageSessionMinutes,
  getHourlyDistribution,
  getUserHourlyRateCents,
  getWeekdayProfitability,
} from "../utils/analytics";

export function StatsPage({
  user,
  logs,
  allLogs,
  rankedUsers,
  overallRankingVisible,
}: {
  user: AppUser;
  logs: PoopLog[];
  allLogs: PoopLog[];
  rankedUsers: RankedUser[];
  overallRankingVisible: boolean;
}) {
  const { t } = useTranslation("stats");
  const king = rankedUsers[0];
  const streakLeader = [...rankedUsers].sort((a, b) => b.bestStreak - a.bestStreak)[0];
  const weeklyTotal = rankedUsers.reduce((sum, ranked) => sum + ranked.weeklyPoints, 0);
  const achievements = getAchievements(user, logs);

  const defaultDuration = user.bathroomDurationMinutes && user.bathroomDurationMinutes > 0
    ? user.bathroomDurationMinutes
    : 10;
  const hourlyRateCents = useMemo(() => getUserHourlyRateCents(user), [user]);
  const avgSessionMinutes = useMemo(() => getAverageSessionMinutes(logs, defaultDuration), [logs, defaultDuration]);
  const annualEstimate = useMemo(
    () => getAnnualFirmCostEstimate(logs, hourlyRateCents, defaultDuration),
    [logs, hourlyRateCents, defaultDuration]
  );
  const hourlyData = useMemo(() => getHourlyDistribution(logs), [logs]);
  const weekdayData = useMemo(
    () => getWeekdayProfitability(logs, hourlyRateCents, defaultDuration),
    [logs, hourlyRateCents, defaultDuration]
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Metrics Grid */}
      <section className={`grid grid-cols-2 gap-3 sm:gap-4 ${overallRankingVisible ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
        {overallRankingVisible ? (
          <MetricCard
            icon="👑"
            label={t("metric.king")}
            value={king?.name ?? "-"}
            hint={t("metric.kingHint", { points: formatNumber(king?.totalPoints ?? 0) })}
          />
        ) : null}
        <MetricCard
          icon="🔥"
          label={t("metric.streakLeader")}
          value={formatNumber(streakLeader?.bestStreak ?? 0)}
          hint={streakLeader?.name ?? t("metric.streakLeaderFallback")}
        />
        <MetricCard
          icon="⏱️"
          label="Média p/ Sessão"
          value={`${avgSessionMinutes} min`}
          hint={avgSessionMinutes <= 10 ? "Dentro do limite saudável" : "Longa permanência"}
        />
        <MetricCard
          icon="🚽"
          label={t("metric.productiveHour")}
          value={getProductiveHour(allLogs)}
          hint={t("metric.productiveHourHint")}
        />
        <MetricCard
          icon="📈"
          label={t("metric.weeklyTotal")}
          value={formatNumber(weeklyTotal)}
          hint={t("metric.weeklyTotalHint")}
        />
        <MetricCard
          icon="⚖️"
          label={t("metric.dailyAverage")}
          value={formatDecimal(getDailyAverage(logs))}
          hint={t("metric.dailyAverageHint")}
        />
      </section>

      {/* HERO CARD: Estimativa Anual de quanto a firma pagou pelas cagadas */}
      <CompanyCostCard estimate={annualEstimate} hourlyRateCents={hourlyRateCents} />

      {/* ANALYTICS CHARTS SECTION */}
      <section className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        {/* Gráfico 1: Horários mais frequentes do dia */}
        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-accent-strong">ANALYTICS DO DIA</p>
            <h2 className="text-2xl font-black text-fg">Horários Mais Frequentes do Dia</h2>
          </div>
          <HourlyFrequencyChart
            buckets={hourlyData.buckets}
            peakHour={hourlyData.peakHour}
            peakCount={hourlyData.peakCount}
          />
        </Card>

        {/* Gráfico 2: Dias da semana mais rentáveis */}
        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-accent-strong">RENTABILIDADE SEMANAL</p>
            <h2 className="text-2xl font-black text-fg">Dias da Semana Mais Rentáveis</h2>
          </div>
          <WeekdayProfitabilityChart
            buckets={weekdayData.buckets}
            bestDay={weekdayData.bestDay}
          />
        </Card>
      </section>

      {/* Existing Performance & Office Hours */}
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

      {/* Conquistas (Achievements) */}
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
