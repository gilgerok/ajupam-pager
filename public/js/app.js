// app.js — Playoffs Liga Ajupam
import { db, auth, getFCMToken } from "./firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

console.log("🚀 App inicializada");

// ---------- CONFIG ----------
const SEND_NOTIFICATION_URL = "https://us-central1-ajupam-pager.cloudfunctions.net/sendNotification";

// ---------- SELECTORES DOM ----------
const userView = document.getElementById("user-view");
const authView = document.getElementById("auth-view");
const adminView = document.getElementById("admin-view");

const courtsList = document.getElementById("courts-list");
const adminCourtsList = document.getElementById("admin-courts-list");

const goToUserBtn = document.getElementById("go-to-user");
const loginForm = document.getElementById("login-form");
const headerLogoutBtn = document.getElementById("header-logout-btn");
const addCourtBtn = document.getElementById("add-court-btn");
const subscribeAllBtn = document.getElementById("subscribe-all-btn");
const unsubscribeAllBtn = document.getElementById("unsubscribe-all-btn");
const toastContainer = document.getElementById("toast-container");
const notificationsBtn = document.getElementById("notifications-btn");

// ---------- UTILIDADES UI ----------
function showView(viewEl) {
  [userView, authView, adminView].forEach(v => v.classList.add("hidden"));
  viewEl.classList.remove("hidden");

  // Alternar botones del header según la vista
  if (viewEl === adminView) {
    // En admin: mostrar logout, ocultar notificaciones
    notificationsBtn.classList.add("hidden");
    headerLogoutBtn.classList.remove("hidden");
  } else {
    // En otras vistas: mostrar notificaciones, ocultar logout
    notificationsBtn.classList.remove("hidden");
    headerLogoutBtn.classList.add("hidden");
  }
}

function showToast(text, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-content">${text}</div>`;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---------- MODALES MODERNOS ----------
function showModal(title, description, placeholder = "") {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modal-overlay");
    const titleEl = document.getElementById("modal-title");
    const descEl = document.getElementById("modal-description");
    const input = document.getElementById("modal-input");
    const confirmBtn = document.getElementById("modal-confirm-btn");
    const cancelBtn = document.getElementById("modal-cancel-btn");
    const closeBtn = document.getElementById("modal-close-btn");

    titleEl.textContent = title;
    descEl.textContent = description;
    input.value = "";
    input.placeholder = placeholder;
    overlay.classList.remove("hidden");

    setTimeout(() => input.focus(), 100);

    const cleanup = () => {
      overlay.classList.add("hidden");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      closeBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      input.removeEventListener("keypress", onEnter);
    };

    const onConfirm = () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onOverlayClick = (e) => {
      if (e.target === overlay) onCancel();
    };

    const onEnter = (e) => {
      if (e.key === "Enter") onConfirm();
    };

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    closeBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
    input.addEventListener("keypress", onEnter);
  });
}

function showConfirm(title, description) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirm-overlay");
    const titleEl = document.getElementById("confirm-title");
    const descEl = document.getElementById("confirm-description");
    const okBtn = document.getElementById("confirm-ok-btn");
    const cancelBtn = document.getElementById("confirm-cancel-btn");
    const closeBtn = document.getElementById("confirm-close-btn");

    titleEl.textContent = title;
    descEl.textContent = description;
    overlay.classList.remove("hidden");

    const cleanup = () => {
      overlay.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      closeBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onOverlayClick = (e) => {
      if (e.target === overlay) onCancel();
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    closeBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
  });
}

// ---------- FIRESTORE HELPERS ----------
async function getSubscribersCount(courtId) {
  const subsSnap = await getDocs(collection(db, "courts", courtId, "subscribers"));
  return subsSnap.size;
}

async function isTokenSubscribed(courtId, token) {
  if (!token) return false;
  const subsSnap = await getDocs(collection(db, "courts", courtId, "subscribers"));
  return subsSnap.docs.some(d => d.data().token === token);
}

async function getSubscribedCourtsCount(token) {
  if (!token) return 0;
  try {
    const courtsSnap = await getDocs(collection(db, "courts"));
    let count = 0;
    for (const courtDoc of courtsSnap.docs) {
      const isSubscribed = await isTokenSubscribed(courtDoc.id, token);
      if (isSubscribed) count++;
    }
    return count;
  } catch (err) {
    console.error("getSubscribedCourtsCount:", err);
    return 0;
  }
}

