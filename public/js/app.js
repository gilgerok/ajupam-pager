/* ============================================
   AJUPAM CANCHAS - APP PRINCIPAL
   Sistema de Notificaciones de Disponibilidad
   ============================================ */

// Estado global de la aplicación
const AppState = {
    currentUser: null,
    isAdmin: false,
    courts: [],
    subscriptions: [],
    fcmToken: null
};

// Elementos del DOM
const DOM = {
    userView: null,
    adminView: null,
    courtsList: null,
    adminCourtsList: null,
    mySubscriptions: null,
    loginModal: null,
    addCourtModal: null,
    notificationModal: null,
    toastContainer: null
};

// Inicializar DOM
function initDOM() {
    DOM.userView = document.getElementById('user-view');
    DOM.adminView = document.getElementById('admin-view');
    DOM.courtsList = document.getElementById('courts-list');
    DOM.adminCourtsList = document.getElementById('admin-courts-list');
    DOM.mySubscriptions = document.getElementById('my-subscriptions');
    DOM.loginModal = document.getElementById('login-modal');
    DOM.addCourtModal = document.getElementById('add-court-modal');
    DOM.notificationModal = document.getElementById('notification-modal');
    DOM.toastContainer = document.getElementById('toast-container');
}

// ============================================
// UTILIDADES
// ============================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    }[type] || 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showModal(modalElement) {
    modalElement.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function hideModal(modalElement) {
    modalElement.classList.add('hidden');
    document.body.style.overflow = '';
}

function setLoading(element, isLoading) {
    if (isLoading) {
        element.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Cargando...</p>
            </div>
        `;
    }
}

// ============================================
// AUTENTICACIÓN
// ============================================

function setupAuthListeners() {
    // Botón admin
    document.getElementById('admin-btn').addEventListener('click', () => {
        if (AppState.isAdmin) {
            showAdminView();
        } else {
            showModal(DOM.loginModal);
        }
    });
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            hideModal(DOM.loginModal);
            showToast('Sesión iniciada correctamente', 'success');
            AppState.isAdmin = true;
            showAdminView();
        } catch (error) {
            console.error('Error en login:', error);
            showToast('Error al iniciar sesión. Verifica tus credenciales', 'error');
        }
    });
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await auth.signOut();
            AppState.isAdmin = false;
            showUserView();
            showToast('Sesión cerrada', 'info');
        } catch (error) {
            console.error('Error en logout:', error);
        }
    });
    
    // Monitorear estado de autenticación
    auth.onAuthStateChanged((user) => {
        AppState.currentUser = user;
        if (user) {
            console.log('Usuario autenticado:', user.email);
        }
    });
}

// ============================================
// VISTAS
// ============================================

function showUserView() {
    DOM.userView.classList.remove('hidden');
    DOM.adminView.classList.add('hidden');
    loadCourts();
    loadMySubscriptions();
}

function showAdminView() {
    DOM.userView.classList.add('hidden');
    DOM.adminView.classList.remove('hidden');
    loadAdminCourts();
    generateQRCode();
    loadStatistics();
}

// ============================================
// CANCHAS - Vista Usuario
// ============================================

async function loadCourts() {
    setLoading(DOM.courtsList, true);
    
    try {
        const snapshot = await db.collection('courts').orderBy('name').get();
        AppState.courts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderCourts();
    } catch (error) {
        console.error('Error al cargar canchas:', error);
        DOM.courtsList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar las canchas</p>
            </div>
        `;
    }
}

