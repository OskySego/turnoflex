/**
 * Procesamiento y validación de notificaciones Webhook de Mercado Pago para TurnoFlex.
 * Gestiona la verificación de firmas HMAC cifradas, el control temporal anti-replay y la sincronización de pagos de seña.
 */

import crypto from 'node:crypto';
import mongoose from 'mongoose';

import {
  MercadoPagoConfig,
  Payment
} from 'mercadopago';

import {
  Turno
} from '../models/Turno.js';


// ============================================================
// CLASE DE ERROR CONTROLADO PARA EL WEBHOOK
// ============================================================

class WebhookError extends Error {
  constructor(
    mensaje,
    statusCode = 400
  ) {
    super(mensaje);

    this.name =
      'WebhookError';

    this.statusCode =
      statusCode;
  }
}


// ============================================================
// HELPER: OBTENER VALOR SIMPLE DESDE REQUEST
// ============================================================

function obtenerValorSimple(
  valor
) {
  if (
    Array.isArray(valor)
  ) {
    return valor.length
      ? String(valor[0])
      : '';
  }

  if (
    valor === undefined ||
    valor === null
  ) {
    return '';
  }

  return String(valor);
}


// ============================================================
// VALIDACIÓN DE FIRMA HMAC DE MERCADO PAGO
//
// Mercado Pago envía los headers:
// x-signature: ts=...,v1=...
// x-request-id: ...
//
// Manifest esperado:
// id:<data.id>;request-id:<request-id>;ts:<timestamp>;
// ============================================================

function validarFirmaMercadoPago(
  req
) {
  const secret =
    String(
      process.env.MP_WEBHOOK_SECRET ||
      ''
    ).trim();

  if (!secret) {
    throw new WebhookError(
      'MP_WEBHOOK_SECRET no está configurado.',
      503
    );
  }

  const xSignature =
    obtenerValorSimple(
      req.headers[
        'x-signature'
      ]
    );

  const xRequestId =
    obtenerValorSimple(
      req.headers[
        'x-request-id'
      ]
    );

  const dataId =
    obtenerValorSimple(
      req.query[
        'data.id'
      ]
    ) ||
    obtenerValorSimple(
      req.body?.data?.id
    );

  if (
    !xSignature ||
    !xRequestId ||
    !dataId
  ) {
    throw new WebhookError(
      'Webhook incompleto.',
      400
    );
  }


  // ----------------------------------------------------------
  // EXTRACCIÓN DE PARÁMETROS (ts Y v1)
  // ----------------------------------------------------------

  const partes = {};

  xSignature
    .split(',')
    .forEach(
      function (
        parte
      ) {
        const indice =
          parte.indexOf('=');

        if (
          indice === -1
        ) {
          return;
        }

        const clave =
          parte
            .slice(
              0,
              indice
            )
            .trim();

        const valor =
          parte
            .slice(
              indice + 1
            )
            .trim();

        partes[clave] =
          valor;
      }
    );

  const ts =
    partes.ts;

  const firmaRecibida =
    partes.v1;

  if (
    !ts ||
    !firmaRecibida
  ) {
    throw new WebhookError(
      'Firma de webhook incompleta.',
      401
    );
  }


  // ----------------------------------------------------------
  // VALIDACIÓN DE FORMATO HEXADECIMAL DE LA FIRMA
  // ----------------------------------------------------------

  if (
    !/^[a-fA-F0-9]{64}$/.test(
      firmaRecibida
    )
  ) {
    throw new WebhookError(
      'Firma de webhook inválida.',
      401
    );
  }


  // ----------------------------------------------------------
  // VALIDACIÓN TEMPORAL (VENTANA MÁXIMA DE 5 MINUTOS)
  // Soportamos timestamps en segundos o milisegundos.
  // ----------------------------------------------------------

  const timestamp =
    Number(ts);

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    throw new WebhookError(
      'Timestamp del webhook inválido.',
      401
    );
  }

  const timestampMs =
    timestamp >
    1_000_000_000_000

      ? timestamp

      : timestamp *
        1000;

  const diferencia =
    Math.abs(
      Date.now() -
      timestampMs
    );

  const cincoMinutos =
    5 *
    60 *
    1000;

  if (
    diferencia >
    cincoMinutos
  ) {
    throw new WebhookError(
      'El webhook se encuentra fuera de la ventana temporal permitida.',
      401
    );
  }


  // ----------------------------------------------------------
  // CONSTRUCCIÓN DEL MANIFEST Y COMPROBACIÓN HMAC SHA-256
  // ----------------------------------------------------------

  const manifest =
    `id:${dataId};` +
    `request-id:${xRequestId};` +
    `ts:${ts};`;

  const firmaEsperada =
    crypto
      .createHmac(
        'sha256',
        secret
      )
      .update(
        manifest
      )
      .digest(
        'hex'
      );

  const bufferEsperado =
    Buffer.from(
      firmaEsperada,
      'utf8'
    );

  const bufferRecibido =
    Buffer.from(
      firmaRecibida,
      'utf8'
    );

  if (
    bufferEsperado.length !==
    bufferRecibido.length
  ) {
    throw new WebhookError(
      'Firma de webhook inválida.',
      401
    );
  }

  // Validación resistente a ataques de tiempo (timing-safe)
  const firmaValida =
    crypto.timingSafeEqual(
      bufferEsperado,
      bufferRecibido
    );

  if (
    !firmaValida
  ) {
    throw new WebhookError(
      'Firma de webhook inválida.',
      401
    );
  }

  return dataId;
}


