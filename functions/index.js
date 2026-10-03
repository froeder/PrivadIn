/**
 * Push de notificações do PrivadIn (Expo Push API):
 * 1. "usuário X pontuou": dispara quando um documento é criado em poop_logs (para todos os ativos, exceto o autor).
 * 2. "reset semanal": dispara quando um documento é criado em editions (para todos os ativos informando quem ganhou).
 *
 * Os tokens ficam em user_private/{uid}.expoPushTokens (somente o dono lê/escreve;
 * o Admin SDK desta função ignora as regras do Firestore).
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

function isExpoToken(token) {
  return typeof token === "string" && /^(Exponent|Expo)PushToken\[.+\]$/.test(token);
}

async function sendExpoPush(db, tokens, tokenOwners, buildMessageFn) {
  if (!tokens || tokens.length === 0) return;

  const invalid = [];

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    const messages = chunk.map((to) => buildMessageFn(to));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      const json = await res.json();
      (json.data || []).forEach((ticket, idx) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          invalid.push(chunk[idx]);
        }
      });
    } catch (err) {
      logger.error("Falha ao enviar lote de push", err);
    }
  }

  if (invalid.length > 0) {
    await Promise.all(
      invalid.map((token) => {
        const uid = tokenOwners.get(token);
        if (!uid) return Promise.resolve();
        return db
          .collection("user_private")
          .doc(uid)
          .set({ expoPushTokens: FieldValue.arrayRemove(token) }, { merge: true });
      })
    );
  }

  logger.info(`Push enviado com sucesso: ${tokens.length} tokens, ${invalid.length} inválidos.`);
}

async function getActiveUserTokens(db, excludeUserId = null) {
  const [privateSnap, inactiveSnap] = await Promise.all([
    db.collection("user_private").get(),
    db.collection("users").where("isActive", "==", false).get(),
  ]);

  const inactive = new Set(inactiveSnap.docs.map((d) => d.id));
  const tokenOwners = new Map(); // token -> uid

  privateSnap.docs.forEach((d) => {
    if (inactive.has(d.id)) return;
    if (excludeUserId && d.id === excludeUserId) return;
    const tokens = d.get("expoPushTokens");
    if (!Array.isArray(tokens)) return;
    tokens.filter(isExpoToken).forEach((t) => tokenOwners.set(t, d.id));
  });

  return {
    tokens: [...tokenOwners.keys()],
    tokenOwners,
  };
}

async function notifyScored(databaseId, event) {
  const log = event.data && event.data.data();
  if (!log || !log.userId) return;

  const db = getFirestore(databaseId === "(default)" ? undefined : databaseId);
  const authorId = log.userId;
  const authorName = String(log.userName || "Um colega").slice(0, 60);
  const points = Number(log.points) || 0;

  const { tokens, tokenOwners } = await getActiveUserTokens(db, authorId);
  if (tokens.length === 0) return;

  const body = points > 0
    ? `${authorName} acabou de pontuar! +${points} pts 🚽`
    : `${authorName} acabou de pontuar! 🚽`;

  await sendExpoPush(db, tokens, tokenOwners, (to) => ({
    to,
    title: "💩 Alguém pontuou!",
    body,
    sound: "default",
    channelId: "scores",
    data: { type: "poop_scored", userId: authorId },
  }));
}

async function notifyWeeklyReset(databaseId, event) {
  const edition = event.data && event.data.data();
  if (!edition) return;

  const db = getFirestore(databaseId === "(default)" ? undefined : databaseId);
  const roman = edition.romanEdition || String(edition.edition || "");
  const winners = Array.isArray(edition.winnerNames) ? edition.winnerNames.filter(Boolean) : [];

  let body = "";
  if (winners.length > 0) {
    const winnersStr = winners.join(", ");
    body = `O ranking foi resetado! Campeão(ões): ${winnersStr}. A nova disputa começou, vá ao trono pontuar! 🚽🏆`;
  } else {
    body = `O ranking foi resetado para uma nova semana! Quem será o novo campeão do trono? 🚽⚡`;
  }

  const { tokens, tokenOwners } = await getActiveUserTokens(db, null);
  if (tokens.length === 0) return;

  await sendExpoPush(db, tokens, tokenOwners, (to) => ({
    to,
    title: `👑 Edição ${roman} Encerrada!`,
    body,
    sound: "default",
    channelId: "scores",
    data: { type: "weekly_reset", edition: edition.edition },
  }));
}

// 1. Notificação de Pontuação (poop_logs)
exports.notifyPoopScoredProd = onDocumentCreated(
  { document: "poop_logs/{logId}", database: "(default)", region: "us-central1" },
  (event) => notifyScored("(default)", event)
);

exports.notifyPoopScoredDev = onDocumentCreated(
  { document: "poop_logs/{logId}", database: "dev-privadin", region: "us-central1" },
  (event) => notifyScored("dev-privadin", event)
);

// 2. Notificação de Reset Semanal (editions)
exports.notifyWeeklyResetProd = onDocumentCreated(
  { document: "editions/{editionId}", database: "(default)", region: "us-central1" },
  (event) => notifyWeeklyReset("(default)", event)
);

exports.notifyWeeklyResetDev = onDocumentCreated(
  { document: "editions/{editionId}", database: "dev-privadin", region: "us-central1" },
  (event) => notifyWeeklyReset("dev-privadin", event)
);
