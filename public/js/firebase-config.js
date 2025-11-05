/* ============================================
   FIREBASE CONFIGURATION
   AJUPAM PAGER - Configuración del Cliente
   ============================================ */
// Configurar debug token para App Check
   if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
       self.FIREBASE_APPCHECK_DEBUG_TOKEN = 'TU_DEBUG_TOKEN_AQUI';
   }
   
// Configuración Firebase - AJUPAM Pager
const firebaseConfig = {
    apiKey: "AIzaSyC7qu6Egw1VFV76QIfmK-AQBKLqrmIAonc",
    authDomain: "ajupam-pager.firebaseapp.com",
    projectId: "ajupam-pager",
    storageBucket: "ajupam-pager.firebasestorage.app",
    messagingSenderId: "580303243943",
    appId: "1:580303243943:web:53becd2e3e4424cb1ba982"
};

// VAPID Key para Cloud Messaging
const vapidKey = "BDvXtlHcZfdSathkkJEk9N6WcHqtz5x7lVcmzQw4hNObLfhcW8XfS63UEKmRY-3JDWBLYGr5Lr7C4IqDkvJBSvA";

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias a los servicios
const auth = firebase.auth();
const db = firebase.firestore();
const messaging = firebase.messaging();

// Configurar persistencia de Firestore (sin deprecation warning)
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Persistencia no disponible: múltiples pestañas abiertas');
        } else if (err.code === 'unimplemented') {
            console.warn('Persistencia no disponible en este navegador');
        }
    });

// Función para solicitar permisos de notificación
async function solicitarPermisosNotificacion() {
    try {
        // Verificar si el navegador soporta notificaciones
        if (!('Notification' in window)) {
            console.warn('Este navegador no soporta notificaciones');
            return null;
        }

        // Verificar estado actual del permiso
        if (Notification.permission === 'granted') {
            console.log('✅ Permisos de notificación ya otorgados');
            return await obtenerTokenFCM();
        } else if (Notification.permission === 'denied') {
            console.warn('⚠️ Permisos de notificación bloqueados por el usuario');
            console.warn('👉 Para habilitar: Haz clic en el candado 🔒 junto a la URL → Permisos → Notificaciones → Permitir');
            return null;
        } else {
            // Permiso no solicitado aún (default)
            console.log('📋 Solicitando permisos de notificación...');
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                console.log('✅ Permisos otorgados');
                return await obtenerTokenFCM();
            } else {
                console.warn('⚠️ Usuario rechazó los permisos de notificación');
                return null;
            }
        }
    } catch (error) {
        console.error('❌ Error al solicitar permisos:', error);
        return null;
    }
}

// Función para obtener token FCM
async function obtenerTokenFCM() {
    try {
        const currentToken = await messaging.getToken({ vapidKey: vapidKey });
        
        if (currentToken) {
            console.log('✅ Token FCM obtenido:', currentToken.substring(0, 20) + '...');
            // Guardar token en variable global para usar en app.js
            window.fcmToken = currentToken;
            return currentToken;
        } else {
            console.warn('⚠️ No se pudo obtener token FCM');
            return null;
        }
    } catch (error) {
        if (error.code === 'messaging/permission-blocked') {
            console.warn('⚠️ Permisos de notificación bloqueados');
            console.warn('👉 Solución:');
            console.warn('   1. Haz clic en el candado 🔒 (izquierda de la URL)');
            console.warn('   2. Ve a "Configuración del sitio" o "Permisos"');
            console.warn('   3. Cambia "Notificaciones" de "Bloquear" a "Permitir"');
            console.warn('   4. Recarga la página (F5)');
        } else {
            console.error('❌ Error al obtener token FCM:', error.message);
        }
        return null;
    }
}

// NO solicitar permisos automáticamente al cargar
// Los permisos se solicitarán cuando el usuario escanee un QR o intente suscribirse
console.log('🔥 Firebase inicializado correctamente - AJUPAM Pager');
console.log('📱 Para recibir notificaciones, escanea un código QR de cancha');

// Exponer función globalmente para que app.js pueda usarla
window.solicitarPermisosNotificacion = solicitarPermisosNotificacion;
window.obtenerTokenFCM = obtenerTokenFCM;

// Manejar mensajes cuando la app está en primer plano
messaging.onMessage((payload) => {
    console.log('📨 Mensaje recibido en primer plano:', payload);
    
    const notificationTitle = payload.notification?.title || 'AJUPAM Pager';
    const notificationOptions = {
        body: payload.notification?.body || 'Nueva notificación',
        icon: '/pager/icons/icon-192.png',
        badge: '/pager/icons/icon-72.png',
        tag: 'ajupam-notification',
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: payload.data
    };
    
    // Mostrar notificación si hay permisos
    if (Notification.permission === 'granted') {
        new Notification(notificationTitle, notificationOptions);
    }
    
    // También mostrar un toast en la app si la función existe
    if (typeof showToast === 'function') {
        showToast(payload.notification?.body || 'Nueva notificación', 'success');
    }
});

// Detectar cambios en el estado del Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
        console.log('✅ Service Worker listo:', registration.scope);
    }).catch((error) => {
        console.error('❌ Error con Service Worker:', error);
    });
}
