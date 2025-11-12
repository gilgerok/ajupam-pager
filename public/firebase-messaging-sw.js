/* ============================================================
   🔥 Firebase Messaging Service Worker — Playoffs Liga Ajupam
   ============================================================ */

importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore-compat.js");

// 🔧 Configuración del proyecto (igual que en firebase-config.js)
firebase.initializeApp({
  apiKey: "AIzaSyC7qu6Egw1VFV76QIfmK-AQBKLqrmIAonc",
  authDomain: "ajupam-pager.firebaseapp.com",
  projectId: "ajupam-pager",
  storageBucket: "ajupam-pager.firebasestorage.app",
  messagingSenderId: "580303243943",
  appId: "1:580303243943:web:54ceadac85f50a741ba982"
});

// Inicializamos Messaging y Firestore
const messaging = firebase.messaging();
const db = firebase.firestore();

// Escucha los mensajes en segundo plano (cuando la app está cerrada o en otra pestaña)
messaging.onBackgroundMessage(async (payload) => {
  console.log("📨 [SW] Mensaje recibido en segundo plano:", payload);
  console.log("📨 [SW] Notification data:", payload.notification);
  console.log("📨 [SW] Custom data:", payload.data);

  const notificationTitle = payload.notification?.title || "Playoffs Liga Ajupam";
  const notificationBody = payload.notification?.body || "Hay una actualización disponible.";
  const notificationOptions = {
    body: notificationBody,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-72.png",
    data: payload.data || {},
    vibrate: [200, 100, 200],
    tag: 'ajupam-notification',
    requireInteraction: false,
    actions: [
      { action: "open_app", title: "Abrir" }
    ]
  };

  // 💾 Guardar notificación en Firestore
  try {
    const token = localStorage.getItem("fcm_token");
    if (token) {
      await db.collection("notifications").doc(token).collection("messages").add({
        title: notificationTitle,
        body: notificationBody,
        data: payload.data || {},
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      });
      console.log("✅ [SW] Notificación guardada en Firestore");

      // Actualizar badge del navegador
      if (self.registration && 'setAppBadge' in navigator) {
        const unreadCount = await getUnreadCount(token);
        await navigator.setAppBadge(unreadCount);
      }
    }
  } catch (error) {
    console.error("❌ [SW] Error guardando notificación:", error);
  }

  console.log("🔔 [SW] Mostrando notificación:", notificationTitle);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Helper para obtener cantidad de notificaciones no leídas
async function getUnreadCount(token) {
  try {
    const snapshot = await db.collection("notifications").doc(token).collection("messages")
      .where("read", "==", false)
      .get();
    return snapshot.size;
  } catch (error) {
    console.error("❌ Error obteniendo count:", error);
    return 0;
  }
}

// ✅ Control de clientes y logs
self.addEventListener("activate", (event) => {
  console.log("🔥 Service Worker ahora controla todas las pestañas");
  event.waitUntil(self.clients.claim());
});

// Permite que los clics en notificaciones abran la app
self.addEventListener("notificationclick", (event) => {
  console.log("🖱️ Notificación clickeada:", event.notification);
  event.notification.close();

  // Si ya hay una pestaña abierta con la app, la enfoca
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes("https://canchas.ajupam.ar") && "focus" in client) {
          return client.focus();
        }
      }
      // Si no hay pestaña abierta, la abre
      if (clients.openWindow) {
        return clients.openWindow("https://canchas.ajupam.ar");
      }
    })
  );
});