async function subscribeToCourt(courtId, token) {
  try {
    await addDoc(collection(db, "courts", courtId, "subscribers"), {
      token,
      createdAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error("subscribeToCourt:", err);
    return false;
  }
}

async function unsubscribeFromCourt(courtId, token) {
  try {
    const subsSnap = await getDocs(collection(db, "courts", courtId, "subscribers"));
    const found = subsSnap.docs.find(d => d.data().token === token);
    if (found) {
      await deleteDoc(doc(db, "courts", courtId, "subscribers", found.id));
      return true;
    }
    return false;
  } catch (err) {
    console.error("unsubscribeFromCourt:", err);
    return false;
  }
}

// ---------- RENDER USUARIO ----------
async function renderCourts() {
  try {
    courtsList.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Cargando canchas...</p></div>`;
    const q = query(collection(db, "courts"), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    courtsList.innerHTML = "";

    if (snap.empty) {
      courtsList.innerHTML = `<p class="empty-state">No hay canchas disponibles.</p>`;
      return;
    }

    let token = localStorage.getItem("fcm_token") || null;
    let hasSubscriptions = false;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const id = docSnap.id;

      const card = document.createElement("div");
      card.className = "court-card";
      card.innerHTML = `
        <div class="court-header">
          <h3>${data.name}</h3>
        </div>
        <div class="court-actions">
          <button class="btn btn-primary btn-subscribe" data-id="${id}">
            <i class="fas fa-bell"></i> <span class="btn-text">Notificarme</span>
          </button>
        </div>
      `;
      courtsList.appendChild(card);

      const btn = card.querySelector(".btn-subscribe");
      const btnText = btn.querySelector(".btn-text");

      const subscribed = token ? await isTokenSubscribed(id, token) : false;
      if (subscribed) {
        hasSubscriptions = true;
        btn.classList.add("subscribed");
        btnText.textContent = "Desuscribirme";
      }

      btn.addEventListener("click", async () => {
        if (!token) {
          token = await getFCMToken();
          if (token) localStorage.setItem("fcm_token", token);
          else {
            showToast("No se pudo obtener el token de notificaciones", "error");
            return;
          }
        }

        const subscribed = btn.classList.contains("subscribed");
        btn.classList.add("loading");

        if (!subscribed) {
          const ok = await subscribeToCourt(id, token);
          btn.classList.remove("loading");
          if (ok) {
            btn.classList.add("subscribed", "success-animation");
            setTimeout(() => btn.classList.remove("success-animation"), 400);
            btnText.textContent = "Desuscribirme";
            showToast("Te suscribiste a la cancha", "success");
          }
        } else {
          const ok = await unsubscribeFromCourt(id, token);
          btn.classList.remove("loading");
          if (ok) {
            btn.classList.remove("subscribed");
            btnText.textContent = "Notificarme";
            showToast("Te desuscribiste", "info");
          }
        }
      });
    }

    // Mostrar/ocultar botones "Activar todas" y "Cancelar todas"
    const totalCourts = snap.size;
    const subscribedCount = hasSubscriptions ? await getSubscribedCourtsCount(token) : 0;

    // Mostrar "Activar todas" si no está suscrito a todas
    if (subscribedCount < totalCourts) {
      subscribeAllBtn.style.display = "inline-flex";
    } else {
      subscribeAllBtn.style.display = "none";
    }

    // Mostrar "Cancelar todas" si tiene al menos una suscripción
    if (hasSubscriptions) {
      unsubscribeAllBtn.style.display = "inline-flex";
    } else {
      unsubscribeAllBtn.style.display = "none";
    }
  } catch (err) {
    console.error("renderCourts error:", err);
    showToast("Error al cargar canchas", "error");
  }
}

// ---------- RENDER ADMIN ----------
async function renderAdminCourts() {
  try {
    const tbody = document.getElementById("admin-courts-tbody");
    tbody.innerHTML = `<tr><td colspan="5" class="loading-cell"><div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Cargando canchas...</p></div></td></tr>`;

    const q = query(collection(db, "courts"), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    tbody.innerHTML = "";

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">No hay canchas registradas.</td></tr>`;
      return;
    }

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const id = docSnap.id;
      const subsCount = await getSubscribersCount(id);
      const status = data.status || "Disponible";
      const statusClass = status.toLowerCase() === "disponible" ? "available" : "unavailable";

      const row = document.createElement("tr");
      row.dataset.courtId = id;
      row.innerHTML = `
        <td>
          <input type="checkbox" class="court-checkbox" data-court-id="${id}" data-court-name="${data.name}">
        </td>
        <td>
          <span class="court-name">${data.name}</span>
        </td>
        <td>
          <span class="subscribers-count">
            <i class="fas fa-users"></i> ${subsCount}
          </span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${status}</span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-primary btn-edit" data-id="${id}" title="Editar">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn btn-secondary btn-notify" data-id="${id}" title="Notificar">
              <i class="fas fa-paper-plane"></i>
            </button>
            <button class="btn btn-danger btn-delete" data-id="${id}" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);

      // Eventos de checkbox
      const checkbox = row.querySelector(".court-checkbox");
      checkbox.addEventListener("change", updateBroadcastButtonState);

      // Editar
      row.querySelector(".btn-edit").addEventListener("click", async () => {
        const nuevo = await showModal(
          "Editar cancha",
          "Ingresá el nuevo nombre para la cancha:",
          data.name
        );
        if (nuevo) {
          await updateDoc(doc(db, "courts", id), { name: nuevo });
          showToast("Cancha actualizada", "success");
          renderAdminCourts();
        }
      });

      // Eliminar
      row.querySelector(".btn-delete").addEventListener("click", async () => {
        const confirmed = await showConfirm(
          "Eliminar cancha",
          `¿Estás seguro de eliminar "${data.name}"? Esta acción no se puede deshacer.`
        );
        if (!confirmed) return;
        await deleteDoc(doc(db, "courts", id));
        showToast("Cancha eliminada", "info");
        renderAdminCourts();
      });

      // Notificar (individual)
      row.querySelector(".btn-notify").addEventListener("click", async () => {
        const msg = await showModal(
          "Enviar notificación",
          `Enviá una notificación a los suscriptores de "${data.name}":`,
          "Ingresá el mensaje (opcional)"
        );

        if (msg === null) return;

        const subsSnap = await getDocs(collection(db, "courts", id, "subscribers"));
        const tokens = subsSnap.docs.map(d => d.data().token).filter(Boolean);

        if (!tokens.length) {
          showToast("No hay suscriptores para esta cancha", "warning");
          return;
        }

        const payload = {
          courtId: id,
          title: `AJUPAM - ${data.name}`,
          body: msg || `Hay una novedad en ${data.name}`,
          tokens
        };

        const res = await fetch(SEND_NOTIFICATION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) showToast("Notificación enviada", "success");
        else showToast("Error enviando notificación", "error");
      });
    }

    // Actualizar el estado inicial del botón broadcast
    updateBroadcastButtonState();
  } catch (err) {
    console.error("renderAdminCourts:", err);
    showToast("Error cargando canchas (admin)", "error");
  }

  // Actualizar estadísticas
  updateAdminStats();

  // Cargar configuración de enlaces y banners
  loadAdminConfig();
}

// Actualizar estadísticas del panel admin
async function updateAdminStats() {
  try {
    const statSubs = document.getElementById("stat-subs");
    const statCourts = document.getElementById("stat-courts");

    // Total de canchas
    const courtsSnap = await getDocs(collection(db, "courts"));
    const totalCourts = courtsSnap.size;
    statCourts.textContent = totalCourts;

    // Total de suscripciones activas (sumando todas las subcollections)
    let totalSubs = 0;
    for (const courtDoc of courtsSnap.docs) {
      const subsSnap = await getDocs(collection(db, "courts", courtDoc.id, "subscribers"));
      totalSubs += subsSnap.size;
    }
    statSubs.textContent = totalSubs;
  } catch (err) {
    console.error("updateAdminStats error:", err);
  }
}

// ---------- LOGIN ----------
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Sesión iniciada", "success");
    showView(adminView);
    renderAdminCourts();
  } catch (err) {
    showToast("Credenciales incorrectas", "error");
  }
});

// Logout desde el header
headerLogoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showToast("Sesión cerrada", "info");
  window.location.hash = "";
  showView(userView);
  renderCourts();
});

// ---------- NAVEGACIÓN ----------
// Routing por URL hash
function handleHashChange() {
  const hash = window.location.hash;
  if (hash === "#admin") {
    showView(authView);
  } else {
    showView(userView);
  }
}

// Escuchar cambios en el hash
window.addEventListener("hashchange", handleHashChange);

// NO ejecutar handleHashChange al inicio porque onAuthStateChanged lo hará

goToUserBtn.addEventListener("click", () => {
  window.location.hash = "";
  showView(userView);
});

addCourtBtn.addEventListener("click", async () => {
  const nombre = await showModal(
    "Agregar cancha",
    "Ingresá el nombre de la nueva cancha:",
    "Ej: Cancha 1"
  );
  if (!nombre) return;
  await addDoc(collection(db, "courts"), {
    name: nombre,
    status: "Disponible",
    createdAt: serverTimestamp()
  });
  showToast("Cancha creada", "success");
  renderAdminCourts();
  renderCourts();
});

// Activar todas las notificaciones
subscribeAllBtn.addEventListener("click", async () => {
  let token = localStorage.getItem("fcm_token");

  if (!token) {
    token = await getFCMToken();
    if (!token) {
      showToast("No se pudo obtener el token de notificaciones", "error");
      return;
    }
    localStorage.setItem("fcm_token", token);
  }

  subscribeAllBtn.classList.add("loading");

  try {
    const courtsSnap = await getDocs(collection(db, "courts"));
    let subscribedCount = 0;

    for (const courtDoc of courtsSnap.docs) {
      const alreadySubscribed = await isTokenSubscribed(courtDoc.id, token);
      if (!alreadySubscribed) {
        const success = await subscribeToCourt(courtDoc.id, token);
        if (success) subscribedCount++;
      }
    }

    subscribeAllBtn.classList.remove("loading");

    if (subscribedCount > 0) {
      showToast(`Te suscribiste a ${subscribedCount} ${subscribedCount === 1 ? 'cancha' : 'canchas'}`, "success");
      renderCourts();
    } else {
      showToast("Ya estás suscrito a todas las canchas", "info");
    }
  } catch (err) {
    console.error("Error al suscribirse a todas las canchas:", err);
    subscribeAllBtn.classList.remove("loading");
    showToast("Error al activar las notificaciones", "error");
  }
});

// Desactivar todas las notificaciones
unsubscribeAllBtn.addEventListener("click", async () => {
  const confirmed = await showConfirm(
    "Cancelar todas las notificaciones",
    "¿Estás seguro de desuscribirte de todas las canchas? Dejarás de recibir notificaciones."
  );

  if (!confirmed) return;

  const token = localStorage.getItem("fcm_token");
  if (!token) {
    showToast("No tenés suscripciones activas", "info");
    return;
  }

  unsubscribeAllBtn.classList.add("loading");

  try {
    const courtsSnap = await getDocs(collection(db, "courts"));
    let unsubscribedCount = 0;

    for (const courtDoc of courtsSnap.docs) {
      const success = await unsubscribeFromCourt(courtDoc.id, token);
      if (success) unsubscribedCount++;
    }

    unsubscribeAllBtn.classList.remove("loading");

    if (unsubscribedCount > 0) {
      showToast(`Te desuscribiste de ${unsubscribedCount} ${unsubscribedCount === 1 ? 'cancha' : 'canchas'}`, "success");
      renderCourts();
    } else {
      showToast("No tenías suscripciones activas", "info");
    }
  } catch (err) {
    console.error("Error al desuscribirse de todas:", err);
    unsubscribeAllBtn.classList.remove("loading");
    showToast("Error al cancelar suscripciones", "error");
  }
});

// ---------- PWA INSTALACIÓN ----------
let deferredPrompt;

// Capturar el evento beforeinstallprompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log("📱 PWA instalable detectada");
});

// Mostrar modal PWA en primera visita
function showPWAInstallModal() {
  const overlay = document.getElementById("pwa-install-overlay");
  const installBtn = document.getElementById("pwa-install-btn");
  const continueBtn = document.getElementById("pwa-continue-browser-btn");

  overlay.classList.remove("hidden");

  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Usuario ${outcome === "accepted" ? "aceptó" : "rechazó"} la instalación`);
      deferredPrompt = null;
    }
    overlay.classList.add("hidden");
    localStorage.setItem("pwa_prompt_shown", "true");
  });

  continueBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    localStorage.setItem("pwa_prompt_shown", "true");
  });
}

