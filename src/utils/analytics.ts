import { getHours, getDay } from "date-fns";
import type { AppUser, PoopLog } from "../types";
import { toDate } from "./date";
import { dailyWorkMinutes, resolveWorkSchedule } from "./workSchedule";

export interface HourlyBucket {
  hour: number;
  label: string;
  count: number;
}

export interface WeekdayProfitBucket {
  dayIndex: number; // 0=Seg, 6=Dom
  label: string;
  count: number;
  earnedCents: number;
}

export interface WebAnnualEstimate {
  annualCostCents: number;
  averageDailyMinutes: number;
  annualBathroomHours: number;
  totalHistoricalEarnedCents: number;
  totalHistoricalMinutes: number;
}

export function getUserHourlyRateCents(user?: AppUser | null): number {
  if (!user) return 2000; // R$ 20,00/h fallback

  let monthlySalaryCents = 300000; // default R$ 3.000,00
  if (typeof (user as any).salary === "number" && (user as any).salary > 0) {
    monthlySalaryCents = Math.round((user as any).salary * 100);
  } else if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(`privadin:monthlySalaryCents:${user.uid}`);
    if (raw !== null) {
      const val = Number(raw);
      if (Number.isFinite(val) && val > 0) {
        monthlySalaryCents = Math.round(val);
      }
    }
  }

  const sched = resolveWorkSchedule(user.workSchedule);
  const workMinutes = dailyWorkMinutes(sched) * 22;
  const workHours = Math.max(1, workMinutes / 60);

  return Math.max(1, Math.round(monthlySalaryCents / workHours));
}

export function getLogDurationMinutes(log: PoopLog, defaultMinutes = 10): number {
  if (typeof log.durationMinutes === "number" && log.durationMinutes > 0) {
    return log.durationMinutes;
  }
  if (typeof (log as any).durationSeconds === "number" && (log as any).durationSeconds > 0) {
    return Math.max(1, Math.round((log as any).durationSeconds / 60));
  }
  return defaultMinutes;
}

export function getLogEarnedCents(
  log: PoopLog,
  hourlyRateCents: number,
  defaultMinutes = 10
): number {
  if (typeof (log as any).earnedAmount === "number" && (log as any).earnedAmount > 0) {
    return Math.round((log as any).earnedAmount * 100);
  }
  const durationMinutes = getLogDurationMinutes(log, defaultMinutes);
  const centsPerMinute = hourlyRateCents / 60;
  return Math.round(durationMinutes * centsPerMinute);
}

export function getHourlyDistribution(logs: PoopLog[]): {
  buckets: HourlyBucket[];
  peakHour: number | null;
  peakCount: number;
} {
  const counts = new Array(24).fill(0);

  logs.forEach((log) => {
    const d = toDate(log.createdAt);
    if (!d) return;
    const hour = getHours(d);
    if (hour >= 0 && hour < 24) {
      counts[hour] += 1;
    }
  });

  const buckets: HourlyBucket[] = counts.map((count, hour) => ({
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

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function getWeekdayProfitability(
  logs: PoopLog[],
  hourlyRateCents: number,
  defaultMinutes = 10
): {
  buckets: WeekdayProfitBucket[];
  bestDay: WeekdayProfitBucket | null;
  totalEarnedCents: number;
} {
  // date-fns / JS getDay: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  // Map to 0=Seg ... 6=Dom
  const toSegDom = (jsDay: number) => (jsDay === 0 ? 6 : jsDay - 1);

  const buckets: WeekdayProfitBucket[] = WEEKDAY_LABELS.map((label, dayIndex) => ({
    dayIndex,
    label,
    count: 0,
    earnedCents: 0,
  }));

  let totalEarnedCents = 0;

  logs.forEach((log) => {
    const d = toDate(log.createdAt);
    if (!d) return;
    const idx = toSegDom(getDay(d));
    const earned = getLogEarnedCents(log, hourlyRateCents, defaultMinutes);

    buckets[idx].count += 1;
    buckets[idx].earnedCents += earned;
    totalEarnedCents += earned;
  });

  let bestDay: WeekdayProfitBucket | null = null;
  let maxEarned = 0;

  buckets.forEach((b) => {
    if (b.earnedCents > maxEarned) {
      maxEarned = b.earnedCents;
      bestDay = b;
    }
  });

  return { buckets, bestDay, totalEarnedCents };
}

export function getAverageSessionMinutes(logs: PoopLog[], defaultMinutes = 10): number {
  if (logs.length === 0) return defaultMinutes;

  const total = logs.reduce((sum, log) => sum + getLogDurationMinutes(log, defaultMinutes), 0);
  return Number((total / logs.length).toFixed(1));
}

export function getAnnualFirmCostEstimate(
  logs: PoopLog[],
  hourlyRateCents: number,
  defaultMinutes = 10
): WebAnnualEstimate {
  const BUSINESS_DAYS_YEAR = 252;

  if (logs.length === 0) {
    const averageDailyMinutes = defaultMinutes;
    const annualBathroomHours = (averageDailyMinutes / 60) * BUSINESS_DAYS_YEAR;
    const annualCostCents = Math.round(annualBathroomHours * hourlyRateCents);
    return {
      annualCostCents,
      averageDailyMinutes,
      annualBathroomHours: Number(annualBathroomHours.toFixed(1)),
      totalHistoricalEarnedCents: 0,
      totalHistoricalMinutes: 0,
    };
  }

  const activeDaysSet = new Set<string>();
  let totalHistoricalMinutes = 0;
  let totalHistoricalEarnedCents = 0;

  logs.forEach((log) => {
    const d = toDate(log.createdAt);
    const duration = getLogDurationMinutes(log, defaultMinutes);
    const earned = getLogEarnedCents(log, hourlyRateCents, defaultMinutes);

    totalHistoricalMinutes += duration;
    totalHistoricalEarnedCents += earned;

    if (d) {
      activeDaysSet.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    }
  });

  const activeDays = Math.max(1, activeDaysSet.size);
  const averageDailyMinutes = Number((totalHistoricalMinutes / activeDays).toFixed(1));
  const annualBathroomHours = Number(((averageDailyMinutes / 60) * BUSINESS_DAYS_YEAR).toFixed(1));
  const annualCostCents = Math.round(annualBathroomHours * hourlyRateCents);

  return {
    annualCostCents,
    averageDailyMinutes,
    annualBathroomHours,
    totalHistoricalEarnedCents,
    totalHistoricalMinutes: Math.round(totalHistoricalMinutes),
  };
}
