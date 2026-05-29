import type { AppUser, RankedUser } from "../types";
import i18n from "../i18n";

const DICEBEAR_URL_PREFIX = "https://api.dicebear.com/";

export function rankUsers(users: AppUser[]): RankedUser[] {
  const overall = [...users].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    const aFirst = a.firstLogAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
    const bFirst = b.firstLogAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
    return aFirst - bFirst;
  });

  const weekly = [...users].sort((a, b) => {
    if (b.weeklyPoints !== a.weeklyPoints) return b.weeklyPoints - a.weeklyPoints;
    const aFirst = a.firstLogAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
    const bFirst = b.firstLogAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
    return aFirst - bFirst;
  });

  const weeklyRanks = new Map(weekly.map((user, index) => [user.uid, index + 1]));

  return overall.map((user, index) => ({
    ...user,
    rank: index + 1,
    weeklyRank: weeklyRanks.get(user.uid) ?? users.length,
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