// Verificar si es primera visita (después de un delay para no ser intrusivo)
setTimeout(() => {
  const hasSeenPrompt = localStorage.getItem("pwa_prompt_shown");
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

  if (!hasSeenPrompt && !isStandalone && deferredPrompt) {
    showPWAInstallModal();
  }
}, 3000); // Esperar 3 segundos antes de mostrar

// ---------- BROADCAST NOTIFICATIONS (ADMIN) ----------
// Note: Old broadcast modal removed - now using selective table-based broadcast

// ---------- SISTEMA DE NOTIFICACIONES ----------
const notificationsBadge = document.getElementById("notifications-badge");
const notificationsPanel = document.getElementById("notifications-panel");
const notificationsList = document.getElementById("notifications-list");
const closeNotificationsBtn = document.getElementById("close-notifications-btn");
const markAllReadBtn = document.getElementById("mark-all-read-btn");

// Abrir/cerrar panel
notificationsBtn?.addEventListener("click", () => {
  notificationsPanel.classList.toggle("open");
  if (notificationsPanel.classList.contains("open")) {
    loadNotifications();
  }
});

closeNotificationsBtn?.addEventListener("click", () => {
  notificationsPanel.classList.remove("open");
});

// Marcar todas como leídas
markAllReadBtn?.addEventListener("click", async () => {
  const token = localStorage.getItem("fcm_token");
  if (!token) return;

  try {
    const notifRef = collection(db, "notifications", token, "messages");
    const q = query(notifRef, where("read", "==", false));
    const snapshot = await getDocs(q);

    const updatePromises = snapshot.docs.map(doc =>
      updateDoc(doc.ref, { read: true })
    );
    await Promise.all(updatePromises);

    showToast("Todas las notificaciones marcadas como leídas", "success");
    loadNotifications();
    updateNotificationBadge();
  } catch (error) {
    console.error("Error marcando como leídas:", error);
    showToast("Error al marcar notificaciones", "error");
  }
});

