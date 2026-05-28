import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import { Crown, Share2, TimerReset } from "lucide-react";
import { Card, MetricCard } from "../components/Card";
import { RankingList } from "../components/RankingList";
import type { AppUser, PoopLog, RankedUser } from "../types";
import { registerPoop } from "../services/poopService";
import { countThisWeek, formatDateTime, formatHour, getCooldownSeconds, getLastLog } from "../utils/date";
import { toRoman } from "../utils/roman";

export function DashboardPage({
  user,
  rankedUsers,
  userLogs,
  cooldownMinutes,
  pointsPerLog,
  edition,
  onPlaySound,
}: {
  user: AppUser;
  rankedUsers: RankedUser[];
  userLogs: PoopLog[];
  cooldownMinutes: number;
  pointsPerLog: number;
  edition: number;
  onPlaySound: () => void;
}) {
  const currentRank = rankedUsers.find((ranked) => ranked.uid === user.uid);
  const lastLog = getLastLog(userLogs);
  const cooldownSeconds = getCooldownSeconds(userLogs, cooldownMinutes);
  const formattedPointsPerLog = pointsPerLog.toLocaleString("pt-BR");
  const isOnCooldown = cooldownSeconds > 0;
  const cooldownWarningMessage = "Está querendo roubar? Aposto que é o mário";

  async function handleRegister() {
    if (isOnCooldown) {
      toast.error(cooldownWarningMessage);
      return;
    }

    const previousRank = currentRank?.rank ?? rankedUsers.length;
    try {
      await registerPoop(user, userLogs, cooldownMinutes, pointsPerLog);
      onPlaySound();
      toast.success("Registro feito. A firma jamais sabera a grandeza desse momento.");
      if ((currentRank?.rank ?? previousRank) <= previousRank) {
        confetti({ particleCount: 140, spread: 75, origin: { y: 0.72 }, colors: ["#fde047", "#f59e0b", "#14b8a6"] });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "O vaso recusou o protocolo.");
    }
  }

  async function handleShareRanking() {
    const rankingText = rankedUsers
      .sort((a, b) => a.rank - b.rank)
      .map((ranked) =>
        `${ranked.rank}. ${ranked.name}${ranked.nickname?.trim() ? ` (${ranked.nickname.trim()})` : ""} - ${ranked.totalPoints} pontos`,
      )
      .join("\n");
    const text = `${toRoman(edition)} cumpetiçao PrivadIn:\n\n${rankingText || "Sem jogadores no ranking ainda."}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Ranking atual do PrivadIn",
          text,
        });
        return;
      }

      await navigator.clipboard.writeText(text);
      toast.success("Ranking copiado. Agora e so jogar no grupo sem piedade.");
    } catch {
      toast.error("Não consegui compartilhar o ranking agora.");
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <section className="order-2 grid grid-cols-2 gap-3 sm:gap-4 md:order-1 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="💩" label="Seu total" value={user.totalPoints} hint={`Cada registro vale ${formattedPointsPerLog} pontos`} />
        <MetricCard icon="🏆" label="Posição geral" value={`#${currentRank?.rank ?? "-"}`} hint="Empate favorece quem registrou primeiro" />
        <MetricCard icon="🔥" label="Streak diaria" value={`${user.currentDailyStreak}d`} hint={`${user.currentWeeklyStreak} semana(s) ativa(s)`} />
        <MetricCard icon="🕘" label="Última cagada" value={formatHour(lastLog?.createdAt)} hint={formatDateTime(lastLog?.createdAt)} />
      </section>

      <section className="order-1 grid gap-4 sm:gap-5 md:order-2 xl:grid-cols-[1fr_380px]">
        <Card className="relative overflow-hidden p-4 sm:p-6">
          <div className="absolute right-4 top-4 hidden text-8xl opacity-10 sm:right-6 sm:top-6 sm:block">🚽</div>
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-yellow-300/15 px-3 py-1 text-xs font-bold text-yellow-100 sm:text-sm">
              <TimerReset size={15} />
              Cooldown anti-fraude: {cooldownMinutes} minuto{cooldownMinutes === 1 ? "" : "s"}
            </span>
            <h2 className="mt-4 text-2xl font-black leading-tight text-white sm:text-5xl">Momento de gloria remunerada?</h2>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              Registre automaticamente data e horário, ganhe {formattedPointsPerLog} pontos e dispute o trono em tempo real.
            </p>
            <button
              onClick={handleRegister}
              aria-disabled={isOnCooldown}
              title={isOnCooldown ? cooldownWarningMessage : "Registrar pontuacao"}
              className={`mt-6 w-full rounded-2xl bg-yellow-300 px-5 py-4 text-base font-black text-slate-950 shadow-xl shadow-yellow-300/20 transition sm:w-auto sm:rounded-3xl sm:px-6 sm:py-6 sm:text-xl ${
                isOnCooldown
                  ? "cursor-not-allowed opacity-60"
                  : "hover:-translate-y-1 hover:bg-yellow-200"
              }`}
            >
              {isOnCooldown
                ? `AGUARDE ${Math.ceil(cooldownSeconds / 60)} MIN`
                : `REGISTRAR CAGADA (+${formattedPointsPerLog})`}
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

      <section className="grid gap-4 sm:gap-5 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-yellow-100">Geral</p>
              <h2 className="text-2xl font-black text-white">Ranking ao vivo</h2>
            </div>
            <button
              onClick={handleShareRanking}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-yellow-200/20 bg-yellow-300/15 px-4 py-3 text-sm font-black text-yellow-100 transition hover:bg-yellow-300 hover:text-slate-950 sm:w-auto"
              title="Compartilhar ranking atual"
            >
              <Share2 size={18} />
              Compartilhar
            </button>
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
