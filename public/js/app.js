// app.js — AJUPAM Pager
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
  serverTimestamp
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
        if (!subscribed) {
          const ok = await subscribeToCourt(id, token);
          if (ok) {
            btn.classList.add("subscribed");
            btnText.textContent = "Desuscribirme";
            const newCount = await getSubscribersCount(id);
            badge.textContent = `${newCount} suscriptores`;
            showToast("Te suscribiste a la cancha", "success");
          }
        } else {
          const ok = await unsubscribeFromCourt(id, token);
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
