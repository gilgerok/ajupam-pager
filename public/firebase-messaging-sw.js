/* ============================================
   FIREBASE MESSAGING SERVICE WORKER
   AJUPAM CANCHAS - Notificaciones de Disponibilidad
   ============================================ */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuración Firebase - AJUPAM Pager
const firebaseConfig = {
    apiKey: "AIzaSyC7qu6Egw1VFV76QIfmK-AQBKLqrmIAonc",
    authDomain: "ajupam-pager.firebaseapp.com",
    projectId: "ajupam-pager",
    storageBucket: "ajupam-pager.firebasestorage.app",
    messagingSenderId: "580303243943",
    appId: "1:580303243943:web:53becd2e3e4424cb1ba982"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obtener instancia de Messaging
const messaging = firebase.messaging();

// Manejar mensajes en background
messaging.onBackgroundMessage((payload) => {
    console.log('[Service Worker] Mensaje recibido en background:', payload);
    
    const notificationTitle = payload.notification?.title || 'AJUPAM Canchas';
    const notificationOptions = {
        body: payload.notification?.body || 'Nueva notificación',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: 'ajupam-notification',
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
            url: payload.data?.url || '/',
            courtId: payload.data?.courtId
        }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clic en notificación
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Clic en notificación:', event);
    
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        })
        .then((clientList) => {
            // Buscar si ya hay una ventana abierta
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if ('focus' in client) {
                    return client.focus();
                }
            }
            // Si no, abrir nueva ventana
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Cache de la aplicación para funcionamiento offline
const CACHE_NAME = 'ajupam-canchas-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/firebase-config.js',
    '/js/app.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cache abierto');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('[Service Worker] Error al cachear:', error);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activando...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
