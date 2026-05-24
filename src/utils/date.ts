import {
  differenceInCalendarDays,
  endOfDay,
  format,
  getHours,
  isAfter,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Timestamp } from "firebase/firestore";
import type { PoopLog } from "../types";

export const COOLDOWN_MINUTES = 15;
export const DAILY_LIMIT = Number(import.meta.env.VITE_DAILY_LOG_LIMIT ?? 8);

export function toDate(value?: Timestamp) {
  return value?.toDate();
}

export function formatDateTime(value?: Timestamp) {
  const date = toDate(value);
  return date ? format(date, "dd/MM/yyyy 'as' HH:mm", { locale: ptBR }) : "Sem registros ainda";
}

export function formatHour(value?: Timestamp) {
  const date = toDate(value);
  return date ? format(date, "HH:mm", { locale: ptBR }) : "--:--";
}

export function getWeekStart(date = new Date()) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function isCurrentWeek(value?: Timestamp) {
  const date = toDate(value);
  return Boolean(date && isAfter(date, getWeekStart()));
}

export function countToday(logs: PoopLog[]) {
  return logs.filter((log) => {
    const date = toDate(log.createdAt);
    return date && isSameDay(date, new Date());
  }).length;
}

export function countThisWeek(logs: PoopLog[]) {
  const start = getWeekStart();
  return logs.filter((log) => {
    const date = toDate(log.createdAt);
    return date && isAfter(date, start);
  }).length;
}

export function getLastLog(logs: PoopLog[]) {
  return [...logs].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  })[0];
}

export function getCooldownSeconds(logs: PoopLog[]) {
  const last = getLastLog(logs);
  if (!last) return 0;
  const elapsed = Date.now() - last.createdAt.toMillis();
  const cooldown = COOLDOWN_MINUTES * 60 * 1000;
  return Math.max(0, Math.ceil((cooldown - elapsed) / 1000));
}

export function calculateDailyStreak(logs: PoopLog[]) {
  const days = new Set(
    logs
      .map((log) => toDate(log.createdAt))
      .filter((date): date is Date => Boolean(date))
      .map((date) => format(date, "yyyy-MM-dd")),
  );
  let streak = 0;
  let cursor = startOfDay(new Date());

  if (!days.has(format(cursor, "yyyy-MM-dd"))) {
    cursor = subDays(cursor, 1);
  }

  while (days.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  return streak;
}

export function calculateWeeklyStreak(logs: PoopLog[]) {
  const weekKeys = new Set(
    logs
      .map((log) => toDate(log.createdAt))
      .filter((date): date is Date => Boolean(date))
      .map((date) => format(getWeekStart(date), "yyyy-MM-dd")),
  );
  let streak = 0;
  let cursor = getWeekStart();

  while (weekKeys.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 7);
  }

  return streak;
}

export function buildDailyBuckets(logs: PoopLog[]) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = subDays(new Date(), 6 - index);
    const interval = { start: startOfDay(date), end: endOfDay(date) };
    const count = logs.filter((log) => {
      const logDate = toDate(log.createdAt);
      return logDate && isWithinInterval(logDate, interval);
    }).length;
    return {
      label: format(date, "EEE", { locale: ptBR }).replace(".", ""),
      count,
    };
  });
}

export function getProductiveHour(logs: PoopLog[]) {
  const hours = logs.reduce<Record<number, number>>((acc, log) => {
    const date = toDate(log.createdAt);
    if (!date) return acc;
    const hour = getHours(date);
    acc[hour] = (acc[hour] ?? 0) + 1;
    return acc;
  }, {});

  const [hour] = Object.entries(hours).sort((a, b) => b[1] - a[1])[0] ?? [];
  return hour ? `${hour.padStart(2, "0")}:00` : "Aguardando o trono";
}

export function getBusinessHoursCount(logs: PoopLog[]) {
  return logs.filter((log) => {
    const date = toDate(log.createdAt);
    if (!date) return false;
    const hour = getHours(date);
    return hour >= 8 && hour <= 18;
  }).length;
}

export function getDailyAverage(logs: PoopLog[]) {
  if (logs.length === 0) return 0;
  const sorted = [...logs].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? 0;
    return aTime - bTime;
  });
  const first = toDate(sorted[0].createdAt);
  if (!first) return 0;
  const days = Math.max(1, differenceInCalendarDays(new Date(), first) + 1);
  return logs.length / days;
}