// ============================================================
// LÓGICA CENTRAL DE SINCRONIZACIÓN DE PAGOS MP
// (Utilizada tanto por el retorno web como por el Webhook)
// ============================================================

export async function sincronizarPagoMercadoPago(paymentId, app, turnoIdEsperado = null) {
  const id = String(paymentId || '');

  if (!/^\d{1,30}$/.test(id)) {
    throw new WebhookError('ID de pago inválido.', 400);
  }

  const accessToken = String(process.env.MP_ACCESS_TOKEN || '').trim();
  if (!accessToken) throw new WebhookError('Falta MP_ACCESS_TOKEN.', 503);

  // Consultamos directamente a la API oficial de Mercado Pago
  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
  const pago = await new Payment(client).get({ id });

  if (!pago || String(pago.id) !== id) {
    throw new WebhookError('Mercado Pago no devolvió el pago solicitado.', 502);
  }

  const turnoId = String(pago.external_reference || '');

  if (!mongoose.Types.ObjectId.isValid(turnoId) ||
      (turnoIdEsperado && turnoId !== String(turnoIdEsperado))) {
    throw new WebhookError('El pago no corresponde al turno.', 409);
  }

  const turno = await Turno.findById(turnoId);
  if (!turno) throw new WebhookError('Turno inexistente para este pago.', 404);

  // Los pagos ya contabilizados nunca vuelven a procesarse ni alteran su método de pago
  if (turno.estadoPago !== 'pendiente') {
    if (turno.metodoPago === 'mercadopago' &&
        turno.mercadoPago?.paymentId === id &&
        turno.mercadoPago?.status === 'approved') {
      return { estado: 'registrado', turnoId };
    }
    console.warn(`[MP] Pago ${id}: turno ${turnoId} ya contabilizado. Revisión manual si hubo otro cobro.`);
    return { estado: 'registrado', turnoId };
  }

  if (turno.metodoPago !== 'mercadopago' || !turno.mercadoPago?.preferenceId) {
    throw new WebhookError('El turno no tiene una preferencia de Mercado Pago activa.', 409);
  }

  if (['cancelado', 'atendido'].includes(turno.estado)) {
    throw new WebhookError('Turno finalizado: el pago requiere revisión manual.', 409);
  }

  // Validamos coincidencia exacta de importe en centavos y moneda ARS
  const cantidadCentavos = Math.round(Number(pago.transaction_amount) * 100);
  const esperadoCentavos = Math.round(Number(turno.montoSena) * 100);

  if (!Number.isSafeInteger(cantidadCentavos) ||
      !Number.isSafeInteger(esperadoCentavos) || esperadoCentavos <= 0 ||
      cantidadCentavos !== esperadoCentavos || String(pago.currency_id || '') !== 'ARS') {
    throw new WebhookError('Importe o moneda del pago no coincide con la seña del turno.', 409);
  }

  const estado = String(pago.status || '');
  const detalles = String(pago.status_detail || '');

  if (estado !== 'approved') {
    // Estados pendientes o rechazados no confirman la reserva, pero registramos el intento
    await Turno.updateOne({
      _id: turno._id, estadoPago: 'pendiente', metodoPago: 'mercadopago'
    }, { $set: {
      'mercadoPago.paymentId': id,
      'mercadoPago.status': estado,
      'mercadoPago.statusDetail': detalles
    } });

    return { estado: estado === 'pending' || estado === 'in_process' ? 'pendiente' : 'rechazado', turnoId };
  }

  const nuevoEstadoPago = ['particular','copago'].includes(turno.tipoCobro) ? 'total_pagado' : 'sena_pagada';
  const cambiaEstado = turno.estado === 'pendiente_pago';
  const nuevoEstado = cambiaEstado ? 'reservado' : turno.estado;
  const ahora = new Date();

  const push = {
    auditoria: {
      accion: 'pago_mp_confirmado', realizadoPor: null, rol: 'sistema',
      detalle: `Pago verificado por la API de Mercado Pago. Payment ID: ${id}.`,
      estadoAnterior: turno.estado, estadoNuevo: nuevoEstado,
      estadoPagoAnterior: 'pendiente', estadoPagoNuevo: nuevoEstadoPago, fecha: ahora
    }
  };

  if (cambiaEstado) {
    push.historialEstados = {
      estadoAnterior: 'pendiente_pago', estadoNuevo: 'reservado',
      modificadoPor: null, fechaModificacion: ahora
    };
  }

  // Actualización atómica en base de datos para evitar confirmaciones dobles
  const actualizado = await Turno.findOneAndUpdate({
    _id: turno._id, estadoPago: 'pendiente', metodoPago: 'mercadopago',
    estado: turno.estado, montoSena: turno.montoSena
  }, {
    $set: {
      estadoPago: nuevoEstadoPago, estado: nuevoEstado,
      'mercadoPago.paymentId': id, 'mercadoPago.status': estado,
      'mercadoPago.statusDetail': detalles
    }, $push: push
  }, { new: true });

  if (!actualizado) return { estado: 'registrado', turnoId };

  // Emitimos evento en tiempo real vía WebSockets si está disponible en la app
  const io = app?.get?.('socketio');
  if (io) io.emit('actualizacion_agenda', {
    tipo: 'PAGO_MP_CONFIRMADO', id: actualizado._id,
    paymentId: id, nuevoEstado: nuevoEstado, estadoPago: nuevoEstadoPago
  });

  return { estado: 'aprobado', turnoId };
}


