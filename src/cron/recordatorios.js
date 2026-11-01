import cron from 'node-cron';
import { Turno } from '../models/Turno.js';
import { sendRecordatorio } from '../utils/mailer.js';
import { enviarWhatsApp } from '../utils/whatsapp.js';

const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
const COLECCION_ENVIOS = 'recordatorio_envios';

let tareaProgramada = null;
let ejecucionEnCurso = false;

// ============================================================
// CALCULAR MAÑANA EN ARGENTINA
// ============================================================

function fechaDeMananaArgentina(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(ahora);

  const valor = (tipo) =>
    Number(partes.find((p) => p.type === tipo)?.value);

  const siguiente = new Date(Date.UTC(
    valor('year'),
    valor('month') - 1,
    valor('day') + 1
  ));

  return siguiente.toISOString().slice(0, 10);
}

// ============================================================
// REGISTRAR INTENTO DE ENVÍO EN MONGODB
// ============================================================

async function registrarIntento(turnoId, fecha, canal) {
  const id = `${turnoId}:${fecha}:${canal}`;

  try {
    await Turno.db.collection(COLECCION_ENVIOS).insertOne({
      _id: id,
      turnoId: String(turnoId),
      fecha,
      canal,
      estado: 'iniciado',
      creadoEn: new Date()
    });

    return id;
  } catch (error) {
    if (error?.code === 11000) {
      return null;
    }

    throw error;
  }
}

// ============================================================
// ACTUALIZAR RESULTADO
// ============================================================

async function actualizarIntento(id, estado, error = null) {
  const cambios = {
    estado,
    actualizadoEn: new Date()
  };

  if (error) {
    cambios.error = String(
      error.message || error
    ).slice(0, 300);
  }

  await Turno.db.collection(COLECCION_ENVIOS).updateOne(
    { _id: id },
    { $set: cambios }
  );
}

// ============================================================
// PROCESAR UN CANAL SIN DUPLICADOS AUTOMÁTICOS
// ============================================================

async function procesarCanal(
  turno,
  fecha,
  canal,
  enviar,
  resumen
) {
  const id = await registrarIntento(
    turno._id,
    fecha,
    canal
  );

  if (!id) {
    resumen.yaProcesados++;

    console.log(
      `Recordatorio ya intentado: turno ${turno._id}, ${canal}`
    );

    return;
  }

  try {
    // Verificar que el turno siga reservado
    const sigueReservado = await Turno.exists({
      _id: turno._id,
      fecha,
      estado: 'reservado'
    });

    if (!sigueReservado) {
      await actualizarIntento(id, 'omitido');
      resumen.omitidos++;
      return;
    }

    const resultado = await enviar();

    // WhatsApp devuelve false si no pudo enviar
    if (canal === 'whatsapp' && resultado !== true) {
      throw new Error(
        'WhatsApp no confirmó el envío.'
      );
    }

    await actualizarIntento(id, 'aceptado');

    if (canal === 'correo') {
      resumen.correosAceptados++;
    }

    if (canal === 'whatsapp') {
      resumen.whatsappsAceptados++;
    }

    console.log(
      `✅ ${canal} aceptado para turno ${turno._id}`
    );

  } catch (error) {
    resumen.fallidos++;

    console.error(
      `❌ Falló ${canal} para turno ${turno._id}:`,
      error.message
    );

    try {
      await actualizarIntento(
        id,
        'fallido',
        error
      );
    } catch (errorRegistro) {
      console.error(
        '❌ No se pudo registrar el fallo:',
        errorRegistro.message
      );
    }
  }
}

// ============================================================
// EJECUTAR RECORDATORIOS
// ============================================================

export async function ejecutarRecordatorios(
  { simulacion = false } = {}
) {
  if (ejecucionEnCurso) {
    console.log(
      'Ya hay un proceso de recordatorios en ejecución.'
    );
    return;
  }

  ejecucionEnCurso = true;

  const fecha = fechaDeMananaArgentina();

  const resumen = {
    turnos: 0,
    correosAceptados: 0,
    whatsappsAceptados: 0,
    fallidos: 0,
    omitidos: 0,
    yaProcesados: 0
  };

  try {
    console.log(
      `⏳ Recordatorios para ${fecha} (${ZONA_HORARIA})` +
      (simulacion ? ' [SIMULACIÓN]' : '')
    );

    // Buscar solamente turnos reservados para mañana
    const turnos = await Turno.find({
      fecha,
      estado: 'reservado'
    })
      .populate('cliente_id')
      .populate('profesional_id');

    resumen.turnos = turnos.length;

    for (const turno of turnos) {
      const cliente = turno.cliente_id;
      const profesional = turno.profesional_id;

      if (!cliente || !profesional) {
        resumen.omitidos++;

        console.warn(
          `⚠️ Turno ${turno._id}: faltan datos de cliente o profesional.`
        );

        continue;
      }

      // Simulación: no enviar ni registrar intentos
      if (simulacion) {
        console.log(
          `🧪 Turno ${turno._id}: ` +
          `correo=${Boolean(cliente.email)}, ` +
          `WhatsApp=${Boolean(cliente.telefono)}`
        );

        continue;
      }

      // ======================================================
      // ENVÍO DE CORREO
      // ======================================================

      if (cliente.email) {
        await procesarCanal(
          turno,
          fecha,
          'correo',
          () => sendRecordatorio(
            cliente.email,
            cliente.nombre,
            turno.fecha,
            turno.hora,
            profesional.nombre
          ),
          resumen
        );
      }

      // ======================================================
      // ENVÍO DE WHATSAPP
      // ======================================================

      if (cliente.telefono) {
        await procesarCanal(
          turno,
          fecha,
          'whatsapp',
          () => enviarWhatsApp(
            cliente.telefono,
            cliente.nombre,
            turno.fecha,
            turno.hora,
            profesional.nombre
          ),
          resumen
        );
      }
    }

    console.log(
      '✅ Recordatorios finalizados:',
      resumen
    );

    return resumen;

  } catch (error) {
    console.error(
      '❌ Error general en recordatorios:',
      error
    );

    throw error;

  } finally {
    ejecucionEnCurso = false;
  }
}

// ============================================================
// PROGRAMAR RECORDATORIOS DIARIOS A LAS 07:00
// ============================================================

export function iniciarCronJobs() {
  if (tareaProgramada) {
    console.log(
      'La tarea de recordatorios ya está programada.'
    );

    return tareaProgramada;
  }

  tareaProgramada = cron.schedule(
    '0 7 * * *',

    async () => {
      try {
        await ejecutarRecordatorios();
      } catch (error) {
        console.error(
          '❌ Error en la tarea programada:',
          error.message
        );
      }
    },

    {
      timezone: ZONA_HORARIA,
      noOverlap: true
    }
  );

  console.log(
    '🕖 Recordatorios programados para las 07:00 (Buenos Aires).'
  );

  return tareaProgramada;
}