// Cargar notificaciones desde Firestore
async function loadNotifications() {
  const token = localStorage.getItem("fcm_token");
  if (!token) {
    notificationsList.innerHTML = `
      <div class="notifications-empty">
        <i class="fas fa-bell-slash"></i>
        <p>Suscribite a una cancha para recibir notificaciones</p>
      </div>
    `;
    return;
  }

  try {
    const { query: fsQuery, where, orderBy: fsOrderBy, limit } = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js");
    const notifRef = collection(db, "notifications", token, "messages");
    const q = fsQuery(notifRef, fsOrderBy("timestamp", "desc"), limit(50));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      notificationsList.innerHTML = `
        <div class="notifications-empty">
          <i class="fas fa-bell-slash"></i>
          <p>No tenés notificaciones</p>
        </div>
      `;
      return;
    }

    notificationsList.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      const notifEl = createNotificationElement(doc.id, data);
      notificationsList.appendChild(notifEl);
    });
  } catch (error) {
    console.error("Error cargando notificaciones:", error);
    notificationsList.innerHTML = `
      <div class="notifications-empty">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error cargando notificaciones</p>
      </div>
    `;
  }
}

// Crear elemento de notificación
function createNotificationElement(id, data) {
  const div = document.createElement("div");
  div.className = `notification-item ${data.read ? "" : "unread"}`;

  const timeAgo = data.timestamp
    ? getTimeAgo(data.timestamp.toDate())
    : "Hace un momento";

  div.innerHTML = `
    <div class="notification-item-header">
      <div class="notification-item-title">${data.title || "Notificación"}</div>
      <div class="notification-item-time">${timeAgo}</div>
    </div>
    <div class="notification-item-body">${data.body || ""}</div>
  `;

  // Marcar como leída al hacer clic
  div.addEventListener("click", async () => {
    if (!data.read) {
      const token = localStorage.getItem("fcm_token");
      const docRef = doc(db, "notifications", token, "messages", id);
      await updateDoc(docRef, { read: true });
      div.classList.remove("unread");
      updateNotificationBadge();
    }
  });

  return div;
}

