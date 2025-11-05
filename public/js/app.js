/* ============================================
   AJUPAM PAGER - JAVASCRIPT PRINCIPAL
   Sistema de Notificaciones de Canchas
   ============================================ */

// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================

const AppState = {
    currentUser: null,
    isAdmin: false,
    fcmToken: null,
    courts: [],
    subscriptions: []
};

// ============================================
// REFERENCIAS DOM
// ============================================

let DOM = {};

function initDOM() {
    DOM = {
        // Views
        authView: document.getElementById('auth-view'),
        userView: document.getElementById('user-view'),
        adminView: document.getElementById('admin-view'),
        
        // Auth
        loginForm: document.getElementById('login-form'),
        emailInput: document.getElementById('email'),
        passwordInput: document.getElementById('password'),
        goToUserBtn: document.getElementById('go-to-user'),
        logoutBtn: document.getElementById('logout-btn'),
        adminAccessLink: document.getElementById('admin-access-link'),
        
        // User View
        courtsList: document.getElementById('courts-list'),
        unsubscribeAllBtn: document.getElementById('unsubscribe-all-btn'),
        
        // Admin View
        adminCourtsList: document.getElementById('admin-courts-list'),
        addCourtBtn: document.getElementById('add-court-btn'),
        
        // Modals
        addCourtModal: document.getElementById('add-court-modal'),
        addCourtForm: document.getElementById('add-court-form'),
        notificationModal: document.getElementById('notification-modal'),
        notificationForm: document.getElementById('notification-form'),
        
        // Stats
        totalCourts: document.getElementById('total-courts'),
        totalSubscribers: document.getElementById('total-subscribers'),
        activeSubscriptions: document.getElementById('active-subscriptions'),
        
        // Toast
        toastContainer: document.getElementById('toast-container')
    };
}

// ============================================
// AUTENTICACIÓN
// ============================================

function setupAuthListeners() {
    // Login form
    DOM.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = DOM.emailInput.value;
        const password = DOM.passwordInput.value;
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            showToast('¡Bienvenido, Admin!', 'success');
            showAdminView();
        } catch (error) {
            console.error('Error en login:', error);
            showToast('Credenciales incorrectas', 'error');
        }
    });
    
    // Go to user view
    DOM.goToUserBtn.addEventListener('click', () => {
        showUserView();
    });
    
    // Admin access link (oculto en el footer)
    DOM.adminAccessLink.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthView();
    });
    
    // Logout
    DOM.logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            showToast('Sesión cerrada', 'success');
            showUserView();
        } catch (error) {
            console.error('Error en logout:', error);
            showToast('Error al cerrar sesión', 'error');
        }
    });
    
    // Unsubscribe all button
    DOM.unsubscribeAllBtn.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de cancelar TODAS las notificaciones?')) {
            return;
        }
        
        try {
            if (!AppState.fcmToken) {
                showToast('No hay suscripciones activas', 'warning');
                return;
            }
            
            const snapshot = await db.collection('subscriptions')
                .where('token', '==', AppState.fcmToken)
                .get();
            
            if (snapshot.empty) {
                showToast('No hay suscripciones activas', 'warning');
                return;
            }
            
            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
            
            AppState.subscriptions = [];
            showToast(`${snapshot.size} suscripciones canceladas`, 'success');
            
            // Recargar canchas para actualizar toggles
            loadCourts();
            updateUnsubscribeAllButton();
            
        } catch (error) {
            console.error('Error al cancelar suscripciones:', error);
            showToast('Error al cancelar suscripciones', 'error');
        }
    });
    
    // Auth state observer
    auth.onAuthStateChanged((user) => {
        AppState.currentUser = user;
        if (user) {
            AppState.isAdmin = true;
        } else {
            AppState.isAdmin = false;
        }
    });
}

// ============================================
// VISTAS
// ============================================

function showAuthView() {
    DOM.authView.classList.remove('hidden');
    DOM.userView.classList.add('hidden');
    DOM.adminView.classList.add('hidden');
}

function showUserView() {
    DOM.authView.classList.add('hidden');
    DOM.userView.classList.remove('hidden');
    DOM.adminView.classList.add('hidden');
    
    loadCourts();
}

function showAdminView() {
    DOM.authView.classList.add('hidden');
    DOM.userView.classList.add('hidden');
    DOM.adminView.classList.remove('hidden');
    
    loadAdminCourts();
    loadStatistics();
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon} toast-icon"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto remove
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// ============================================
// CANCHAS - VISTA USUARIO
// ============================================

async function loadCourts() {
    try {
        DOM.courtsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Cargando canchas...</p></div>';
        
        // Cargar suscripciones primero
        await loadSubscriptions();
        
        const snapshot = await db.collection('courts')
            .orderBy('number')
            .get();
        
        if (snapshot.empty) {
            DOM.courtsList.innerHTML = '<p class="empty-state">No hay canchas disponibles aún</p>';
            return;
        }
        
        AppState.courts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderCourts();
        updateUnsubscribeAllButton();
    } catch (error) {
        console.error('Error al cargar canchas:', error);
        DOM.courtsList.innerHTML = '<p class="empty-state">Error al cargar canchas</p>';
    }
}

