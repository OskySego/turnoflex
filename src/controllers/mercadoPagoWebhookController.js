import crypto from 'node:crypto';
import mongoose from 'mongoose';

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { Turno } from '../models/Turno.js';


// ============================================================
// MANEJO DE ERRORES DEL WEBHOOK
// ============================================================

// Armo una clase propia para atajar y diferenciar rápidamente 
// los errores del webhook de otros errores del sistema.
class WebhookError extends Error {
  constructor(mensaje, statusCode = 400) {
    super(mensaje);
    this.name = 'WebhookError';
    this.statusCode = statusCode;
  }
}


// ============================================================
// EXTRACCIÓN SEGURA DE DATOS
// ============================================================

// Me aseguro de que el valor que me mandan siempre sea un string limpio, 
// incluso si por algún motivo bizarro Mercado Pago me lo manda como Array.
function obtenerValorSimple(valor) {
  if (Array.isArray(valor)) {
    return valor.length ? String(valor[0]) : '';
  }

  if (valor === undefined || valor === null) {
    return '';
  }

  return String(valor);
}


// ============================================================
// VALIDAR FIRMA CRIPTOGRÁFICA DE MERCADO PAGO
// ============================================================

function validarFirmaMercadoPago(req) {

  // Traigo la clave secreta que me dio Mercado Pago desde las variables de entorno
  const secret = String(process.env.MP_WEBHOOK_SECRET || '').trim();

  if (!secret) {
    throw new WebhookError('MP_WEBHOOK_SECRET no está configurado en el servidor.', 503);
  }

  // Agarro los encabezados (headers) de seguridad que me manda el webhook
  const xSignature = obtenerValorSimple(req.headers['x-signature']);
  const xRequestId = obtenerValorSimple(req.headers['x-request-id']);

  // Busco el ID del pago, puede venir por Query Params o en el Body
  const dataId = obtenerValorSimple(req.query['data.id']) || obtenerValorSimple(req.body?.data?.id);


  if (!xSignature || !xRequestId || !dataId) {
    throw new WebhookError('Webhook incompleto. Faltan parámetros de seguridad.', 400);
  }


  // ----------------------------------------------------------
  // PARSEAR LA FIRMA
  // ----------------------------------------------------------

  // El x-signature viene en un formato feo: "ts=timestamp,v1=firma". 
  // Lo desarmo y lo meto en un objeto para leerlo más fácil.
  const partes = {};

  xSignature.split(',').forEach(function (parte) {
    const indice = parte.indexOf('=');

    if (indice === -1) return;

    const clave = parte.slice(0, indice).trim();
    const valor = parte.slice(indice + 1).trim();

    partes[clave] = valor;
  });

  const ts = partes.ts;
  const firmaRecibida = partes.v1;

  if (!ts || !firmaRecibida) {
    throw new WebhookError('Firma de webhook incompleta (Falta ts o v1).', 401);
  }


  // ----------------------------------------------------------
  // CHEQUEOS DE SEGURIDAD BÁSICOS
  // ----------------------------------------------------------

  // La firma de MP es un hash SHA-256 (64 caracteres hexadecimales). 
  // Si no coincide con este patrón, la descarto de una.
  if (!/^[a-fA-F0-9]{64}$/.test(firmaRecibida)) {
    throw new WebhookError('Firma de webhook malformada.', 401);
  }

  const timestamp = Number(ts);

  if (!Number.isFinite(timestamp)) {
    throw new WebhookError('Timestamp del webhook inválido.', 401);
  }


  // ----------------------------------------------------------
  // DEFENSA CONTRA REPLAY ATTACKS
  // ----------------------------------------------------------

  // Acomodo el timestamp a milisegundos y comparo. 
  // Si la petición es de hace más de 5 minutos, la reboto por seguridad.
  const timestampMs = timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
  
  const diferencia = Math.abs(Date.now() - timestampMs);
  const cincoMinutos = 5 * 60 * 1000;

  if (diferencia > cincoMinutos) {
    throw new WebhookError('El webhook se encuentra fuera de la ventana temporal permitida.', 401);
  }


  // ----------------------------------------------------------
  // COMPARACIÓN CRIPTOGRÁFICA DE LA FIRMA
  // ----------------------------------------------------------

  // Armo el "manifest" (texto crudo) exactamente como me lo pide la documentación de Mercado Pago
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // Hasheo ese texto con mi clave secreta
  const firmaEsperada = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  const bufferEsperado = Buffer.from(firmaEsperada, 'utf8');
  const bufferRecibido = Buffer.from(firmaRecibida, 'utf8');

  // Comparo las longitudes primero para evitar un error del timingSafeEqual
  if (bufferEsperado.length !== bufferRecibido.length) {
    throw new WebhookError('Longitud de firma de webhook inválida.', 401);
  }

  // Hago una comparación segura contra ataques de tiempo (Timing Attacks)
  const firmaValida = crypto.timingSafeEqual(bufferEsperado, bufferRecibido);

  if (!firmaValida) {
    throw new WebhookError('La validación criptográfica de la firma del webhook falló.', 401);
  }

  // Si pasó todos los escudos, devuelvo limpio el ID del pago
  return dataId;
}


