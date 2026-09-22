import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  where,
  increment,
  updateDoc,
  Unsubscribe,
  setDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  AppUser,
  PoopLog,
  PoopcoinSupplySummary,
  PoopcoinTransaction,
  PoopcoinTransactionEntry,
  PoopcoinTransactionType,
  ShopItem,
} from "../types";
import { canonicalJson, randomNonce, sha256Hex } from "./cryptoUtils";
import { createAuditLogRecord, adminLogsRef } from "./adminService";

export const poopcoinTransactionsRef = collection(db, "poopcoin_transactions");
export const poopcoinChainHeadRef = doc(db, "poopcoin_chain", "head");
export const usersRef = collection(db, "users");
export const appSettingsRef = doc(db, "app_settings", "global");
export const shopItemsRef = collection(db, "shop_items");

export const POOPCOIN_TOTAL_SUPPLY = 1_000_000;
export const MAX_TRANSFER_AMOUNT = 100_000;
export const MAX_REASON_LENGTH = 240;
export const GENESIS_HASH = "0".repeat(64);

export function normalizePoopcoinAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_TRANSFER_AMOUNT, Math.trunc(value)));
}

export function normalizePoopcoinReason(value: string): string {
  return value.trim().slice(0, MAX_REASON_LENGTH);
}

export function formatPoopcoins(value?: number | null): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function parsePoopcoinSupplySummary(
  data?: Record<string, unknown> | null
): PoopcoinSupplySummary {
  const rawTotal = Number(data?.totalSupply ?? POOPCOIN_TOTAL_SUPPLY);
  const totalSupply = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : POOPCOIN_TOTAL_SUPPLY;
  const mintedSupply = Math.min(totalSupply, Math.max(0, Number(data?.mintedSupply ?? 0)));
  const burnedSupply = Math.max(0, Number(data?.burnedSupply ?? 0));
  const circulatingSupply = Math.max(0, Number(data?.circulatingSupply ?? 0));
  const isMigrated = Boolean(data?.supplyMigratedAt);

  return {
    totalSupply,
    mintedSupply,
    burnedSupply,
    circulatingSupply,
    availableSupply: isMigrated ? Math.max(0, totalSupply - mintedSupply) : 0,
    supplyMigratedAt: data?.supplyMigratedAt ?? null,
  };
}

export async function fetchPoopcoinSupplySummary(): Promise<PoopcoinSupplySummary> {
  try {
    const snap = await getDoc(poopcoinChainHeadRef);
    if (!snap.exists()) {
      return {
        totalSupply: POOPCOIN_TOTAL_SUPPLY,
        mintedSupply: 0,
        burnedSupply: 0,
        circulatingSupply: 0,
        availableSupply: POOPCOIN_TOTAL_SUPPLY,
        supplyMigratedAt: null,
      };
    }
    return parsePoopcoinSupplySummary(snap.data() as Record<string, unknown>);
  } catch (error) {
    console.error("Error fetching poopcoin supply:", error);
    return {
      totalSupply: POOPCOIN_TOTAL_SUPPLY,
      mintedSupply: 0,
      burnedSupply: 0,
      circulatingSupply: 0,
      availableSupply: POOPCOIN_TOTAL_SUPPLY,
      supplyMigratedAt: null,
    };
  }
}

export function listenPoopcoinChainHead(
  callback: (summary: PoopcoinSupplySummary) => void
): Unsubscribe {
  return onSnapshot(
    poopcoinChainHeadRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(parsePoopcoinSupplySummary(snapshot.data() as Record<string, unknown>));
      } else {
        callback({
          totalSupply: POOPCOIN_TOTAL_SUPPLY,
          mintedSupply: 0,
          burnedSupply: 0,
          circulatingSupply: 0,
          availableSupply: POOPCOIN_TOTAL_SUPPLY,
          supplyMigratedAt: null,
        });
      }
    },
    (err) => {
      console.error("Error listening to chain head:", err);
    }
  );
}

export async function fetchPoopcoinSettings(): Promise<{
  poopcoinsPerLog: number;
  cuiterPostCost: number;
}> {
  try {
    const snap = await getDoc(appSettingsRef);
    const data = snap.data();
    return {
      poopcoinsPerLog: Math.max(1, Number(data?.poopcoinsPerLog ?? 1)),
      cuiterPostCost: Math.max(1, Number(data?.cuiterPostCost ?? 5)),
    };
  } catch {
    return {
      poopcoinsPerLog: 1,
      cuiterPostCost: 5,
    };
  }
}

export function listenPoopcoinTransactions(
  callback: (transactions: PoopcoinTransaction[]) => void,
  maxCount = 50
): Unsubscribe {
  const q = query(poopcoinTransactionsRef, orderBy("sequence", "desc"), limit(maxCount));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: PoopcoinTransaction[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as any),
      }));
      callback(list);
    },
    (err) => {
      console.error("Error listening to poopcoin transactions:", err);
    }
  );
}

export function listenUserPoopcoinTransactions(
  userId: string,
  callback: (transactions: PoopcoinTransaction[]) => void,
  maxCount = 50
): Unsubscribe {
  const q = query(
    poopcoinTransactionsRef,
    where("affectedUserIds", "array-contains", userId),
    orderBy("sequence", "desc"),
    limit(maxCount)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: PoopcoinTransaction[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as any),
      }));
      callback(list);
    },
    (err) => {
      console.error("Error listening to user poopcoin transactions:", err);
    }
  );
}

