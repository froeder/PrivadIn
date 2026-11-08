import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import { EditionRecord } from "../types";
import { toRoman } from "../utils/roman";

export const editionsRef = collection(db, "editions");

/**
 * Cria um objeto de edição de fallback para edições históricas
 * que foram registradas antes da criação do snapshot detalhado.
 */
export function createHistoricalFallbackEdition(editionNumber: number): EditionRecord {
  const roman = toRoman(editionNumber);
  return {
    id: String(editionNumber),
    edition: editionNumber,
    romanEdition: roman,
    title: `Edição ${roman}`,
    endedAt: null,
    resetByUid: "",
    resetByName: "Arquivo Histórico do Trono",
    totalCompetitors: 0,
    totalPoints: 0,
    maxPoints: 0,
    winnerUids: [],
    winnerNames: [],
    winners: [],
    competitors: [],
    createdAt: null,
    isHistoricalFallback: true,
  };
}

/**
 * Busca os detalhes de uma edição específica por número ou id.
 * Caso o documento não exista no Firestore (edição antiga pré-sistema),
 * retorna um fallback amigável para exibição consistente do troféu.
 */
export async function getEditionDetails(editionNumber: number): Promise<EditionRecord> {
  try {
    const docRef = doc(db, "editions", String(editionNumber));
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      const data = snapshot.data() as EditionRecord;
      return {
        ...data,
        id: snapshot.id,
        edition: Number(data.edition ?? editionNumber),
        romanEdition: data.romanEdition || toRoman(editionNumber),
        title: data.title || `Edição ${toRoman(editionNumber)}`,
        competitors: Array.isArray(data.competitors) ? data.competitors : [],
        winners: Array.isArray(data.winners) ? data.winners : [],
        winnerUids: Array.isArray(data.winnerUids) ? data.winnerUids : [],
        winnerNames: Array.isArray(data.winnerNames) ? data.winnerNames : [],
      };
    }
  } catch (err) {
    console.warn(`[editionService] Erro ao carregar edição ${editionNumber}:`, err);
  }

  return createHistoricalFallbackEdition(editionNumber);
}

/**
 * Busca múltiplas edições em paralelo e retorna um mapa [edição -> EditionRecord].
 */
export async function getEditionsMap(editionNumbers: number[]): Promise<Map<number, EditionRecord>> {
  const map = new Map<number, EditionRecord>();
  if (!editionNumbers || editionNumbers.length === 0) return map;

  const unique = Array.from(new Set(editionNumbers)).filter((n) => n > 0);
  const results = await Promise.all(unique.map((num) => getEditionDetails(num)));

  results.forEach((record) => {
    map.set(record.edition, record);
  });

  return map;
}

/**
 * Busca o histórico de todas as edições salvas ordenadas da mais recente para a mais antiga.
 */
export async function getAllEditions(maxCount: number = 50): Promise<EditionRecord[]> {
  try {
    const q = query(editionsRef, orderBy("edition", "desc"), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as EditionRecord;
      const num = Number(data.edition ?? d.id);
      return {
        ...data,
        id: d.id,
        edition: num,
        romanEdition: data.romanEdition || toRoman(num),
        title: data.title || `Edição ${toRoman(num)}`,
        competitors: Array.isArray(data.competitors) ? data.competitors : [],
        winners: Array.isArray(data.winners) ? data.winners : [],
      };
    });
  } catch (err) {
    console.warn("[editionService] Erro ao buscar lista de edições:", err);
    return [];
  }
}
