import { useTranslation } from "react-i18next";
import { Card, MetricCard } from "../components/Card";
import { WeeklyChart } from "../components/WeeklyChart";
import type { PoopLog } from "../types";
import { buildDailyBuckets, countThisWeek, countToday, formatDateTime } from "../utils/date";
import { formatNumber } from "../utils/format";

export function HistoryPage({ logs }: { logs: PoopLog[] }) {
  const { t } = useTranslation(["history", "common"]);
  const buckets = buildDailyBuckets(logs);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <MetricCard icon="📅" label={t("common:labels.today")} value={formatNumber(countToday(logs))} hint={t("metricTodayHint")} />
        <MetricCard icon="🗓️" label={t("common:labels.week")} value={formatNumber(countThisWeek(logs))} hint={t("metricWeekHint")} />
        <div className="col-span-2 md:col-span-1">
          <MetricCard icon="🧾" label={t("common:labels.totalHistory")} value={formatNumber(logs.length)} hint={t("metricTotalHint")} />
        </div>
      </section>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-accent-strong">{t("chartEyebrow")}</p>
          <h2 className="text-2xl font-black text-fg">{t("chartTitle")}</h2>
        </div>
        <WeeklyChart buckets={buckets} />
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-accent-strong">{t("timelineEyebrow")}</p>
          <h2 className="text-2xl font-black text-fg">{t("timelineTitle")}</h2>
        </div>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-fg-muted">
              {t("empty")}
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={log.id} className="flex items-start gap-2.5 rounded-xl border border-line/10 bg-panel-strong/40 p-3 sm:items-center sm:gap-3 sm:rounded-2xl sm:p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft/35 text-lg text-accent-strong sm:h-11 sm:w-11 sm:rounded-2xl sm:text-xl">
                  🚽
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-fg">{t("entryTitle", { index: logs.length - index })}</p>
                  <p className="text-xs text-fg-muted sm:text-sm">{formatDateTime(log.createdAt)}</p>
                </div>
                <span className="self-start rounded-full bg-accent px-2.5 py-1 text-xs font-black text-accent-fg sm:self-auto sm:px-3 sm:text-sm">
                  +{formatNumber(log.points)}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
