# 🏐 AJUPAM CANCHAS

Sistema de notificaciones push para disponibilidad de canchas de pádel - AJUPAM Mendoza

[![Firebase Hosting](https://img.shields.io/badge/Firebase-Hosting-orange)](https://firebase.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-blue)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 🌐 URLs

- **Producción:** https://canchas.ajupam.ar/
- **Staging:** https://ajupam-pager.web.app/
- **Sitio principal:** https://ajupam.ar/

---

## 📋 Descripción

Aplicación web progresiva (PWA) que permite a los jugadores de pádel:
- 📱 Suscribirse a notificaciones de disponibilidad de canchas
- 🔔 Recibir alertas push cuando una cancha esté disponible
- 📷 Escanear códigos QR para suscripción rápida
- ⚙️ Panel de administración para gestión de canchas

---

## 🚀 Características

- ✅ **Progressive Web App (PWA)** - Instalable en dispositivos móviles
- ✅ **Notificaciones Push** - Firebase Cloud Messaging
- ✅ **QR Scanner** - Suscripción rápida mediante códigos QR
- ✅ **Offline First** - Funciona sin conexión
- ✅ **Responsive** - Adaptado a móviles y desktop
- ✅ **Panel Admin** - Gestión completa de canchas y notificaciones

---

## 📁 Estructura del Proyecto

```
ajupam-pager/
├── public/                         # Archivos públicos (Firebase Hosting)
│   ├── index.html                  # App principal
│   ├── manifest.json               # PWA manifest
│   ├── firebase-messaging-sw.js    # Service Worker
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── firebase-config.js
│   │   └── app.js
│   ├── icons/                      # Iconos PWA
│   └── images/
├── firebase.json                   # Config Firebase Hosting
├── .firebaserc                     # Proyecto Firebase
├── firestore.rules                 # Reglas Firestore
├── firestore.indexes.json          # Índices Firestore
├── package.json                    # Dependencias NPM
└── README.md                       # Este archivo
```

---

## 🛠️ Tecnologías

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Firebase (Firestore, Cloud Messaging, Hosting, Authentication)
- **PWA:** Service Worker, Web App Manifest
- **QR:** html5-qrcode library
- **Generación QR:** qrcode.js library

---

## ⚙️ Instalación

### Requisitos previos
- Node.js 18+ y npm
- Firebase CLI (`npm install -g firebase-tools`)
- Cuenta Firebase con proyecto creado

### Pasos

1. **Clonar repositorio**
```bash
git clone https://github.com/gilgerok/ajupam-pager.git
cd ajupam-pager
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar Firebase**
```bash
firebase login
firebase use ajupam-pager
```

4. **Probar localmente**
```bash
npm run serve
# Abre http://localhost:5000
```

5. **Desplegar**
```bash
npm run deploy
```

---

## 🌐 Configuración DNS (Dominio personalizado)

Para usar `canchas.ajupam.ar`:

1. En tu proveedor DNS, agregar registro CNAME:
```
Tipo: CNAME
Nombre: canchas
Valor: ajupam-pager.web.app
TTL: 3600
```

2. En Firebase Console:
```
Hosting → Dominios personalizados → Agregar dominio
→ canchas.ajupam.ar
→ Verificar y configurar SSL
```

---

## 📱 Uso

### Para Usuarios

1. **Escanear QR** de una cancha
2. **Permitir notificaciones** cuando se solicite
3. **Recibir alertas** cuando la cancha esté disponible

### Para Administradores

1. Acceder al **Panel Admin** (botón en la esquina)
2. Iniciar sesión con credenciales de admin
3. **Configurar canchas:** nombre, ubicación, etc.
4. **Generar códigos QR** para cada cancha
5. **Enviar notificaciones** a suscriptores

---

## 🔧 Scripts Disponibles

```bash
# Servidor local de desarrollo
npm run serve

# Deploy solo del hosting
npm run deploy

# Deploy completo (hosting + firestore)
npm run deploy:full

# Ver logs de Cloud Functions
npm run logs
```

---

## 🔐 Seguridad

- ✅ Firestore Rules configuradas para proteger datos
- ✅ Autenticación de admin requerida para panel
- ✅ HTTPS obligatorio (Firebase Hosting)
- ✅ Service Worker con scope limitado

---

## 🐛 Troubleshooting

### Notificaciones no llegan
1. Verificar permisos del navegador
2. Verificar que Service Worker esté activo (DevTools → Application)
3. Verificar credenciales Firebase en `firebase-config.js`
4. Verificar Cloud Messaging API habilitada en Firebase Console

### PWA no se instala
1. Verificar que el sitio use HTTPS
2. Verificar que `manifest.json` esté correctamente configurado
3. Verificar que todos los iconos existan en `/icons/`

### Errores 404
1. Verificar que `firebase deploy` haya completado correctamente
2. Limpiar cache del navegador (Ctrl + Shift + R)
3. Verificar que la estructura de carpetas sea correcta

---

## 📊 Monitoreo

- **Firebase Console:** https://console.firebase.google.com/project/ajupam-pager
- **Analytics:** Hosting → Métricas
- **Logs:** Cloud Functions → Logs

---

## 🚀 Roadmap

- [ ] Notificaciones programadas
- [ ] Historial de notificaciones
- [ ] Estadísticas de uso
- [ ] Multi-idioma (i18n)
- [ ] Tests automatizados
- [ ] GitHub Actions para CI/CD

---

## 👥 Contribuir

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/NuevaCaracteristica`)
3. Commit cambios (`git commit -m 'Agrega nueva característica'`)
4. Push al branch (`git push origin feature/NuevaCaracteristica`)
5. Abrir Pull Request

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

---

## 📞 Contacto

**AJUPAM** - Agrupación de Jugadores de Pádel de Mendoza

- 🌐 Web: https://ajupam.ar
- 📱 Instagram: [@ajupam.padel](https://instagram.com/ajupam.padel)
- 📧 Email: contacto@ajupam.ar
- 💬 WhatsApp: +54 9 261 253-4840

---

## 🙏 Agradecimientos

- Comunidad de +2000 jugadores de AJUPAM
- Firebase por la infraestructura
- Todos los sponsors y colaboradores

---

**Hecho con ❤️ en Mendoza, Argentina 🇦🇷**
