export interface WorkSchedule {
  horarioInicioExpediente?: string;
  horarioFimExpediente?: string;
  horarioInicioAlmoco?: string;
  horarioFimAlmoco?: string;
  timezone?: string;
}

export interface AppUser {
  uid: string;
  name: string;
  nickname?: string;
  email: string;
  avatar?: string;
  role?: "player" | "admin";
  isActive?: boolean;
  totalPoints?: number;
  weeklyPoints?: number;
  currentDailyStreak?: number;
  currentWeeklyStreak?: number;
  bestStreak?: number;
  salary?: number;
  hourlyRate?: number;
  poopcoinBalance?: number;
  bathroomDurationMinutes?: number;
  termsAccepted?: boolean;
  workSchedule?: WorkSchedule;
  createdAt?: any;
  lastLogAt?: any;
}

export interface PoopLog {
  id?: string;
  userId: string;
  userName: string;
  durationSeconds: number;
  earnedAmount?: number;
  points?: number;
  poopcoinsEarned?: number;
  createdAt: any;
  note?: string;
  isWeeklyActive?: boolean;
  competitionEdition?: number;
}

export type TabType = "timer" | "ranking" | "profile";