function renderCourts() {
    if (AppState.courts.length === 0) {
        DOM.courtsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-volleyball-ball"></i>
                <p>No hay canchas disponibles aún</p>
            </div>
        `;
        return;
    }
    
    DOM.courtsList.innerHTML = AppState.courts.map(court => {
        const isSubscribed = AppState.subscriptions.includes(court.id);
        const isEnabled = court.enabled !== false;
        
        return `
            <div class="court-card ${isSubscribed ? 'subscribed' : ''} ${!isEnabled ? 'disabled' : ''}" 
                 data-court-id="${court.id}">
                <div class="court-info">
                    <h3 class="court-name">
                        <i class="fas fa-volleyball-ball"></i>
                        ${court.name}
                    </h3>
                    ${court.location ? `<p class="court-location"><i class="fas fa-map-marker-alt"></i> ${court.location}</p>` : ''}
                    <p class="court-status">
                        ${isSubscribed ? '<i class="fas fa-check-circle"></i> Notificaciones activadas' : 
                          !isEnabled ? '<i class="fas fa-ban"></i> Cancha no disponible' :
                          'Toca para activar notificaciones'}
                    </p>
                </div>
                <div class="court-toggle">
                    <label class="toggle" ${!isEnabled ? 'style="opacity:0.5"' : ''}>
                        <input type="checkbox" 
                               ${isSubscribed ? 'checked' : ''} 
                               ${!isEnabled ? 'disabled' : ''}
                               onchange="toggleSubscription('${court.id}', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleSubscription(courtId, subscribe) {
    // Solicitar permisos si no los tiene
    if (subscribe && !AppState.fcmToken) {
        const token = await window.solicitarPermisosNotificacion();
        if (!token) {
            showToast('Debes permitir las notificaciones', 'warning');
            loadCourts(); // Recargar para resetear el toggle
            return;
        }
        AppState.fcmToken = token;
    }
    
    try {
        const court = AppState.courts.find(c => c.id === courtId);
        
        if (subscribe) {
            // Suscribirse
            await db.collection('subscriptions').add({
                courtId: courtId,
                courtName: court.name,
                token: AppState.fcmToken,
                subscribedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            AppState.subscriptions.push(courtId);
            showToast(`Te suscribiste a ${court.name}`, 'success');
        } else {
            // Desuscribirse
            const snapshot = await db.collection('subscriptions')
                .where('courtId', '==', courtId)
                .where('token', '==', AppState.fcmToken)
                .get();
            
            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
            
            AppState.subscriptions = AppState.subscriptions.filter(id => id !== courtId);
            showToast(`Te desuscribiste de ${court.name}`, 'info');
        }
        
        renderCourts();
        loadMySubscriptions();
        
    } catch (error) {
        console.error('Error al cambiar suscripción:', error);
        showToast('Error al actualizar la suscripción', 'error');
        loadCourts(); // Recargar para resetear el estado
    }
}

async function loadMySubscriptions() {
    if (!AppState.fcmToken) {
        DOM.mySubscriptions.innerHTML = '<p class="empty-state">Activá una cancha para ver tus suscripciones</p>';
        return;
    }
    
    try {
        const snapshot = await db.collection('subscriptions')
            .where('token', '==', AppState.fcmToken)
            .get();
        
        if (snapshot.empty) {
            DOM.mySubscriptions.innerHTML = '<p class="empty-state">No tenés suscripciones activas aún</p>';
            return;
        }
        
        const subscriptions = snapshot.docs.map(doc => doc.data());
        AppState.subscriptions = subscriptions.map(s => s.courtId);
        
        DOM.mySubscriptions.innerHTML = subscriptions.map(sub => `
            <div class="subscription-item">
                <i class="fas fa-check-circle"></i>
                <span>${sub.courtName}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error al cargar suscripciones:', error);
    }
}

// ============================================
// CANCHAS - Vista Admin
// ============================================

function setupAdminListeners() {
    // Agregar cancha
    document.getElementById('add-court-btn').addEventListener('click', () => {
        showModal(DOM.addCourtModal);
    });
    
    // Form agregar cancha
    document.getElementById('add-court-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('court-name').value;
        const location = document.getElementById('court-location').value;
        
        try {
            await db.collection('courts').add({
                name: name,
                location: location || '',
                enabled: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            hideModal(DOM.addCourtModal);
            document.getElementById('add-court-form').reset();
            showToast('Cancha agregada correctamente', 'success');
            loadAdminCourts();
            
        } catch (error) {
            console.error('Error al agregar cancha:', error);
            showToast('Error al agregar la cancha', 'error');
        }
    });
    
    // QR Actions
    document.getElementById('download-qr').addEventListener('click', downloadQR);
    document.getElementById('print-qr').addEventListener('click', printQR);
    document.getElementById('copy-url').addEventListener('click', copyURL);
}

async function loadAdminCourts() {
    setLoading(DOM.adminCourtsList, true);
    
    try {
        const snapshot = await db.collection('courts').orderBy('name').get();
        
        if (snapshot.empty) {
            DOM.adminCourtsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-volleyball-ball"></i>
                    <p>No hay canchas creadas aún</p>
                    <button class="btn-primary" onclick="document.getElementById('add-court-btn').click()">
                        <i class="fas fa-plus"></i>
                        Agregar Primera Cancha
                    </button>
                </div>
            `;
            return;
        }
        
        const courts = await Promise.all(snapshot.docs.map(async doc => {
            const courtData = doc.data();
            const subsSnapshot = await db.collection('subscriptions')
                .where('courtId', '==', doc.id)
                .get();
            
            return {
                id: doc.id,
                ...courtData,
                subscribersCount: subsSnapshot.size
            };
        }));
        
        renderAdminCourts(courts);
        
    } catch (error) {
        console.error('Error al cargar canchas admin:', error);
        DOM.adminCourtsList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar las canchas</p>
            </div>
        `;
    }
}

function renderAdminCourts(courts) {
    DOM.adminCourtsList.innerHTML = courts.map(court => `
        <div class="admin-court-card ${court.enabled ? 'enabled' : 'disabled'}">
            <div class="admin-court-header">
                <h4>${court.name}</h4>
                <span class="court-badge ${court.enabled ? 'badge-success' : 'badge-disabled'}">
                    ${court.enabled ? 'ACTIVA' : 'DESHABILITADA'}
                </span>
            </div>
            
            ${court.location ? `<p class="court-location"><i class="fas fa-map-marker-alt"></i> ${court.location}</p>` : ''}
            
            <div class="admin-court-stats">
                <i class="fas fa-users"></i>
                <span>${court.subscribersCount} ${court.subscribersCount === 1 ? 'suscriptor' : 'suscriptores'}</span>
            </div>
            
            <div class="admin-court-actions">
                <button class="btn-primary" 
                        onclick="openNotificationModal('${court.id}', '${court.name}', ${court.subscribersCount})"
                        ${!court.enabled || court.subscribersCount === 0 ? 'disabled' : ''}>
                    <i class="fas fa-bell"></i>
                    Notificar Disponible
                </button>
                <button class="btn-secondary" onclick="toggleCourtEnabled('${court.id}', ${!court.enabled})">
                    <i class="fas fa-${court.enabled ? 'ban' : 'check'}"></i>
                    ${court.enabled ? 'Deshabilitar' : 'Habilitar'}
                </button>
            </div>
        </div>
    `).join('');
}

async function toggleCourtEnabled(courtId, enabled) {
    try {
        await db.collection('courts').doc(courtId).update({
            enabled: enabled
        });
        
        showToast(`Cancha ${enabled ? 'habilitada' : 'deshabilitada'} correctamente`, 'success');
        loadAdminCourts();
        
    } catch (error) {
        console.error('Error al cambiar estado de cancha:', error);
        showToast('Error al actualizar la cancha', 'error');
    }
}

// ============================================
// NOTIFICACIONES
// ============================================

function openNotificationModal(courtId, courtName, subscribersCount) {
    document.getElementById('notify-court-name').textContent = courtName;
    document.getElementById('notify-subscribers-count').textContent = subscribersCount;
    document.getElementById('notification-form').dataset.courtId = courtId;
    document.getElementById('notification-form').dataset.courtName = courtName;
    
    showModal(DOM.notificationModal);
}

function setupNotificationListener() {
    document.getElementById('notification-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const form = e.target;
        const courtId = form.dataset.courtId;
        const courtName = form.dataset.courtName;
        const message = document.getElementById('notification-message').value;
        
        try {
            // Obtener todos los tokens suscritos a esta cancha
            const snapshot = await db.collection('subscriptions')
                .where('courtId', '==', courtId)
                .get();
            
            if (snapshot.empty) {
                showToast('No hay suscriptores para esta cancha', 'warning');
                return;
            }
            
            const tokens = snapshot.docs.map(doc => doc.data().token);
            
            // Enviar notificaciones (esto requiere Cloud Functions)
            // Por ahora, guardamos la notificación en Firestore
            await db.collection('notifications').add({
                courtId: courtId,
                courtName: courtName,
                message: message,
                tokens: tokens,
                sentAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            });
            
            hideModal(DOM.notificationModal);
            form.reset();
            showToast(`Notificación enviada a ${tokens.length} ${tokens.length === 1 ? 'usuario' : 'usuarios'}`, 'success');
            
        } catch (error) {
            console.error('Error al enviar notificación:', error);
            showToast('Error al enviar la notificación', 'error');
        }
    });
}

// ============================================
// QR CODE
// ============================================

function generateQRCode() {
    const canvas = document.getElementById('qr-code');
    const url = window.location.origin + '/';
    
    QRCode.toCanvas(canvas, url, {
        width: 256,
        margin: 2,
        color: {
            dark: '#0066CC',
            light: '#FFFFFF'
        }
    }, (error) => {
        if (error) {
            console.error('Error generando QR:', error);
        }
    });
    
    document.getElementById('app-url').textContent = url;
}

function downloadQR() {
    const canvas = document.getElementById('qr-code');
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'ajupam-canchas-qr.png';
    link.href = url;
    link.click();
    showToast('QR descargado', 'success');
}

function printQR() {
    const canvas = document.getElementById('qr-code');
    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>AJUPAM Canchas - QR Code</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 2rem;
                }
                h1 { color: #0066CC; }
                img { margin: 2rem 0; }
            </style>
        </head>
        <body>
            <h1>AJUPAM Canchas</h1>
            <p>Escaneá el código QR para recibir notificaciones</p>
            <img src="${canvas.toDataURL()}" />
            <p>${window.location.origin}/</p>
        </body>
        </html>
    `);
    win.document.close();
    win.print();
}

function copyURL() {
    const url = window.location.origin + '/';
    navigator.clipboard.writeText(url).then(() => {
        showToast('URL copiada al portapapeles', 'success');
    });
}

// ============================================
// ESTADÍSTICAS
// ============================================

async function loadStatistics() {
    try {
        const courtsSnapshot = await db.collection('courts').get();
        const subsSnapshot = await db.collection('subscriptions').get();
        
        // Contar suscriptores únicos
        const uniqueTokens = new Set(subsSnapshot.docs.map(doc => doc.data().token));
        
        document.getElementById('total-courts').textContent = courtsSnapshot.size;
        document.getElementById('total-subscribers').textContent = uniqueTokens.size;
        document.getElementById('active-subscriptions').textContent = subsSnapshot.size;
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// ============================================
// MODALES
// ============================================

function setupModalListeners() {
    // Cerrar modales con X
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            hideModal(modal);
        });
    });
    
    // Cerrar modales con click fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal);
            }
        });
    });
    
    // Cerrar modales con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
                hideModal(modal);
            });
        }
    });
}

// ============================================
// INICIALIZACIÓN
// ============================================

async function init() {
    console.log('🚀 Inicializando AJUPAM Canchas...');
    
    // Inicializar DOM
    initDOM();
    
    // Setup listeners
    setupAuthListeners();
    setupAdminListeners();
    setupNotificationListener();
    setupModalListeners();
    
    // Cargar vista de usuario por defecto
    showUserView();
    
    // Intentar obtener token FCM si hay permisos
    if (Notification.permission === 'granted') {
        try {
            AppState.fcmToken = await window.obtenerTokenFCM();
            console.log('✅ Token FCM obtenido');
        } catch (error) {
            console.warn('⚠️ No se pudo obtener token FCM:', error);
        }
    }
    
    console.log('✅ AJUPAM Canchas inicializado');
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Exponer funciones globalmente para uso en HTML
window.toggleSubscription = toggleSubscription;
window.toggleCourtEnabled = toggleCourtEnabled;
window.openNotificationModal = openNotificationModal;
