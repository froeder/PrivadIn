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
  deleteDoc,
  deleteField,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { AppUser, CuiterComment, CuiterPost, CuiterReactionType, PoopcoinTransactionEntry } from "../types";
import { canonicalJson, randomNonce, sha256Hex } from "./cryptoUtils";
import {
  appSettingsRef,
  GENESIS_HASH,
  poopcoinChainHeadRef,
  formatPoopcoins,
} from "./poopcoinService";

export const CUITER_MAX_CHARS = 80;
export const DEFAULT_CUITER_POST_COST = 1;
export const cuiterPostsRef = collection(db, "cuiter_posts");

export function formatTimeAgo(value: any): string {
  if (!value) return "agora";
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (typeof value?.toMillis === "function") {
    date = new Date(value.toMillis());
  } else if (typeof value === "number") {
    date = new Date(value);
  } else {
    return "recentemente";
  }

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  if (diffSec < 45) return "agora";
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `há ${mins} min`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `há ${hours} h`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month} às ${hours}:${mins}`;
}

export function subscribeCuiterFeed(
  callback: (posts: CuiterPost[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(cuiterPostsRef, orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const posts: CuiterPost[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId || "",
          userName: data.userName || "Cagador",
          userNickname: data.userNickname,
          userBadge: data.userBadge,
          userTitle: data.userTitle,
          message: data.message || "",
          createdAt: data.createdAt,
          poopcoinTransactionHash: data.poopcoinTransactionHash,
          reactions: data.reactions || {},
          commentsCount: data.commentsCount || 0,
        };
      });
      callback(posts);
    },
    (error) => {
      console.error("Erro no listener do feed do Cuiter:", error);
      onError?.(error);
    }
  );
}

export async function fetchCuiterPostCost(): Promise<number> {
  try {
    const snap = await getDoc(appSettingsRef);
    if (!snap.exists()) return DEFAULT_CUITER_POST_COST;
    const cost = Number(snap.data()?.cuiterPostCost);
    return Number.isFinite(cost) && cost > 0 ? cost : DEFAULT_CUITER_POST_COST;
  } catch (error) {
    console.error("Erro ao buscar custo do post Cuiter:", error);
    return DEFAULT_CUITER_POST_COST;
  }
}

export async function createCuiterPost(
  user: AppUser,
  message: string
): Promise<CuiterPost> {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    throw new Error("Escreva algo para postar no Cuiter.");
  }
  if (normalizedMessage.length > CUITER_MAX_CHARS) {
    throw new Error(`O pensamento deve ter no máximo ${CUITER_MAX_CHARS} caracteres.`);
  }

  const cuiterPostCost = await fetchCuiterPostCost();
  const currentBalance = Number(user.poopcoinBalance ?? 0);
  if (currentBalance < cuiterPostCost) {
    throw new Error(
      `Saldo insuficiente. Postar no Cuiter custa ${formatPoopcoins(cuiterPostCost)} PC (você tem ${formatPoopcoins(currentBalance)} PC).`
    );
  }

  const newPostRef = doc(cuiterPostsRef);
  let resultingHash = "";

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", user.uid);
    const [userSnapshot, headSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(poopcoinChainHeadRef),
    ]);

    const userData = userSnapshot.data() as AppUser | undefined;
    if (!userData || userData.isActive === false) {
      throw new Error("Seu usuário não está ativo para postar.");
    }

    const liveBalance = Number(userData.poopcoinBalance ?? 0);
    if (liveBalance < cuiterPostCost) {
      throw new Error(
        `Saldo insuficiente. Seu saldo atual é de ${formatPoopcoins(liveBalance)} PC.`
      );
    }

    const previousHash = String(headSnapshot.data()?.lastHash ?? GENESIS_HASH);
    const previousSequence = Number(headSnapshot.data()?.lastSequence ?? 0);
    const sequence = Math.max(0, Math.trunc(previousSequence)) + 1;
    const createdAt = Timestamp.now();
    const nonce = randomNonce();
    const entries: PoopcoinTransactionEntry[] = [
      { userId: user.uid, delta: -cuiterPostCost },
    ];
    const affectedUserIds = [user.uid];
    const role = (userData.role === "admin" ? "admin" : "player") as "player" | "admin";
    const reason = "Publicação no Cuiter";

    const unsignedPayload = {
      previousHash,
      sequence,
      createdAt,
      type: "cuiter_spend",
      entries,
      affectedUserIds,
      fromUserId: user.uid,
      toUserId: null,
      amount: cuiterPostCost,
      createdBy: user.uid,
      createdByRole: role,
      status: "active",
      reversesTransactionHash: null,
      linkedLogId: null,
      linkedPostId: newPostRef.id,
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
      amount: cuiterPostCost,
      createdBy: user.uid,
      createdByRole: role,
      status: "active",
      reversesTransactionHash: null,
      reversedByTransactionHash: null,
      linkedLogId: null,
      linkedPostId: newPostRef.id,
      reason,
      nonce,
    };

    // 1. Grava o bloco da transação
    transaction.set(doc(db, "poopcoin_transactions", hash), transactionData);

    // 2. Atualiza a cabeça da cadeia (queima as moedas)
    const currentBurned = Number(headSnapshot.data()?.burnedSupply ?? 0);
    const currentCirculating = Number(headSnapshot.data()?.circulatingSupply ?? 0);
    transaction.set(
      poopcoinChainHeadRef,
      {
        lastHash: hash,
        lastSequence: sequence,
        updatedAt: createdAt,
        burnedSupply: currentBurned + cuiterPostCost,
        circulatingSupply: Math.max(0, currentCirculating - cuiterPostCost),
      },
      { merge: true }
    );

    // 3. Atualiza o saldo do usuário
    transaction.update(userRef, {
      poopcoinBalance: increment(-cuiterPostCost),
    });

    // 4. Cria o post
    const postUserName = userData.nickname?.trim() || userData.name || "Cagador Anônimo";
    transaction.set(newPostRef, {
      userId: user.uid,
      userName: postUserName,
      userNickname: userData.nickname?.trim() || "",
      userBadge: userData.equippedBadge || "",
      userTitle: userData.equippedTitle || "",
      message: normalizedMessage,
      createdAt,
      poopcoinTransactionHash: hash,
      reactions: {},
      commentsCount: 0,
    });
  });

  return {
    id: newPostRef.id,
    userId: user.uid,
    userName: user.nickname?.trim() || user.name || "Cagador Anônimo",
    userNickname: user.nickname?.trim() || "",
    userBadge: user.equippedBadge || "",
    userTitle: user.equippedTitle || "",
    message: normalizedMessage,
    createdAt: Timestamp.now(),
    poopcoinTransactionHash: resultingHash,
    reactions: {},
    commentsCount: 0,
  };
}

export async function togglePostReaction(
  postId: string,
  userId: string,
  reactionType: CuiterReactionType
): Promise<void> {
  const postRef = doc(db, "cuiter_posts", postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) return;

  const postData = postSnap.data() as CuiterPost;
  const currentReaction = postData.reactions?.[userId];

  if (currentReaction === reactionType) {
    // Desmarcar reação (toggle off)
    await updateDoc(postRef, {
      [`reactions.${userId}`]: deleteField(),
    });
  } else {
    // Atribuir nova reação
    await updateDoc(postRef, {
      [`reactions.${userId}`]: reactionType,
    });
  }
}

export async function fetchUserCuiterPosts(
  userId: string,
  limitCount = 10
): Promise<CuiterPost[]> {
  try {
    const q = query(
      cuiterPostsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as CuiterPost));
  } catch (error) {
    console.error("Erro ao buscar posts do usuário:", error);
    return [];
  }
}

export async function fetchUserProfile(userId: string): Promise<AppUser | null> {
  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) return null;
    return {
      uid: snap.id,
      ...snap.data(),
    } as AppUser;
  } catch (error) {
    console.error("Erro ao buscar perfil do usuário:", error);
    return null;
  }
}

export async function deleteCuiterPost(postId: string): Promise<void> {
  // Apaga o documento principal do post
  await deleteDoc(doc(db, "cuiter_posts", postId));
}

export function subscribeCuiterComments(
  postId: string,
  callback: (comments: CuiterComment[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const commentsRef = collection(db, "cuiter_posts", postId, "comments");
  const q = query(commentsRef, orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const comments: CuiterComment[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          postId,
          userId: data.userId || "",
          userName: data.userName || "Cagador",
          userNickname: data.userNickname,
          userBadge: data.userBadge,
          userTitle: data.userTitle,
          message: data.message || "",
          createdAt: data.createdAt,
          replyToCommentId: data.replyToCommentId || null,
          replyToUserName: data.replyToUserName || null,
        };
      });
      callback(comments);
    },
    (error) => {
      console.error("Erro no listener de comentários do Cuiter:", error);
      onError?.(error);
    }
  );
}

export async function createCuiterComment(
  postId: string,
  user: AppUser,
  message: string,
  replyTo?: { commentId: string; userName: string } | null
): Promise<CuiterComment> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Escreva algo para responder.");
  }
  if (trimmed.length > CUITER_MAX_CHARS) {
    throw new Error(`A resposta deve ter no máximo ${CUITER_MAX_CHARS} caracteres.`);
  }

  const postRef = doc(db, "cuiter_posts", postId);
  const commentsRef = collection(db, "cuiter_posts", postId, "comments");
  const newCommentRef = doc(commentsRef);
  const createdAt = Timestamp.now();

  const commentData: Omit<CuiterComment, "id"> = {
    postId,
    userId: user.uid,
    userName: user.nickname?.trim() || user.name || "Cagador Anônimo",
    userNickname: user.nickname?.trim() || "",
    userBadge: user.equippedBadge || "",
    userTitle: user.equippedTitle || "",
    message: trimmed,
    createdAt,
    replyToCommentId: replyTo?.commentId || null,
    replyToUserName: replyTo?.userName || null,
  };

  await runTransaction(db, async (transaction) => {
    transaction.set(newCommentRef, commentData);
    transaction.update(postRef, {
      commentsCount: increment(1),
    });
  });

  return {
    id: newCommentRef.id,
    ...commentData,
  };
}

export async function deleteCuiterComment(
  postId: string,
  commentId: string
): Promise<void> {
  const postRef = doc(db, "cuiter_posts", postId);
  const commentRef = doc(db, "cuiter_posts", postId, "comments", commentId);

  await runTransaction(db, async (transaction) => {
    transaction.delete(commentRef);
    transaction.update(postRef, {
      commentsCount: increment(-1),
    });
  });
}

/**
 * Alterna curtida rápida (like) em uma postagem do Cuiter.
 */
export async function toggleCuiterPostLike(postId: string, userId: string): Promise<void> {
  await togglePostReaction(postId, userId, "like");
}

/**
 * Adiciona comentário a uma postagem do Cuiter (alias compatível com PWA).
 */
export const addCuiterPostComment = createCuiterComment;

/**
 * Busca os posts recentes do feed do Cuiter em dose única.
 */
export async function fetchCuiterFeed(limitCount = 20): Promise<CuiterPost[]> {
  const q = query(
    cuiterPostsRef,
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as CuiterPost[];
}
