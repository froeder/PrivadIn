import { Card, MetricCard } from "../components/Card";
import { WeeklyChart } from "../components/WeeklyChart";
import type { PoopLog } from "../types";
import { buildDailyBuckets, countThisWeek, countToday, formatDateTime } from "../utils/date";

export function HistoryPage({ logs }: { logs: PoopLog[] }) {
  const buckets = buildDailyBuckets(logs);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <MetricCard icon="📅" label="Hoje" value={countToday(logs)} hint="Quantidade diária" />
        <MetricCard icon="🗓️" label="Semana" value={countThisWeek(logs)} hint="Desde segunda-feira" />
        <div className="col-span-2 md:col-span-1">
          <MetricCard icon="🧾" label="Histórico total" value={logs.length} hint="Registros pessoais" />
        </div>
      </section>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Últimos 7 dias</p>
          <h2 className="text-2xl font-black text-white">Gráfico semanal</h2>
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
              Nada registrado ainda. O expediente aguarda seu primeiro capítulo.
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={log.id} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3 sm:items-center sm:gap-3 sm:rounded-2xl sm:p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-yellow-300/15 text-lg sm:h-11 sm:w-11 sm:rounded-2xl sm:text-xl">
                  🚽
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white">Registro #{logs.length - index}</p>
                  <p className="text-xs text-slate-400 sm:text-sm">{formatDateTime(log.createdAt)}</p>
                </div>
                <span className="self-start rounded-full bg-yellow-300 px-2.5 py-1 text-xs font-black text-slate-950 sm:self-auto sm:px-3 sm:text-sm">
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
