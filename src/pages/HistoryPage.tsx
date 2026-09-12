import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, MetricCard } from "../components/Card";
import { WeeklyChart } from "../components/WeeklyChart";
import type { AppUser, PoopLog } from "../types";
import { buildDailyBuckets, countThisWeek, countToday, formatDateTime } from "../utils/date";
import { formatNumber } from "../utils/format";
import { formatCurrencyFromCents } from "../utils/currency";
import { getLogDurationMinutes, getLogEarnedCents, getUserHourlyRateCents } from "../utils/analytics";

const PAGE_SIZE = 10;

export function HistoryPage({ user, logs }: { user?: AppUser | null; logs: PoopLog[] }) {
  const { t } = useTranslation(["history", "common"]);
  const [currentPage, setCurrentPage] = useState(1);

  const buckets = useMemo(() => buildDailyBuckets(logs), [logs]);
  const hourlyRateCents = useMemo(() => getUserHourlyRateCents(user), [user]);
  const defaultDurationMinutes = user?.bathroomDurationMinutes && user.bathroomDurationMinutes > 0
    ? user.bathroomDurationMinutes
    : 10;

  const totalEarnedCents = useMemo(() => {
    return logs.reduce((sum, log) => {
      return sum + getLogEarnedCents(log, hourlyRateCents, defaultDurationMinutes);
    }, 0);
  }, [logs, hourlyRateCents, defaultDurationMinutes]);

  const totalMinutes = useMemo(() => {
    return logs.reduce((sum, log) => {
      return sum + getLogDurationMinutes(log, defaultDurationMinutes);
    }, 0);
  }, [logs, defaultDurationMinutes]);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return logs.slice(start, start + PAGE_SIZE);
  }, [logs, currentPage]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Metrics */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <MetricCard
          icon="📅"
          label={t("common:labels.today")}
          value={formatNumber(countToday(logs))}
          hint={t("metricTodayHint")}
        />
        <MetricCard
          icon="🗓️"
          label={t("common:labels.week")}
          value={formatNumber(countThisWeek(logs))}
          hint={t("metricWeekHint")}
        />
        <MetricCard
          icon="🧾"
          label={t("common:labels.totalHistory")}
          value={formatNumber(logs.length)}
          hint={`${totalMinutes} min no trono`}
        />
        <MetricCard
          icon="💰"
          label="Total Faturado"
          value={formatCurrencyFromCents(totalEarnedCents)}
          hint="Pago pela firma"
        />
      </section>

      {/* Weekly Chart */}
      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-accent-strong">{t("chartEyebrow")}</p>
          <h2 className="text-2xl font-black text-fg">{t("chartTitle")}</h2>
        </div>
        <WeeklyChart buckets={buckets} />
      </Card>

      {/* Paginated Complete History */}
      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-accent-strong">{t("timelineEyebrow")}</p>
            <h2 className="text-2xl font-black text-fg">Histórico Completo de Sessões</h2>
          </div>
          {logs.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-fg-muted">
              <span>{logs.length} sessões registradas</span>
              <span>•</span>
              <span className="text-accent-strong">Página {currentPage} de {totalPages}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-fg-muted">
              {t("empty")}
            </div>
          ) : (
            paginatedLogs.map((log, index) => {
              const globalIndex = logs.length - ((currentPage - 1) * PAGE_SIZE + index);
              const duration = getLogDurationMinutes(log, defaultDurationMinutes);
              const earnedCents = getLogEarnedCents(log, hourlyRateCents, defaultDurationMinutes);

              return (
                <div
                  key={log.id}
                  className="flex flex-col gap-3 rounded-xl border border-line/10 bg-panel-strong/40 p-3 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft/35 text-lg text-accent-strong sm:h-11 sm:w-11 sm:rounded-2xl sm:text-xl">
                      🚽
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-fg">
                          {t("entryTitle", { index: globalIndex })}
                        </p>
                        {log.competitionEdition && (
                          <span className="rounded-md bg-canvas-elevated px-1.5 py-0.5 text-[10px] font-bold text-fg-muted">
                            Ed. {log.competitionEdition}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-fg-muted sm:text-sm">{formatDateTime(log.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    {/* Duration badge */}
                    <div className="flex items-center gap-1 rounded-lg bg-panel px-2.5 py-1 text-xs font-bold text-fg-soft sm:text-sm">
                      <span>⏱️</span>
                      <span>{duration} min</span>
                    </div>

                    {/* Earnings in R$ */}
                    <div className="flex items-center gap-1 rounded-lg bg-success/15 px-2.5 py-1 text-xs font-black text-success sm:text-sm">
                      <span>💰</span>
                      <span>+ {formatCurrencyFromCents(earnedCents)}</span>
                    </div>

                    {/* Points badge */}
                    <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-black text-accent-fg sm:px-3 sm:text-sm">
                      +{formatNumber(log.points)} pts
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between border-t border-line/10 pt-4">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-line/10 bg-panel px-3.5 py-2 text-xs font-bold text-fg transition hover:bg-panel-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              ◀ Anterior
            </button>

            <div className="flex items-center gap-1.5 text-xs font-bold text-fg-muted">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((pageNum, idx, arr) => {
                  const prev = arr[idx - 1];
                  const hasGap = prev && pageNum - prev > 1;

                  return (
                    <div key={pageNum} className="flex items-center gap-1.5">
                      {hasGap && <span>...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-7 w-7 rounded-lg text-xs font-black transition ${
                          pageNum === currentPage
                            ? "bg-accent text-accent-fg shadow-accent"
                            : "border border-line/10 bg-panel text-fg hover:bg-panel-strong"
                        }`}
                      >
                        {pageNum}
                      </button>
                    </div>
                  );
                })}
            </div>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-line/10 bg-panel px-3.5 py-2 text-xs font-bold text-fg transition hover:bg-panel-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próxima ▶
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
