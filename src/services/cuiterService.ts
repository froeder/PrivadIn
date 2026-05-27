import { Timestamp, addDoc, collection, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import type { AppUser } from "../types";

export const CUITER_MAX_CHARS = 148;
export const cuiterPostsRef = collection(db, "cuiter_posts");

export function cuiterPostsQuery() {
  return query(cuiterPostsRef, orderBy("createdAt", "desc"));
}

export function canPostOnCuiter(user: AppUser) {
  return Boolean(user.lastLogAt);
}

export async function createCuiterPost(user: AppUser, message: string) {
  if (!canPostOnCuiter(user)) {
    throw new Error("Registre uma cagada antes para desbloquear o Cuiter.");
  }

  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    throw new Error("Escreva uma frase curta antes de publicar.");
  }

  if ([...normalizedMessage].length > CUITER_MAX_CHARS) {
    throw new Error(`A mensagem pode ter no maximo ${CUITER_MAX_CHARS} caracteres.`);
  }

  await addDoc(cuiterPostsRef, {
    userId: user.uid,
    userName: user.nickname?.trim() || user.name,
    message: normalizedMessage,
    createdAt: Timestamp.now(),
  });
}
