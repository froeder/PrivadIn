import type { AppUser, RankedUser } from "../types";

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
  if (rank === 1) return "Rei da Privada";
  if (rank === 2) return "Vice do Vaso";
  if (rank === 3) return "Bronze Sanitário";
  return "Competidor CLT";
}

export function avatarFor(name: string, email: string) {
  const seed = encodeURIComponent(name || email);
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}&backgroundColor=facc15,f59e0b,0f172a`;
}