async function loadSubscriptions() {
    try {
        if (!AppState.fcmToken) {
            AppState.fcmToken = await window.obtenerTokenFCM().catch(() => null);
        }
        
        if (!AppState.fcmToken) {
            AppState.subscriptions = [];
            return;
        }
        
        const snapshot = await db.collection('subscriptions')
            .where('token', '==', AppState.fcmToken)
            .get();
        
        AppState.subscriptions = snapshot.docs.map(doc => doc.data().courtId);
        
    } catch (error) {
        console.error('Error al cargar suscripciones:', error);
        AppState.subscriptions = [];
    }
}

function updateUnsubscribeAllButton() {
    if (AppState.subscriptions.length > 0) {
        DOM.unsubscribeAllBtn.style.display = 'inline-flex';
    } else {
        DOM.unsubscribeAllBtn.style.display = 'none';
    }
}

function renderCourts() {
    DOM.courtsList.innerHTML = '';
    
    AppState.courts.forEach(court => {
        const isSubscribed = AppState.subscriptions.includes(court.id);
        const isDisabled = !court.enabled;
        
        const courtCard = document.createElement('div');
        courtCard.className = `court-card ${isDisabled ? 'disabled' : ''}`;
        
        courtCard.innerHTML = `
            <div class="court-header">
                <h3>Cancha ${court.number}</h3>
                <span class="court-status ${isDisabled ? 'status-disabled' : 'status-available'}">
                    <i class="fas fa-circle"></i>
                    ${isDisabled ? 'Deshabilitada' : 'Disponible'}
                </span>
            </div>
            <div class="court-actions">
                <div class="subscription-toggle">
                    <span>${isSubscribed ? 'Suscripto' : 'Suscribirse'}</span>
                    <label class="toggle">
                        <input 
                            type="checkbox" 
                            ${isSubscribed ? 'checked' : ''} 
                            ${isDisabled ? 'disabled' : ''}
                            onchange="toggleSubscription('${court.id}', ${court.number}, this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        `;
        
        DOM.courtsList.appendChild(courtCard);
    });
}

async function toggleSubscription(courtId, courtNumber, subscribe) {
    try {
        // Solicitar permisos si no están otorgados
        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                showToast('Necesitás habilitar las notificaciones', 'warning');
                // Revertir toggle
                loadCourts();
                return;
            }
        }
        
        // Obtener token FCM
        if (!AppState.fcmToken) {
            AppState.fcmToken = await window.obtenerTokenFCM();
        }
        
        if (subscribe) {
            // Suscribirse
            await db.collection('subscriptions').add({
                courtId: courtId,
                courtNumber: courtNumber,
                token: AppState.fcmToken,
                subscribedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            AppState.subscriptions.push(courtId);
            showToast(`Suscripto a Cancha ${courtNumber}`, 'success');
        } else {
            // Desuscribirse
            const snapshot = await db.collection('subscriptions')
                .where('courtId', '==', courtId)
                .where('token', '==', AppState.fcmToken)
                .get();
            
            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
            
            AppState.subscriptions = AppState.subscriptions.filter(id => id !== courtId);
            showToast(`Desuscripto de Cancha ${courtNumber}`, 'success');
        }
        
        updateUnsubscribeAllButton();
        
    } catch (error) {
        console.error('Error al gestionar suscripción:', error);
        showToast('Error al actualizar suscripción', 'error');
        // Recargar para revertir cambios en UI
        loadCourts();
    }
}

// ============================================
// ADMIN - GESTIÓN DE CANCHAS
// ============================================

function setupAdminListeners() {
    // Add court button
    DOM.addCourtBtn.addEventListener('click', () => {
        showModal(DOM.addCourtModal);
    });
    
    // Add court form
    DOM.addCourtForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const courtNumber = parseInt(document.getElementById('court-number').value);
        
        try {
            await db.collection('courts').add({
                number: courtNumber,
                enabled: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showToast(`Cancha ${courtNumber} creada exitosamente`, 'success');
            hideModal(DOM.addCourtModal);
            DOM.addCourtForm.reset();
            loadAdminCourts();
            loadStatistics();
        } catch (error) {
            console.error('Error al crear cancha:', error);
            showToast('Error al crear la cancha', 'error');
        }
    });
}

