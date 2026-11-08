import { Share } from "react-native";
import { getDocs, query, where } from "firebase/firestore";
import { AppUser } from "../types";
import { logsRef } from "../services/poopService";

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val.toDate === "function") return val.toDate();
  if (typeof val.seconds === "number") return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(val: any): string {
  const d = toDate(val);
  return d ? d.toISOString() : "";
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Evita injeção de fórmulas em planilhas
  if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/** Monta um CSV com os dados de perfil, pontuações e histórico de sessões do usuário. */
export async function buildUserDataCsv(user: AppUser): Promise<string> {
  const lines: string[] = [];

  lines.push("# PERFIL");
  lines.push(csvRow(["campo", "valor"]));
  const profile: [string, unknown][] = [
    ["id", user.uid],
    ["nome", user.name],
    ["apelido", user.nickname],
    ["email", user.email],
    ["bio", user.bio],
    ["perfil_tipo", user.role],
    ["titulo_equipado", user.equippedTitle],
    ["criado_em", fmtDate(user.createdAt)],
    ["termos_aceitos", user.termsAccepted ? "sim" : "nao"],
    ["fuso_horario", user.workSchedule?.timezone],
    ["inicio_expediente", user.workSchedule?.horarioInicioExpediente],
    ["fim_expediente", user.workSchedule?.horarioFimExpediente],
    ["inicio_almoco", user.workSchedule?.horarioInicioAlmoco],
    ["fim_almoco", user.workSchedule?.horarioFimAlmoco],
    ["salario", user.salary],
    ["valor_hora", user.hourlyRate],
    ["itens_desbloqueados", (user.unlockedItems || []).join(" | ")],
  ];
  profile.forEach(([k, v]) => lines.push(csvRow([k, v])));

  lines.push("");
  lines.push("# PONTUACOES");
  lines.push(csvRow(["campo", "valor"]));
  const scores: [string, unknown][] = [
    ["pontos_totais", user.totalPoints ?? 0],
    ["pontos_semanais", user.weeklyPoints ?? 0],
    ["sequencia_diaria_atual", user.currentDailyStreak ?? 0],
    ["sequencia_semanal_atual", user.currentWeeklyStreak ?? 0],
    ["melhor_sequencia", user.bestStreak ?? 0],
    ["saldo_poopcoins", user.poopcoinBalance ?? 0],
    ["edicoes_vencidas", (user.wonEditions || []).join(" | ")],
    ["primeiro_registro", fmtDate(user.firstLogAt)],
    ["ultimo_registro", fmtDate(user.lastLogAt)],
  ];
  scores.forEach(([k, v]) => lines.push(csvRow([k, v])));

  lines.push("");
  lines.push("# HISTORICO_DE_SESSOES");
  lines.push(
    csvRow(["data", "duracao_segundos", "pontos", "poopcoins", "edicao", "ganho_estimado", "nota"])
  );
  const snap = await getDocs(query(logsRef, where("userId", "==", user.uid)));
  const logs = snap.docs
    .map((d) => d.data() as any)
    .sort(
      (a, b) =>
        (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0)
    );
  logs.forEach((l) =>
    lines.push(
      csvRow([
        fmtDate(l.createdAt),
        l.durationSeconds,
        l.points,
        l.poopcoinsEarned,
        l.competitionEdition,
        l.earnedAmount,
        l.note,
      ])
    )
  );

  return lines.join("\r\n");
}

/** Gera o CSV e abre o menu de compartilhamento nativo (salvar em arquivos, Drive, e-mail...). */
export async function exportUserDataCsv(user: AppUser): Promise<void> {
  const csv = await buildUserDataCsv(user);
  await Share.share({
    title: "privadin_meus_dados.csv",
    message: csv,
  });
}
