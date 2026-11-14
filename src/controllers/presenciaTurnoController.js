import mongoose from 'mongoose';
import { Turno } from '../models/Turno.js';

// Trabajo con la fecha de Buenos Aires para identificar
// correctamente los turnos de la jornada.
function fechaDeHoy() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const dato = tipo =>
    partes.find(parte => parte.type === tipo)?.value || '';

  return `${dato('year')}-${dato('month')}-${dato('day')}`;
}

function responder(req, res, codigo, mensaje, id) {
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(codigo).json({
      ok: codigo < 400,
      mensaje
    });
  }

  if (codigo >= 400) {
    return res.status(codigo).send(mensaje);
  }

  return res.redirect(
    303,
    `/turnos/${encodeURIComponent(id)}?exito=${encodeURIComponent(mensaje)}`
  );
}

async function cambiarPresencia(req, res, confirmar) {
  try {
    const usuario = req.session?.usuario;

    if (!usuario || !['admin', 'personal'].includes(usuario.rol)) {
      return responder(
        req, res, 403,
        'No tenés permiso para registrar llegadas.'
      );
    }

    const turnoId = String(req.params.id || '');

    if (!mongoose.Types.ObjectId.isValid(turnoId)) {
      return responder(
        req, res, 400,
        'El turno indicado no es válido.'
      );
    }

    const hoy = fechaDeHoy();
    const ahora = new Date();

    const idUsuario = usuario.id || usuario._id;

    const realizadoPor = mongoose.Types.ObjectId.isValid(idUsuario)
      ? idUsuario
      : null;

    // Solo modifico turnos de hoy que todavía pueden
    // recibir atención. Evito duplicar confirmaciones.
    const filtro = {
      _id: turnoId,
      fecha: hoy,
      estado: {
        $in: ['reservado', 'En Espera', 'pendiente_pago']
      },
      ...(confirmar
        ? { presentadoEn: null }
        : {
            presentadoEn: { $ne: null },
            ultimoLlamadoSalaEn: null
          })
    };

    // La llegada se guarda por separado.
    // No modifico estados de atención ni de pago.
    const cambio = {
      $set: {
        presentadoEn: confirmar ? ahora : null,
        presentadoPor: confirmar ? realizadoPor : null
      },
      $push: {
        auditoria: {
          accion: 'modificacion',
          realizadoPor,
          rol: usuario.rol,
          detalle: confirmar
            ? 'Confirmé la llegada del paciente a recepción.'
            : 'Corregí la confirmación de llegada del paciente.',
          fecha: ahora
        }
      }
    };

    const resultado = await Turno.updateOne(
      filtro,
      cambio
    );

    if (!resultado?.acknowledged || resultado.matchedCount !== 1) {
      return responder(
        req,
        res,
        409,
        confirmar
          ? 'No pude confirmar la llegada. Revisá la fecha, el estado o si ya se registró.'
          : 'No puedo deshacer la llegada: el turno cambió o el paciente ya fue llamado.'
      );
    }

    // Aviso a las agendas médicas conectadas.
    // No transmito datos personales del paciente.
    const io = req.app.get('socketio');

    if (typeof io?.to === 'function') {
      io.to('agenda-medica').emit(
        'presencia_actualizada',
        { fecha: hoy }
      );
    }

    return responder(
      req,
      res,
      200,
      confirmar
        ? 'Llegada confirmada correctamente.'
        : 'Confirmación de llegada anulada.',
      turnoId
    );

  } catch (error) {
    console.error(
      'Error al registrar la presencia del paciente:',
      error
    );

    return responder(
      req,
      res,
      500,
      'No se pudo actualizar la presencia del paciente.'
    );
  }
}

export const confirmarLlegada = (req, res) =>
  cambiarPresencia(req, res, true);

export const anularLlegada = (req, res) =>
  cambiarPresencia(req, res, false);