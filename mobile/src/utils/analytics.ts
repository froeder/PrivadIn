import { PoopLog } from "../types";

export interface HourlyBucket {
  hour: number;
  label: string;
  count: number;
}

export interface WeekdayBucket {
  dayIndex: number; // 0 = Seg, 6 = Dom
  label: string;
  count: number;
  earnedAmount: number;
}

export interface AnnualEstimate {
  annualCost: number;
  averageDailyMinutes: number;
  annualBathroomHours: number;
  totalHistoricalEarned: number;
  totalHistoricalMinutes: number;
}

export function parseLogDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val.toDate === "function") return val.toDate();
  if (typeof val.seconds === "number") return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function getHourlyDistribution(logs: PoopLog[]): {
  buckets: HourlyBucket[];
  peakHour: number | null;
  peakCount: number;
} {
  const hourCounts = new Array(24).fill(0);

  logs.forEach((log) => {
    const d = parseLogDate(log.createdAt);
    if (!d) return;
    const hour = d.getHours();
    if (hour >= 0 && hour < 24) {
      hourCounts[hour] += 1;
    }
  });

  const buckets: HourlyBucket[] = hourCounts.map((count, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}h`,
    count,
  }));

  let peakHour: number | null = null;
  let peakCount = 0;
  buckets.forEach((b) => {
    if (b.count > peakCount) {
      peakCount = b.count;
      peakHour = b.hour;
    }
  });

  return { buckets, peakHour, peakCount };
}

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function getWeekdayProfitability(
  logs: PoopLog[],
  hourlyRate: number
): {
  buckets: WeekdayBucket[];
  bestDay: WeekdayBucket | null;
  totalEarned: number;
} {
  // Map standard JS day (0=Dom, 1=Seg, ... 6=Sab) to 0=Seg ... 6=Dom
  const toSegDomIndex = (jsDay: number) => (jsDay === 0 ? 6 : jsDay - 1);

  const buckets: WeekdayBucket[] = WEEKDAY_NAMES.map((label, dayIndex) => ({
    dayIndex,
    label,
    count: 0,
    earnedAmount: 0,
  }));

  let totalEarned = 0;

  logs.forEach((log) => {
    const d = parseLogDate(log.createdAt);
    if (!d) return;
    const idx = toSegDomIndex(d.getDay());
    const durationSeconds =
      typeof log.durationSeconds === "number" && log.durationSeconds > 0
        ? log.durationSeconds
        : 600; // 10 min fallback
    const earned =
      typeof log.earnedAmount === "number" && log.earnedAmount > 0
        ? log.earnedAmount
        : (durationSeconds / 3600) * hourlyRate;

    buckets[idx].count += 1;
    buckets[idx].earnedAmount += earned;
    totalEarned += earned;
  });

  let bestDay: WeekdayBucket | null = null;
  let maxEarned = 0;

  buckets.forEach((b) => {
    if (b.earnedAmount > maxEarned) {
      maxEarned = b.earnedAmount;
      bestDay = b;
    }
  });

  return { buckets, bestDay, totalEarned };
}

export function getAverageSessionMinutes(
  logs: PoopLog[],
  defaultMinutes = 10
): number {
  if (logs.length === 0) return defaultMinutes;

  const totalMinutes = logs.reduce((acc, log) => {
    const duration =
      typeof log.durationSeconds === "number" && log.durationSeconds > 0
        ? log.durationSeconds / 60
        : defaultMinutes;
    return acc + duration;
  }, 0);

  return Number((totalMinutes / logs.length).toFixed(1));
}

export function getAnnualFirmCostEstimate(
  logs: PoopLog[],
  hourlyRate: number,
  defaultMinutes = 10
): AnnualEstimate {
  const BUSINESS_DAYS_YEAR = 252;

  if (logs.length === 0) {
    const averageDailyMinutes = defaultMinutes;
    const annualBathroomHours = (averageDailyMinutes / 60) * BUSINESS_DAYS_YEAR;
    const annualCost = annualBathroomHours * hourlyRate;
    return {
      annualCost: Number(annualCost.toFixed(2)),
      averageDailyMinutes,
      annualBathroomHours: Number(annualBathroomHours.toFixed(1)),
      totalHistoricalEarned: 0,
      totalHistoricalMinutes: 0,
    };
  }

  // Calculate unique days with logs to get active days
  const activeDaysSet = new Set<string>();
  let totalHistoricalMinutes = 0;
  let totalHistoricalEarned = 0;

  logs.forEach((log) => {
    const d = parseLogDate(log.createdAt);
    const durationSec =
      typeof log.durationSeconds === "number" && log.durationSeconds > 0
        ? log.durationSeconds
        : defaultMinutes * 60;
    const durationMin = durationSec / 60;
    const earned =
      typeof log.earnedAmount === "number" && log.earnedAmount > 0
        ? log.earnedAmount
        : (durationSec / 3600) * hourlyRate;

    totalHistoricalMinutes += durationMin;
    totalHistoricalEarned += earned;

    if (d) {
      activeDaysSet.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    }
  });

  const activeDaysCount = Math.max(1, activeDaysSet.size);
  // Average minutes spent in the bathroom per active day
  const averageDailyMinutes = Number(
    (totalHistoricalMinutes / activeDaysCount).toFixed(1)
  );

  // Projected for 252 business days
  const annualBathroomHours = Number(
    ((averageDailyMinutes / 60) * BUSINESS_DAYS_YEAR).toFixed(1)
  );
  const annualCost = Number((annualBathroomHours * hourlyRate).toFixed(2));

  return {
    annualCost,
    averageDailyMinutes,
    annualBathroomHours,
    totalHistoricalEarned: Number(totalHistoricalEarned.toFixed(2)),
    totalHistoricalMinutes: Math.round(totalHistoricalMinutes),
  };
}
