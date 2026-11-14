/**
 * Middlewares de validación para el módulo de Profesionales.
 * Verifica formato de ObjectId, existencia en BD y campos obligatorios antes de pasar al controlador.
 */

import mongoose from 'mongoose';
import { Profesional } from '../models/Profesional.js';

// ============================================================
// VALIDACIÓN DE ID Y EXISTENCIA EN BASE DE DATOS
// ============================================================

export const validarExistenciaProfesional = async (req, res, next) => {
  const { id } = req.params;

  try {
    // Chequeamos formato de ObjectId antes de consultar Mongo para evitar CastError
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).render('detalle-profesional', {
        tituloPage: 'Error 400',
        error: 'El formato del ID de profesional no es válido.'
      });
    }

    // Buscamos el profesional en la colección habilitando virtuals en lean
    const profesional = await Profesional.findById(id).lean({ virtuals: true });

    // Si no existe en la base, renderizamos la vista con el aviso de error
    if (!profesional) {
      return res.status(404).render('detalle-profesional', {
        tituloPage: 'No Encontrado',
        error: `El profesional con ID '${id}' no fue encontrado en la base de datos.`
      });
    }

    // Guardamos el documento en req para reutilizarlo en el controlador sin volver a consultar
    req.profesionalEncontrado = profesional;

    next();
  } catch (error) {
    console.error("Error en el middleware validarExistenciaProfesional:", error);
    res.status(500).send('Error interno en el servidor.');
  }
};

// ============================================================
// VALIDACIÓN DE DATOS OBLIGATORIOS (ALTA DE PROFESIONAL)
// ============================================================

export const validarCamposCreacionProfesional = (req, res, next) => {
  const {
    nombre,
    especialidad,
    diasDisponibles
  } = req.body;

  const camposFaltantes = [];

  // Verificamos los campos mínimos requeridos (horaInicio y horaFin toman defaults del esquema)
  if (!nombre) camposFaltantes.push('nombre');
  if (!especialidad) camposFaltantes.push('especialidad');

  if (camposFaltantes.length > 0) {
    return res.status(400).send(`Error: Faltan campos obligatorios: ${camposFaltantes.join(', ')}`);
  }

  // Si vienen días disponibles cargados, validamos que sea array o string separable
  if (diasDisponibles && typeof diasDisponibles !== 'string' && !Array.isArray(diasDisponibles)) {
    return res.status(400).send('Error: diasDisponibles tiene un formato incorrecto.');
  }

  next();
};