// Formatear tiempo relativo
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return "Ahora";
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} hs`;
  if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)} días`;
  return date.toLocaleDateString("es-AR");
}

// Actualizar badge de notificaciones
async function updateNotificationBadge() {
  const token = localStorage.getItem("fcm_token");
  if (!token) {
    notificationsBadge.classList.add("hidden");
    return;
  }

  try {
    const { query: fsQuery, where } = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js");
    const notifRef = collection(db, "notifications", token, "messages");
    const q = fsQuery(notifRef, where("read", "==", false));
    const snapshot = await getDocs(q);

    const count = snapshot.size;
    if (count > 0) {
      notificationsBadge.textContent = count > 99 ? "99+" : count;
      notificationsBadge.classList.remove("hidden");
    } else {
      notificationsBadge.classList.add("hidden");
    }
  } catch (error) {
    console.error("Error actualizando badge:", error);
  }
}

// Escuchar evento de nueva notificación
window.addEventListener("newNotification", () => {
  updateNotificationBadge();
  if (notificationsPanel.classList.contains("open")) {
    loadNotifications();
  }
});

// Actualizar badge al cargar la página
updateNotificationBadge();

// Limpiar Badge API nativo cuando la app está en foco
window.addEventListener("focus", async () => {
  if ("clearAppBadge" in navigator) {
    try {
      await navigator.clearAppBadge();
      console.log("✅ Badge nativo limpiado");
    } catch (error) {
      console.error("❌ Error limpiando badge nativo:", error);
    }
  }
});

// Limpiar badge cuando se abre el panel de notificaciones
notificationsBtn?.addEventListener("click", async () => {
  if ("clearAppBadge" in navigator) {
    try {
      await navigator.clearAppBadge();
    } catch (error) {
      console.error("❌ Error limpiando badge:", error);
    }
  }
});

// ---------- OBSERVADOR DE SESIÓN ----------
onAuthStateChanged(auth, user => {
  if (user) {
    // Si hay usuario autenticado, mostrar admin (respetando el hash si es #admin)
    const hash = window.location.hash;
    if (hash === "#admin") {
      showView(adminView);
      renderAdminCourts();
    } else {
      // Usuario logueado pero no en #admin, redirigir a admin
      window.location.hash = "#admin";
      showView(adminView);
      renderAdminCourts();
    }
  } else {
    // Sin usuario, mostrar vista de usuario (ignorar #admin si lo hay)
    if (window.location.hash === "#admin") {
      showView(authView); // Mostrar login
    } else {
      showView(userView);
      renderCourts();
    }
  }
});

// ========================================
// CONFIGURACIÓN DE ENLACES Y BANNERS
// ========================================

// Guardar configuración de banner
window.saveBanner = async function(bannerNum) {
  const title = document.getElementById(`banner${bannerNum}-title`).value;
  const desc = document.getElementById(`banner${bannerNum}-desc`).value;
  const url = document.getElementById(`banner${bannerNum}-url`).value;
  const image = document.getElementById(`banner${bannerNum}-image`).value;

  if (!title || !url) {
    showToast("Completá al menos el título y la URL", "warning");
    return;
  }

  try {
    await setDoc(doc(db, "config", `banner${bannerNum}`), {
      title,
      description: desc,
      url,
      imageUrl: image,
      updatedAt: serverTimestamp()
    });
    showToast(`Banner ${bannerNum} guardado correctamente`, "success");
    loadBanners(); // Recargar banners en vista de usuario
  } catch (err) {
    console.error("Error guardando banner:", err);
    showToast("Error al guardar el banner", "error");
  }
};

