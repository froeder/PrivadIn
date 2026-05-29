import { clsx } from "clsx";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-line/10 bg-panel/90 p-3.5 shadow-panel backdrop-blur-xl sm:rounded-2xl sm:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="min-h-[7.5rem] sm:min-h-32">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-fg-muted sm:text-sm">{label}</p>
          <div className="mt-1.5 text-2xl font-black text-fg sm:mt-2 sm:text-3xl">{value}</div>
          {hint ? <p className="mt-1.5 text-xs text-fg-muted sm:mt-2 sm:text-sm">{hint}</p> : null}
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft/30 text-xl text-accent-strong ring-1 ring-accent/20 sm:h-12 sm:w-12 sm:rounded-2xl sm:text-2xl">
          {icon}
        </span>
      </div>
    </Card>
  );
}
