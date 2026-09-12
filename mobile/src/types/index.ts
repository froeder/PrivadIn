export interface AppUser {
  uid: string;
  name: string;
  nickname?: string;
  email: string;
  avatar?: string;
  role?: "player" | "admin";
  totalPoints?: number;
  weeklyPoints?: number;
  currentDailyStreak?: number;
  bestStreak?: number;
  salary?: number;
  hourlyRate?: number;
  poopcoinBalance?: number;
  bathroomDurationMinutes?: number;
  createdAt?: any;
  lastLogAt?: any;
}

export interface PoopLog {
  id?: string;
  userId: string;
  userName: string;
  durationSeconds: number;
  earnedAmount?: number;
  createdAt: any;
  note?: string;
}

export type TabType = "timer" | "ranking" | "profile";