// ============================================================
// CONTROLADOR MERCADO PAGO
// ============================================================


// ============================================================
// SINCRONIZAR PAGO CONTRA LA API DE MERCADO PAGO
// ============================================================

export async function sincronizarPagoMercadoPago(paymentId, app, turnoIdEsperado = null) {
  
  const id = String(paymentId || '');
  
  // Me aseguro que el ID que voy a mandar a buscar sea solo numérico (hasta 30 dígitos)
  if (!/^\d{1,30}$/.test(id)) {
    throw new WebhookError('ID de pago inválido.', 400);
  }
  
  const accessToken = String(process.env.MP_ACCESS_TOKEN || '').trim();
  
  if (!accessToken) {
    throw new WebhookError('Falta MP_ACCESS_TOKEN.', 503);
  }


  // Le pregunto directamente a la API de Mercado Pago cuál es el estado real de este pago.
  // Es más seguro que confiar ciegamente en lo que viene en el Body.
  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
  const pago = await new Payment(client).get({ id });
  
  if (!pago || String(pago.id) !== id) {
    throw new WebhookError('Mercado Pago no devolvió el pago solicitado.', 502);
  }
  

  // Busco qué turno de mi base de datos está asociado a este pago
  const turnoId = String(pago.external_reference || '');
  
  if (!mongoose.Types.ObjectId.isValid(turnoId) || (turnoIdEsperado && turnoId !== String(turnoIdEsperado))) {
    throw new WebhookError('El pago no corresponde al turno.', 409);
  }
  
  const turno = await Turno.findById(turnoId);
  
  if (!turno) {
    throw new WebhookError('Turno inexistente para este pago.', 404);
  }


  // Si ya lo había contabilizado antes (por ejemplo, si el cliente volvió de la pasarela y MP me manda el webhook 
  // al mismo tiempo), freno acá para no duplicar el trabajo ni la auditoría.
  if (turno.estadoPago !== 'pendiente') {
    if (turno.metodoPago === 'mercadopago' && turno.mercadoPago?.paymentId === id && turno.mercadoPago?.status === 'approved') {
      return { estado: 'registrado', turnoId };
    }
    
    console.warn(`[MP] Pago ${id}: turno ${turnoId} ya contabilizado. Revisión manual si hubo otro cobro.`);
    
    return { estado: 'registrado', turnoId };
  }
  

  // Freno si me mandan un pago para un turno que se suponía que iba a ser en efectivo en la clínica,
  // o si el turno no tenía un link de pago generado (preferenceId).
  if (turno.metodoPago !== 'mercadopago' || !turno.mercadoPago?.preferenceId) {
    throw new WebhookError('El turno no tiene una preferencia de Mercado Pago activa.', 409);
  }
  
  // Si el turno ya pasó (está cancelado o ya se atendió al paciente), freno. El pago se tiene que revisar a mano.
  if (['cancelado', 'atendido'].includes(turno.estado)) {
    throw new WebhookError('Turno finalizado: el pago requiere revisión manual.', 409);
  }


  // Valido que no me estén pagando de menos (Ej: modificaron el importe desde Postman).
  // Multiplico por 100 y redondeo para comparar en centavos enteros y evitar problemas de decimales en JavaScript.
  const cantidadCentavos = Math.round(Number(pago.transaction_amount) * 100);
  const esperadoCentavos = Math.round(Number(turno.montoSena) * 100);
  
  if (
    !Number.isSafeInteger(cantidadCentavos) ||
    !Number.isSafeInteger(esperadoCentavos) || 
    esperadoCentavos <= 0 ||
    cantidadCentavos !== esperadoCentavos || 
    String(pago.currency_id || '') !== 'ARS'
  ) {
    throw new WebhookError('Importe o moneda del pago no coincide con la seña del turno.', 409);
  }


  const estado = String(pago.status || '');
  const detalles = String(pago.status_detail || '');
  
  // Si el pago no fue aprobado (ej: rechazado por fondos o pendiente en PagoFácil), actualizo 
  // los datos en Mongo pero NO le confirmo la reserva al paciente todavía.
  if (estado !== 'approved') {
    
    await Turno.updateOne(
      { _id: turno._id, estadoPago: 'pendiente', metodoPago: 'mercadopago' }, 
      { $set: {
          'mercadoPago.paymentId': id,
          'mercadoPago.status': estado,
          'mercadoPago.statusDetail': detalles
        } 
      }
    );
    
    return { estado: estado === 'pending' || estado === 'in_process' ? 'pendiente' : 'rechazado', turnoId };
  }


  // ========================================================
  // PAGO APROBADO: ACTUALIZAR ESTADOS Y AUDITORÍA
  // ========================================================

  const nuevoEstadoPago = ['particular','copago'].includes(turno.tipoCobro) ? 'total_pagado' : 'sena_pagada';
  const cambiaEstado = turno.estado === 'pendiente_pago';
  const nuevoEstado = cambiaEstado ? 'reservado' : turno.estado;
  const ahora = new Date();
  
  // Armo el bloque de auditoría para dejar asentado de forma transparente 
  // que este cambio lo hizo el sistema de forma automática a través de MP.
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
  
  // Hago una actualización ATÓMICA ($set y $push) buscando exactamente por el estado anterior. 
  // Así evito que si me entran 2 webhooks al mismo tiempo, los dos modifiquen e inserten duplicados.
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
  
  if (!actualizado) {
    return { estado: 'registrado', turnoId };
  }


  // Mando la orden por WebSocket para que a la secretaria 
  // se le ponga la cajita verde del turno en su pantalla en tiempo real.
  const io = app?.get?.('socketio');
  
  if (io) {
    io.emit('actualizacion_agenda', {
      tipo: 'PAGO_MP_CONFIRMADO', id: actualizado._id,
      paymentId: id, nuevoEstado: nuevoEstado, estadoPago: nuevoEstadoPago
    });
  }
  
  return { estado: 'aprobado', turnoId };
}


