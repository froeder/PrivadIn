/**
 * Push de "usuário X pontuou": dispara quando um documento é criado em poop_logs
 * e envia notificação (Expo Push) para todos os usuários ativos, exceto o autor.
 *
 * Os tokens ficam em user_private/{uid}.expoPushTokens (somente o dono lê/escreve;
 * o Admin SDK desta função ignora as regras).
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

async function notifyScored(databaseId, event) {
  const log = event.data && event.data.data();
  if (!log || !log.userId) return;

  const db = getFirestore(databaseId === "(default)" ? undefined : databaseId);
  const authorId = log.userId;
  const authorName = String(log.userName || "Um colega").slice(0, 60);
  const points = Number(log.points) || 0;

  const [privateSnap, inactiveSnap] = await Promise.all([
    db.collection("user_private").get(),
    db.collection("users").where("isActive", "==", false).get(),
  ]);

  const inactive = new Set(inactiveSnap.docs.map((d) => d.id));
  const tokenOwners = new Map(); // token -> uid

  privateSnap.docs.forEach((d) => {
    if (d.id === authorId || inactive.has(d.id)) return;
    const tokens = d.get("expoPushTokens");
    if (!Array.isArray(tokens)) return;
    tokens.filter(isExpoToken).forEach((t) => tokenOwners.set(t, d.id));
  });

  const tokens = [...tokenOwners.keys()];
  if (tokens.length === 0) return;

  const body = points > 0
    ? `${authorName} acabou de pontuar! +${points} pts 🚽`
    : `${authorName} acabou de pontuar! 🚽`;

  const invalid = [];

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    const messages = chunk.map((to) => ({
      to,
      title: "💩 Alguém pontuou!",
      body,
      sound: "default",
      channelId: "scores",
      data: { type: "poop_scored", userId: authorId },
    }));

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

  // Limpa tokens inválidos
  await Promise.all(
    invalid.map((token) =>
      db
        .collection("user_private")
        .doc(tokenOwners.get(token))
        .set({ expoPushTokens: FieldValue.arrayRemove(token) }, { merge: true })
    )
  );

  logger.info(`Push de pontuação enviado: ${tokens.length} tokens, ${invalid.length} inválidos`);
}

// Produção: banco "(default)"
exports.notifyPoopScoredProd = onDocumentCreated(
  { document: "poop_logs/{logId}", database: "(default)", region: "southamerica-east1" },
  (event) => notifyScored("(default)", event)
);

// Homologação: banco "dev-privadin"
exports.notifyPoopScoredDev = onDocumentCreated(
  { document: "poop_logs/{logId}", database: "dev-privadin", region: "southamerica-east1" },
  (event) => notifyScored("dev-privadin", event)
);