export async function getActiveUsers(): Promise<AppUser[]> {
  try {
    const q = query(usersRef, orderBy("name", "asc"), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => ({ uid: d.id, ...(d.data() as any) }))
      .filter((u) => u.isActive !== false);
  } catch (error) {
    console.error("Error fetching active users:", error);
    return [];
  }
}

export async function transferPoopcoins(
  sender: AppUser,
  recipientUid: string,
  amountValue: number,
  reasonValue?: string
): Promise<{ hash: string }> {
  const amount = normalizePoopcoinAmount(amountValue);
  const targetUid = recipientUid.trim();
  const reason = reasonValue ? normalizePoopcoinReason(reasonValue) : null;

  if (amount <= 0) {
    throw new Error("Informe uma quantidade inteira positiva de Poopcoins.");
  }
  if (!targetUid) {
    throw new Error("Informe o ID do destinatário.");
  }
  if (targetUid === sender.uid) {
    throw new Error("Você não pode transferir Poopcoins para si mesmo.");
  }

  let resultingHash = "";

  await runTransaction(db, async (transaction) => {
    const senderRef = doc(db, "users", sender.uid);
    const recipientRef = doc(db, "users", targetUid);

    const [senderSnapshot, recipientSnapshot, headSnapshot] = await Promise.all([
      transaction.get(senderRef),
      transaction.get(recipientRef),
      transaction.get(poopcoinChainHeadRef),
    ]);

    const senderData = senderSnapshot.data() as AppUser | undefined;
    const recipientData = recipientSnapshot.data() as AppUser | undefined;

    if (!senderData || senderData.isActive === false) {
      throw new Error("Seu usuário não está ativo para transferir Poopcoins.");
    }

    if (!recipientData || recipientData.isActive === false) {
      throw new Error("Destinatário não encontrado ou inativo no sistema.");
    }

    const currentBalance = Number(senderData.poopcoinBalance ?? 0);
    if (currentBalance < amount) {
      throw new Error(
        `Saldo insuficiente. Seu saldo atual é de ${formatPoopcoins(currentBalance)} Poopcoins.`
      );
    }

    const previousHash = String(headSnapshot.data()?.lastHash ?? GENESIS_HASH);
    const previousSequence = Number(headSnapshot.data()?.lastSequence ?? 0);
    const sequence = Math.max(0, Math.trunc(previousSequence)) + 1;
    const createdAt = Timestamp.now();
    const nonce = randomNonce();
    const entries: PoopcoinTransactionEntry[] = [
      { userId: sender.uid, delta: -amount },
      { userId: targetUid, delta: amount },
    ];
    const affectedUserIds = [sender.uid, targetUid].sort();
    const senderRole = (senderData.role === "admin" ? "admin" : "player") as "player" | "admin";

    const unsignedPayload = {
      previousHash,
      sequence,
      createdAt,
      type: "transfer",
      entries,
      affectedUserIds,
      fromUserId: sender.uid,
      toUserId: targetUid,
      amount,
      createdBy: sender.uid,
      createdByRole: senderRole,
      status: "active",
      reversesTransactionHash: null,
      linkedLogId: null,
      linkedPostId: null,
      reason,
      nonce,
    };

    const hash = sha256Hex(canonicalJson(unsignedPayload));
    resultingHash = hash;

    const transactionData = {
      hash,
      previousHash,
      sequence,
      createdAt,
      type: "transfer",
      entries,
      affectedUserIds,
      fromUserId: sender.uid,
      toUserId: targetUid,
      amount,
      createdBy: sender.uid,
      createdByRole: senderRole,
      status: "active",
      reversesTransactionHash: null,
      reversedByTransactionHash: null,
      linkedLogId: null,
      linkedPostId: null,
      reason,
      nonce,
    };

    // 1. Write the transaction block
    transaction.set(doc(db, "poopcoin_transactions", hash), transactionData);

    // 2. Update chain head
    transaction.set(
      poopcoinChainHeadRef,
      {
        lastHash: hash,
        lastSequence: sequence,
        updatedAt: createdAt,
      },
      { merge: true }
    );

    // 3. Update balances
    transaction.update(senderRef, { poopcoinBalance: increment(-amount) });
    transaction.update(recipientRef, { poopcoinBalance: increment(amount) });
  });

  return { hash: resultingHash };
}

/**
 * Executa o débito/gasto atômico de Poopcoins (ex: postar no Cuiter) com validação de saldo e registro em blockchain.
 */
export async function spendPoopcoins(
  user: AppUser,
  amount: number,
  reason: string,
  options?: { linkedPostId?: string; type?: PoopcoinTransactionType }
): Promise<{ hash: string; remainingBalance: number }> {
  const normalizedAmount = Math.max(1, Math.trunc(amount));
  const normalizedReason = normalizePoopcoinReason(reason);
  const type = options?.type || "cuiter_spend";

  let txHash = "";
  let finalBalance = 0;

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("Usuário não encontrado.");
    }

    const userData = userSnap.data() as AppUser;
    const currentBalance = Number(userData.poopcoinBalance ?? 0);

    if (currentBalance < normalizedAmount) {
      throw new Error(
        `Saldo insuficiente de Poopcoins. Você possui ${formatPoopcoins(currentBalance)}, mas a operação custa ${formatPoopcoins(normalizedAmount)}.`
      );
    }

    const tx = await appendPoopcoinTransaction(transaction, {
      type,
      entries: [{ userId: user.uid, delta: -normalizedAmount }],
      amount: normalizedAmount,
      createdBy: user.uid,
      createdByRole: userData.role || "player",
      fromUserId: user.uid,
      linkedPostId: options?.linkedPostId ?? null,
      reason: normalizedReason,
      supplyEffect: {
        burnedDelta: normalizedAmount,
        circulatingDelta: -normalizedAmount,
      },
    });

    txHash = tx.hash;
    finalBalance = currentBalance - normalizedAmount;

    transaction.update(userRef, {
      poopcoinBalance: increment(-normalizedAmount),
    });
  });

  return { hash: txHash, remainingBalance: finalBalance };
}

