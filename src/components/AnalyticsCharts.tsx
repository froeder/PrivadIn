import { useState } from "react";
import type { HourlyBucket, WeekdayProfitBucket, WebAnnualEstimate } from "../utils/analytics";
import { formatCurrencyFromCents } from "../utils/currency";

export function CompanyCostCard({
  estimate,
  hourlyRateCents,
}: {
  estimate: WebAnnualEstimate;
  hourlyRateCents: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-accent bg-panel-strong/80 p-5 shadow-panel backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1 text-xs font-black text-accent-strong">
          <span>💸</span>
          <span>A FIRMA PAGA!</span>
        </div>
        <span className="text-xs font-bold text-fg-muted">Projeção para 252 dias úteis/ano</span>
      </div>

      <div className="my-4">
        <p className="text-xs font-bold uppercase tracking-wider text-fg-muted sm:text-sm">
          Estimativa Anual Paga Pela Firma
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-accent-strong sm:text-4xl">
            {formatCurrencyFromCents(estimate.annualCostCents)}
          </span>
          <span className="text-sm font-bold text-fg-muted">/ano</span>
        </div>
        <p className="mt-2 text-xs text-fg-soft sm:text-sm">
          Projeção anual de quanto o seu salário cobre suas visitas ao trono durante o expediente corporativo.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-canvas-elevated/70 p-3 text-center sm:gap-3 sm:p-4">
        <div>
          <p className="text-base font-black text-fg sm:text-lg">
            {estimate.averageDailyMinutes} min
          </p>
          <p className="text-[10px] font-bold text-fg-muted sm:text-xs">Média Diária</p>
        </div>
        <div>
          <p className="text-base font-black text-fg sm:text-lg">
            {estimate.annualBathroomHours} h
          </p>
          <p className="text-[10px] font-bold text-fg-muted sm:text-xs">Horas Pagas/Ano</p>
        </div>
        <div>
          <p className="text-base font-black text-accent-strong sm:text-lg">
            {formatCurrencyFromCents(hourlyRateCents)}
          </p>
          <p className="text-[10px] font-bold text-fg-muted sm:text-xs">Sua Taxa/Hora</p>
        </div>
      </div>
    </div>
  );
}

export function HourlyFrequencyChart({
  buckets,
  peakHour,
  peakCount,
}: {
  buckets: HourlyBucket[];
  peakHour: number | null;
  peakCount: number;
}) {
  const [selectedHour, setSelectedHour] = useState<HourlyBucket | null>(null);
  const max = Math.max(1, peakCount);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-fg-muted">
            Distribuição de todas as sessões registradas ao longo das 24 horas:
          </p>
        </div>
        {peakHour !== null && (
          <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-xs font-black text-danger sm:self-auto">
            <span>🔥</span>
            <span>Horário de Pico: {String(peakHour).padStart(2, "0")}:00h ({peakCount} sessões)</span>
          </div>
        )}
      </div>

      {/* Hourly bars (scrollable or grid) */}
      <div className="flex h-36 items-end gap-1 overflow-x-auto pb-2 pt-4 sm:h-44 sm:gap-1.5">
        {buckets.map((bucket) => {
          const isPeak = peakHour !== null && bucket.hour === peakHour;
          const isSelected = selectedHour?.hour === bucket.hour;
          const heightPercent = bucket.count > 0 ? Math.max(14, (bucket.count / max) * 100) : 6;

          return (
            <button
              key={bucket.hour}
              type="button"
              onClick={() => setSelectedHour(bucket)}
              className="flex min-w-[28px] flex-1 flex-col items-center gap-1.5 transition-transform hover:scale-105 sm:min-w-[34px]"
            >
              <span className="text-[10px] font-black text-accent-strong">
                {bucket.count > 0 ? bucket.count : ""}
              </span>
              <div className="flex h-20 w-full items-end rounded-full bg-canvas-elevated/75 p-0.5 sm:h-28">
                <div
                  className={`w-full rounded-full transition-all ${
                    isPeak
                      ? "bg-gradient-to-t from-danger to-danger/80 shadow-accent"
                      : isSelected
                      ? "bg-gradient-to-t from-accent-strong to-accent shadow-accent"
                      : bucket.count > 0
                      ? "bg-gradient-to-t from-blue-600 to-cyan-500"
                      : "bg-line/20"
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <span
                className={`text-[10px] font-bold ${
                  isPeak
                    ? "font-black text-danger"
                    : isSelected
                    ? "text-accent-strong"
                    : "text-fg-muted"
                }`}
              >
                {bucket.label}
              </span>
            </button>
          );
        })}
      </div>

      {selectedHour && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-xs text-fg-soft">
          <strong className="text-fg">Janela das {selectedHour.label}:00: </strong>
          {selectedHour.count === 0
            ? "Nenhuma sessão registrada neste horário."
            : `${selectedHour.count} cagada(s) realizada(s) nesse horário.`}
        </div>
      )}
    </div>
  );
}

export function WeekdayProfitabilityChart({
  buckets,
  bestDay,
}: {
  buckets: WeekdayProfitBucket[];
  bestDay: WeekdayProfitBucket | null;
}) {
  const maxEarned = Math.max(1, ...buckets.map((b) => b.earnedCents));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-fg-muted">
          Ganhos acumulados e sessões por dia da semana (Segunda a Domingo):
        </p>
        {bestDay && bestDay.earnedCents > 0 && (
          <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-success/30 bg-success/15 px-3 py-1 text-xs font-black text-success sm:self-auto">
            <span>🏆</span>
            <span>Dia Mais Rentável: {bestDay.label} ({formatCurrencyFromCents(bestDay.earnedCents)})</span>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {buckets.map((bucket) => {
          const isBest = bestDay?.dayIndex === bucket.dayIndex && bucket.earnedCents > 0;
          const widthPercent =
            bucket.earnedCents > 0 ? Math.max(12, (bucket.earnedCents / maxEarned) * 100) : 4;

          return (
            <div
              key={bucket.dayIndex}
              className={`flex items-center gap-3 rounded-xl p-2 transition ${
                isBest ? "bg-accent/10 border border-accent/20" : "bg-panel-strong/30"
              }`}
            >
              <div className="w-16 shrink-0 sm:w-20">
                <span className={`text-xs font-black sm:text-sm ${isBest ? "text-accent-strong" : "text-fg"}`}>
                  {bucket.label}
                </span>
                <p className="text-[10px] text-fg-muted">
                  {bucket.count} {bucket.count === 1 ? "sessão" : "sessões"}
                </p>
              </div>

              <div className="relative h-4 flex-1 rounded-full bg-canvas-elevated/80 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isBest
                      ? "bg-gradient-to-r from-accent to-accent-strong shadow-accent"
                      : "bg-gradient-to-r from-blue-600 to-cyan-500"
                  }`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>

              <div className="w-24 shrink-0 text-right sm:w-28">
                <span className={`text-xs font-black sm:text-sm ${isBest ? "text-success" : "text-fg-soft"}`}>
                  {formatCurrencyFromCents(bucket.earnedCents)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
