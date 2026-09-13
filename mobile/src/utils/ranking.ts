import type { AppUser, PoopLog, RankedUser } from "../types";

export function getWeekStart(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.toMillis === "function") return new Date(value.toMillis());
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function rankUsers(users: AppUser[], logs: PoopLog[] = []): RankedUser[] {
  const activeUsers = users.filter((user) => user.isActive !== false);
  const latestLogAt = new Map<string, number>();
  const currentCompetitionLatestLogAt = new Map<string, number>();
  const currentWeekPoints = new Map<string, number>();
  const currentWeekStart = getWeekStart();
  const useLogWeeklyPoints = logs.length > 0;

  for (const log of logs) {
    const createdAtMs =
      log.createdAt?.toMillis?.() ??
      (log.createdAt?.seconds ? log.createdAt.seconds * 1000 : log.createdAt instanceof Date ? log.createdAt.getTime() : 0);
    const previousLatest = latestLogAt.get(log.userId) ?? 0;

    if (createdAtMs > previousLatest) {
      latestLogAt.set(log.userId, createdAtMs);
    }

    const logDate = toDate(log.createdAt);
    const isCurrentWeekLog = Boolean(logDate && logDate > currentWeekStart);

    if (isCurrentWeekLog) {
      currentWeekPoints.set(
        log.userId,
        (currentWeekPoints.get(log.userId) ?? 0) + Math.max(0, Number(log.points) || 0)
      );

      const previousWeeklyLatest = currentCompetitionLatestLogAt.get(log.userId) ?? 0;
      if (createdAtMs > previousWeeklyLatest) {
        currentCompetitionLatestLogAt.set(log.userId, createdAtMs);
      }
    }
  }

  const overall = [...activeUsers].sort((a, b) => {
    const aTotal = a.totalPoints ?? 0;
    const bTotal = b.totalPoints ?? 0;
    if (bTotal !== aTotal) return bTotal - aTotal;
    const aLatest =
      latestLogAt.get(a.uid) ??
      a.lastLogAt?.toMillis?.() ??
      (a.lastLogAt?.seconds ? a.lastLogAt.seconds * 1000 : 0);
    const bLatest =
      latestLogAt.get(b.uid) ??
      b.lastLogAt?.toMillis?.() ??
      (b.lastLogAt?.seconds ? b.lastLogAt.seconds * 1000 : 0);
    return bLatest - aLatest;
  });

  const weekly = [...activeUsers].sort((a, b) => {
    const aWeeklyPoints = useLogWeeklyPoints ? currentWeekPoints.get(a.uid) ?? 0 : a.weeklyPoints ?? 0;
    const bWeeklyPoints = useLogWeeklyPoints ? currentWeekPoints.get(b.uid) ?? 0 : b.weeklyPoints ?? 0;
    if (bWeeklyPoints !== aWeeklyPoints) return bWeeklyPoints - aWeeklyPoints;
    const aLatest =
      currentCompetitionLatestLogAt.get(a.uid) ??
      (aWeeklyPoints > 0 ? a.lastLogAt?.toMillis?.() ?? 0 : 0);
    const bLatest =
      currentCompetitionLatestLogAt.get(b.uid) ??
      (bWeeklyPoints > 0 ? b.lastLogAt?.toMillis?.() ?? 0 : 0);
    return bLatest - aLatest;
  });

  const weeklyRanks = new Map(weekly.map((user, index) => [user.uid, index + 1]));

  return overall.map((user, index) => ({
    ...user,
    weeklyPoints: useLogWeeklyPoints ? currentWeekPoints.get(user.uid) ?? 0 : user.weeklyPoints ?? 0,
    rank: index + 1,
    weeklyRank: weeklyRanks.get(user.uid) ?? activeUsers.length,
  }));
}

export function medalFor(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "🏅";
}

export function titleFor(rank: number): string {
  if (rank === 1) return "Rei do Trono";
  if (rank === 2) return "Duque da Descarga";
  if (rank === 3) return "Cavaleiro do Papel";
  return "Cagador da Firma";
}

export function avatarFor(name: string, email: string): string {
  const seed = encodeURIComponent(name || email || "Cagador");
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}&backgroundColor=facc15,f59e0b,0f172a`;
}
