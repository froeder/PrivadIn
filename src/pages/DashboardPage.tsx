import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import { Crown, TimerReset } from "lucide-react";
import { Card, MetricCard } from "../components/Card";
import { RankingList } from "../components/RankingList";
import type { AppUser, PoopLog, RankedUser } from "../types";
import { registerPoop } from "../services/poopService";
import { countThisWeek, formatDateTime, formatHour, getCooldownSeconds, getLastLog } from "../utils/date";

export function DashboardPage({
  user,
  rankedUsers,
  userLogs,
  onPlaySound,
}: {
  user: AppUser;
  rankedUsers: RankedUser[];
  userLogs: PoopLog[];
  onPlaySound: () => void;
}) {
  const currentRank = rankedUsers.find((ranked) => ranked.uid === user.uid);
  const lastLog = getLastLog(userLogs);
  const cooldownSeconds = getCooldownSeconds(userLogs);

  async function handleRegister() {
    const previousRank = currentRank?.rank ?? rankedUsers.length;
    try {
      await registerPoop(user, userLogs);
      onPlaySound();
      toast.success("Registro feito. A firma jamais sabera a grandeza desse momento.");
      if ((currentRank?.rank ?? previousRank) <= previousRank) {
        confetti({ particleCount: 140, spread: 75, origin: { y: 0.72 }, colors: ["#fde047", "#f59e0b", "#14b8a6"] });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "O vaso recusou o protocolo.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="💩" label="Seu total" value={user.totalPoints} hint="Cada registro vale 1 ponto" />
        <MetricCard icon="🏆" label="Posicao geral" value={`#${currentRank?.rank ?? "-"}`} hint="Empate favorece quem registrou primeiro" />
        <MetricCard icon="🔥" label="Streak diaria" value={`${user.currentDailyStreak}d`} hint={`${user.currentWeeklyStreak} semana(s) ativa(s)`} />
        <MetricCard icon="🕘" label="Ultima cagada" value={formatHour(lastLog?.createdAt)} hint={formatDateTime(lastLog?.createdAt)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Card className="relative overflow-hidden p-6">
          <div className="absolute right-6 top-6 hidden text-8xl opacity-10 sm:block">🚽</div>
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-yellow-300/15 px-3 py-1 text-sm font-bold text-yellow-100">
              <TimerReset size={15} />
              Cooldown anti-fraude: 15 minutos
            </span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-5xl">Momento de gloria remunerada?</h2>
            <p className="mt-3 text-slate-300">
              Registre automaticamente data e horario, some ponto e dispute o trono em tempo real.
            </p>
            <button
              onClick={handleRegister}
              disabled={cooldownSeconds > 0}
              className="mt-6 w-full rounded-3xl bg-yellow-300 px-6 py-6 text-xl font-black text-slate-950 shadow-xl shadow-yellow-300/20 transition hover:-translate-y-1 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {cooldownSeconds > 0 ? `AGUARDE ${Math.ceil(cooldownSeconds / 60)} MIN` : "REGISTRAR CAGADA"}
            </button>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-yellow-100">Top 3</p>
              <h2 className="text-xl font-black text-white">Podio sanitario</h2>
            </div>
            <Crown className="text-yellow-200" />
          </div>
          <RankingList users={rankedUsers.slice(0, 3)} currentUid={user.uid} />
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-yellow-100">Geral</p>
            <h2 className="text-2xl font-black text-white">Ranking ao vivo</h2>
          </div>
          <RankingList users={rankedUsers} currentUid={user.uid} />
        </Card>
        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-yellow-100">{countThisWeek(userLogs)} seus nesta semana</p>
            <h2 className="text-2xl font-black text-white">Ranking semanal</h2>
          </div>
          <RankingList users={rankedUsers} mode="weekly" currentUid={user.uid} />
        </Card>
      </section>
    </div>
  );
}