// ============================================================
// CONTROLADOR DE WEBHOOKS
// ============================================================

export class MercadoPagoWebhookController {
  static async recibirNotificacion(req, res) {
    try {
      // Sin sesión de usuario: validación estricta de firma HMAC para aceptar la notificación
      const paymentId = validarFirmaMercadoPago(req);
      const tipo = obtenerValorSimple(req.body?.type) || obtenerValorSimple(req.query?.type);

      // Si el evento no corresponde a un pago directo, respondemos OK sin procesar
      if (tipo && tipo !== 'payment') return res.sendStatus(200);

      await sincronizarPagoMercadoPago(paymentId, req.app);
      return res.sendStatus(200);
    } catch (error) {
      if (error instanceof WebhookError) {
        console.warn(`[Mercado Pago Webhook ${error.statusCode}] ${error.message}`);

        // Las firmas inválidas retornan error, mientras que discrepancias de negocio 
        // devuelven 200 a MP para evitar reintentos infinitos innecesarios
        const status = error.statusCode === 409 || error.statusCode === 404
          ? 200 : error.statusCode;

        return res.sendStatus(status);
      }

      console.error('Mercado Pago Webhook:', error);
      return res.sendStatus(500); // Retornamos 500 para permitir reintentos automáticos ante caídas transitorias
    }
  }
}

export default MercadoPagoWebhookController;