import { WorkSchedule } from "../types";

export const DEFAULT_WORK_SCHEDULE: Required<WorkSchedule> = {
  horarioInicioExpediente: "09:00",
  horarioFimExpediente: "18:00",
  horarioInicioAlmoco: "12:00",
  horarioFimAlmoco: "13:00",
  timezone: "America/Sao_Paulo",
};

export function resolveWorkSchedule(raw?: Partial<WorkSchedule> | null): Required<WorkSchedule> {
  const parseTime = (value: unknown, fallback: string) =>
    typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;

  return {
    horarioInicioExpediente: parseTime(
      raw?.horarioInicioExpediente,
      DEFAULT_WORK_SCHEDULE.horarioInicioExpediente
    ),
    horarioFimExpediente: parseTime(
      raw?.horarioFimExpediente,
      DEFAULT_WORK_SCHEDULE.horarioFimExpediente
    ),
    horarioInicioAlmoco: parseTime(
      raw?.horarioInicioAlmoco,
      DEFAULT_WORK_SCHEDULE.horarioInicioAlmoco
    ),
    horarioFimAlmoco: parseTime(
      raw?.horarioFimAlmoco,
      DEFAULT_WORK_SCHEDULE.horarioFimAlmoco
    ),
    timezone:
      typeof raw?.timezone === "string" && raw.timezone.trim()
        ? raw.timezone
        : DEFAULT_WORK_SCHEDULE.timezone,
  };
}

export function hasCompleteWorkSchedule(raw?: Partial<WorkSchedule> | null): boolean {
  return Boolean(
    raw &&
      typeof raw.horarioInicioExpediente === "string" &&
      /^\d{2}:\d{2}$/.test(raw.horarioInicioExpediente) &&
      typeof raw.horarioFimExpediente === "string" &&
      /^\d{2}:\d{2}$/.test(raw.horarioFimExpediente) &&
      typeof raw.horarioInicioAlmoco === "string" &&
      /^\d{2}:\d{2}$/.test(raw.horarioInicioAlmoco) &&
      typeof raw.horarioFimAlmoco === "string" &&
      /^\d{2}:\d{2}$/.test(raw.horarioFimAlmoco)
  );
}

export function minutesOfDay(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function isBetweenMinutes(current: number, start: number, end: number): boolean {
  if (start <= end) return current >= start && current < end;
  return current >= start || current < end;
}

export function localTimeInTimezone(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    });
    return formatter.format(date);
  } catch {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
}

export type ScheduleStatusType = "working" | "lunch" | "outside";

export interface ScheduleStatus {
  status: ScheduleStatusType;
  localTime: string;
  isWorkTime: boolean;
  message: string;
  badgeLabel: string;
  badgeColor: string;
}

export function checkWorkScheduleStatus(
  rawSchedule?: Partial<WorkSchedule> | null,
  now: Date = new Date()
): ScheduleStatus {
  const schedule = resolveWorkSchedule(rawSchedule);
  const localTime = localTimeInTimezone(now, schedule.timezone);
  const currentMinutes = minutesOfDay(localTime);

  const workStart = minutesOfDay(schedule.horarioInicioExpediente);
  const workEnd = minutesOfDay(schedule.horarioFimExpediente);
  const lunchStart = minutesOfDay(schedule.horarioInicioAlmoco);
  const lunchEnd = minutesOfDay(schedule.horarioFimAlmoco);

  // Check lunch first if within work bounds
  if (isBetweenMinutes(currentMinutes, lunchStart, lunchEnd)) {
    return {
      status: "lunch",
      localTime,
      isWorkTime: false,
      message: `Horário de almoço (${schedule.horarioInicioAlmoco} - ${schedule.horarioFimAlmoco}). As pausas remuneradas do trono devem ocorrer no expediente de trabalho.`,
      badgeLabel: "Horário de Almoço 🥪",
      badgeColor: "#f59e0b",
    };
  }

  // Check if inside work hours
  if (isBetweenMinutes(currentMinutes, workStart, workEnd)) {
    return {
      status: "working",
      localTime,
      isWorkTime: true,
      message: `Em expediente oficial (${schedule.horarioInicioExpediente} - ${schedule.horarioFimExpediente}). Bom proveito no trono remunerado!`,
      badgeLabel: "Expediente Ativo 💼",
      badgeColor: "#10b981",
    };
  }

  return {
    status: "outside",
    localTime,
    isWorkTime: false,
    message: `Fora do horário de expediente (${schedule.horarioInicioExpediente} - ${schedule.horarioFimExpediente}). O trono só é oficialmente remunerado durante seu trabalho!`,
    badgeLabel: "Fora do Expediente 🌙",
    badgeColor: "#ef4444",
  };
}