// Guardar enlaces de categorías
window.saveCategoryLinks = async function() {
  const links = {
    fem5ta6ta: document.getElementById("link-fem-5ta6ta").value,
    fem7ma8va: document.getElementById("link-fem-7ma8va").value,
    masc2da3ra: document.getElementById("link-masc-2da3ra").value,
    masc4ta5ta: document.getElementById("link-masc-4ta5ta").value,
    masc6tamas: document.getElementById("link-masc-6tamas").value
  };

  try {
    await setDoc(doc(db, "config", "categoryLinks"), {
      ...links,
      updatedAt: serverTimestamp()
    });
    showToast("Enlaces de categorías guardados", "success");
    loadCategoryLinks(); // Recargar enlaces en vista de usuario
  } catch (err) {
    console.error("Error guardando enlaces:", err);
    showToast("Error al guardar enlaces", "error");
  }
};

// Guardar enlaces de formularios
window.saveFormLinks = async function() {
  const denuncias = document.getElementById("link-denuncias").value;
  const encuesta = document.getElementById("link-encuesta").value;

  try {
    await setDoc(doc(db, "config", "formLinks"), {
      denuncias,
      encuesta,
      updatedAt: serverTimestamp()
    });
    showToast("Enlaces de formularios guardados", "success");
    loadFormLinks(); // Recargar enlaces en vista de usuario
  } catch (err) {
    console.error("Error guardando formularios:", err);
    showToast("Error al guardar formularios", "error");
  }
};

// Cargar configuración en el admin
async function loadAdminConfig() {
  try {
    // Cargar banners
    for (let i = 1; i <= 3; i++) {
      const docSnap = await getDoc(doc(db, "config", `banner${i}`));
      if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById(`banner${i}-title`).value = data.title || "";
        document.getElementById(`banner${i}-desc`).value = data.description || "";
        document.getElementById(`banner${i}-url`).value = data.url || "";
        document.getElementById(`banner${i}-image`).value = data.imageUrl || "";
      }
    }

    // Cargar enlaces de categorías
    const categoryDoc = await getDoc(doc(db, "config", "categoryLinks"));
    if (categoryDoc.exists()) {
      const data = categoryDoc.data();
      document.getElementById("link-fem-5ta6ta").value = data.fem5ta6ta || "";
      document.getElementById("link-fem-7ma8va").value = data.fem7ma8va || "";
      document.getElementById("link-masc-2da3ra").value = data.masc2da3ra || "";
      document.getElementById("link-masc-4ta5ta").value = data.masc4ta5ta || "";
      document.getElementById("link-masc-6tamas").value = data.masc6tamas || "";
    }

    // Cargar enlaces de formularios
    const formDoc = await getDoc(doc(db, "config", "formLinks"));
    if (formDoc.exists()) {
      const data = formDoc.data();
      document.getElementById("link-denuncias").value = data.denuncias || "";
      document.getElementById("link-encuesta").value = data.encuesta || "";
    }
  } catch (err) {
    console.error("Error cargando config admin:", err);
  }
}

// Cargar banners en vista de usuario (uno por sección)
async function loadBanners() {
  try {
    const sections = ['canchas', 'cuadros', 'encuestas'];
    const colors = [
      { gradient: 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)', icon: 'fa-arrow-right', btnClass: 'btn-primary' },
      { gradient: 'linear-gradient(135deg, #cc6600 0%, #994d00 100%)', icon: 'fa-arrow-right', btnClass: 'btn-warning' },
      { gradient: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)', icon: 'fa-arrow-right', btnClass: 'btn-success' }
    ];

    for (let i = 0; i < sections.length; i++) {
      const sectionName = sections[i];
      const bannerZone = document.querySelector(`.banner-zone[data-banner-section="${sectionName}"]`);

      if (!bannerZone) continue;

      bannerZone.innerHTML = "";

      // Cargar banner correspondiente (banner1 = canchas, banner2 = cuadros, banner3 = encuestas)
      const docSnap = await getDoc(doc(db, "config", `banner${i + 1}`));

      if (docSnap.exists()) {
        const data = docSnap.data();

        if (data.title && data.url) {
          const bannerCard = document.createElement("div");
          bannerCard.className = "banner-card";

          const color = colors[i];
          const backgroundImage = data.imageUrl
            ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${data.imageUrl}')`
            : color.gradient;

          bannerCard.style.backgroundImage = backgroundImage;

          // Usar 'description' como texto del botón
          const buttonText = data.description || 'Ver más';

          bannerCard.innerHTML = `
            <div class="banner-content">
              <h3>${data.title}</h3>
              <a href="${data.url}" class="btn ${color.btnClass} banner-btn" target="_blank" rel="noopener">
                <i class="fas ${color.icon}"></i> ${buttonText}
              </a>
            </div>
          `;

          bannerZone.appendChild(bannerCard);
        }
      }
    }
  } catch (err) {
    console.error("Error cargando banners:", err);
  }
}

