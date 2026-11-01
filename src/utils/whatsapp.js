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
// INICIALIZAR WHATSAPP
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
  // GENERACION DEL CODIGO QR
  // ==========================================================

  client.on('qr', async (qr) => {
    console.log('📱 WhatsApp solicita vincular un dispositivo.');

    isReady = false;

    try {
      latestQr = await qrcode.toDataURL(qr);

      io.emit('whatsapp_qr', latestQr);

      console.log('✅ Codigo QR enviado al panel de TurnoFlex.');

    } catch (error) {
      console.error(
        '❌ Error al generar QR:',
        error.message
      );
    }
  });

  // ==========================================================
  // AUTENTICACION
  // ==========================================================

  client.on('authenticated', () => {
    console.log('✅ WhatsApp: autenticacion correcta.');
  });

  client.on('auth_failure', (mensaje) => {
    console.error(
      '❌ WhatsApp: fallo de autenticacion:',
      mensaje
    );

    isReady = false;
  });

  // ==========================================================
  // PROGRESO DE CARGA
  // ==========================================================

  client.on('loading_screen', (porcentaje, mensaje) => {
    console.log(
      `⏳ WhatsApp cargando: ${porcentaje}% - ${mensaje || ''}`
    );
  });

  // ==========================================================
  // CAMBIOS DE ESTADO
  // ==========================================================

  client.on('change_state', (estado) => {
    console.log('📡 WhatsApp estado:', estado);
  });

  // ==========================================================
  // WHATSAPP CONECTADO
  // ==========================================================

  client.on('ready', async () => {

    console.log('✅ Bot de WhatsApp conectado.');

    isReady = true;
    latestQr = null;

    // Avisar al panel de secretaria
    io.emit('whatsapp_ready');

    // Ejecutar prueba solo si fue solicitada
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
          '❌ Numero de prueba invalido. Usar 549 + 10 digitos.'
        );
        return;
      }

      console.log('📨 Preparando mensaje de prueba...');

      const destino = await client.getNumberId(numero);

      if (!destino) {
        console.error(
          '❌ El numero de prueba no fue encontrado en WhatsApp.'
        );
        return;
      }

      const mensaje =
        '✅ Prueba de TurnoFlex\n\n' +
        'WhatsApp esta conectado correctamente.\n' +
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
  // DESCONEXION
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
  // SINCRONIZACION CON SOCKET.IO
  // ==========================================================

  io.on('connection', (socket) => {

    if (isReady) {

      socket.emit('whatsapp_ready');

    } else if (latestQr) {

      socket.emit('whatsapp_qr', latestQr);

    }
  });

  // ==========================================================
  // INICIAR EL CLIENTE
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
// ENVIAR RECORDATORIOS DE TURNOS
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
      '⚠️ WhatsApp no esta listo para enviar mensajes.'
    );

    return false;
  }

  try {

    const numeroLimpio = String(numero).replace(/\D/g, '');

    // Aceptar numeros argentinos con o sin prefijo 549
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
