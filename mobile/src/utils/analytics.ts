import { AppUser, PoopLog } from "../types";
import { resolveWorkSchedule, dailyWorkMinutes } from "./workSchedule";

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

export interface DailyBucket {
  label: string;
  dayShort: string;
  dateStr: string;
  count: number;
  points: number;
  earnedAmount: number;
  isToday: boolean;
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
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val.toDate === "function") {
    const d = val.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val.toMillis === "function") {
    const d = new Date(val.toMillis());
    return isNaN(d.getTime()) ? null : d;
  }
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
  const safeHourlyRate = typeof hourlyRate === "number" && !isNaN(hourlyRate) && hourlyRate > 0 ? hourlyRate : 20;

  if (logs.length === 0) {
    const averageDailyMinutes = defaultMinutes;
    const annualBathroomHours = (averageDailyMinutes / 60) * BUSINESS_DAYS_YEAR;
    const annualCost = annualBathroomHours * safeHourlyRate;
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
        : (durationSec / 3600) * safeHourlyRate;

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
  const annualCost = Number((annualBathroomHours * safeHourlyRate).toFixed(2));

  return {
    annualCost,
    averageDailyMinutes,
    annualBathroomHours,
    totalHistoricalEarned: Number(totalHistoricalEarned.toFixed(2)),
    totalHistoricalMinutes: Math.round(totalHistoricalMinutes),
  };
}

export function getUserHourlyRate(user?: AppUser | null): number {
  if (!user) return 20;

  if (typeof user.hourlyRate === "number" && user.hourlyRate > 0 && !isNaN(user.hourlyRate)) {
    return user.hourlyRate;
  }

  let monthlySalary = 3000;
  if (typeof user.salary === "number" && user.salary > 0 && !isNaN(user.salary)) {
    monthlySalary = user.salary;
  }

  const sched = resolveWorkSchedule(user.workSchedule);
  const workMinutes = dailyWorkMinutes(sched) * 22;
  const workHours = Math.max(1, workMinutes / 60);
  const rate = Number((monthlySalary / workHours).toFixed(2));

  return isNaN(rate) || rate <= 0 ? 20 : rate;
}

export function getBusinessHoursCount(logs: PoopLog[]): number {
  return logs.filter((log) => {
    const d = parseLogDate(log.createdAt);
    if (!d) return false;
    const day = d.getDay(); // 0 = Domingo, 6 = Sábado
    const isWeekday = day >= 1 && day <= 5;
    const hour = d.getHours();
    return isWeekday && hour >= 8 && hour <= 18;
  }).length;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function buildDailyBuckets(logs: PoopLog[], hourlyRate = 20): DailyBucket[] {
  const today = new Date();
  const buckets: DailyBucket[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const nextD = new Date(d);
    nextD.setDate(d.getDate() + 1);

    const dayLogs = logs.filter((log) => {
      const logDate = parseLogDate(log.createdAt);
      return logDate && logDate >= d && logDate < nextD;
    });

    const count = dayLogs.length;
    const points = dayLogs.reduce(
      (sum, l) => sum + (typeof l.points === "number" ? l.points : 2000),
      0
    );
    const earnedAmount = dayLogs.reduce((sum, l) => {
      if (typeof l.earnedAmount === "number" && l.earnedAmount > 0) {
        return sum + l.earnedAmount;
      }
      const durSec =
        typeof l.durationSeconds === "number" && l.durationSeconds > 0
          ? l.durationSeconds
          : 600;
      return sum + (durSec / 3600) * hourlyRate;
    }, 0);

    const isToday = i === 0;
    const dayShort = DAY_LABELS[d.getDay()];
    const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}`;

    buckets.push({
      label: isToday ? "Hoje" : dayShort,
      dayShort,
      dateStr,
      count,
      points,
      earnedAmount: Number(earnedAmount.toFixed(2)),
      isToday,
    });
  }

  return buckets;
}

