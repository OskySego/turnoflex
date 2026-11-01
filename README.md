# 🏥 TurnoFlex

**TurnoFlex** es una plataforma web integral diseñada para la gestión inteligente de turnos, historiales clínicos y administración de centros de salud o servicios profesionales. Construida con un enfoque en la escalabilidad, la seguridad y la experiencia del usuario.

🌍 **Web en Producción:** [https://turnoflex-a7c0.onrender.com](https://turnoflex-a7c0.onrender.com)  
📂 **Repositorio Oficial:** [https://github.com/OskySego/turnoflex](https://github.com/OskySego/turnoflex)

---

## 🚀 Mejoras y Características Principales

### 🔒 Autenticación y Seguridad
* **Sistema de Roles:** Control de acceso estricto diferenciando entre `admin`, `personal`, `profesional` y `cliente`.
* **Autenticación Segura:** Inicio de sesión protegido con encriptación de contraseñas (`bcrypt`) y gestión de sesiones multiplataforma.
* **Manejo de Errores:** Sistema de validación robusto con alertas y mensajes de error bien marcados en la interfaz para guiar al usuario.

### 📅 Gestión Avanzada de Turnos
* **Validación por Médico y Horarios:** El sistema respeta las reglas de comercio, asignando turnos únicamente en los días y horarios laborales de cada profesional.
* **Cobertura Médica:** Soporte dual para turnos a través de **Obra Social / Prepaga** o de manera **Particular**.
* **Gestión Familiar:** Capacidad de vincular grupos familiares para que un usuario pueda gestionar los turnos de sus dependientes.
* **Historias Clínicas:** Registro digital y evolución clínica centralizada por paciente, accesible para los profesionales.

### 💬 Notificaciones e Integraciones
* **Recordatorios Multicanal:** Integración de procesos automáticos (Cron Jobs) para enviar recordatorios de turnos vía **WhatsApp** (whatsapp-web.js) y **Email** (Nodemailer).
* **Pasarela de Pagos:** Integración completa con **Mercado Pago** para la gestión de cobros de consultas particulares de forma segura y directa.

### 🎨 Diseño y Experiencia de Usuario (UI/UX)
* **Estilos Centralizados:** Implementación de `turnoflex.css` para mantener una estructura visual coherente y estandarizada en todas las vistas.
* **Modo Claro / Oscuro:** Interfaz adaptable a las preferencias del usuario para mejorar la accesibilidad y reducir la fatiga visual.
* **Estructura Modular:** Implementación de un `footer` global y layouts consistentes para reforzar la identidad de marca en cada página.

### ☁️ Infraestructura y Despliegue
* **Base de Datos en la Nube:** Migración a **MongoDB Atlas**, permitiendo el acceso, la lectura y escritura de datos desde cualquier lugar del mundo de manera ininterrumpida.
* **Hosting:** Despliegue continuo y estable configurado en **Render** para asegurar la disponibilidad 24/7.

---

## 🛠️ Stack Tecnológico
* **Backend:** Node.js, Express.js
* **Base de Datos:** MongoDB (Atlas) + Mongoose
* **Frontend:** Motor de plantillas Pug, CSS3 (turnoflex.css), JavaScript Vanilla
* **Librerías Destacadas:** Socket.io (tiempo real), MercadoPago SDK, Node-cron, Nodemailer, WhatsApp-web.js.

---
*Desarrollado y mantenido por [Los CLaudestinos](Neuyin Herrera, Maximiliano Carlos Ratti, Karina Ajhuacho Choque, Oscar Segovia) - 2026.*