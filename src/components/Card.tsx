import { clsx } from "clsx";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("rounded-2xl border border-white/10 bg-white/8 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl", className)}>
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
    <Card className="min-h-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-400">{label}</p>
          <div className="mt-2 text-3xl font-black text-white">{value}</div>
          {hint ? <p className="mt-2 text-sm text-slate-400">{hint}</p> : null}
        </div>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-yellow-300/15 text-2xl ring-1 ring-yellow-200/20">
          {icon}
        </span>
      </div>
    </Card>
  );
}
