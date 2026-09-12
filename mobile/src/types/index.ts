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
  bio?: string;
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
  equippedTitle?: string;
  equippedBadge?: string;
  themeColor?: string;
  unlockedItems?: string[];
  createdAt?: any;
  firstLogAt?: any;
  lastLogAt?: any;
  cooldownUntil?: any;
}

export interface BonusTimeRange {
  start: string; // HH:MM
  end: string; // HH:MM
  points: number;
}

export interface PoopLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
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
  bonusTimeRanges?: BonusTimeRange[];
}

export interface PoopLog {
  id?: string;
  userId: string;
  userName: string;
  durationSeconds: number;
  earnedAmount?: number;
  points?: number;
  poopcoinsEarned?: number;
  poopcoinTransactionHash?: string | null;
  createdAt: any;
  note?: string;
  isWeeklyActive?: boolean;
  competitionEdition?: number;
  location?: PoopLocation | null;
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

export type PoopcoinTransactionType =
  | "mint_log"
  | "legacy_mint"
  | "transfer"
  | "cuiter_spend"
  | "admin_adjustment"
  | "reversal";

export type PoopcoinTransactionStatus = "active" | "reversed";

export interface PoopcoinTransactionEntry {
  userId: string;
  delta: number;
}

export interface PoopcoinTransaction {
  id: string;
  hash: string;
  previousHash: string;
  sequence: number;
  createdAt: any;
  type: PoopcoinTransactionType;
  entries: PoopcoinTransactionEntry[];
  affectedUserIds: string[];
  fromUserId?: string | null;
  toUserId?: string | null;
  amount: number;
  createdBy: string;
  createdByRole?: string;
  status: PoopcoinTransactionStatus;
  reversesTransactionHash?: string | null;
  reversedByTransactionHash?: string | null;
  linkedLogId?: string | null;
  linkedPostId?: string | null;
  reason?: string | null;
  nonce: string;
}

export interface PoopcoinSupplySummary {
  totalSupply: number;
  mintedSupply: number;
  burnedSupply: number;
  circulatingSupply: number;
  availableSupply: number;
  supplyMigratedAt?: any | null;
}

export type TabType =
  | "timer"
  | "cuiter"
  | "ranking"
  | "poopcoins"
  | "groups"
  | "profile"
  | "analytics"
  | "admin";

export type AdminAuditAction =
  | "adjust_points"
  | "remove_log"
  | "reset_weekly"
  | "update_cooldown"
  | "update_points_per_log"
  | "update_terms_of_use"
  | "deactivate_user"
  | "reactivate_user"
  | "promote_admin"
  | "demote_admin"
  | "update_competition_announcement"
  | "update_poopcoin_rules"
  | "adjust_poopcoins"
  | "reverse_poopcoin_transaction"
  | "migrate_poopcoins"
  | "recalculate_poopcoin_supply";

export interface AdminAuditLog {
  id: string;
  action: AdminAuditAction;
  adminId: string;
  adminName?: string;
  targetUserId?: string | null;
  targetUserName?: string | null;
  delta?: number | null;
  points?: number | null;
  removedLogId?: string | null;
  cooldownMinutes?: number | null;
  pointsPerLog?: number | null;
  poopcoinsPerLog?: number | null;
  cuiterPostCost?: number | null;
  edition?: number | null;
  poopcoins?: number | null;
  poopcoinTransactionHash?: string | null;
  createdAt: any;
}

export type CuiterReactionType = "like" | "poop" | "laugh";

export interface CuiterPost {
  id: string;
  userId: string;
  userName: string;
  userNickname?: string;
  userBadge?: string;
  userTitle?: string;
  message: string;
  createdAt: any;
  poopcoinTransactionHash?: string;
  reactions?: Record<string, CuiterReactionType>;
}

export type ShopItemCategory = "title" | "badge" | "perk";
export type ShopItemRarity = "comum" | "raro" | "epico" | "lendario";

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: ShopItemCategory;
  rarity: ShopItemRarity;
  price: number;
  icon: string;
  perkEffect?: string;
}


