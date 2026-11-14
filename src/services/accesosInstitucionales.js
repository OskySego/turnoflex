/**
 * Servicio de gestión de identidades institucionales y envío de invitaciones para TurnoFlex.
 * Maneja la validación de correos personales, generación de alias internos, tokens de activación y pasarelas de correo (Brevo / SMTP).
 */

import { randomBytes, createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import { Usuario } from '../models/Usuario.js';

const DOMINIO_INTERNO = 'turnoflex.internal';
const DURACION_TOKEN_MS = 24 * 60 * 60 * 1000; // Validez de 24 horas para el token de activación

// ============================================================
// VALIDACIÓN Y VERIFICACIÓN DE MODELO
// ============================================================

export function validarCorreoPersonal(valor) {
  const correo = String(valor ?? '').trim().toLowerCase();
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.endsWith('@turnoflex.internal')) {
    throw new Error('Ingresá un correo particular válido.');
  }
  return correo;
}

export function comprobarModeloUsuarioInstitucional() {
  for (const campo of [
    'emailInstitucional', 'activo', 'profesional_id',
    'activacionHash', 'activacionHasta'
  ]) {
    if (!Usuario.schema.path(campo)) {
      throw new Error(
        `Falta el campo ${campo} en src/models/Usuario.js. ` +
        'No se creó una cuenta incompleta.'
      );
    }
  }
}


// ============================================================
// GENERACIÓN DE ALIAS Y CREDENCIALES INSTITUCIONALES
// ============================================================

function aliasBase(nombre) {
  const palabras = String(nombre ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(?:(?:dr|dra|lic|prof)\.?\s+)+/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (palabras.length < 2) {
    throw new Error('Ingresá nombre y apellido para crear la identidad institucional.');
  }

  return `${palabras[0].slice(0, 24)}.${palabras.at(-1).slice(0, 24)}`;
}

async function obtenerCorreoInstitucional(nombre) {
  const base = aliasBase(nombre);
  for (let numero = 1; numero <= 1000; numero++) {
    const alias = `${base}${numero === 1 ? '' : '.' + numero}@${DOMINIO_INTERNO}`;
    const existe = await Usuario.exists({
      $or: [{ emailInstitucional: alias }, { email: alias }]
    });
    if (!existe) return alias;
  }
  throw new Error('No fue posible encontrar un identificador institucional libre.');
}

export function hashTokenActivacion(token) {
  return createHash('sha256').update(token).digest('hex');
}

function generarInvitacion() {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    hash: hashTokenActivacion(token),
    vence: new Date(Date.now() + DURACION_TOKEN_MS)
  };
}

function origenPublico() {
  const url = String(
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  if (!/^https?:\/\/[^\s/]+$/.test(url)) {
    throw new Error('APP_URL debe ser una URL de origen válida (sin rutas).');
  }
  if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
    throw new Error('En producción APP_URL debe utilizar HTTPS.');
  }
  return url;
}


// ============================================================
// ENVÍO DE CORREOS (BREVO API / SMTP DESARROLLO)
// ============================================================

