// firebase-config.js — AJUPAM Pager (producción)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging.js";

console.log("🚀 Inicializando Firebase...");

const firebaseConfig = {
  apiKey: "AIzaSyC7qu6Egw1VFV76QIfmK-AQBKLqrmIAonc",
  authDomain: "ajupam-pager.firebaseapp.com",
  projectId: "ajupam-pager",
  storageBucket: "ajupam-pager.firebasestorage.app",
  messagingSenderId: "580303243943",
  appId: "1:580303243943:web:54ceadac85f50a741ba982"
};

// 🔑 VAPID KEY pública de tu proyecto (Firebase Console → Cloud Messaging → Configuración del SDK web)
const VAPID_KEY = "BFjkS5J-gDu-SR9sj-K4zkyAQj1KKhBQg30lZ8CyU_8Y6z8z854QgAfL_u_AFmxt9Cv9TM_9R9QBYckc-ScI9LA";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);

// ✅ Helper: obtener token de notificación con registro SW y permisos
export async function getFCMToken() {
  try {
    console.log("🔑 Solicitando permiso de notificaciones...");
    const permission = await Notification.requestPermission();
    console.log("📋 Permiso actual:", permission);
    if (permission !== "granted") {
      console.warn("Permiso de notificaciones denegado por el usuario");
      return null;
    }

    console.log("🧱 Registrando Service Worker...");
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("📦 SW registrado:", registration);
    console.log("📦 SW state:", registration.active?.state);

    // 🔄 Esperar a que el SW esté activo y controlando la página
    const swReady = await navigator.serviceWorker.ready;
    console.log("🧩 SW listo, obteniendo token...");
    console.log("🧩 SW activo:", swReady.active);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReady
    });

    if (token) {
      console.log("✅ Token FCM obtenido:", token);
      console.log("✅ Longitud del token:", token.length);
      localStorage.setItem("fcm_token", token);
      console.log("💾 Token guardado en localStorage");
    } else {
      console.warn("⚠️ No se obtuvo token FCM");
    }

    return token;
  } catch (error) {
    console.error("❌ Error al obtener token FCM:", error);
    console.error("❌ Error stack:", error.stack);
    return null;
  }
}


// Recepción de mensajes en foreground
onMessage(messaging, async (payload) => {
  console.log("📩 [FOREGROUND] Mensaje recibido:", payload);
  console.log("📩 [FOREGROUND] Notification data:", payload.notification);
  console.log("📩 [FOREGROUND] Custom data:", payload.data);

  const { title, body } = payload.notification || {};

  // 💾 Guardar notificación en Firestore
  try {
    const token = localStorage.getItem("fcm_token");
    if (token) {
      const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js");
      const notifRef = collection(db, "notifications", token, "messages");
      await addDoc(notifRef, {
        title: title || "Notificación AJUPAM",
        body: body || "Hay una actualización disponible.",
        data: payload.data || {},
        timestamp: serverTimestamp(),
        read: false
      });
      console.log("✅ [FOREGROUND] Notificación guardada en Firestore");

      // Disparar evento personalizado para actualizar UI
      window.dispatchEvent(new CustomEvent("newNotification"));
    }
  } catch (error) {
    console.error("❌ [FOREGROUND] Error guardando notificación:", error);
  }

  if (Notification.permission === "granted") {
    console.log("🔔 [FOREGROUND] Mostrando notificación:", title);
    new Notification(title || "Notificación AJUPAM", { body });
  } else {
    console.warn("⚠️ [FOREGROUND] Permiso de notificación no concedido:", Notification.permission);
  }
});

export { db, auth, messaging, VAPID_KEY };
