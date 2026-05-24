import { Card, MetricCard } from "../components/Card";
import { WeeklyChart } from "../components/WeeklyChart";
import type { PoopLog } from "../types";
import { buildDailyBuckets, countThisWeek, countToday, formatDateTime } from "../utils/date";

export function HistoryPage({ logs }: { logs: PoopLog[] }) {
  const buckets = buildDailyBuckets(logs);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon="📅" label="Hoje" value={countToday(logs)} hint="Quantidade diaria" />
        <MetricCard icon="🗓️" label="Semana" value={countThisWeek(logs)} hint="Desde segunda-feira" />
        <MetricCard icon="🧾" label="Historico total" value={logs.length} hint="Registros pessoais" />
      </section>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Ultimos 7 dias</p>
          <h2 className="text-2xl font-black text-white">Grafico semanal</h2>
        </div>
        <WeeklyChart buckets={buckets} />
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Somente seus registros</p>
          <h2 className="text-2xl font-black text-white">Linha do tempo</h2>
        </div>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
              Nada registrado ainda. O expediente aguarda seu primeiro capitulo.
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={log.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-yellow-300/15 text-xl">
                  🚽
                </div>
                <div className="flex-1">
                  <p className="font-black text-white">Registro #{logs.length - index}</p>
                  <p className="text-sm text-slate-400">{formatDateTime(log.createdAt)}</p>
                </div>
                <span className="rounded-full bg-yellow-300 px-3 py-1 text-sm font-black text-slate-950">
                  +{log.points}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