async function enviarCorreoActivacion({ correoPersonal, nombre, alias, token }) {
  const link = `${origenPublico()}/accesos/activar/${token}`;
  const texto = [
    `Hola ${nombre}:`,
    '',
    'Te damos la bienvenida a TurnoFlex.',
    `Tu identificador institucional para iniciar sesión es: ${alias}`,
    'IMPORTANTE: este identificador no es un buzón para recibir correos.',
    '',
    'Activá tu cuenta y elegí tu contraseña en este enlace:',
    link,
    '',
    'El enlace caduca en 24 horas y solo sirve una vez.',
    'Si no solicitaste el acceso, ignorá este mensaje.',
    '',
    'TurnoFlex — una solución desarrollada por Los Claudestinos®'
  ].join('\n');

  // Integración principal con API REST de Brevo (recomendada para producción en Render)
  if (process.env.BREVO_API_KEY) {
    if (!process.env.BREVO_SENDER_EMAIL) {
      throw new Error('Falta BREVO_SENDER_EMAIL.');
    }
    const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'TurnoFlex', email: process.env.BREVO_SENDER_EMAIL },
        to: [{ email: correoPersonal, name: nombre }],
        subject: 'Activación de acceso institucional a TurnoFlex',
        textContent: texto
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!respuesta.ok) {
      throw new Error(`El proveedor de email respondió HTTP ${respuesta.status}.`);
    }
    return;
  }

  // Fallback SMTP local para pruebas de desarrollo (Gmail)
  if (process.env.NODE_ENV !== 'production' &&
      process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const transporte = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    await transporte.sendMail({
      from: `"TurnoFlex" <${process.env.EMAIL_USER}>`,
      to: correoPersonal,
      subject: 'Activación de acceso institucional a TurnoFlex',
      text: texto
    });
    return;
  }

  throw new Error('Configurá BREVO_API_KEY y BREVO_SENDER_EMAIL para enviar invitaciones desde Render.');
}


// ============================================================
// CREACIÓN Y REENVÍO DE CUENTAS INSTITUCIONALES
// ============================================================

export async function crearCuentaInstitucional({
  nombre, correoPersonal, rol, profesionalId = null
}) {
  comprobarModeloUsuarioInstitucional();
  if (!['profesional', 'personal'].includes(rol)) {
    throw new Error('Rol institucional no permitido.');
  }
  if (rol === 'profesional' && !profesionalId) {
    throw new Error('La cuenta profesional debe vincularse a su perfil médico.');
  }

  const email = validarCorreoPersonal(correoPersonal);
  if (await Usuario.exists({ email })) {
    throw new Error('Ya existe una cuenta TurnoFlex con ese correo particular.');
  }

  const alias = await obtenerCorreoInstitucional(nombre);
  const invitacion = generarInvitacion();

  // Generamos una contraseña aleatoria inicial que nadie conoce. 
  // El usuario establecerá su propia clave al completar el flujo de activación.
  const cuenta = await Usuario.create({
    nombre: String(nombre).trim(),
    email,
    emailInstitucional: alias,
    password: randomBytes(48).toString('hex'),
    rol,
    activo: false,
    profesional_id: profesionalId,
    activacionHash: invitacion.hash,
    activacionHasta: invitacion.vence
  });

  let enviado = false;
  try {
    await enviarCorreoActivacion({
      correoPersonal: email,
      nombre: cuenta.nombre,
      alias,
      token: invitacion.token
    });
    enviado = true;
  } catch (error) {
    // Si falla el envío de correo, la cuenta no se borra ni se habilita: 
    // queda registrada como pendiente para permitir un posterior reenvío.
    console.error('Invitación no enviada:', error.message);
  }

  return { cuenta, enviado };
}

export async function reenviarInvitacionInstitucional(cuenta) {
  comprobarModeloUsuarioInstitucional();
  if (!cuenta || cuenta.activo !== false) {
    throw new Error('La cuenta no está pendiente de activación.');
  }

  if (cuenta.suspendidoAdministrativamente === true) {
    throw new Error('La cuenta está desactivada administrativamente.');
  }

  const invitacion = generarInvitacion();
  const actualizado = await Usuario.updateOne(
    { _id: cuenta._id, activo: false, suspendidoAdministrativamente: { $ne: true } },
    { $set: { activacionHash: invitacion.hash, activacionHasta: invitacion.vence } }
  );
  if (actualizado.matchedCount !== 1) {
    throw new Error('La cuenta dejó de estar pendiente.');
  }

  try {
    await enviarCorreoActivacion({
      correoPersonal: cuenta.email,
      nombre: cuenta.nombre,
      alias: cuenta.emailInstitucional,
      token: invitacion.token
    });
    return true;
  } catch (error) {
    console.error('Error al reenviar invitación:', error.message);
    return false;
  }
}