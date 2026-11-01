// TurnoFlex: resumen de agenda para Recepción y Administración.
// Consulta de solo lectura. NO modifica turnos ni pagos.
import { Router } from 'express';
import { asegurarAutenticacion, permitirRoles } from '../middlewares/authMiddleware.js';
import { Turno } from '../models/Turno.js';
// Registrar los modelos empleados en populate() de manera explícita.
import '../models/Cliente.js';
import '../models/Profesional.js';

const router = Router();
router.use(asegurarAutenticacion, permitirRoles('admin', 'personal'));

function fechaArgentina() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const p = name => parts.find(item => item.type === name)?.value;
  return `${p('year')}-${p('month')}-${p('day')}`;
}

function fechaValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const date = new Date(`${valor}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === valor;
}

router.get('/resumen', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.set('X-Content-Type-Options', 'nosniff');

    const fecha = req.query.fecha === undefined ? fechaArgentina() : req.query.fecha;
    if (!fechaValida(fecha)) {
      return res.status(400).json({ error: 'La fecha debe tener formato AAAA-MM-DD.' });
    }

    // El listado tiene un límite visual; la cuenta total siempre incluye todos los turnos.
    const [total, turnos] = await Promise.all([
      Turno.countDocuments({ fecha }),
      Turno.find({ fecha })
        .select('hora estado estadoPago modalidad cliente_id profesional_id')
        .sort({ hora: 1, _id: 1 })
        .limit(300)
        .populate('cliente_id', 'nombre')
        .populate('profesional_id', 'nombre especialidad')
        .lean()
    ]);

    const estados = { reservado: 0, pendiente_pago: 0, atendido: 0, cancelado: 0, en_espera: 0 };
    let pagosSinCompletar = 0;

    // Estadísticas completas sin descargar información médica ni datos privados extras.
    const resumenEstados = await Turno.aggregate([
      { $match: { fecha } },
      { $group: { _id: { estado: '$estado', pago: '$estadoPago' }, n: { $sum: 1 } } }
    ]);
    for (const item of resumenEstados) {
      const estado = item._id.estado;
      if (estado === 'En Espera') estados.en_espera += item.n;
      else if (Object.hasOwn(estados, estado)) estados[estado] += item.n;
      if (estado !== 'cancelado' && item._id.pago !== 'total_pagado') pagosSinCompletar += item.n;
    }

    return res.json({
      fecha,
      total,
      mostrados: turnos.length,
      resumen: { ...estados, pagosSinCompletar },
      turnos: turnos.map(t => ({
        id: String(t._id),
        hora: t.hora || '—',
        paciente: t.cliente_id?.nombre || 'Paciente no disponible',
        profesional: t.profesional_id?.nombre || 'Profesional no disponible',
        especialidad: t.profesional_id?.especialidad || '',
        estado: t.estado || 'desconocido',
        estadoPago: t.estadoPago || 'pendiente',
        modalidad: t.modalidad || 'regular'
      }))
    });
  } catch (error) {
    return next(error);
  }
});

export default router;