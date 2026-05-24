import type { DailyBucket } from "../types";

export function WeeklyChart({ buckets }: { buckets: DailyBucket[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <div className="flex h-48 items-end gap-2 pt-4">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end rounded-full bg-slate-950/50 p-1">
            <div
              className="w-full rounded-full bg-gradient-to-t from-yellow-500 to-yellow-200 shadow-lg shadow-yellow-400/20 transition-all"
              style={{ height: `${Math.max(8, (bucket.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-400">{bucket.label}</span>
          <span className="text-xs text-yellow-100">{bucket.count}</span>
        </div>
      ))}
    </div>
  );
}
