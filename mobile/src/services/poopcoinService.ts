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
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  AppUser,
  PoopcoinSupplySummary,
  PoopcoinTransaction,
  PoopcoinTransactionEntry,
} from "../types";
import { canonicalJson, randomNonce, sha256Hex } from "./cryptoUtils";

export const poopcoinTransactionsRef = collection(db, "poopcoin_transactions");
export const poopcoinChainHeadRef = doc(db, "poopcoin_chain", "head");
export const usersRef = collection(db, "users");
export const appSettingsRef = doc(db, "app_settings", "global");

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
