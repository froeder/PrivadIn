import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import type { RankedUser } from "../types";
import { medalFor, titleFor } from "../utils/ranking";
import { formatNumber } from "../utils/format";

export function RankingList({
  users,
  mode = "overall",
  currentUid,
}: {
  users: RankedUser[];
  mode?: "overall" | "weekly";
  currentUid?: string;
}) {
  const { t } = useTranslation("common");
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
              "flex items-center gap-2.5 rounded-xl border p-2.5 transition sm:gap-3 sm:rounded-2xl sm:p-3",
              rank <= 3
                ? "border-yellow-200/25 bg-yellow-300/12"
                : "border-white/10 bg-white/6",
              user.uid === currentUid && "ring-2 ring-yellow-300/70",
            )}
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950/70 text-xl sm:h-12 sm:w-12 sm:rounded-2xl sm:text-2xl">
              {medalFor(rank)}
            </div>
            <img src={user.avatar} alt="" className="h-10 w-10 rounded-full bg-yellow-100 sm:h-11 sm:w-11" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-black text-white sm:text-base">{user.name}</p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-100 sm:text-xs">
                  #{rank}
                </span>
              </div>
              {user.nickname?.trim() ? (
                <p className="truncate text-[11px] font-semibold text-yellow-100 sm:text-xs">{user.nickname.trim()}</p>
              ) : null}
              <p className="text-[11px] text-slate-400 sm:text-xs">{titleFor(rank)}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-yellow-200 sm:text-2xl">{formatNumber(points)}</p>
              <p className="text-[10px] text-slate-400 sm:text-xs">{t("labels.pointsShort")}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
