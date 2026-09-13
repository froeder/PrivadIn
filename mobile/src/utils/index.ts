// Date utilities
export {
  DEFAULT_COOLDOWN_MINUTES,
  DAILY_LIMIT,
  toDate,
  formatDateTime,
  formatHour,
  formatTimeAgo,
  getWeekStart,
  isCurrentWeek,
  countToday,
  countThisWeek,
  sumThisWeekPoints,
  getLastLog,
  getCooldownSeconds,
  calculateDailyStreak,
  calculateWeeklyStreak,
  getProductiveHour,
  getBusinessHoursCount,
  getDailyAverage,
} from "./date";

// Timezone utilities
export {
  TimezoneOption,
  TIMEZONE_VALUES,
  getGMTOffsetLabel,
  buildTimezoneOptions,
  TIMEZONE_OPTIONS,
} from "./timezones";

// Terms of Use utilities
export {
  INITIAL_TERMS_OF_USE_VERSION,
  MAX_TERMS_OF_USE_LENGTH,
  TERMS_ENFORCEMENT_ENABLED,
  DEFAULT_TERMS_OF_USE_TEXT,
  normalizeTermsOfUseText,
  getCurrentTermsVersion,
  getCurrentTermsText,
  hasAcceptedCurrentTerms,
} from "./terms";

// Roman numerals
export { toRoman } from "./roman";

// Analytics formulas
export {
  HourlyBucket,
  WeekdayBucket,
  DailyBucket,
  AnnualEstimate,
  parseLogDate,
  getHourlyDistribution,
  getWeekdayProfitability,
  getAverageSessionMinutes,
  getAnnualFirmCostEstimate,
  getUserHourlyRate,
  buildDailyBuckets,
} from "./analytics";

// Work Schedule calculations
export {
  DEFAULT_WORK_SCHEDULE,
  resolveWorkSchedule,
  hasCompleteWorkSchedule,
  minutesOfDay,
  isBetweenMinutes,
  localTimeInTimezone,
  ScheduleStatusType,
  ScheduleStatus,
  checkWorkScheduleStatus,
  dailyWorkMinutes,
  assertActiveWorkTime,
} from "./workSchedule";

// Achievements
export {
  AchievementBadge,
  calculateAchievements,
  getAchievements,
} from "./achievements";

// Weekly Ranking Share
export {
  RANKING_LIMIT,
  ShareWeeklyRankingOptions,
  generateRankingShareText,
  shareWeeklyRanking,
} from "./weeklyRankingShare";

// Ranking calculations
export {
  rankUsers,
  medalFor,
  titleFor,
  avatarFor,
} from "./ranking";

// Currency & number formatting
export {
  formatCurrency,
  formatCurrencyFromCents,
  digitsOnly,
  formatCurrencyInput,
  parseCurrencyInputToCents,
} from "./currency";

export {
  formatNumber,
  formatDecimal,
  formatPoopcoins,
} from "./format";

// Typed error class
export {
  RegisterPoopErrorCode,
  RegisterPoopResolutionTarget,
  RegisterPoopError,
  isRegisterPoopError,
} from "./registerPoopError";

// Internationalization
export {
  SupportedLanguage,
  LANGUAGE_STORAGE_KEY,
  translations,
  getPersistedLanguage,
  persistLanguage,
} from "./i18n";