// Cargar enlaces de categorías en vista de usuario
async function loadCategoryLinks() {
  try {
    const docSnap = await getDoc(doc(db, "config", "categoryLinks"));
    if (docSnap.exists()) {
      const data = docSnap.data();

      // Categorías femeninas
      const femCategories = [
        { key: "fem5ta6ta", label: "5ta / 6ta" },
        { key: "fem7ma8va", label: "7ma / 8va" }
      ];

      // Categorías masculinas
      const mascCategories = [
        { key: "masc2da3ra", label: "2da / 3ra" },
        { key: "masc4ta5ta", label: "4ta / 5ta" },
        { key: "masc6tamas", label: "6ta o más" }
      ];

      // Renderizar categorías femeninas
      const femLinksGrid = document.querySelectorAll(".links-category")[0]?.querySelector(".links-grid");
      if (femLinksGrid) {
        femLinksGrid.innerHTML = "";
        femCategories.forEach(cat => {
          if (data[cat.key]) {
            const linkCard = document.createElement("a");
            linkCard.href = data[cat.key];
            linkCard.className = "link-card link-card-fem";
            linkCard.target = "_blank";
            linkCard.rel = "noopener";
            linkCard.innerHTML = `
              <i class="fas fa-table"></i>
              <span>${cat.label}</span>
            `;
            femLinksGrid.appendChild(linkCard);
          }
        });
      }

      // Renderizar categorías masculinas
      const mascLinksGrid = document.querySelectorAll(".links-category")[1]?.querySelector(".links-grid");
      if (mascLinksGrid) {
        mascLinksGrid.innerHTML = "";
        mascCategories.forEach(cat => {
          if (data[cat.key]) {
            const linkCard = document.createElement("a");
            linkCard.href = data[cat.key];
            linkCard.className = "link-card";
            linkCard.target = "_blank";
            linkCard.rel = "noopener";
            linkCard.innerHTML = `
              <i class="fas fa-table"></i>
              <span>${cat.label}</span>
            `;
            mascLinksGrid.appendChild(linkCard);
          }
        });
      }
    }
  } catch (err) {
    console.error("Error cargando enlaces de categorías:", err);
  }
}

// Cargar enlaces de formularios en vista de usuario
async function loadFormLinks() {
  try {
    const docSnap = await getDoc(doc(db, "config", "formLinks"));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const linksGrid = document.querySelectorAll(".links-category")[2]?.querySelector(".links-grid");

      if (linksGrid) {
        linksGrid.innerHTML = "";

        if (data.denuncias) {
          const denunciasCard = document.createElement("a");
          denunciasCard.href = data.denuncias;
          denunciasCard.className = "link-card link-card-warning";
          denunciasCard.target = "_blank";
          denunciasCard.rel = "noopener";
          denunciasCard.innerHTML = `
            <i class="fas fa-user-secret"></i>
            <span>Denuncias Anónimas</span>
          `;
          linksGrid.appendChild(denunciasCard);
        }

        if (data.encuesta) {
          const encuestaCard = document.createElement("a");
          encuestaCard.href = data.encuesta;
          encuestaCard.className = "link-card link-card-success";
          encuestaCard.target = "_blank";
          encuestaCard.rel = "noopener";
          encuestaCard.innerHTML = `
            <i class="fas fa-star"></i>
            <span>Encuesta de Satisfacción</span>
          `;
          linksGrid.appendChild(encuestaCard);
        }
      }
    }
  } catch (err) {
    console.error("Error cargando enlaces de formularios:", err);
  }
}

// Cargar todo al inicio
loadBanners();
loadCategoryLinks();
loadFormLinks();

