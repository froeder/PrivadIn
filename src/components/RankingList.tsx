import { clsx } from "clsx";
import type { RankedUser } from "../types";
import { medalFor, titleFor } from "../utils/ranking";

export function RankingList({
  users,
  mode = "overall",
  currentUid,
}: {
  users: RankedUser[];
  mode?: "overall" | "weekly";
  currentUid?: string;
}) {
  const sorted = [...users].sort((a, b) => (mode === "weekly" ? a.weeklyRank - b.weeklyRank : a.rank - b.rank));

  return (
    <div className="space-y-3">
      {sorted.map((user) => {
        const rank = mode === "weekly" ? user.weeklyRank : user.rank;
        const points = mode === "weekly" ? user.weeklyPoints : user.totalPoints;
        return (
          <div
            key={user.uid}
            className={clsx(
              "flex items-center gap-3 rounded-2xl border p-3 transition",
              rank <= 3
                ? "border-yellow-200/25 bg-yellow-300/12"
                : "border-white/10 bg-white/6",
              user.uid === currentUid && "ring-2 ring-yellow-300/70",
            )}
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950/70 text-2xl">
              {medalFor(rank)}
            </div>
            <img src={user.avatar} alt="" className="h-11 w-11 rounded-full bg-yellow-100" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-black text-white">{user.name}</p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-yellow-100">
                  #{rank}
                </span>
              </div>
              <p className="text-xs text-slate-400">{titleFor(rank)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-yellow-200">{points}</p>
              <p className="text-xs text-slate-400">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