// ---------------------------------------------------------------------------
// LOJA PRIVADIN (SHOP & RECOMPENSAS COM ESTOQUE E PREÇO DINÂMICO)
// ---------------------------------------------------------------------------

/**
 * Calcula o preço atual do item baseado no estoque restante e no multiplicador de escassez.
 * Conforme a quantidade vai diminuindo, o preço vai aumentando proporcionalmente.
 */
export function calculateCurrentItemPrice(item: Partial<ShopItem>): number {
  const base = Math.max(1, Math.round(Number(item.basePrice ?? item.price ?? 1)));
  const initial = Math.max(1, Math.round(Number(item.initialStock ?? 10)));
  const current = Math.max(0, Math.round(Number(item.currentStock ?? initial)));
  const multiplier =
    typeof item.priceMultiplier === "number" && item.priceMultiplier >= 1
      ? item.priceMultiplier
      : 1;

  if (multiplier <= 1 || current >= initial) {
    return base;
  }

  // Quantidade de unidades já vendidas
  const sold = Math.max(0, initial - current);
  // Cada unidade vendida acrescenta (multiplier - 1) ao fator de escassez
  const increaseFactor = 1 + (multiplier - 1) * sold;
  const dynamicPrice = Math.round(base * increaseFactor);
  return Math.max(base, dynamicPrice);
}

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

/**
 * Escuta os itens da loja em tempo real no Firestore.
 * Se a coleção estiver vazia, popula automaticamente com o catálogo padrão.
 */
export function listenShopItems(callback: (items: ShopItem[]) => void): () => void {
  const q = query(shopItemsRef);
  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty) {
        try {
          const batch = writeBatch(db);
          SHOP_CATALOG.forEach((it) => {
            const ref = doc(db, "shop_items", it.id);
            const initial = it.initialStock ?? (it.rarity === "lendario" ? 3 : it.rarity === "epico" ? 8 : 15);
            const base = it.basePrice ?? it.price ?? 10;
            const mult = it.priceMultiplier ?? 1.15;
            batch.set(ref, {
              ...it,
              basePrice: base,
              initialStock: initial,
              currentStock: initial,
              priceMultiplier: mult,
              active: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        } catch (err) {
          console.warn("Não foi possível inicializar itens da loja no Firestore:", err);
        }

        callback(
          SHOP_CATALOG.map((it) => {
            const dynamicPrice = calculateCurrentItemPrice(it);
            return {
              ...it,
              price: dynamicPrice,
            };
          })
        );
        return;
      }

      const items: ShopItem[] = [];
      snapshot.forEach((snap) => {
        const data = snap.data();
        const raw = { ...data, id: snap.id } as ShopItem;
        const dynamicPrice = calculateCurrentItemPrice(raw);
        items.push({
          ...raw,
          price: dynamicPrice,
        });
      });

      // Ordenar por categoria e depois por preço crescente
      items.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return (a.price || 0) - (b.price || 0);
      });

      callback(items);
    },
    (err) => {
      console.warn("Erro ao escutar shop_items:", err);
      callback(
        SHOP_CATALOG.map((it) => ({
          ...it,
          price: calculateCurrentItemPrice(it),
        }))
      );
    }
  );
}

/**
 * Cria ou atualiza um item da loja (acesso restrito a administradores).
 */
