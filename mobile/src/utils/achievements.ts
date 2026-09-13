import { AppUser, PoopLog } from "../types";
import { parseLogDate } from "./analytics";

export interface AchievementBadge {
  id: string;
  icon: string;
  title: string;
  description: string;
  requirementHint: string;
  unlocked: boolean;
  progressText: string;
  progressPercent: number;
  levelColor: string;
  category: "time" | "streak" | "points" | "crypto";
}

/**
 * Calculates dynamic achievements for a user based on their profile data and poop logs.
 */
export function calculateAchievements(
  user?: AppUser | null,
  logs: PoopLog[] = []
): AchievementBadge[] {
  const totalPoints = user?.totalPoints || 0;
  const poopcoinBalance = user?.poopcoinBalance || 0;
  const currentStreak = user?.currentDailyStreak || 0;
  const bestStreak = Math.max(currentStreak, user?.bestStreak || 0);
  const totalLogs = logs.length;

  // Analisa horários dos logs
  let hasEarlyBird = false; // antes das 08:00
  let officeHoursCount = 0; // entre 08:00 e 18:00
  let hasNightOwl = false; // entre 22:00 e 05:59

  logs.forEach((log) => {
    const d = parseLogDate(log.createdAt);
    if (!d) return;
    const hour = d.getHours();
    if (hour < 8) {
      hasEarlyBird = true;
    }
    if (hour >= 8 && hour < 18) {
      officeHoursCount++;
    }
    if (hour >= 22 || hour < 6) {
      hasNightOwl = true;
    }
  });

  const badges: AchievementBadge[] = [
    {
      id: "pioneer",
      icon: "🚽",
      title: "Pioneiro do Trono",
      description: "Registrou sua primeira cagada remunerada no aplicativo.",
      requirementHint: "Faça pelo menos 1 registro no banheiro.",
      unlocked: totalLogs >= 1 || totalPoints > 0,
      progressText: totalLogs >= 1 ? "Concluído" : "0 / 1 sessão",
      progressPercent: totalLogs >= 1 ? 100 : 0,
      levelColor: "#38bdf8",
      category: "points",
    },
    {
      id: "early_bird",
      icon: "🌅",
      title: "Madrugador",
      description: "Evacuou antes das 08h da manhã antes de começar a correria.",
      requirementHint: "Faça um registro no trono antes das 08:00.",
      unlocked: hasEarlyBird,
      progressText: hasEarlyBird ? "Desbloqueado" : "Pendente",
      progressPercent: hasEarlyBird ? 100 : 0,
      levelColor: "#f59e0b",
      category: "time",
    },
    {
      id: "office_hours",
      icon: "💼",
      title: "Horário Nobre",
      description: "Cagada de alto valor executada em pleno horário comercial.",
      requirementHint: "Registre 5 sessões entre 08:00 e 18:00.",
      unlocked: officeHoursCount >= 5,
      progressText: `${Math.min(5, officeHoursCount)} / 5 no expediente`,
      progressPercent: Math.min(100, (officeHoursCount / 5) * 100),
      levelColor: "#10b981",
      category: "time",
    },
    {
      id: "night_owl",
      icon: "🌙",
      title: "Cagada Noturna",
      description: "Sessão na calada da noite, demonstrando dedicação além do expediente.",
      requirementHint: "Faça um registro entre 22:00 e 06:00.",
      unlocked: hasNightOwl,
      progressText: hasNightOwl ? "Desbloqueado" : "Pendente",
      progressPercent: hasNightOwl ? 100 : 0,
      levelColor: "#818cf8",
      category: "time",
    },
    {
      id: "streak_3",
      icon: "🔥",
      title: "Iniciante Fiel",
      description: "Manteve uma sequência ininterrupta de 3 dias no trono.",
      requirementHint: "Atinja uma sequência de 3 dias consecutivos.",
      unlocked: bestStreak >= 3,
      progressText: `${Math.min(3, bestStreak)} / 3 dias`,
      progressPercent: Math.min(100, (bestStreak / 3) * 100),
      levelColor: "#f97316",
      category: "streak",
    },
    {
      id: "streak_7",
      icon: "⚡",
      title: "Mestre Semanal",
      description: "7 dias consecutivos de consistência fecal corporativa.",
      requirementHint: "Mantenha o ritmo por 7 dias seguidos.",
      unlocked: bestStreak >= 7,
      progressText: `${Math.min(7, bestStreak)} / 7 dias`,
      progressPercent: Math.min(100, (bestStreak / 7) * 100),
      levelColor: "#eab308",
      category: "streak",
    },
    {
      id: "streak_15",
      icon: "🎖️",
      title: "Veterano do Trono",
      description: "15 dias seguidos honrando o salário no banheiro.",
      requirementHint: "Atinja 15 dias consecutivos de registros.",
      unlocked: bestStreak >= 15,
      progressText: `${Math.min(15, bestStreak)} / 15 dias`,
      progressPercent: Math.min(100, (bestStreak / 15) * 100),
      levelColor: "#ec4899",
      category: "streak",
    },
    {
      id: "streak_30",
      icon: "🏆",
      title: "Lenda Inabalável",
      description: "Um mês inteiro de consistência inabalável no trono.",
      requirementHint: "Alcance o lendário streak de 30 dias.",
      unlocked: bestStreak >= 30,
      progressText: `${Math.min(30, bestStreak)} / 30 dias`,
      progressPercent: Math.min(100, (bestStreak / 30) * 100),
      levelColor: "#a855f7",
      category: "streak",
    },
    {
      id: "millionaire",
      icon: "👑",
      title: "Milionário do Trono",
      description: "Acumulou mais de 10.000 pontos no ranking da comunidade.",
      requirementHint: "Atinja 10.000 pontos totais no seu perfil.",
      unlocked: totalPoints >= 10000,
      progressText: `${Math.min(10000, totalPoints).toLocaleString()} / 10.000 pts`,
      progressPercent: Math.min(100, (totalPoints / 10000) * 100),
      levelColor: "#fbbf24",
      category: "points",
    },
    {
      id: "crypto_whale",
      icon: "🪙",
      title: "Magnata Poopcoin",
      description: "Acumulou uma reserva estratégica de pelo menos 10 Poopcoins.",
      requirementHint: "Tenha 10 ou mais Poopcoins em sua carteira.",
      unlocked: poopcoinBalance >= 10,
      progressText: `${Math.min(10, poopcoinBalance).toFixed(1)} / 10 PC`,
      progressPercent: Math.min(100, (poopcoinBalance / 10) * 100),
      levelColor: "#10b981",
      category: "crypto",
    },
  ];

  return badges;
}

/**
 * Adapter para compatibilidade direta com a assinatura do PWA getAchievements(user, logs).
 */
export function getAchievements(
  user?: AppUser | null,
  logs: PoopLog[] = []
): { id: string; name: string; description: string; icon: string; unlocked: boolean }[] {
  const badges = calculateAchievements(user, logs);
  return badges.map((b) => ({
    id: b.id,
    name: b.title,
    description: b.description,
    icon: b.icon,
    unlocked: b.unlocked,
  }));
}

