import {
  Timestamp,
  addDoc,
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AppUser, CuiterPost } from "../types";

export const CUITER_MAX_CHARS = 50;
export const CUITER_PAGE_SIZE = 10;
export const CUITER_CREDIT_START_DATE = new Date(2026, 4, 27, 0, 0, 0, 0);
export const cuiterPostsRef = collection(db, "cuiter_posts");

type CuiterPageCursor = QueryDocumentSnapshot<DocumentData> | null;

function mapPost(doc: QueryDocumentSnapshot<DocumentData>) {
  return { id: doc.id, ...doc.data() } as CuiterPost;
}

export async function fetchCuiterPostsPage(cursor: CuiterPageCursor, pageSize = CUITER_PAGE_SIZE) {
  const baseQuery = query(cuiterPostsRef, orderBy("createdAt", "desc"), limit(pageSize));
  const paginatedQuery = cursor ? query(cuiterPostsRef, orderBy("createdAt", "desc"), startAfter(cursor), limit(pageSize)) : baseQuery;
  const snapshot = await getDocs(paginatedQuery);
  const docs = snapshot.docs;
  return {
    posts: docs.map(mapPost),
    nextCursor: docs.length > 0 ? docs[docs.length - 1] : cursor,
    hasMore: docs.length === pageSize,
  };
}

export async function countUserCuiterPosts(uid: string) {
  const snapshot = await getCountFromServer(
    query(
      cuiterPostsRef,
      where("userId", "==", uid),
      where("createdAt", ">=", Timestamp.fromDate(CUITER_CREDIT_START_DATE)),
    ),
  );
  return snapshot.data().count;
}

export function isCuiterCreditEligibleLog(createdAtMs: number) {
  return createdAtMs >= CUITER_CREDIT_START_DATE.getTime();
}

export function getCuiterAvailableCredits(userLogsCount: number, userPostsCount: number) {
  return Math.max(0, userLogsCount - userPostsCount);
}

export function canPostOnCuiter(user: AppUser, userLogsCount: number, userPostsCount: number) {
  if (!user.lastLogAt) return false;
  return getCuiterAvailableCredits(userLogsCount, userPostsCount) > 0;
}

export async function createCuiterPost(
  user: AppUser,
  message: string,
  userLogsCount: number,
  userPostsCount: number,
) {
  if (!user.lastLogAt) {
    throw new Error("Para publicar no Cuiter, registre uma cagada primeiro.");
  }

  if (!canPostOnCuiter(user, userLogsCount, userPostsCount)) {
    throw new Error("Clique em Registrar cagada novamente para liberar um novo post.");
  }

  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    throw new Error("Escreva uma frase curta antes de publicar.");
  }

  if ([...normalizedMessage].length > CUITER_MAX_CHARS) {
    throw new Error(`A mensagem pode ter no maximo ${CUITER_MAX_CHARS} caracteres.`);
  }

  const createdAt = Timestamp.now();
  const docRef = await addDoc(cuiterPostsRef, {
    userId: user.uid,
    userName: user.nickname?.trim() || user.name,
    message: normalizedMessage,
    createdAt,
  });
  return {
    id: docRef.id,
    userId: user.uid,
    userName: user.nickname?.trim() || user.name,
    message: normalizedMessage,
    createdAt,
  } as CuiterPost;
}
