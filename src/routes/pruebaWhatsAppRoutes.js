/**
 * Enrutador de pruebas del servicio de WhatsApp para TurnoFlex.
 * Permite realizar envíos de prueba simulados restringidos exclusivamente a administradores y entornos fuera de producción.
 */

import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';

import {
  asegurarAutenticacion,
  permitirRoles
} from '../middlewares/authMiddleware.js';

import { enviarWhatsApp } from '../utils/whatsapp.js';

const router = Router();

// ============================================================
// SEGURIDAD GLOBAL: SOLO ADMINS Y EXCLUSIVO DESARROLLO
// ============================================================

// Restringimos el acceso a administradores
router.use(asegurarAutenticacion, permitirRoles('admin'));

// Deshabilitamos por completo estas rutas de prueba en producción (retornan 404)
router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.sendStatus(404);
  }
  next();
});

// ============================================================
// CONFIGURACIÓN DE RATE LIMIT PARA PRUEBAS
// ============================================================

// Limitamos el spam de envíos de prueba (máximo 3 peticiones cada 30 minutos)
const limitarPruebas = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Límite de pruebas alcanzado. Intentá más tarde.'
});

// ============================================================
// HELPERS DE FECHA Y RENDERIZADO
// ============================================================

// Calcula la fecha de mañana en zona horaria de Argentina (YYYY-MM-DD)
function mananaEnArgentina() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const numero = (tipo) =>
    Number(partes.find(p => p.type === tipo)?.value);

  return new Date(Date.UTC(
    numero('year'),
    numero('month') - 1,
    numero('day') + 1
  )).toISOString().slice(0, 10);
}

// Renderiza la vista del panel de prueba con los datos provistos
function mostrar(req, res, valores = {}) {
  return res.render('prueba-whatsapp', {
    tituloPage: 'Prueba de WhatsApp',
    csrfToken: req.session.pruebaWhatsAppCsrf,
    ...valores
  });
}

// ============================================================
// RUTAS DE PRUEBA WHATSAPP
// ============================================================

// Pantalla principal del panel de pruebas
router.get('/', (req, res) => {
  req.session.pruebaWhatsAppCsrf ??=
    randomBytes(32).toString('hex');

  return mostrar(req, res);
});

// Enviar recordatorio de prueba ficticio por WhatsApp
router.post('/', limitarPruebas, async (req, res) => {
  const esperado = req.session.pruebaWhatsAppCsrf;
  const recibido = req.body?._csrf;

  // Validación de seguridad contra ataques CSRF usando comparación timing-safe
  if (
    typeof esperado !== 'string' ||
    typeof recibido !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(recibido) ||
    !timingSafeEqual(
      Buffer.from(esperado, 'hex'),
      Buffer.from(recibido, 'hex')
    )
  ) {
    return res.status(403).send(
      'Formulario vencido. Volvé a abrir la página.'
    );
  }

  // Limpiamos el teléfono ingresado para conservar únicamente dígitos
  const telefono = String(
    req.body?.telefono ?? ''
  ).replace(/\D/g, '');

  // Validamos formato exacto de número argentino (549 + 10 dígitos)
  if (!/^549\d{10}$/.test(telefono)) {
    return mostrar(req, res, {
      error: 'Ingresá un número argentino en formato 549 + 10 dígitos.'
    });
  }

  try {
    // Intentamos enviar el mensaje de prueba mediante la utilidad de WhatsApp
    const aceptado = await enviarWhatsApp(
      telefono,
      'Paciente de Prueba',
      mananaEnArgentina(),
      '10:00',
      'Profesional de Prueba'
    );

    if (aceptado !== true) {
      return mostrar(req, res, {
        error: 'WhatsApp todavía no está listo para enviar mensajes.'
      });
    }

    return mostrar(req, res, {
      exito: 'WhatsApp aceptó el envío. Verificá que llegue al celular.'
    });

  } catch (error) {
    console.error(
      'Error en prueba de WhatsApp:',
      error.message
    );

    return mostrar(req, res, {
      error: 'Falló el envío. Revisá la consola de TurnoFlex.'
    });
  }
});

// ============================================================
// EXPORTACIÓN DEL ENRUTADOR
// ============================================================

export default router;