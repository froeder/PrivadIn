import type { Timestamp } from "firebase/firestore";

export type AppLanguage = "pt-BR" | "en-US" | "es-ES" | "zh-Hans" | "ar";

export type AppView = "dashboard" | "history" | "stats" | "cuiter" | "admin" | "profile";

export type UserRole = "player" | "admin";

export interface AppUser {
  uid: string;
  name: string;
  nickname?: string;
  email: string;
  avatar: string;
  role: UserRole;
  totalPoints: number;
  weeklyPoints: number;
  currentDailyStreak: number;
  currentWeeklyStreak: number;
  bestStreak: number;
  createdAt: Timestamp;
  firstLogAt?: Timestamp;
  lastLogAt?: Timestamp;
}

export interface PoopLog {
  id: string;
  userId: string;
  userName: string;
  createdAt: Timestamp;
  points: number;
  isWeeklyActive: boolean;
}

export interface CuiterPost {
  id: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: Timestamp;
}

export interface AppSettings {
  cooldownMinutes: number;
  pointsPerLog: number;
  edition: number;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export type AdminAuditAction =
  | "adjust_points"
  | "remove_log"
  | "reset_weekly"
  | "update_cooldown"
  | "update_points_per_log";

export interface AdminAuditLog {
  id: string;
  action: AdminAuditAction;
  adminId: string;
  adminName: string;
  targetUserId?: string;
  targetUserName?: string;
  delta?: number;
  points?: number;
  removedLogId?: string;
  createdAt: Timestamp;
  description: string;
}

export type RegistrationRequestStatus = "pending" | "used";

export interface RegistrationRequest {
  id: string;
  email: string;
  name: string;
  approvalCode: string;
  status: RegistrationRequestStatus;
  createdAt: Timestamp;
  usedAt?: Timestamp;
  claimedBy?: string;
}

export type RegistrationAttemptStatus =
  | "code_requested"
  | "invalid_code"
  | "account_created"
  | "failed";

export interface RegistrationAttempt {
  id: string;
  email: string;
  status: RegistrationAttemptStatus;
  createdAt: Timestamp;
  approvalCodeProvided?: string;
  requestId?: string;
  message?: string;
}

export interface RankedUser extends AppUser {
  rank: number;
  weeklyRank: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export interface DailyBucket {
  label: string;
  count: number;
}

export interface StatSummary {
  king?: RankedUser;
  streakLeader?: RankedUser;
  productiveHour: string;
  weeklyTotal: number;
  dailyAverage: number;
}
