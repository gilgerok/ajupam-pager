// app.js — Playoffs Liga Ajupam
import { db, auth, getFCMToken } from "./firebase-config.js";
import {
  collection,
  doc,
  getDocs,
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

const adminAccessLink = document.getElementById("admin-access-link");
const goToUserBtn = document.getElementById("go-to-user");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const addCourtBtn = document.getElementById("add-court-btn");
const unsubscribeAllBtn = document.getElementById("unsubscribe-all-btn");
const toastContainer = document.getElementById("toast-container");

// ---------- UTILIDADES UI ----------
function showView(viewEl) {
  [userView, authView, adminView].forEach(v => v.classList.add("hidden"));
  viewEl.classList.remove("hidden");
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
      const subsCount = await getSubscribersCount(id);

      const card = document.createElement("div");
      card.className = "court-card";
      card.innerHTML = `
        <div class="court-header">
          <h3>${data.name}</h3>
          <div>
            <span class="court-status ${data.status === "Disponible" ? "status-available" : "status-unavailable"}">${data.status}</span>
            <span class="court-badge">${subsCount} suscriptores</span>
          </div>
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
      const badge = card.querySelector(".court-badge");

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
            const newCount = await getSubscribersCount(id);
            badge.textContent = `${newCount} suscriptores`;
            showToast("Te suscribiste a la cancha", "success");
          }
        } else {
          const ok = await unsubscribeFromCourt(id, token);
          btn.classList.remove("loading");
          if (ok) {
            btn.classList.remove("subscribed");
            btnText.textContent = "Notificarme";
            const newCount = await getSubscribersCount(id);
            badge.textContent = `${newCount} suscriptores`;
            showToast("Te desuscribiste", "info");
          }
        }
      });
    }

    // Mostrar/ocultar botón "Desactivar todas"
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
    adminCourtsList.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Cargando canchas...</p></div>`;
    const q = query(collection(db, "courts"), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    adminCourtsList.innerHTML = "";

    if (snap.empty) {
      adminCourtsList.innerHTML = `<p class="empty-state">No hay canchas registradas.</p>`;
      return;
    }

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const id = docSnap.id;
      const subsCount = await getSubscribersCount(id);

      const card = document.createElement("div");
      card.className = "admin-court-card";
      card.innerHTML = `
        <div class="admin-court-header">
          <h4>${data.name}</h4>
          <div class="admin-court-actions">
            <button class="btn btn-primary btn-edit" data-id="${id}"><i class="fas fa-pen"></i></button>
            <button class="btn btn-secondary btn-notify" data-id="${id}"><i class="fas fa-paper-plane"></i></button>
            <button class="btn btn-danger btn-delete" data-id="${id}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="admin-court-stats">
          <span>${subsCount} suscriptores</span> ·
          <span>${data.status || "Disponible"}</span>
        </div>
      `;
      adminCourtsList.appendChild(card);

      // editar
      card.querySelector(".btn-edit").addEventListener("click", async () => {
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

      // eliminar
      card.querySelector(".btn-delete").addEventListener("click", async () => {
        const confirmed = await showConfirm(
          "Eliminar cancha",
          `¿Estás seguro de eliminar "${data.name}"? Esta acción no se puede deshacer.`
        );
        if (!confirmed) return;
        await deleteDoc(doc(db, "courts", id));
        showToast("Cancha eliminada", "info");
        renderAdminCourts();
      });

      // notificar
      card.querySelector(".btn-notify").addEventListener("click", async () => {
        const msg = await showModal(
          "Enviar notificación",
          `Enviá una notificación a los suscriptores de "${data.name}":`,
          "Ingresá el mensaje (opcional)"
        );

        if (msg === null) return; // Usuario canceló

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
  } catch (err) {
    console.error("renderAdminCourts:", err);
    showToast("Error cargando canchas (admin)", "error");
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

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showToast("Sesión cerrada", "info");
  showView(userView);
  renderCourts();
});

// ---------- NAVEGACIÓN ----------
adminAccessLink.addEventListener("click", e => {
  e.preventDefault();
  showView(authView);
});
goToUserBtn.addEventListener("click", () => showView(userView));

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
const broadcastBtn = document.getElementById("broadcast-btn");
const broadcastOverlay = document.getElementById("broadcast-overlay");
const broadcastCloseBtn = document.getElementById("broadcast-close-btn");
const broadcastCancelBtn = document.getElementById("broadcast-cancel-btn");
const broadcastSendBtn = document.getElementById("broadcast-send-btn");
const broadcastTitle = document.getElementById("broadcast-title");
const broadcastMessage = document.getElementById("broadcast-message");
const broadcastCount = document.getElementById("broadcast-count");

// Abrir modal broadcast
broadcastBtn?.addEventListener("click", async () => {
  // Obtener cantidad de suscriptores únicos
  const uniqueTokens = await getAllUniqueTokens();
  broadcastCount.textContent = `${uniqueTokens.length} suscriptor${uniqueTokens.length !== 1 ? "es" : ""}`;

  broadcastTitle.value = "";
  broadcastMessage.value = "";
  broadcastOverlay.classList.remove("hidden");
  setTimeout(() => broadcastTitle.focus(), 100);
});

// Cerrar modal
broadcastCloseBtn?.addEventListener("click", () => {
  broadcastOverlay.classList.add("hidden");
});

broadcastCancelBtn?.addEventListener("click", () => {
  broadcastOverlay.classList.add("hidden");
});

// Enviar broadcast
broadcastSendBtn?.addEventListener("click", async () => {
  const title = broadcastTitle.value.trim();
  const body = broadcastMessage.value.trim();

  if (!title || !body) {
    showToast("Completá todos los campos", "error");
    return;
  }

  const confirmed = await showConfirm(
    "Confirmar envío",
    `¿Enviar esta notificación a todos los suscriptores?`
  );

  if (!confirmed) return;

  broadcastSendBtn.classList.add("loading");
  broadcastSendBtn.disabled = true;

  try {
    const uniqueTokens = await getAllUniqueTokens();

    if (uniqueTokens.length === 0) {
      showToast("No hay suscriptores para enviar", "warning");
      broadcastOverlay.classList.add("hidden");
      return;
    }

    // Enviar notificación usando la Cloud Function
    const response = await fetch(SEND_NOTIFICATION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokens: uniqueTokens,
        title: title,
        body: body,
        data: { type: "broadcast" }
      })
    });

    const result = await response.json();

    if (response.ok) {
      showToast(`Notificación enviada a ${uniqueTokens.length} usuario${uniqueTokens.length !== 1 ? "s" : ""}`, "success");
      broadcastOverlay.classList.add("hidden");
    } else {
      showToast(`Error: ${result.error}`, "error");
    }
  } catch (error) {
    console.error("Error enviando broadcast:", error);
    showToast("Error al enviar notificación", "error");
  } finally {
    broadcastSendBtn.classList.remove("loading");
    broadcastSendBtn.disabled = false;
  }
});

// Función para obtener todos los tokens únicos
async function getAllUniqueTokens() {
  try {
    const courtsSnap = await getDocs(collection(db, "courts"));
    const tokensSet = new Set();

    for (const courtDoc of courtsSnap.docs) {
      const subscribersSnap = await getDocs(
        collection(db, "courts", courtDoc.id, "subscribers")
      );
      subscribersSnap.forEach(sub => {
        const token = sub.data().token;
        if (token) tokensSet.add(token);
      });
    }

    return Array.from(tokensSet);
  } catch (error) {
    console.error("Error obteniendo tokens:", error);
    return [];
  }
}

// ---------- SISTEMA DE NOTIFICACIONES ----------
const notificationsBtn = document.getElementById("notifications-btn");
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
    showView(adminView);
    renderAdminCourts();
  } else {
    showView(userView);
    renderCourts();
  }
});