export async function saveShopItem(
  admin: AppUser,
  itemData: Partial<ShopItem> & { id?: string }
): Promise<string> {
  if (admin.role !== "admin") {
    throw new Error("Apenas administradores podem gerenciar itens da loja.");
  }

  const basePrice = Math.max(1, Math.round(Number(itemData.basePrice || itemData.price || 10)));
  const initialStock = Math.max(1, Math.round(Number(itemData.initialStock ?? 10)));
  const currentStock = Math.max(0, Math.min(initialStock, Math.round(Number(itemData.currentStock ?? initialStock))));
  const priceMultiplier = Math.max(1, Number(itemData.priceMultiplier ?? 1.15));

  const itemId =
    itemData.id?.trim() ||
    `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const itemRef = doc(db, "shop_items", itemId);
  const snap = await getDoc(itemRef);

  const payload: any = {
    name: itemData.name?.trim() || "Item da Loja",
    description: itemData.description?.trim() || "",
    category: itemData.category || "title",
    rarity: itemData.rarity || "comum",
    icon: itemData.icon?.trim() || "🎁",
    basePrice,
    initialStock,
    currentStock,
    priceMultiplier,
    active: itemData.active !== false,
    updatedAt: serverTimestamp(),
  };

  if (itemData.perkEffect?.trim()) {
    payload.perkEffect = itemData.perkEffect.trim();
  } else {
    payload.perkEffect = null;
  }

  if (snap.exists()) {
    await updateDoc(itemRef, payload);
    await addDoc(adminLogsRef, {
      action: "update_shop_item",
      adminId: admin.uid,
      adminName: admin.name || "Admin",
      createdAt: serverTimestamp(),
      reason: `${admin.name || "Admin"} editou "${payload.name}" (Estoque: ${currentStock}/${initialStock}, Mult: ${priceMultiplier.toFixed(2)}x)`,
    });
  } else {
    payload.id = itemId;
    payload.createdAt = serverTimestamp();
    await setDoc(itemRef, payload);
    await addDoc(adminLogsRef, {
      action: "create_shop_item",
      adminId: admin.uid,
      adminName: admin.name || "Admin",
      createdAt: serverTimestamp(),
      reason: `${admin.name || "Admin"} criou "${payload.name}" (Preço Base: ${basePrice} PC, Estoque: ${initialStock}, Mult: ${priceMultiplier.toFixed(2)}x)`,
    });
  }

  return itemId;
}

/**
 * Exclui um item da loja (acesso restrito a administradores).
 */
export async function deleteShopItem(admin: AppUser, itemId: string): Promise<void> {
  if (admin.role !== "admin") {
    throw new Error("Apenas administradores podem excluir itens da loja.");
  }
  const itemRef = doc(db, "shop_items", itemId);
  const snap = await getDoc(itemRef);
  const name = snap.data()?.name || itemId;
  await deleteDoc(itemRef);

  await addDoc(adminLogsRef, {
    action: "delete_shop_item",
    adminId: admin.uid,
    adminName: admin.name || "Admin",
    createdAt: serverTimestamp(),
    reason: `${admin.name || "Admin"} excluiu o item "${name}" da loja`,
  });
}

export async function buyShopItem(
  user: AppUser,
  item: ShopItem
): Promise<{ hash: string; pricePaid: number }> {
  let resultingHash = "";
  let finalPricePaid = item.price;

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", user.uid);
    const itemRef = doc(db, "shop_items", item.id);

    const [userSnap, headSnap, itemSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(poopcoinChainHeadRef),
      transaction.get(itemRef),
    ]);

    const userData = userSnap.data() as AppUser | undefined;
    if (!userData || userData.isActive === false) {
      throw new Error("Usuário inativo ou não encontrado.");
    }

    // Identifica dados dinâmicos do item se existir no banco
    let effectiveItem: ShopItem = item;
    if (itemSnap.exists()) {
      const itemData = itemSnap.data() as ShopItem;
      if (itemData.active === false) {
        throw new Error("Este item não está mais disponível na loja.");
      }
      const availableStock = itemData.currentStock ?? itemData.initialStock ?? 10;
      if (availableStock <= 0) {
        throw new Error("Este item está ESGOTADO!");
      }
      effectiveItem = {
        ...itemData,
        id: itemSnap.id,
      };
    } else {
      if ((effectiveItem.currentStock ?? 10) <= 0) {
        throw new Error("Este item está ESGOTADO!");
      }
    }

    // Calcula o preço dinâmico em tempo real
    const livePrice = calculateCurrentItemPrice(effectiveItem);
    finalPricePaid = livePrice;

    const liveBalance = Number(userData.poopcoinBalance ?? 0);
    if (liveBalance < livePrice) {
      throw new Error(
        `Saldo insuficiente. O item custa ${formatPoopcoins(livePrice)} PC e seu saldo é de ${formatPoopcoins(liveBalance)} PC.`
      );
    }

    const alreadyOwned = Boolean(
      userData.unlockedItems?.includes(item.id) ||
      userData.unlockedItems?.includes(effectiveItem.id) ||
      (effectiveItem.name && userData.unlockedItems?.includes(effectiveItem.name)) ||
      (effectiveItem.category === "title" && userData.equippedTitle === effectiveItem.name) ||
      (effectiveItem.category === "badge" && userData.equippedBadge === effectiveItem.icon)
    );
    if (alreadyOwned) {
      throw new Error("Você já possui este item em seu inventário! O limite é de 1 unidade por usuário.");
    }

    const previousHash = String(headSnap.data()?.lastHash ?? GENESIS_HASH);
    const previousSequence = Number(headSnap.data()?.lastSequence ?? 0);
    const sequence = Math.max(0, Math.trunc(previousSequence)) + 1;
    const createdAt = Timestamp.now();
    const nonce = randomNonce();
    const entries: PoopcoinTransactionEntry[] = [
      { userId: user.uid, delta: -livePrice },
    ];
    const affectedUserIds = [user.uid];
    const role = (userData.role === "admin" ? "admin" : "player") as "player" | "admin";
    const reason = `Loja: ${effectiveItem.name}`;

    const unsignedPayload = {
      previousHash,
      sequence,
      createdAt,
      type: "cuiter_spend",
      entries,
      affectedUserIds,
      fromUserId: user.uid,
      toUserId: null,
      amount: livePrice,
      createdBy: user.uid,
      createdByRole: role,
      status: "active",
      reversesTransactionHash: null,
      linkedLogId: null,
      linkedPostId: null,
      reason,
      nonce,
    };

    const hash = sha256Hex(canonicalJson(unsignedPayload));
    resultingHash = hash;

    const transactionData = {
      hash,
      previousHash,
      sequence,
      createdAt,
      type: "cuiter_spend",
      entries,
      affectedUserIds,
      fromUserId: user.uid,
      toUserId: null,
      amount: livePrice,
      createdBy: user.uid,
      createdByRole: role,
      status: "active",
      reversesTransactionHash: null,
      reversedByTransactionHash: null,
      linkedLogId: null,
      linkedPostId: null,
      reason,
      nonce,
    };

    // 1. Grava bloco da transação
    transaction.set(doc(db, "poopcoin_transactions", hash), transactionData);

    // 2. Diminui estoque do item
    if (itemSnap.exists()) {
      const stock = effectiveItem.currentStock ?? effectiveItem.initialStock ?? 10;
      transaction.update(itemRef, {
        currentStock: Math.max(0, stock - 1),
        updatedAt: createdAt,
      });
    }

    // 3. Atualiza head (queima e circulação de moedas)
    const currentBurned = Number(headSnap.data()?.burnedSupply ?? 0);
    const currentCirculating = Number(headSnap.data()?.circulatingSupply ?? 0);
    transaction.set(
      poopcoinChainHeadRef,
      {
        lastHash: hash,
        lastSequence: sequence,
        updatedAt: createdAt,
        burnedSupply: currentBurned + livePrice,
        circulatingSupply: Math.max(0, currentCirculating - livePrice),
      },
      { merge: true }
    );

    // 4. Atualiza usuário (desconta saldo e adiciona aos itens desbloqueados)
    const updatedUnlocked = Array.from(
      new Set([...(userData.unlockedItems || []), item.id])
    );
    const userUpdates: any = {
      poopcoinBalance: increment(-livePrice),
      unlockedItems: updatedUnlocked,
    };
    if (effectiveItem.category === "title" && !userData.equippedTitle) {
      userUpdates.equippedTitle = effectiveItem.name;
    }
    if (effectiveItem.category === "badge" && !userData.equippedBadge) {
      userUpdates.equippedBadge = effectiveItem.icon;
    }

    transaction.update(userRef, userUpdates);
  });

  return { hash: resultingHash, pricePaid: finalPricePaid };
}

export async function equipUserItem(
  userId: string,
  item: ShopItem,
  equip: boolean
) {
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

export async function mintPoopcoinsForLog(
  user: AppUser,
  logId: string
): Promise<{ poopcoinsEarned: number; transactionHash: string | null }> {
  try {
    const [settings, headSnap] = await Promise.all([
      fetchPoopcoinSettings(),
      getDoc(poopcoinChainHeadRef),
    ]);

    const amount = settings.poopcoinsPerLog || 1;
    const headData = headSnap.data();
    const summary = parsePoopcoinSupplySummary(headData);

    // Check available supply
    if (summary.availableSupply < amount) {
      return { poopcoinsEarned: 0, transactionHash: null };
    }

    let resultingHash = "";

    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", user.uid);
      const [userSnapshot, freshHeadSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(poopcoinChainHeadRef),
      ]);

      const previousHash = String(freshHeadSnapshot.data()?.lastHash ?? GENESIS_HASH);
      const previousSequence = Number(freshHeadSnapshot.data()?.lastSequence ?? 0);
      const sequence = Math.max(0, Math.trunc(previousSequence)) + 1;
      const createdAt = Timestamp.now();
      const nonce = randomNonce();
      const entries: PoopcoinTransactionEntry[] = [{ userId: user.uid, delta: amount }];
      const affectedUserIds = [user.uid];
      const role = (userSnapshot.data()?.role === "admin" ? "admin" : "player") as "player" | "admin";

      const unsignedPayload = {
        previousHash,
        sequence,
        createdAt,
        type: "mint_log",
        entries,
        affectedUserIds,
        fromUserId: null,
        toUserId: user.uid,
        amount,
        createdBy: user.uid,
        createdByRole: role,
        status: "active",
        reversesTransactionHash: null,
        linkedLogId: logId,
        linkedPostId: null,
        reason: null,
        nonce,
      };

      const hash = sha256Hex(canonicalJson(unsignedPayload));
      resultingHash = hash;

      const transactionData = {
        hash,
        previousHash,
        sequence,
        createdAt,
        type: "mint_log",
        entries,
        affectedUserIds,
        fromUserId: null,
        toUserId: user.uid,
        amount,
        createdBy: user.uid,
        createdByRole: role,
        status: "active",
        reversesTransactionHash: null,
        reversedByTransactionHash: null,
        linkedLogId: logId,
        linkedPostId: null,
        reason: null,
        nonce,
      };

      // 1. Transaction block
      transaction.set(doc(db, "poopcoin_transactions", hash), transactionData);

      // 2. Update head
      const currentMinted = Number(freshHeadSnapshot.data()?.mintedSupply ?? 0);
      const currentCirculating = Number(freshHeadSnapshot.data()?.circulatingSupply ?? 0);
      transaction.set(
        poopcoinChainHeadRef,
        {
          lastHash: hash,
          lastSequence: sequence,
          updatedAt: createdAt,
          mintedSupply: currentMinted + amount,
          circulatingSupply: currentCirculating + amount,
        },
        { merge: true }
      );

      // 3. Update user poopcoin balance
      transaction.update(userRef, {
        poopcoinBalance: increment(amount),
      });
    });

    return { poopcoinsEarned: amount, transactionHash: resultingHash };
  } catch (error) {
    console.error("Error minting poopcoins for log:", error);
    return { poopcoinsEarned: 0, transactionHash: null };
  }
}

// ---------------------------------------------------------------------------
// GESTÃO ADMINISTRATIVA DA ECONOMIA POOPCOIN
// ---------------------------------------------------------------------------

export type AppendPoopcoinInput = {
  type: PoopcoinTransactionType;
  entries: PoopcoinTransactionEntry[];
  amount: number;
  createdBy: string;
  createdByRole?: string;
  createdAt?: Timestamp;
  fromUserId?: string | null;
  toUserId?: string | null;
  linkedLogId?: string | null;
  linkedPostId?: string | null;
  reversesTransactionHash?: string | null;
  reason?: string | null;
  supplyEffect?: PoopcoinSupplyEffect;
};

export type PoopcoinSupplyEffect = {
  mintedDelta?: number;
  burnedDelta?: number;
  circulatingDelta?: number;
  requireMigratedSupply?: boolean;
};

function resolveSupplyHeadUpdate(
  headData: Record<string, unknown> | undefined,
  effect?: PoopcoinSupplyEffect
) {
  if (!effect) return {};

  const hasMigratedSupply = Boolean(headData?.supplyMigratedAt);
  if (!hasMigratedSupply) {
    if (effect.requireMigratedSupply) {
      throw new Error("Recalcule o suprimento de PoopCoins antes de emitir novas moedas.");
    }
    return {};
  }

  const summary = parsePoopcoinSupplySummary(headData);
  const mintedSupply = summary.mintedSupply + Math.trunc(effect.mintedDelta ?? 0);
  const burnedSupply = summary.burnedSupply + Math.trunc(effect.burnedDelta ?? 0);
  const circulatingSupply = summary.circulatingSupply + Math.trunc(effect.circulatingDelta ?? 0);

  if (
    mintedSupply < 0 ||
    mintedSupply > summary.totalSupply ||
    burnedSupply < 0 ||
    circulatingSupply < 0
  ) {
    throw new Error("Suprimento de PoopCoins insuficiente para esta operação.");
  }

  return {
    totalSupply: summary.totalSupply,
    mintedSupply,
    burnedSupply,
    circulatingSupply,
  };
}

function uniqueUserIds(entries: PoopcoinTransactionEntry[]): string[] {
  return Array.from(new Set(entries.map((entry) => entry.userId))).sort();
}

function assertValidEntries(entries: PoopcoinTransactionEntry[]) {
  if (entries.length === 0) {
    throw new Error("Transação sem lançamentos.");
  }

  entries.forEach((entry) => {
    if (!entry.userId || !Number.isInteger(entry.delta) || entry.delta === 0) {
      throw new Error("Lançamento de Poopcoins inválido.");
    }
  });
}

function entriesDelta(entries: PoopcoinTransactionEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.delta, 0);
}

function reversalSupplyEffect(original: any): PoopcoinSupplyEffect | undefined {
  if (original.type === "mint_log" || original.type === "legacy_mint") {
    return {
      mintedDelta: -original.amount,
      circulatingDelta: -original.amount,
    };
  }

  if (original.type === "cuiter_spend") {
    return {
      burnedDelta: -original.amount,
      circulatingDelta: original.amount,
    };
  }

  if (original.type === "admin_adjustment") {
    const delta = entriesDelta(original.entries);
    if (delta > 0) {
      return {
        mintedDelta: -delta,
        circulatingDelta: -delta,
      };
    }
    if (delta < 0) {
      return {
        burnedDelta: delta,
        circulatingDelta: -delta,
      };
    }
  }

  return undefined;
}

export async function appendPoopcoinTransaction(
  transaction: any,
  input: AppendPoopcoinInput
): Promise<{ hash: string; data: any }> {
  assertValidEntries(input.entries);

  const headSnapshot = await transaction.get(poopcoinChainHeadRef);
  const previousHash = String(headSnapshot.data()?.lastHash ?? GENESIS_HASH);
  const previousSequence = Number(headSnapshot.data()?.lastSequence ?? 0);
  const sequence = Math.max(0, Math.trunc(previousSequence)) + 1;
  const createdAt = input.createdAt ?? Timestamp.now();
  const nonce = randomNonce();
  const reason = input.reason ? normalizePoopcoinReason(input.reason) : null;
  const affectedUserIds = uniqueUserIds(input.entries);

  const unsignedPayload = {
    previousHash,
    sequence,
    createdAt,
    type: input.type,
    entries: input.entries,
    affectedUserIds,
    fromUserId: input.fromUserId ?? null,
    toUserId: input.toUserId ?? null,
    amount: input.amount,
    createdBy: input.createdBy,
    createdByRole: input.createdByRole || "admin",
    status: "active",
    reversesTransactionHash: input.reversesTransactionHash ?? null,
    linkedLogId: input.linkedLogId ?? null,
    linkedPostId: input.linkedPostId ?? null,
    reason,
    nonce,
  };
  const hash = sha256Hex(canonicalJson(unsignedPayload));
  const transactionData = {
    hash,
    previousHash,
    sequence,
    createdAt,
    type: input.type,
    entries: input.entries,
    affectedUserIds,
    fromUserId: input.fromUserId ?? null,
    toUserId: input.toUserId ?? null,
    amount: input.amount,
    createdBy: input.createdBy,
    createdByRole: input.createdByRole || "admin",
    status: "active",
    reversesTransactionHash: input.reversesTransactionHash ?? null,
    reversedByTransactionHash: null,
    linkedLogId: input.linkedLogId ?? null,
    linkedPostId: input.linkedPostId ?? null,
    reason,
    nonce,
  };

  transaction.set(doc(db, "poopcoin_transactions", hash), transactionData);
  transaction.set(
    poopcoinChainHeadRef,
    {
      lastHash: hash,
      lastSequence: sequence,
      updatedAt: createdAt,
      ...resolveSupplyHeadUpdate(
        headSnapshot.data() as Record<string, unknown> | undefined,
        input.supplyEffect
      ),
    },
    { merge: true }
  );

  return { hash, data: transactionData };
}

/**
 * Ajuste administrativo manual de saldo de PoopCoins (crédito ou débito com motivo registrado no Ledger)
 */
export async function adjustPoopcoins(
  admin: AppUser,
  targetUser: AppUser,
  amountValue: number,
  reasonValue: string
): Promise<void> {
  const amount = Math.trunc(amountValue);
  const reason = normalizePoopcoinReason(reasonValue);

  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error("Informe um ajuste inteiro diferente de zero.");
  }

  if (Math.abs(amount) > MAX_TRANSFER_AMOUNT) {
    throw new Error(`Informe um ajuste de até ${formatPoopcoins(MAX_TRANSFER_AMOUNT)} PoopCoins.`);
  }

  if (!reason) {
    throw new Error("Informe o motivo do ajuste.");
  }

  await runTransaction(db, async (transaction) => {
    const targetRef = doc(db, "users", targetUser.uid);
    const targetSnapshot = await transaction.get(targetRef);

    if (!targetSnapshot.exists()) {
      throw new Error("Usuário alvo não encontrado.");
    }

    const { hash } = await appendPoopcoinTransaction(transaction, {
      type: "admin_adjustment",
      entries: [{ userId: targetUser.uid, delta: amount }],
      amount: Math.abs(amount),
      createdBy: admin.uid,
      createdByRole: admin.role,
      toUserId: amount > 0 ? targetUser.uid : null,
      fromUserId: amount < 0 ? targetUser.uid : null,
      reason,
      supplyEffect:
        amount > 0
          ? {
              mintedDelta: amount,
              circulatingDelta: amount,
              requireMigratedSupply: true,
            }
          : {
              burnedDelta: Math.abs(amount),
              circulatingDelta: amount,
            },
    });

    transaction.update(targetRef, { poopcoinBalance: increment(amount) });
    transaction.set(
      doc(collection(db, "admin_audit_logs")),
      createAuditLogRecord({
        action: "adjust_poopcoins",
        admin,
        targetUser,
        delta: amount,
        poopcoins: amount,
        poopcoinTransactionHash: hash,
      })
    );
  });
}

/**
 * Reversão de transação indevida por Hash
 */
export async function reversePoopcoinTransaction(
  admin: AppUser,
  transactionHash: string,
  reasonValue: string
): Promise<void> {
  const normalizedHash = transactionHash.trim();
  const reason = normalizePoopcoinReason(reasonValue);

  if (!normalizedHash) {
    throw new Error("Informe o hash da transação.");
  }

  if (!reason) {
    throw new Error("Informe o motivo da reversão.");
  }

  await runTransaction(db, async (transaction) => {
    const originalRef = doc(db, "poopcoin_transactions", normalizedHash);
    const originalSnapshot = await transaction.get(originalRef);
    const original = originalSnapshot.data() as PoopcoinTransaction | undefined;

    if (!original) {
      throw new Error("Transação não encontrada no Ledger.");
    }

    if (original.status === "reversed" || original.reversedByTransactionHash) {
      throw new Error("Esta transação já foi revertida anteriormente.");
    }

    if (original.type === "reversal") {
      throw new Error("Transações de reversão não podem ser revertidas.");
    }

    const inverseEntries = original.entries.map((entry) => ({
      userId: entry.userId,
      delta: -entry.delta,
    }));

    const { hash } = await appendPoopcoinTransaction(transaction, {
      type: "reversal",
      entries: inverseEntries,
      amount: original.amount,
      createdBy: admin.uid,
      createdByRole: admin.role,
      reversesTransactionHash: original.hash,
      fromUserId: original.toUserId ?? null,
      toUserId: original.fromUserId ?? null,
      linkedLogId: original.linkedLogId ?? null,
      linkedPostId: original.linkedPostId ?? null,
      reason,
      supplyEffect: reversalSupplyEffect(original),
    });

    inverseEntries.forEach((entry) => {
      transaction.update(doc(db, "users", entry.userId), {
        poopcoinBalance: increment(entry.delta),
      });
    });
    transaction.update(originalRef, {
      status: "reversed",
      reversedByTransactionHash: hash,
    });
    transaction.set(
      doc(collection(db, "admin_audit_logs")),
      createAuditLogRecord({
        action: "reverse_poopcoin_transaction",
        admin,
        delta: 0,
        poopcoins: original.amount,
        poopcoinTransactionHash: hash,
      })
    );
  });
}

/**
 * Recálculo atômico de todo o supply da plataforma
 */
export async function recalculatePoopcoinSupply(admin: AppUser): Promise<PoopcoinSupplySummary> {
  const [usersSnapshot, latestTransactionSnapshot] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(query(poopcoinTransactionsRef, orderBy("sequence", "desc"), limit(1))),
  ]);
  const latestTransaction = latestTransactionSnapshot.docs[0]?.data() as PoopcoinTransaction | undefined;
  const walletSupply = usersSnapshot.docs.reduce((sum, userDoc) => {
    const userData = userDoc.data() as Pick<AppUser, "poopcoinBalance">;
    const balance = Number(userData.poopcoinBalance ?? 0);
    return sum + (Number.isFinite(balance) ? Math.max(0, Math.trunc(balance)) : 0);
  }, 0);
  const now = Timestamp.now();
  const circulatingSupply = Math.min(POOPCOIN_TOTAL_SUPPLY, walletSupply);
  const normalizedSummary: PoopcoinSupplySummary = {
    totalSupply: POOPCOIN_TOTAL_SUPPLY,
    mintedSupply: circulatingSupply,
    burnedSupply: 0,
    circulatingSupply,
    availableSupply: Math.max(0, POOPCOIN_TOTAL_SUPPLY - circulatingSupply),
    supplyMigratedAt: now,
  };

  await runTransaction(db, async (transaction) => {
    const headSnapshot = await transaction.get(poopcoinChainHeadRef);
    const headData = headSnapshot.data();
    const headSequence = Math.max(0, Math.trunc(Number(headData?.lastSequence ?? 0)));
    const latestSequence = Math.max(0, Math.trunc(Number(latestTransaction?.sequence ?? 0)));
    const lastHash =
      latestTransaction && latestSequence > headSequence
        ? latestTransaction.hash
        : String(headData?.lastHash ?? latestTransaction?.hash ?? GENESIS_HASH);
    const { availableSupply, ...headSupplyFields } = normalizedSummary;
    transaction.set(
      poopcoinChainHeadRef,
      {
        ...headSupplyFields,
        lastHash,
        lastSequence: Math.max(headSequence, latestSequence),
        updatedAt: now,
      },
      { merge: true }
    );
    transaction.set(
      doc(collection(db, "admin_audit_logs")),
      createAuditLogRecord({
        action: "recalculate_poopcoin_supply",
        admin,
        delta: normalizedSummary.mintedSupply,
        poopcoins: normalizedSummary.mintedSupply,
      })
    );
  });

  return normalizedSummary;
}

/**
 * Migração retroativa de moedas para registros antigos
 */
export async function migratePoopcoinsForLogs(admin: AppUser, logs: PoopLog[]): Promise<number> {
  const settings = await fetchPoopcoinSettings();
  const poopcoinsPerLog = settings.poopcoinsPerLog || 1;
  const pendingLogs = logs
    .filter((log) => !log.poopcoinTransactionHash && log.poopcoinsEarned == null && log.userId && log.id)
    .slice(0, 25);
  let processed = 0;
  let minted = 0;

  for (const log of pendingLogs) {
    if (!log.id) continue;
    let processedLog = false;
    let mintedForLog = 0;

    await runTransaction(db, async (transaction) => {
      const logRef = doc(db, "poop_logs", log.id!);
      const userRef = doc(db, "users", log.userId);
      const [logSnapshot, userSnapshot, headSnapshot] = await Promise.all([
        transaction.get(logRef),
        transaction.get(userRef),
        transaction.get(poopcoinChainHeadRef),
      ]);
      const latestLog = logSnapshot.data() as PoopLog | undefined;
      const targetUser = userSnapshot.data() as AppUser | undefined;

      if (!latestLog || latestLog.poopcoinTransactionHash || latestLog.poopcoinsEarned != null || !targetUser) {
        return;
      }

      const summary = parsePoopcoinSupplySummary(headSnapshot.data() as Record<string, unknown> | undefined);
      const poopcoinsEarned = summary.availableSupply >= poopcoinsPerLog ? poopcoinsPerLog : 0;

      const poopcoinTransaction =
        poopcoinsEarned > 0
          ? await appendPoopcoinTransaction(transaction, {
              type: "legacy_mint",
              entries: [{ userId: log.userId, delta: poopcoinsEarned }],
              amount: poopcoinsEarned,
              createdBy: admin.uid,
              createdByRole: admin.role,
              toUserId: log.userId,
              linkedLogId: log.id,
              createdAt: latestLog.createdAt ?? Timestamp.now(),
              reason: "Migração inicial de logs antigos.",
              supplyEffect: {
                mintedDelta: poopcoinsEarned,
                circulatingDelta: poopcoinsEarned,
                requireMigratedSupply: true,
              },
            })
          : null;

      transaction.update(logRef, {
        poopcoinTransactionHash: poopcoinTransaction?.hash ?? null,
        poopcoinsEarned,
      });
      transaction.update(userRef, {
        ...(poopcoinsEarned > 0 ? { poopcoinBalance: increment(poopcoinsEarned) } : {}),
      });
      processedLog = true;
      mintedForLog = poopcoinsEarned;
    });

    if (processedLog) {
      processed += 1;
      minted += mintedForLog;
    }
  }

  if (processed > 0) {
    await runTransaction(db, async (transaction) => {
      transaction.set(
        doc(collection(db, "admin_audit_logs")),
        createAuditLogRecord({
          action: "migrate_poopcoins",
          admin,
          delta: processed,
          poopcoins: minted,
        })
      );
    });
  }

  return processed;
}
