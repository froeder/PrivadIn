import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import { Loader2, Share2, TimerReset } from "lucide-react";
import type { Timestamp } from "@firebase/firestore";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, MetricCard } from "../components/Card";
import { RankingList } from "../components/RankingList";
import { useAuth } from "../contexts/AuthContext";
import type { AppUser, PoopLog, RankedUser } from "../types";
import { countThisWeek, formatDateTime, formatHour, getCooldownSeconds, getLastLog, sumThisWeekPoints } from "../utils/date";
import { formatNumber } from "../utils/format";
import { toRoman } from "../utils/roman";
import { requestCurrentLocation } from "../services/locationService";
import { registerPoopWithValidation } from "../services/poopService";
import { createWeeklyRankingShareFile, RANKING_LIMIT } from "../utils/weeklyRankingShare";
import { isRegisterPoopError } from "../utils/registerPoopError";

const POOPCOIN_RULE_BANNER_MS = 24 * 60 * 60 * 1000;

export function DashboardPage({
  user,
  rankedUsers,
  userLogs,
  cooldownMinutes,
  pointsPerLog,
  poopcoinsPerLog,
  poopcoinsPerLogUpdatedAt,
  edition,
  competitionAnnouncement,
  onPlaySound,
  onOpenProfile,
  onViewProfile,
}: {
  user: AppUser;
  rankedUsers: RankedUser[];
  userLogs: PoopLog[];
  cooldownMinutes: number;
  pointsPerLog: number;
  poopcoinsPerLog: number;
  poopcoinsPerLogUpdatedAt?: Timestamp;
  edition: number;
  competitionAnnouncement: string;
  onPlaySound: () => void;
  onOpenProfile: () => void;
  onViewProfile: (uid: string) => void;
}) {
  const { t } = useTranslation(["dashboard", "common"]);
  const { openTermsReview } = useAuth();
  const currentRank = rankedUsers.find((ranked) => ranked.uid === user.uid);
  const lastLog = getLastLog(userLogs);
  const visibleWeeklyPoints = userLogs.length > 0 ? sumThisWeekPoints(userLogs) : user.weeklyPoints;
  const logCooldownSeconds = getCooldownSeconds(userLogs, cooldownMinutes);
  const userCooldownSeconds = user.cooldownUntil
    ? Math.max(0, Math.ceil((user.cooldownUntil.toMillis() - Date.now()) / 1000))
    : 0;
  const cooldownSeconds = Math.max(logCooldownSeconds, userCooldownSeconds);
  const formattedPointsPerLog = formatNumber(pointsPerLog);
  const formattedPoopcoinsPerLog = formatNumber(poopcoinsPerLog);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSharingRanking, setIsSharingRanking] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isOnCooldown = cooldownSeconds > 0;
  const cooldownWarningMessage = t("cooldownWarning");
  const poopcoinRuleUpdatedAtMs = poopcoinsPerLogUpdatedAt?.toMillis?.() ?? 0;
  const showPoopcoinRuleBanner =
    poopcoinRuleUpdatedAtMs > 0 &&
    nowMs - poopcoinRuleUpdatedAtMs < POOPCOIN_RULE_BANNER_MS;

  useEffect(() => {
    if (!showPoopcoinRuleBanner) return;

    const remainingMs = Math.max(0, POOPCOIN_RULE_BANNER_MS - (Date.now() - poopcoinRuleUpdatedAtMs));
    const timeoutId = window.setTimeout(() => setNowMs(Date.now()), remainingMs + 1000);
    return () => window.clearTimeout(timeoutId);
  }, [poopcoinRuleUpdatedAtMs, showPoopcoinRuleBanner]);

  async function handleRegister() {
    if (isOnCooldown || isRegistering) {
      if (isOnCooldown) {
        toast.error(cooldownWarningMessage);
      }
      return;
    }
    setIsRegistering(true);

    const previousRank = currentRank?.weeklyRank ?? rankedUsers.length;
    try {
      const location = await requestCurrentLocation();
      await registerPoopWithValidation(user, userLogs, location, cooldownMinutes, pointsPerLog);
      onPlaySound();
      toast.success(t("registerSuccess"));
      if ((currentRank?.weeklyRank ?? previousRank) <= previousRank) {
        confetti({ particleCount: 140, spread: 75, origin: { y: 0.72 }, colors: ["#fde047", "#f59e0b", "#14b8a6"] });
      }
    } catch (error) {
      if (isRegisterPoopError(error) && (error.resolutionTarget === "profile" || error.resolutionTarget === "terms")) {
        toast((toastInstance) => (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-fg">{error.message}</p>
            <button
              type="button"
              className="rounded-xl bg-accent px-3 py-2 text-sm font-black text-accent-fg transition hover:bg-accent-strong"
              onClick={() => {
                toast.dismiss(toastInstance.id);
                if (error.resolutionTarget === "terms") {
                  void openTermsReview();
                  return;
                }
                onOpenProfile();
              }}
            >
              {error.resolutionTarget === "terms" ? t("resolveTermsAction") : t("resolveProfileAction")}
            </button>
          </div>
        ));
      } else {
        toast.error(error instanceof Error ? error.message : t("genericRegisterError"));
      }
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleShareRanking() {
    if (isSharingRanking) return;

    setIsSharingRanking(true);

    try {
      const editionLabel = t("common:labels.currentEdition", { edition: toRoman(edition) });
      const file = await createWeeklyRankingShareFile({
        currentUid: user.uid,
        currentUserLabel: t("shareCurrentUser"),
        editionLabel,
        emptyLabel: t("shareEmpty"),
        footerLabel: t("shareFooter", { count: Math.min(rankedUsers.length, RANKING_LIMIT) }),
        fileName: `privadin-weekly-ranking-${toRoman(edition).toLowerCase()}.png`,
        pointsLabel: t("common:labels.pointsShort"),
        title: t("weeklyTitle"),
        users: rankedUsers,
      });

      const canShareFiles = navigator.canShare ? navigator.canShare({ files: [file] }) : true;

      if (navigator.share && canShareFiles) {
        await navigator.share({
          title: t("shareTitle"),
          files: [file],
        });
        return;
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t("shareDownloaded", { count: Math.min(rankedUsers.length, RANKING_LIMIT) }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      toast.error(t("shareError"));
    } finally {
      setIsSharingRanking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {competitionAnnouncement ? (
        <Card className="border-accent/20 bg-accent-soft/20">
          <div className="space-y-2">
            <p className="text-sm font-bold text-accent-strong">{t("announcementEyebrow")}</p>
            <p className="text-base font-semibold text-fg sm:text-lg">{competitionAnnouncement}</p>
          </div>
        </Card>
      ) : null}

      {showPoopcoinRuleBanner ? (
        <Card className="border-success/20 bg-success-soft/25">
          <div className="space-y-1">
            <p className="text-sm font-bold text-success">Regra PoopCoin atualizada</p>
            <p className="text-base font-semibold text-fg sm:text-lg">
              Cada registro validado agora gera {formattedPoopcoinsPerLog} PC enquanto houver suprimento disponivel.
            </p>
          </div>
        </Card>
      ) : null}

      <section className="order-3 grid grid-cols-2 gap-3 sm:gap-4 md:order-1 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="💩" label={t("metric.total")} value={formatNumber(user.totalPoints)} hint={t("metric.totalHint", { points: formattedPointsPerLog })} />
        <MetricCard icon="📊" label={t("metric.weeklyPoints")} value={formatNumber(visibleWeeklyPoints)} hint={t("metric.weeklyPointsHint")} />
        <MetricCard icon="🔥" label={t("metric.streak")} value={`${user.currentDailyStreak}d`} hint={t("metric.streakHint", { count: user.currentWeeklyStreak })} />
        <MetricCard icon="🕘" label={t("metric.lastLog")} value={formatHour(lastLog?.createdAt)} hint={formatDateTime(lastLog?.createdAt)} />
      </section>

      <section className="order-1 grid gap-4 sm:gap-5 md:order-2 xl:grid-cols-[1fr_380px]">
        <Card className="relative overflow-hidden p-4 sm:p-6">
          <div className="absolute right-4 top-4 hidden text-8xl opacity-10 sm:right-6 sm:top-6 sm:block">🚽</div>
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft/35 px-3 py-1 text-xs font-bold text-accent-strong sm:text-sm">
              <TimerReset size={15} />
              {t("cooldownBadge", { count: cooldownMinutes })}
            </span>
            <h2 className="mt-4 text-2xl font-black leading-tight text-fg sm:text-5xl">{t("heroTitle")}</h2>
            <p className="mt-3 text-sm text-fg-soft sm:text-base">
              {t("heroDescription", { points: formattedPointsPerLog })}
            </p>
            <button
              onClick={handleRegister}
              aria-disabled={isOnCooldown || isRegistering}
              title={isOnCooldown ? cooldownWarningMessage : t("registerTooltip")}
              disabled={isOnCooldown || isRegistering}
              className={`mt-6 w-full rounded-2xl bg-accent px-5 py-4 text-base font-black text-accent-fg shadow-accent transition sm:w-auto sm:rounded-3xl sm:px-6 sm:py-6 sm:text-xl ${
                isOnCooldown || isRegistering
                  ? "cursor-not-allowed opacity-60"
                  : "hover:-translate-y-1 hover:bg-accent-strong"
              }`}
            >
              {isRegistering ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label={t("loading")} />
              ) : isOnCooldown ? (
                t("registerButtonCooldown", { minutes: Math.ceil(cooldownSeconds / 60) })
              ) : (
                t("registerButtonReady", { points: formattedPointsPerLog })
              )}
            </button>
          </div>
        </Card>
      </section>

      <section className="order-2 grid gap-4 sm:gap-5">
        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-accent-strong">{t("weeklyEyebrow", { count: countThisWeek(userLogs) })}</p>
            <h2 className="text-2xl font-black text-fg">{t("weeklyTitle")}</h2>
          </div>
          <RankingList users={rankedUsers} mode="weekly" currentUid={user.uid} onViewProfile={onViewProfile} />
          <button
            onClick={handleShareRanking}
            disabled={isSharingRanking}
            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/20 bg-accent-soft/35 px-4 py-3 text-sm font-black text-accent-strong transition sm:w-auto ${
              isSharingRanking ? "cursor-wait opacity-70" : "hover:bg-accent hover:text-accent-fg"
            }`}
            title={t("shareTitle")}
          >
            {isSharingRanking ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
            {t("shareAction")}
          </button>
        </Card>

        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-accent-strong">{t("overallEyebrow")}</p>
            <h2 className="text-2xl font-black text-fg">{t("overallTitle")}</h2>
          </div>
          <RankingList users={rankedUsers} currentUid={user.uid} onViewProfile={onViewProfile} />
        </Card>
      </section>
    </div>
  );
}