async function loadAdminCourts() {
    try {
        DOM.adminCourtsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Cargando canchas...</p></div>';
        
        const snapshot = await db.collection('courts')
            .orderBy('number')
            .get();
        
        if (snapshot.empty) {
            DOM.adminCourtsList.innerHTML = '<p class="empty-state">No hay canchas creadas aún</p>';
            return;
        }
        
        DOM.adminCourtsList.innerHTML = '';
        
        for (const doc of snapshot.docs) {
            const court = doc.data();
            const courtId = doc.id;
            
            // Contar suscriptores
            const subsSnapshot = await db.collection('subscriptions')
                .where('courtId', '==', courtId)
                .get();
            
            const card = document.createElement('div');
            card.className = `admin-court-card ${!court.enabled ? 'disabled' : ''}`;
            
            card.innerHTML = `
                <div class="admin-court-header">
                    <h4>Cancha ${court.number}</h4>
                    <span class="court-badge ${court.enabled ? 'badge-success' : 'badge-disabled'}">
                        ${court.enabled ? 'ACTIVA' : 'DESHABILITADA'}
                    </span>
                </div>
                <div class="admin-court-stats">
                    <i class="fas fa-users"></i>
                    <span>${subsSnapshot.size} ${subsSnapshot.size === 1 ? 'suscriptor' : 'suscriptores'}</span>
                </div>
                <div class="admin-court-actions">
                    <button 
                        class="btn-primary" 
                        onclick="openNotificationModal('${courtId}', ${court.number})"
                        ${!court.enabled || subsSnapshot.size === 0 ? 'disabled' : ''}>
                        <i class="fas fa-bell"></i>
                        Notificar Disponibilidad
                    </button>
                    <button 
                        class="btn-secondary" 
                        onclick="toggleCourtEnabled('${courtId}', ${!court.enabled})">
                        <i class="fas fa-${court.enabled ? 'ban' : 'check'}"></i>
                        ${court.enabled ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                    <button 
                        class="btn-danger" 
                        onclick="deleteCourt('${courtId}', ${court.number})">
                        <i class="fas fa-trash"></i>
                        Eliminar
                    </button>
                </div>
            `;
            
            DOM.adminCourtsList.appendChild(card);
        }
        
    } catch (error) {
        console.error('Error al cargar canchas admin:', error);
        DOM.adminCourtsList.innerHTML = '<p class="empty-state">Error al cargar canchas</p>';
    }
}

async function toggleCourtEnabled(courtId, enabled) {
    try {
        await db.collection('courts').doc(courtId).update({
            enabled: enabled
        });
        
        showToast(`Cancha ${enabled ? 'habilitada' : 'deshabilitada'}`, 'success');
        loadAdminCourts();
    } catch (error) {
        console.error('Error al actualizar cancha:', error);
        showToast('Error al actualizar la cancha', 'error');
    }
}

async function deleteCourt(courtId, courtNumber) {
    if (!confirm(`¿Estás seguro de eliminar la Cancha ${courtNumber}? Esta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        // Eliminar suscripciones asociadas
        const subsSnapshot = await db.collection('subscriptions')
            .where('courtId', '==', courtId)
            .get();
        
        const deletePromises = subsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        
        // Eliminar cancha
        await db.collection('courts').doc(courtId).delete();
        
        showToast(`Cancha ${courtNumber} eliminada`, 'success');
        loadAdminCourts();
        loadStatistics();
    } catch (error) {
        console.error('Error al eliminar cancha:', error);
        showToast('Error al eliminar la cancha', 'error');
    }
}

// ============================================
// NOTIFICACIONES
// ============================================

function openNotificationModal(courtId, courtNumber) {
    document.getElementById('notification-court-id').value = courtId;
    document.getElementById('notification-court-number').textContent = courtNumber;
    document.getElementById('notification-message').value = '';
    showModal(DOM.notificationModal);
}

function setupNotificationListener() {
    DOM.notificationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const courtId = document.getElementById('notification-court-id').value;
        const courtNumber = document.getElementById('notification-court-number').textContent;
        const message = document.getElementById('notification-message').value.trim();
        
        try {
            // Obtener suscriptores de esta cancha
            const subsSnapshot = await db.collection('subscriptions')
                .where('courtId', '==', courtId)
                .get();
            
            if (subsSnapshot.empty) {
                showToast('No hay suscriptores para esta cancha', 'warning');
                return;
            }
            
            // Extraer los tokens de los suscriptores
            const tokens = subsSnapshot.docs.map(doc => doc.data().token);
            
            console.log(`📤 Enviando notificación a ${tokens.length} dispositivos`);
            
            // Crear registro de notificación con los tokens
            await db.collection('notifications').add({
                courtId: courtId,
                courtNumber: parseInt(courtNumber),
                message: message || null,
                tokens: tokens,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                subscribersCount: subsSnapshot.size
            });
            
            hideModal(DOM.notificationModal);
            showToast(`Notificación enviada a ${subsSnapshot.size} ${subsSnapshot.size === 1 ? 'usuario' : 'usuarios'}`, 'success');
            
        } catch (error) {
            console.error('Error al enviar notificación:', error);
            showToast('Error al enviar la notificación', 'error');
        }
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
        
        DOM.totalCourts.textContent = courtsSnapshot.size;
        DOM.totalSubscribers.textContent = uniqueTokens.size;
        DOM.activeSubscriptions.textContent = subsSnapshot.size;
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// ============================================
// MODALES
// ============================================

function showModal(modal) {
    modal.classList.remove('hidden');
}

function hideModal(modal) {
    modal.classList.add('hidden');
}

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
    console.log('🚀 Inicializando AJUPAM Pager...');
    
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
    
    console.log('✅ AJUPAM Pager inicializado');
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
window.deleteCourt = deleteCourt;
window.openNotificationModal = openNotificationModal;