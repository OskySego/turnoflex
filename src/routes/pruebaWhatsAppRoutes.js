import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';

import {
  asegurarAutenticacion,
  permitirRoles
} from '../middlewares/authMiddleware.js';

import { enviarWhatsApp } from '../utils/whatsapp.js';

const router = Router();

// Solo administradores; deshabilitado en producción.
router.use(asegurarAutenticacion, permitirRoles('admin'));

router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.sendStatus(404);
  }
  next();
});

// Evitar demasiados envíos de prueba.
const limitarPruebas = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Límite de pruebas alcanzado. Intentá más tarde.'
});

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

function mostrar(req, res, valores = {}) {
  return res.render('prueba-whatsapp', {
    tituloPage: 'Prueba de WhatsApp',
    csrfToken: req.session.pruebaWhatsAppCsrf,
    ...valores
  });
}

// Pantalla de prueba.
router.get('/', (req, res) => {
  req.session.pruebaWhatsAppCsrf ??=
    randomBytes(32).toString('hex');

  return mostrar(req, res);
});

// Enviar recordatorio ficticio.
router.post('/', limitarPruebas, async (req, res) => {
  const esperado = req.session.pruebaWhatsAppCsrf;
  const recibido = req.body?._csrf;

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

  const telefono = String(
    req.body?.telefono ?? ''
  ).replace(/\D/g, '');

  if (!/^549\d{10}$/.test(telefono)) {
    return mostrar(req, res, {
      error: 'Ingresá un número argentino en formato 549 + 10 dígitos.'
    });
  }

  try {
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

export default router;