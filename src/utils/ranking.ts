import type { AppUser, PoopLog, RankedUser } from "../types";
import i18n from "../i18n";
import { getWeekStart, toDate } from "./date";

const DICEBEAR_URL_PREFIX = "https://api.dicebear.com/";

export function rankUsers(users: AppUser[], logs: PoopLog[] = []): RankedUser[] {
  const activeUsers = users.filter((user) => user.isActive !== false);
  const latestLogAt = new Map<string, number>();
  const currentCompetitionLatestLogAt = new Map<string, number>();
  const currentWeekPoints = new Map<string, number>();
  const currentWeekStart = getWeekStart();
  const useLogWeeklyPoints = logs.length > 0;

  for (const log of logs) {
    const createdAtMs = log.createdAt?.toMillis?.() ?? 0;
    const previousLatest = latestLogAt.get(log.userId) ?? 0;

    if (createdAtMs > previousLatest) {
      latestLogAt.set(log.userId, createdAtMs);
    }

    const logDate = toDate(log.createdAt);
    const isCurrentWeekLog = Boolean(logDate && logDate > currentWeekStart);

    if (isCurrentWeekLog) {
      currentWeekPoints.set(
        log.userId,
        (currentWeekPoints.get(log.userId) ?? 0) + Math.max(0, Number(log.points) || 0),
      );

      const previousWeeklyLatest = currentCompetitionLatestLogAt.get(log.userId) ?? 0;
      if (createdAtMs > previousWeeklyLatest) {
        currentCompetitionLatestLogAt.set(log.userId, createdAtMs);
      }
    }
  }

  const overall = [...activeUsers].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    const aLatest = latestLogAt.get(a.uid) ?? a.lastLogAt?.toMillis() ?? a.firstLogAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
    const bLatest = latestLogAt.get(b.uid) ?? b.lastLogAt?.toMillis() ?? b.firstLogAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0;
    return bLatest - aLatest;
  });

  const weekly = [...activeUsers].sort((a, b) => {
    const aWeeklyPoints = useLogWeeklyPoints ? currentWeekPoints.get(a.uid) ?? 0 : a.weeklyPoints;
    const bWeeklyPoints = useLogWeeklyPoints ? currentWeekPoints.get(b.uid) ?? 0 : b.weeklyPoints;
    if (bWeeklyPoints !== aWeeklyPoints) return bWeeklyPoints - aWeeklyPoints;
    const aLatest = currentCompetitionLatestLogAt.get(a.uid) ?? (aWeeklyPoints > 0 ? a.lastLogAt?.toMillis() : undefined) ?? 0;
    const bLatest = currentCompetitionLatestLogAt.get(b.uid) ?? (bWeeklyPoints > 0 ? b.lastLogAt?.toMillis() : undefined) ?? 0;
    return bLatest - aLatest;
  });

  const weeklyRanks = new Map(weekly.map((user, index) => [user.uid, index + 1]));

  return overall.map((user, index) => ({
    ...user,
    weeklyPoints: useLogWeeklyPoints ? currentWeekPoints.get(user.uid) ?? 0 : user.weeklyPoints,
    rank: index + 1,
    weeklyRank: weeklyRanks.get(user.uid) ?? activeUsers.length,
  }));
}

export function medalFor(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "🏅";
}

export function titleFor(rank: number) {
  if (rank === 1) return i18n.t("services:ranking.first");
  if (rank === 2) return i18n.t("services:ranking.second");
  if (rank === 3) return i18n.t("services:ranking.third");
  return i18n.t("services:ranking.other");
}

export function avatarFor(name: string, email: string) {
  const seed = encodeURIComponent(name || email);
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}&backgroundColor=facc15,f59e0b,0f172a`;
}

export function isValidDicebearUrl(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith(DICEBEAR_URL_PREFIX)) return false;

  try {
    const url = new URL(trimmedValue);
    return url.href.startsWith(DICEBEAR_URL_PREFIX);
  } catch {
    return false;
  }
}

export function canLoadDicebearUrl(value: string) {
  const trimmedValue = value.trim();
  if (!isValidDicebearUrl(trimmedValue)) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const image = new Image();
    const timeoutId = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      resolve(false);
    }, 5000);

    image.onload = () => {
      window.clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      resolve(true);
    };

    image.onerror = () => {
      window.clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      resolve(false);
    };

    image.src = trimmedValue;
  });
}
