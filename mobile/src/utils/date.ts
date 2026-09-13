import type { PoopLog } from "../types";

export const DEFAULT_COOLDOWN_MINUTES = 15;
export const DAILY_LIMIT = 8;

/**
 * Converte qualquer valor (Timestamp, Date, number, string) para Date válido.
 */
export function toDate(value?: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }
  if ("toMillis" in value && typeof value.toMillis === "function") {
    return new Date(value.toMillis());
  }
  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  return undefined;
}

/**
 * Formata data e hora legível.
 */
export function formatDateTime(
  value?: any,
  locale = "pt-BR"
): string {
  const date = toDate(value);
  if (!date) return "Sem registros";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Formata apenas a hora (HH:mm).
 */
export function formatHour(value?: any): string {
  const date = toDate(value);
  if (!date) return "--:--";
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Formata tempo decorrido relativo ("há 5 min", "ontem", etc.).
 */
export function formatTimeAgo(value?: any): string {
  const date = toDate(value);
  if (!date) return "agora";

  const diffMs = Date.now() - date.getTime();
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSecs < 60) return "agora";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `há ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `há ${diffWeeks} sem`;
  return formatDateTime(date);
}

/**
 * Retorna o início da semana (segunda-feira 00:00:00).
 */
export function getWeekStart(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Verifica se a data pertence à semana atual.
 */
export function isCurrentWeek(value?: any): boolean {
  const date = toDate(value);
  if (!date) return false;
  return date.getTime() >= getWeekStart().getTime();
}

/**
 * Conta quantas sessões foram registradas hoje.
 */
export function countToday(logs: PoopLog[]): number {
  const todayStr = new Date().toDateString();
  return logs.filter((log) => {
    const d = toDate(log.createdAt);
    return d && d.toDateString() === todayStr;
  }).length;
}

/**
 * Conta quantas sessões foram registradas nesta semana.
 */
export function countThisWeek(logs: PoopLog[]): number {
  const start = getWeekStart().getTime();
  return logs.filter((log) => {
    const d = toDate(log.createdAt);
    return d && d.getTime() >= start;
  }).length;
}

/**
 * Soma os pontos obtidos na semana atual.
 */
export function sumThisWeekPoints(logs: PoopLog[]): number {
  const start = getWeekStart().getTime();
  return logs.reduce((sum, log) => {
    const d = toDate(log.createdAt);
    if (!d || d.getTime() < start) return sum;
    return sum + Math.max(0, Number(log.points) || 0);
  }, 0);
}

/**
 * Obtém o registro mais recente da lista de logs.
 */
export function getLastLog(logs: PoopLog[]): PoopLog | undefined {
  if (logs.length === 0) return undefined;
  return [...logs].sort((a, b) => {
    const aTime = toDate(a.createdAt)?.getTime() ?? 0;
    const bTime = toDate(b.createdAt)?.getTime() ?? 0;
    return bTime - aTime;
  })[0];
}

/**
 * Calcula os segundos restantes de cooldown antifraude com base no último log.
 */
export function getCooldownSeconds(
  logs: PoopLog[],
  cooldownMinutes = DEFAULT_COOLDOWN_MINUTES
): number {
  const last = getLastLog(logs);
  if (!last) return 0;
  const lastDate = toDate(last.createdAt);
  if (!lastDate) return 0;
  const elapsed = Date.now() - lastDate.getTime();
  const cooldownMs = cooldownMinutes * 60 * 1000;
  return Math.max(0, Math.ceil((cooldownMs - elapsed) / 1000));
}

/**
 * Calcula o streak diário consecutivo de uso do trono.
 */
export function calculateDailyStreak(logs: PoopLog[]): number {
  const dayStrings = new Set<string>();
  logs.forEach((log) => {
    const d = toDate(log.createdAt);
    if (d) {
      dayStrings.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    }
  });

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  const getDayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  // Se não registrou hoje, verifica se registrou ontem para não quebrar prematuramente
  if (!dayStrings.has(getDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (dayStrings.has(getDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/**
 * Calcula o streak semanal consecutivo.
 */
export function calculateWeeklyStreak(logs: PoopLog[]): number {
  const weekKeys = new Set<string>();
  logs.forEach((log) => {
    const d = toDate(log.createdAt);
    if (d) {
      const ws = getWeekStart(d);
      weekKeys.add(`${ws.getFullYear()}-${ws.getMonth() + 1}-${ws.getDate()}`);
    }
  });

  let streak = 0;
  const cursor = getWeekStart();

  const getWeekKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  while (weekKeys.has(getWeekKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  return streak;
}

/**
 * Retorna o horário mais produtivo/frequente em formato "HH:00".
 */
export function getProductiveHour(logs: PoopLog[]): string {
  if (logs.length === 0) return "--:--";

  const hourCounts = new Array(24).fill(0);
  logs.forEach((log) => {
    const d = toDate(log.createdAt);
    if (d) {
      const h = d.getHours();
      if (h >= 0 && h < 24) hourCounts[h]++;
    }
  });

  let peakHour = 0;
  let maxCount = 0;
  hourCounts.forEach((count, hour) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = hour;
    }
  });

  return maxCount > 0 ? `${String(peakHour).padStart(2, "0")}:00` : "--:--";
}

/**
 * Retorna a quantidade de sessões realizadas em horário comercial (08h às 18h).
 */
export function getBusinessHoursCount(logs: PoopLog[]): number {
  return logs.filter((log) => {
    const d = toDate(log.createdAt);
    if (!d) return false;
    const hour = d.getHours();
    return hour >= 8 && hour <= 18;
  }).length;
}

/**
 * Retorna a média diária de registros desde a primeira sessão.
 */
export function getDailyAverage(logs: PoopLog[]): number {
  if (logs.length === 0) return 0;
  const sorted = [...logs].sort((a, b) => {
    const aTime = toDate(a.createdAt)?.getTime() ?? 0;
    const bTime = toDate(b.createdAt)?.getTime() ?? 0;
    return aTime - bTime;
  });

  const firstDate = toDate(sorted[0].createdAt);
  if (!firstDate) return 0;

  const diffDays = Math.max(
    1,
    Math.ceil((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  return Number((logs.length / diffDays).toFixed(1));
}
