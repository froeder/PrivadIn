import { collection, doc, onSnapshot, query, updateDoc } from "@firebase/firestore";
import { db } from "../services/firebase";
import type { AppUser, ShopItem } from "../types";

export const SHOP_CATALOG: ShopItem[] = [
  // TÍTULOS
  {
    id: "title_lord_throne",
    name: "Lorde do Trono",
    description: "Dono absoluto da porcelana sagrada em horário de expediente corporativo.",
    category: "title",
    rarity: "raro",
    price: 25,
    basePrice: 25,
    initialStock: 15,
    currentStock: 15,
    priceMultiplier: 1.15,
    icon: "👑",
    active: true,
  },
  {
    id: "title_lightning_pooper",
    name: "Cagador Relâmpago",
    description: "Entra, executa com precisão militar e volta antes da daily começar.",
    category: "title",
    rarity: "comum",
    price: 15,
    basePrice: 15,
    initialStock: 25,
    currentStock: 25,
    priceMultiplier: 1.1,
    icon: "⚡",
    active: true,
  },
  {
    id: "title_coffee_flush",
    name: "Café & Descarga",
    description: "O combo biológico mais potente da produtividade moderna.",
    category: "title",
    rarity: "comum",
    price: 10,
    basePrice: 10,
    initialStock: 30,
    currentStock: 30,
    priceMultiplier: 1.1,
    icon: "☕",
    active: true,
  },
  {
    id: "title_triple_ply",
    name: "Folha Dupla VIP",
    description: "Apenas o papel higiênico mais macio para a alta nobreza do escritório.",
    category: "title",
    rarity: "raro",
    price: 35,
    basePrice: 35,
    initialStock: 12,
    currentStock: 12,
    priceMultiplier: 1.2,
    icon: "🧻",
    active: true,
  },
  {
    id: "title_paid_rest",
    name: "Descanso Remunerado",
    description: "Faturando centavos por segundo sentado com postura de executivo.",
    category: "title",
    rarity: "epico",
    price: 50,
    basePrice: 50,
    initialStock: 8,
    currentStock: 8,
    priceMultiplier: 1.25,
    icon: "🛋️",
    active: true,
  },
  {
    id: "title_emperor",
    name: "Imperador do Trono",
    description: "A maior autoridade sanitária de toda a empresa. Respeite o rei!",
    category: "title",
    rarity: "lendario",
    price: 100,
    basePrice: 100,
    initialStock: 3,
    currentStock: 3,
    priceMultiplier: 1.5,
    icon: "💩",
    active: true,
  },

  // BADGES / MOLDURAS
  {
    id: "badge_gold_24k",
    name: "Moldura Dourada 24k",
    description: "O requinte do ouro maciço ao redor do seu avatar no perfil.",
    category: "badge",
    rarity: "epico",
    price: 60,
    basePrice: 60,
    initialStock: 10,
    currentStock: 10,
    priceMultiplier: 1.25,
    icon: "🥇",
    active: true,
  },
  {
    id: "badge_flame_pro",
    name: "Chamas do Expediente",
    description: "Para quem mantém acesa a chama sagrada do dever diário.",
    category: "badge",
    rarity: "raro",
    price: 35,
    basePrice: 35,
    initialStock: 15,
    currentStock: 15,
    priceMultiplier: 1.15,
    icon: "🔥",
    active: true,
  },
  {
    id: "badge_diamond_toilet",
    name: "Privada de Diamante",
    description: "Símbolo máximo de luxo sanitário gerado por minutos de trono.",
    category: "badge",
    rarity: "lendario",
    price: 120,
    basePrice: 120,
    initialStock: 2,
    currentStock: 2,
    priceMultiplier: 1.6,
    icon: "💎",
    active: true,
  },
  {
    id: "badge_stealth_ninja",
    name: "Ninja Sanitário",
    description: "Ninguém ouviu a porta, ninguém viu sair. Discrição lendária.",
    category: "badge",
    rarity: "raro",
    price: 40,
    basePrice: 40,
    initialStock: 12,
    currentStock: 12,
    priceMultiplier: 1.2,
    icon: "🥷",
    active: true,
  },

  // PRIVILÉGIOS CORPORATIVOS FICTÍCIOS
  {
    id: "perk_coffee_break",
    name: "Vale Café Gourmet",
    description: "Direito moral de preparar um café especial sem olhar para o relógio.",
    category: "perk",
    rarity: "comum",
    price: 10,
    basePrice: 10,
    initialStock: 50,
    currentStock: 50,
    priceMultiplier: 1.05,
    icon: "☕",
    perkEffect: "Imunidade de pressa no café da copa",
    active: true,
  },
  {
    id: "perk_meeting_immunity",
    name: "Imunidade de Reunião Inútil",
    description: "Álibi perfeito: 'Estava resolvendo um bloqueio interno de alta gravidade'.",
    category: "perk",
    rarity: "epico",
    price: 75,
    basePrice: 75,
    initialStock: 5,
    currentStock: 5,
    priceMultiplier: 1.35,
    icon: "🔇",
    perkEffect: "Álibi corporativo supremo",
    active: true,
  },
  {
    id: "perk_radio_dj",
    name: "DJ da Firma",
    description: "O poder simbólico e incontestável de escolher a playlist da tarde.",
    category: "perk",
    rarity: "raro",
    price: 45,
    basePrice: 45,
    initialStock: 10,
    currentStock: 10,
    priceMultiplier: 1.2,
    icon: "🎵",
    perkEffect: "Voto de minerva na caixa de som",
    active: true,
  },
  {
    id: "perk_friday_license",
    name: "Licença Sextou às 16h",
    description: "Permissão espiritual para fechar abas do navegador na sexta à tarde.",
    category: "perk",
    rarity: "lendario",
    price: 150,
    basePrice: 150,
    initialStock: 3,
    currentStock: 3,
    priceMultiplier: 1.5,
    icon: "🍻",
    perkEffect: "Vibe sextou ativada",
    active: true,
  },
];

