# 🏥 TurnoFlex

**TurnoFlex** es una plataforma web integral diseñada para la gestión inteligente de turnos, sala de espera en tiempo real, historiales clínicos y administración operativa de centros de salud o consultorios profesionales. Construida con enfoque en la escalabilidad, la seguridad por roles y una experiencia de usuario fluida.

🌍 **Web en Producción:** [https://turnoflex-a7c0.onrender.com](https://turnoflex-a7c0.onrender.com)  
📂 **Repositorio Oficial:** [https://github.com/OskySego/turnoflex](https://github.com/OskySego/turnoflex)

---

## 🚀 Funcionalidades y Módulos Principales

### 🔒 Autenticación, Seguridad y Gestión Institucional
* **Control de Acceso por Roles:** Diferenciación estricta entre `admin`, `personal` (Secretaría / Recepción), `profesional` y `cliente`, con redirección y paneles personalizados según el perfil (`/inicio-admin`, `/inicio-secretaria`, `/medico/agenda` e `/inicio-cliente`).
* **Portada Pública y Verificación de Cuentas:** Pantalla institucional de bienvenida (`/bienvenida`) para visitantes sin sesión y middleware global (`verificarCuentaHabilitada`) para controlar cuentas activas en tiempo real.
* **Alta de Cuentas Institucionales (`/accesos`):** Generación de credenciales institucionales para personal y profesionales, seguimiento del estado de envío de invitaciones por correo y reenvío directo ante fallos.
* **Recuperación de Correos Huérfanos:** Herramienta exclusiva para administradores que permite liberar correos de prueba bloqueados, archivando la cuenta si posee historial clínico o turnos sin perder trazabilidad.
* **Seguridad HTTP y Sesiones Compartidas:** Protección con `helmet`, contraseñas encriptadas con `bcrypt`, validación estricta de `SESSION_SECRET` en producción, tokens `_csrf` en formularios críticos, soporte para proxy inverso (`Render` / `Cloudflare Tunnel`) y sesiones compartidas entre Express y **Socket.IO**.

### 📅 Gestión Avanzada de Turnos y Agenda
* **Panel Operativo en Tiempo Real (`/turnos`):** Tarjetas con código único por especialidad (`TRN-XXXX`), filtros instantáneos por estado (`Reservados`, `Pendiente pago`, `En espera`, `Atendidos`, `Cancelados`), paginación y actualización automática de estados y pagos mediante **Socket.IO**.
* **Validación de Agenda Profesional:** Asignación de turnos respetando días laborales, franjas horarias, duración de consulta por médico, modalidad (`Presencial`, `Telemedicina` o `Ambas`) y configuración de **sobreturnos**.
* **Directorio Médico (`/profesionales`):** Buscador instantáneo por nombre, especialidad, subespecialidad, matrícula, sede o correo; filtros por modalidad de atención; y gestión administrativa con desactivación lógica, reactivación o eliminación definitiva protegida cuando existen registros históricos.
* **Cobertura Médica y Gestión Familiar:** Soporte para atención por **Obra Social / Prepaga** (con cálculo de copago), **Particular** o **Ambas**, además de vinculación de grupos familiares para gestionar turnos de dependientes.

### 📺 Sala de Espera en Vivo (`/sala-espera`)
* **Pantalla Pública en Tiempo Real:** Interfaz proyectable de alto contraste con reloj y fecha sincronizados con la zona horaria de Buenos Aires (`America/Argentina/Buenos_Aires`).
* **Llamados Instantáneos y Cola Anonimizada:** Notificación visual con animación de destello al convocar pacientes a consultorio, listado de próximos turnos pendientes identificado por horario y código corto (protegiendo datos sensibles) e historial de últimos llamados.
* **Recuperación de Estado:** Sincronización bidireccional mediante **Socket.IO** (`llamado_paciente`, `actualizacion_agenda`) respaldada por endpoints REST (`/api/sala-espera/ultimo-llamado`) para reconstruir la pantalla ante recargas o reconexiones.

### 🩺 Módulo de Historia Clínica (`/clinica`)
* **Registros Clínicos y Evoluciones:** Gestión centralizada de historias clínicas (`HistoriaClinica`) y notas de evolución estructuradas (`NotaClinica` con anamnesis, examen físico, diagnóstico e indicaciones) con permisos granulares por paciente y profesional.
* **Auditoría de Operaciones:** Registro y visualización de eventos de auditoría por turno para administración y recepción.

### 💬 Notificaciones, Pruebas e Integraciones
* **Recordatorios Multicanal:** Procesos automáticos programados con `node-cron` para enviar recordatorios de turnos vía **WhatsApp** (`whatsapp-web.js`) y **Email** (`Nodemailer`).
* **Consola de Prueba de WhatsApp (`/admin/prueba-whatsapp`):** Herramienta exclusiva para administradores que permite validar el envío de recordatorios a un número autorizado sin alterar turnos reales del sistema.
* **Pasarela de Pagos con Mercado Pago:** Integración completa con checkout y webhooks (`/webhooks`) validados mediante firma `x-signature`, reflejando pagos totales, señas o cobros en efectivo en tiempo real.

### 🎨 Diseño y Experiencia de Usuario (UI/UX)
* **Estilos Centralizados y Bootstrap Local:** Hoja de estilos unificada (`turnoflex.css`) combinada con Bootstrap servido localmente (`/vendor/bootstrap`) y vistas modulares en **Pug**.
* **Modo Claro / Oscuro:** Interfaz adaptable a las preferencias del usuario para mejorar la accesibilidad y reducir la fatiga visual en jornadas prolongadas.

---

## 🛠️ Stack Tecnológico

* **Backend:** Node.js, Express.js
* **Base de Datos:** MongoDB Atlas + Mongoose
* **Frontend:** Motor de plantillas Pug, CSS3 (`turnoflex.css`), Bootstrap 5, JavaScript Vanilla
* **Tiempo Real y Servicios:** Socket.IO, Mercado Pago SDK, `node-cron`, Nodemailer, `whatsapp-web.js`, Helmet, `express-session`

---

## 📂 Estructura General del Proyecto

```text
turnoflex/
├── app.js                     # Punto de entrada: Express, Socket.IO, sesiones, middlewares y rutas
├── seed.js                    # Script de migración y población de datos v3.0 (vista previa y aplicación)
├── public/                    # Recursos estáticos (CSS, JS cliente, imágenes, favicon)
└── src/
    ├── config/                # Conexión a MongoDB Atlas
    ├── controllers/           # Lógica de negocio (turnos, sala de espera, historial, etc.)
    ├── cron/                  # Tareas programadas de recordatorios automáticos
    ├── middlewares/           # Autenticación, permisos por rol, cuentas activas y errorHandler global
    ├── models/                # Esquemas Mongoose (Usuario, Cliente, Profesional, Turno, HistoriaClinica, NotaClinica, Especialidad)
    ├── routes/                # Enrutadores modulares (auth, accesos, turnos, profesionales, clinica, webhooks, APIs)
    ├── utils/                 # Integración con WhatsApp, correo y utilidades
    └── views/                 # Plantillas Pug (paneles por rol, sala-espera, profesionales, turnos, clínica)
    
---
*Desarrollado y mantenido por [Los CLaudestinos](Neuyin Herrera, Maximiliano Carlos Ratti, Karina Ajhuacho Choque, Oscar Segovia) - 2026.*