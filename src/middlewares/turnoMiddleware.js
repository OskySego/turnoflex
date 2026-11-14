/**
 * Middlewares de validación para el módulo de Turnos.
 * Verifica la existencia del turno en BD y los datos mínimos requeridos antes de pasar al controlador.
 */

import { Turno } from '../models/Turno.js';

// ============================================================
// VALIDACIÓN DE EXISTENCIA EN BASE DE DATOS
// ============================================================

export const validarExistenciaTurno = async (req, res, next) => {
  const { id } = req.params;

  try {
    // Buscamos el turno en la colección en modo lean
    const turno = await Turno.findById(id).lean();

    // Si no existe en la base, renderizamos la vista con el aviso 404
    if (!turno) {
      return res.status(404).render('detalle-turno', {
        tituloPage: 'Turno no encontrado',
        error: `El turno con ID "${id}" no existe en la base de datos.`
      });
    }

    // Adjuntamos el documento en req para evitar volver a consultarlo en el controlador
    req.turnoEncontrado = turno;

    next();
  } catch (error) {
    res.status(500).send('Error interno en el servidor.');
  }
};

// ============================================================
// VALIDACIÓN DE DATOS OBLIGATORIOS (ALTA DE TURNO)
// ============================================================

export const validarCamposCreacionTurno = (req, res, next) => {
  const { cliente_id, profesional_id, fecha, hora } = req.body;

  // Cortamos rápido si falta alguno de los datos base para agendar el turno
  if (!cliente_id || !profesional_id || !fecha || !hora) {
    return res.status(400).send('Faltan campos obligatorios para crear el turno.');
  }

  next();
};