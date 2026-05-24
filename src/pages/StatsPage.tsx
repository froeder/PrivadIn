import { AchievementGrid } from "../components/AchievementGrid";
import { Card, MetricCard } from "../components/Card";
import { WeeklyChart } from "../components/WeeklyChart";
import type { AppUser, PoopLog, RankedUser } from "../types";
import { buildDailyBuckets, getBusinessHoursCount, getDailyAverage, getProductiveHour } from "../utils/date";
import { getAchievements } from "../utils/achievements";

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
  const king = rankedUsers[0];
  const streakLeader = [...rankedUsers].sort((a, b) => b.bestStreak - a.bestStreak)[0];
  const weeklyTotal = rankedUsers.reduce((sum, ranked) => sum + ranked.weeklyPoints, 0);
  const achievements = getAchievements(user, logs);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon="👑" label="Rei da privada" value={king?.name ?? "-"} hint={`${king?.totalPoints ?? 0} pontos`} />
        <MetricCard icon="🔥" label="Maior streak" value={streakLeader?.bestStreak ?? 0} hint={streakLeader?.name ?? "Sem lider ainda"} />
        <MetricCard icon="🚽" label="Horario produtivo" value={getProductiveHour(allLogs)} hint="Pico geral" />
        <MetricCard icon="📈" label="Total da semana" value={weeklyTotal} hint="Todos os jogadores" />
        <MetricCard icon="⚖️" label="Media diaria" value={getDailyAverage(logs).toFixed(1)} hint="Seu ritmo pessoal" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-yellow-100">Sua performance</p>
            <h2 className="text-2xl font-black text-white">Semana em barras</h2>
          </div>
          <WeeklyChart buckets={buildDailyBuckets(logs)} />
        </Card>

        <Card>
          <p className="text-sm font-bold text-yellow-100">Horario comercial</p>
          <h2 className="text-2xl font-black text-white">{getBusinessHoursCount(logs)} registros CLT</h2>
          <p className="mt-3 text-sm text-slate-400">
            Conta somente registros entre 8h e 18h. Um placar elegante para quem sabe otimizar a agenda.
          </p>
          <div className="mt-5 rounded-2xl bg-slate-950/50 p-5 text-center text-6xl">💼</div>
        </Card>
      </section>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Sistema de conquistas</p>
          <h2 className="text-2xl font-black text-white">Troféus do trono</h2>
        </div>
        <AchievementGrid achievements={achievements} />
      </Card>
    </div>
  );
}