// ============================================================
// HANDLER DEL WEBHOOK
// ============================================================

export class MercadoPagoWebhookController {
  
  static async recibirNotificacion(req, res) {
    try {
      
      // Acá NO hay sesión web, así que obligo a que la petición pase por mi escudo HMAC
      const paymentId = validarFirmaMercadoPago(req);
      const tipo = obtenerValorSimple(req.body?.type) || obtenerValorSimple(req.query?.type);
      
      // MP manda webhooks de todo tipo (ej: planes de suscripción). Si no es un pago simple, 
      // le devuelvo 200 (OK) para que deje de molestar, pero no lo proceso.
      if (tipo && tipo !== 'payment') {
        return res.sendStatus(200);
      }
      
      await sincronizarPagoMercadoPago(paymentId, req.app);
      
      return res.sendStatus(200);
      
    } catch (error) {
      if (error instanceof WebhookError) {
        console.warn(`[Mercado Pago Webhook ${error.statusCode}] ${error.message}`);
        
        // Si el turno no existe (404) o el importe no coincide (409), devuelvo 200 
        // para que Mercado Pago no intente volver a mandarme este webhook fallido.
        const status = error.statusCode === 409 || error.statusCode === 404 ? 200 : error.statusCode;
        
        return res.sendStatus(status);
      }
      
      console.error('Mercado Pago Webhook Fallo Interno:', error);
      
      // Si fue culpa mía (código 500), le digo a Mercado Pago que sí vuelva a reintentar mandarlo más tarde.
      return res.sendStatus(500);
    }
  }
}

export default MercadoPagoWebhookController;