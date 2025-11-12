/**
 * 🔥 AJUPAM Pager — sendNotification (Firebase Cloud Messaging HTTP v1)
 * Cloud Functions v2 (Node.js 20+)
 * Envía notificaciones FCM a los tokens suscriptos desde el panel admin.
 */

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: "https://canchas.ajupam.ar" });

// Inicializa Firebase Admin (usa las credenciales del servicio automático)
admin.initializeApp();

exports.sendNotification = onRequest({ region: "us-central1" }, (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.set("Access-Control-Allow-Origin", "https://canchas.ajupam.ar");
        return res.status(405).send("Method Not Allowed");
      }

      const { tokens, title, body, courtId } = req.body;

      if (!Array.isArray(tokens) || tokens.length === 0) {
        logger.warn("Solicitud sin tokens válidos:", req.body);
        res.set("Access-Control-Allow-Origin", "https://canchas.ajupam.ar");
        return res.status(400).send("No tokens provided");
      }

      logger.info(`📤 Enviando notificación a ${tokens.length} tokens`);

      // Enviar notificación a cada token individualmente con su token en data
      const messages = tokens.map(token => ({
        notification: {
          title: title || "Notificación AJUPAM",
          body: body || "Hay una actualización disponible"
        },
        data: {
          courtId: courtId || "",
          token: token  // ✨ Incluir el token para que el SW pueda guardar la notificación
        },
        token
      }));

      const response = await admin.messaging().sendEach(messages);

      logger.info("✅ Notificaciones enviadas:", response.successCount);
      logger.info("❌ Fallidas:", response.failureCount);

      // 🧹 Limpieza de tokens inválidos
      if (response.failureCount > 0 && courtId) {
        const invalidTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            // Códigos de error que indican tokens inválidos/expirados
            if (
              errorCode === "messaging/invalid-registration-token" ||
              errorCode === "messaging/registration-token-not-registered"
            ) {
              invalidTokens.push(tokens[idx]);
              logger.warn(`🗑️ Token inválido detectado: ${tokens[idx].substring(0, 20)}...`);
            }
          }
        });

        // Eliminar tokens inválidos de Firestore
        if (invalidTokens.length > 0) {
          const db = admin.firestore();
          const subscribersRef = db.collection("courts").doc(courtId).collection("subscribers");

          for (const token of invalidTokens) {
            const snapshot = await subscribersRef.where("token", "==", token).get();
            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
          }

          logger.info(`🧹 Limpiados ${invalidTokens.length} tokens inválidos de la BD`);
        }
      }

      res.set("Access-Control-Allow-Origin", "https://canchas.ajupam.ar");
      res.status(200).send(response);
    } catch (err) {
      logger.error("💥 Error interno en sendNotification:", err);
      res.set("Access-Control-Allow-Origin", "https://canchas.ajupam.ar");
      res.status(500).send(err.message || err);
    }
  });
});
