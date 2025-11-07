/* ============================================================
   🔥 Firebase Messaging Service Worker — AJUPAM Pager
   ============================================================ */

importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

// 🔧 Configuración del proyecto (igual que en firebase-config.js)
firebase.initializeApp({
  apiKey: "AIzaSyC7qu6Egw1VFV76QIfmK-AQBKLqrmIAonc",
  authDomain: "ajupam-pager.firebaseapp.com",
  projectId: "ajupam-pager",
  storageBucket: "ajupam-pager.firebasestorage.app",
  messagingSenderId: "580303243943",
  appId: "1:580303243943:web:54ceadac85f50a741ba982"
});

// Inicializamos Messaging
const messaging = firebase.messaging();

// Escucha los mensajes en segundo plano (cuando la app está cerrada o en otra pestaña)
messaging.onBackgroundMessage((payload) => {
  console.log("📨 [SW] Mensaje recibido en segundo plano:", payload);
  console.log("📨 [SW] Notification data:", payload.notification);
  console.log("📨 [SW] Custom data:", payload.data);

  const notificationTitle = payload.notification?.title || "Notificación AJUPAM";
  const notificationOptions = {
    body: payload.notification?.body || "Hay una actualización disponible.",
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

  console.log("🔔 [SW] Mostrando notificación:", notificationTitle);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

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