export function listenShopCatalog(callback: (items: ShopItem[]) => void) {
  try {
    const q = query(collection(db, "shop_items"));
    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          callback(SHOP_CATALOG);
          return;
        }
        const items: ShopItem[] = [];
        snapshot.forEach((snap) => {
          items.push({ id: snap.id, ...(snap.data() as any) });
        });
        callback(items);
      },
      () => {
        callback(SHOP_CATALOG);
      }
    );
  } catch {
    callback(SHOP_CATALOG);
    return () => {};
  }
}

export function resolveUserOwnedItems(
  user: Partial<AppUser> | null | undefined,
  catalog: ShopItem[] = SHOP_CATALOG
): ShopItem[] {
  if (!user) return [];
  const list: ShopItem[] = [];
  const seenKeys = new Set<string>();

  catalog.forEach((item) => {
    const isOwned = Boolean(
      user.unlockedItems?.includes(item.id) ||
      user.unlockedItems?.includes(item.name) ||
      (item.category === "title" && user.equippedTitle === item.name) ||
      (item.category === "badge" && user.equippedBadge === item.icon)
    );

    if (isOwned) {
      list.push(item);
      seenKeys.add(item.id);
      seenKeys.add(item.name);
    }
  });

  user.unlockedItems?.forEach((idOrName) => {
    if (!seenKeys.has(idOrName)) {
      list.push({
        id: idOrName,
        name: idOrName,
        description: "Item colecionável exclusivo adquirido",
        category: "badge",
        rarity: "raro",
        price: 0,
        icon: "🎁",
      });
      seenKeys.add(idOrName);
    }
  });

  return list;
}

export async function equipUserShopItem(userId: string, item: ShopItem, equip: boolean) {
  const userRef = doc(db, "users", userId);
  if (item.category === "title") {
    await updateDoc(userRef, {
      equippedTitle: equip ? item.name : null,
    });
  } else if (item.category === "badge") {
    await updateDoc(userRef, {
      equippedBadge: equip ? item.icon : null,
    });
  }
}
