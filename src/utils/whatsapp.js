/**
 * Servicio de mensajería y bot de WhatsApp para TurnoFlex (whatsapp-web.js).
 * Gestiona el ciclo de vida del cliente, autenticación por código QR, sincronización vía WebSockets y envío de recordatorios.
 */

import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';

const { Client, LocalAuth } = pkg;

// ============================================================
// TURNOFLEX - SERVICIO DE WHATSAPP
// ============================================================

let client = null;
let latestQr = null;
let isReady = false;
let pruebaEnviada = false;

// ============================================================
// INICIALIZACIÓN DEL CLIENTE DE WHATSAPP
// ============================================================

export const iniciarWhatsApp = (io) => {

  if (client) {
    console.log('WhatsApp ya fue inicializado.');
    return;
  }

  console.log('🚀 Iniciando cliente de WhatsApp...');

  client = new Client({
    authStrategy: new LocalAuth(),

    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    }
  });

  // ==========================================================
  // GENERACIÓN DEL CÓDIGO QR PARA VINCULACIÓN
  // ==========================================================

  client.on('qr', async (qr) => {
    console.log('📱 WhatsApp solicita vincular un dispositivo.');

    isReady = false;

    try {
      latestQr = await qrcode.toDataURL(qr);

      // Emitimos el QR actualizado a través de Socket.io al panel de control
      io.emit('whatsapp_qr', latestQr);

      console.log('✅ Código QR enviado al panel de TurnoFlex.');

    } catch (error) {
      console.error(
        '❌ Error al generar QR:',
        error.message
      );
    }
  });

  // ==========================================================
  // EVENTOS DE AUTENTICACIÓN
  // ==========================================================

  client.on('authenticated', () => {
    console.log('✅ WhatsApp: autenticación correcta.');
  });

  client.on('auth_failure', (mensaje) => {
    console.error(
      '❌ WhatsApp: fallo de autenticación:',
      mensaje
    );

    isReady = false;
  });

  // ==========================================================
  // PROGRESO DE CARGA DE SESIÓN
  // ==========================================================

  client.on('loading_screen', (porcentaje, mensaje) => {
    console.log(
      `⏳ WhatsApp cargando: ${porcentaje}% - ${mensaje || ''}`
    );
  });

  // ==========================================================
  // CAMBIOS DE ESTADO DE LA CONEXIÓN
  // ==========================================================

  client.on('change_state', (estado) => {
    console.log('📡 WhatsApp estado:', estado);
  });

  // ==========================================================
  // CLIENTE LISTO Y OPERATIVO
  // ==========================================================

  client.on('ready', async () => {

    console.log('✅ Bot de WhatsApp conectado.');

    isReady = true;
    latestQr = null;

    // Notificamos al panel de secretaría que el bot está operativo
    io.emit('whatsapp_ready');

    // Ejecutamos mensaje de prueba opcional únicamente si fue configurado por entorno
    const numeroPrueba =
      process.env.TURNOFLEX_PRUEBA_WHATSAPP;

    if (!numeroPrueba || pruebaEnviada) {
      return;
    }

    pruebaEnviada = true;

    try {
      const numero = numeroPrueba.replace(/\D/g, '');

      if (!/^549\d{10}$/.test(numero)) {
        console.error(
          '❌ Número de prueba inválido. Usar 549 + 10 dígitos.'
        );
        return;
      }

      console.log('📨 Preparando mensaje de prueba...');

      const destino = await client.getNumberId(numero);

      if (!destino) {
        console.error(
          '❌ El número de prueba no fue encontrado en WhatsApp.'
        );
        return;
      }

      const mensaje =
        '✅ Prueba de TurnoFlex\n\n' +
        'WhatsApp está conectado correctamente.\n' +
        'El sistema puede enviar mensajes.';

      await client.sendMessage(
        destino._serialized,
        mensaje
      );

      console.log(
        '✅ Mensaje de prueba enviado correctamente.'
      );

    } catch (error) {
      console.error(
        '❌ Error al enviar mensaje de prueba:',
        error.message
      );
    }
  });

  // ==========================================================
  // GESTIÓN DE DESCONEXIÓN
  // ==========================================================

  client.on('disconnected', (motivo) => {

    console.error(
      '🔌 WhatsApp desconectado:',
      motivo
    );

    isReady = false;
    latestQr = null;
  });

  // ==========================================================
  // SINCRONIZACIÓN DE ESTADO CON NUEVAS CONEXIONES SOCKET.IO
  // ==========================================================

  io.on('connection', (socket) => {

    if (isReady) {

      socket.emit('whatsapp_ready');

    } else if (latestQr) {

      socket.emit('whatsapp_qr', latestQr);

    }
  });

  // ==========================================================
  // INICIO DE LA INSTANCIA DE CLIENTE
  // ==========================================================

  try {

    client.initialize().catch((error) => {

      console.error(
        '❌ Error al iniciar WhatsApp:',
        error
      );

      isReady = false;
    });

  } catch (error) {

    console.error(
      '❌ Error inesperado al inicializar WhatsApp:',
      error
    );

    isReady = false;
  }
};


// ============================================================
// ENVÍO DE RECORDATORIOS AUTOMÁTICOS DE TURNOS
// ============================================================

export const enviarWhatsApp = async (
  numero,
  paciente,
  fecha,
  hora,
  profesional
) => {

  if (!client || !isReady) {

    console.log(
      '⚠️ WhatsApp no está listo para enviar mensajes.'
    );

    return false;
  }

  try {

    const numeroLimpio = String(numero).replace(/\D/g, '');

    // Normalización de números telefónicos argentinos con o sin prefijo 549
    let telefono = numeroLimpio;

    if (telefono.startsWith('549')) {
      telefono = telefono.substring(3);
    } else if (telefono.startsWith('54')) {
      telefono = telefono.substring(2);

      if (telefono.startsWith('9')) {
        telefono = telefono.substring(1);
      }
    }

    telefono = telefono.replace(/^0/, '');

    const chatId = `549${telefono}@c.us`;

    const mensaje =
      `Hola *${paciente}* 👋\n\n` +
      `Te recordamos que tenés un turno programado para mañana:\n\n` +
      `👨‍⚕️ *Profesional:* ${profesional}\n` +
      `📅 *Fecha:* ${fecha}\n` +
      `⏰ *Hora:* ${hora} hs\n\n` +
      `Si no podés asistir, por favor ingresá a tu portal web para cancelarlo.`;

    await client.sendMessage(chatId, mensaje);

    console.log(
      '✅ Recordatorio de WhatsApp enviado.'
    );

    return true;

  } catch (error) {

    console.error(
      '❌ Error al enviar recordatorio de WhatsApp:',
      error.message
    );

    return false;
  }
};