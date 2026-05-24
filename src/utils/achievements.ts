import type { Achievement, AppUser, PoopLog } from "../types";
import { getBusinessHoursCount } from "./date";

export function getAchievements(user?: AppUser | null, logs: PoopLog[] = []): Achievement[] {
  const total = user?.totalPoints ?? 0;
  const businessHours = getBusinessHoursCount(logs);
  const streak = user?.currentDailyStreak ?? 0;

  return [
    {
      id: "rookie",
      name: "Estreante da Privada",
      description: "Registrou a primeira glória no expediente.",
      icon: "🚽",
      unlocked: total >= 1,
    },
    {
      id: "clt",
      name: "CLT Intestinal",
      description: "Cinco registros com crachá psicológico batido.",
      icon: "💼",
      unlocked: total >= 5,
    },
    {
      id: "ghost",
      name: "Fantasma do Banheiro",
      description: "Dez sumiços documentados oficialmente.",
      icon: "👻",
      unlocked: total >= 10,
    },
    {
      id: "master",
      name: "Mestre do Expediente",
      description: "Streak de 5 dias. Disciplina, fibra e coragem.",
      icon: "🔥",
      unlocked: streak >= 5,
    },
    {
      id: "corporate",
      name: "Horário Comercial",
      description: "Três registros entre 8h e 18h.",
      icon: "🧻",
      unlocked: businessHours >= 3,
    },
  ];
}