// ============================================
// MOBILE BOTTOM NAVIGATION
// ============================================
function initMobileNavigation() {
  const navTabs = document.querySelectorAll(".nav-tab");
  const contentSections = document.querySelectorAll(".content-section");

  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetSection = tab.dataset.tab;

      // Remove active class from all tabs
      navTabs.forEach(t => t.classList.remove("active"));

      // Add active class to clicked tab
      tab.classList.add("active");

      // Hide all sections
      contentSections.forEach(section => {
        if (section.dataset.section === targetSection) {
          section.classList.remove("hidden");
        } else {
          section.classList.add("hidden");
        }
      });

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// Initialize mobile navigation
initMobileNavigation();

// ============================================
// ADMIN NAVIGATION
// ============================================
function initAdminNavigation() {
  const adminNavTabs = document.querySelectorAll(".admin-nav-tab");
  const adminContentSections = document.querySelectorAll(".admin-content-section");

  adminNavTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetSection = tab.dataset.adminTab;

      // Remove active class from all tabs
      adminNavTabs.forEach(t => t.classList.remove("active"));

      // Add active class to clicked tab
      tab.classList.add("active");

      // Hide all sections
      adminContentSections.forEach(section => {
        if (section.dataset.adminSection === targetSection) {
          section.classList.remove("hidden");
        } else {
          section.classList.add("hidden");
        }
      });

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// Initialize admin navigation
initAdminNavigation();

// ============================================
// ADMIN COURTS SELECTION & BROADCAST
// ============================================

// Actualizar estado del botón broadcast según checkboxes seleccionados
function updateBroadcastButtonState() {
  const checkedBoxes = document.querySelectorAll(".court-checkbox:checked");
  const broadcastBtn = document.getElementById("broadcast-btn");
  const selectAllCheckbox = document.getElementById("select-all-checkbox");
  const allCheckboxes = document.querySelectorAll(".court-checkbox");

  if (broadcastBtn) {
    if (checkedBoxes.length > 0) {
      broadcastBtn.disabled = false;
      broadcastBtn.title = `Notificar a ${checkedBoxes.length} ${checkedBoxes.length === 1 ? 'cancha' : 'canchas'} seleccionadas`;
    } else {
      broadcastBtn.disabled = true;
      broadcastBtn.title = "Seleccioná canchas para notificar";
    }
  }

  // Actualizar estado del checkbox "Seleccionar todas"
  if (selectAllCheckbox && allCheckboxes.length > 0) {
    selectAllCheckbox.checked = checkedBoxes.length === allCheckboxes.length;
    selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < allCheckboxes.length;
  }
}

// Checkbox "Seleccionar todas"
const selectAllCheckbox = document.getElementById("select-all-checkbox");
if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener("change", (e) => {
    const checked = e.target.checked;
    const courtCheckboxes = document.querySelectorAll(".court-checkbox");
    courtCheckboxes.forEach(cb => {
      cb.checked = checked;
    });
    updateBroadcastButtonState();
  });
}

// Botón "Seleccionar todas" (alternativo)
const selectAllBtn = document.getElementById("select-all-courts-btn");
if (selectAllBtn) {
  selectAllBtn.addEventListener("click", () => {
    const allCheckboxes = document.querySelectorAll(".court-checkbox");
    const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);

    allCheckboxes.forEach(cb => {
      cb.checked = !allChecked;
    });

    updateBroadcastButtonState();
  });
}

// Broadcast a canchas seleccionadas
const broadcastBtn = document.getElementById("broadcast-btn");
if (broadcastBtn) {
  broadcastBtn.addEventListener("click", async () => {
    const checkedBoxes = document.querySelectorAll(".court-checkbox:checked");

    if (checkedBoxes.length === 0) {
      showToast("Seleccioná al menos una cancha", "warning");
      return;
    }

    const courtNames = Array.from(checkedBoxes).map(cb => cb.dataset.courtName).join(", ");
    const msg = await showModal(
      `Notificación Broadcast (${checkedBoxes.length} ${checkedBoxes.length === 1 ? 'cancha' : 'canchas'})`,
      `Enviá una notificación a los suscriptores de: ${courtNames}`,
      "Ingresá el mensaje"
    );

    if (msg === null) return;

    broadcastBtn.classList.add("loading");

    try {
      // Recolectar tokens de todas las canchas seleccionadas
      const allTokens = new Set();

      for (const checkbox of checkedBoxes) {
        const courtId = checkbox.dataset.courtId;
        const subsSnap = await getDocs(collection(db, "courts", courtId, "subscribers"));
        subsSnap.docs.forEach(d => {
          const token = d.data().token;
          if (token) allTokens.add(token);
        });
      }

      const tokens = Array.from(allTokens);

      if (tokens.length === 0) {
        showToast("No hay suscriptores en las canchas seleccionadas", "warning");
        broadcastBtn.classList.remove("loading");
        return;
      }

      const payload = {
        courtId: "",
        title: "AJUPAM - Notificación Importante",
        body: msg || "Hay novedades importantes",
        tokens
      };

      const res = await fetch(SEND_NOTIFICATION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      broadcastBtn.classList.remove("loading");

      if (res.ok) {
        showToast(`Notificación enviada a ${tokens.length} ${tokens.length === 1 ? 'suscriptor' : 'suscriptores'}`, "success");
        // Desmarcar checkboxes
        checkedBoxes.forEach(cb => cb.checked = false);
        updateBroadcastButtonState();
      } else {
        showToast("Error enviando notificación", "error");
      }
    } catch (err) {
      console.error("Error en broadcast:", err);
      showToast("Error enviando notificación", "error");
      broadcastBtn.classList.remove("loading");
    }
  });
}
