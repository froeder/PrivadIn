import { Share, Platform, Alert } from "react-native";
import { AppUser } from "../types";
import { toRoman } from "./roman";

export const RANKING_LIMIT = 10;

export interface ShareWeeklyRankingOptions {
  users: AppUser[];
  edition: number;
  currentUserId?: string;
  announcement?: string;
}

export function generateRankingShareText({
  users,
  edition,
  currentUserId,
  announcement,
}: ShareWeeklyRankingOptions): string {
  const romanEdition = toRoman(edition);
  const topUsers = users.slice(0, RANKING_LIMIT);

  let text = `🚽 *PRIVADIN - RANKING SEMANAL* 👑\n`;
  text += `⚡ Edição ${romanEdition} • Campeonato Oficial do Trono\n`;
  if (announcement) {
    text += `📢 "${announcement.trim()}"\n`;
  }
  text += `\n🏆 *PÓDIO & DESTAQUES DA SEMANA:*\n`;

  topUsers.forEach((user, index) => {
    const rank = index + 1;
    const points = (user.weeklyPoints || 0).toLocaleString("pt-BR");
    const name = user.name || "Cagador Anônimo";
    const isMe = user.uid === currentUserId ? " (Você 👈)" : "";

    let medal = `#${rank}`;
    if (rank === 1) medal = "🥇 1º";
    else if (rank === 2) medal = "🥈 2º";
    else if (rank === 3) medal = "🥉 3º";

    const badge = user.equippedBadge ? ` ${user.equippedBadge}` : "";
    const streak = user.currentDailyStreak && user.currentDailyStreak > 1 ? ` (🔥 ${user.currentDailyStreak}d)` : "";

    text += `${medal} ${name}${badge}${isMe}: *${points} pts*${streak}\n`;
  });

  if (currentUserId) {
    const myIndex = users.findIndex((u) => u.uid === currentUserId);
    if (myIndex >= RANKING_LIMIT) {
      const me = users[myIndex];
      const myPoints = (me.weeklyPoints || 0).toLocaleString("pt-BR");
      text += `\n... Minha posição atual: #${myIndex + 1} (${myPoints} pts)`;
    }
  }

  text += `\n✨ *Cagada remunerada levada a sério no expediente!*`;
  text += `\n📲 Venha disputar no *PrivadIn* e ganhe Poopcoins 🪙`;

  return text;
}

export async function shareWeeklyRanking(options: ShareWeeklyRankingOptions): Promise<boolean> {
  try {
    const message = generateRankingShareText(options);
    const romanEdition = toRoman(options.edition);
    const title = `Ranking Semanal PrivadIn - Edição ${romanEdition}`;

    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text: message,
        });
        return true;
      } catch (err: any) {
        if (err.name === "AbortError") return false;
      }
    }

    const result = await Share.share(
      {
        title,
        message,
      },
      {
        dialogTitle: `Compartilhar Ranking da Edição ${romanEdition}`,
      }
    );

    return result.action === Share.sharedAction;
  } catch (error: any) {
    console.error("Erro ao compartilhar ranking:", error);
    Alert.alert("Erro", "Não foi possível abrir o compartilhamento.");
    return false;
  }
}
