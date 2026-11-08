import { toRoman, fromRoman } from "./roman";

/**
 * Normaliza qualquer formato de entrada de edições ganhas para um array de números inteiros ordenados.
 * Suporta:
 * - array de números: [1, 3, 15, 30]
 * - array de strings ou romanos: ["1", "III", "XV", "XXX"]
 * - string única com separadores: "I, III, XV, XXX" ou "1, 3, 15, 30"
 */
export function normalizeWonEditions(input: any): number[] {
  if (!input) return [];

  let rawList: any[] = [];
  if (Array.isArray(input)) {
    rawList = input;
  } else if (typeof input === "string") {
    rawList = input.split(/[,\s;/]+/).map((s) => s.trim()).filter(Boolean);
  } else if (typeof input === "number") {
    rawList = [input];
  }

  const set = new Set<number>();
  for (const item of rawList) {
    let num = 0;
    if (typeof item === "number" && Number.isFinite(item)) {
      num = Math.trunc(item);
    } else if (typeof item === "string") {
      num = fromRoman(item);
    }
    if (num > 0) {
      set.add(num);
    }
  }

  return Array.from(set).sort((a, b) => a - b);
}

export interface WonEditionsFormat {
  count: number;
  editions: number[];
  romanList: string[]; // ["I", "III", "XV", "XXX"]
  titleText: string;   // Ex: "Campeão das edições I, III, XV, XXX" ou "Campeão da Edição I"
  editionsListText: string; // Ex: "Edições I, III, XV, XXX" ou "Edição I"
  shortBadgeText: string;   // Ex: "4x Campeão (I, III, XV, XXX)"
  countLabel: string;       // Ex: "4 Edições Vencidas" ou "1 Edição Vencida"
}

/**
 * Formata os dados de edições ganhas para exibição rica no perfil do usuário no mobile.
 */
export function formatWonEditions(wonEditions: any): WonEditionsFormat {
  const editions = normalizeWonEditions(wonEditions);
  const count = editions.length;
  const romanList = editions.map((ed) => toRoman(ed));

  if (count === 0) {
    return {
      count: 0,
      editions: [],
      romanList: [],
      titleText: "Ainda sem títulos de edições",
      editionsListText: "",
      shortBadgeText: "0 títulos",
      countLabel: "0 edições vencidas",
    };
  }

  if (count === 1) {
    const roman = romanList[0];
    return {
      count: 1,
      editions,
      romanList,
      titleText: `Campeão da Edição ${roman}`,
      editionsListText: `Edição ${roman}`,
      shortBadgeText: `Campeão Ed. ${roman}`,
      countLabel: "1 Edição Vencida",
    };
  }

  const romanJoined = romanList.join(", ");
  return {
    count,
    editions,
    romanList,
    titleText: `Campeão das edições ${romanJoined}`,
    editionsListText: `Edições ${romanJoined}`,
    shortBadgeText: `${count}x Campeão (${romanJoined})`,
    countLabel: `${count} Edições Vencidas`,
  };
}
