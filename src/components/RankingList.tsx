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
                ? "border-accent/25 bg-accent-soft/20"
                : "border-line/10 bg-panel-strong/40",
              user.uid === currentUid && "ring-2 ring-accent/70",
            )}
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas-elevated/80 text-xl text-fg sm:h-12 sm:w-12 sm:rounded-2xl sm:text-2xl">
              {medalFor(rank)}
            </div>
            <img src={user.avatar} alt="" className="h-10 w-10 rounded-full bg-accent-soft sm:h-11 sm:w-11" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-black text-fg sm:text-base">{user.name}</p>
                <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-semibold text-accent-strong sm:text-xs">
                  #{rank}
                </span>
              </div>
              {user.nickname?.trim() ? (
                <p className="truncate text-[11px] font-semibold text-accent-strong sm:text-xs">{user.nickname.trim()}</p>
              ) : null}
              <p className="text-[11px] text-fg-muted sm:text-xs">{titleFor(rank)}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-accent-strong sm:text-2xl">{formatNumber(points)}</p>
              <p className="text-[10px] text-fg-muted sm:text-xs">{t("labels.pointsShort")}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
