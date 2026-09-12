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
  acceptedTermsVersion?: number;
  ownedGroupId?: string | null;
  workSchedule?: WorkSchedule;
  createdAt?: any;
  lastLogAt?: any;
}

export interface AppSettings {
  cooldownMinutes: number;
  pointsPerLog?: number;
  poopcoinsPerLog?: number;
  cuiterPostCost?: number;
  edition?: number;
  overallRankingVisible?: boolean;
  termsOfUseText?: string;
  termsOfUseVersion?: number;
  competitionAnnouncement?: string;
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

export interface RankingGroup {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  memberCount: number;
  edition: number;
  createdAt: any;
  updatedAt?: any;
  deletedAt?: any;
  deletedBy?: string | null;
}

export type TabType = "timer" | "ranking" | "groups" | "profile";


