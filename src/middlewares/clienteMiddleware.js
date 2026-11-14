/**
 * Middlewares de validación para el módulo de Clientes.
 * Verifica la integridad de los ObjectId, existencia en BD y campos obligatorios antes de llegar al controlador.
 */

import mongoose from 'mongoose';
import { Cliente } from '../models/Cliente.js';

// ============================================================
// VALIDACIÓN DE ID Y EXISTENCIA EN BASE DE DATOS
// ============================================================

export const validarExistenciaCliente = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Chequeamos formato de ObjectId antes de consultar Mongo para evitar CastError
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('El ID del cliente no es válido.');
    }

    // Verificamos que el registro exista realmente en la colección
    const cliente = await Cliente.findById(id);
    if (!cliente) {
      return res.status(404).send('Cliente no encontrado.');
    }

    next();
  } catch (error) {
    res.status(500).send('Error de validación: ' + error.message);
  }
};

// ============================================================
// VALIDACIÓN DE DATOS OBLIGATORIOS (ALTA DE CLIENTE)
// ============================================================

export const validarCamposCreacionCliente = (req, res, next) => {
  const { nombre, email } = req.body;

  // Cortamos rápido si faltan los datos mínimos requeridos para crear la ficha
  if (!nombre || !email) {
    return res.status(400).send('El nombre y el email son campos obligatorios.');
  }

  next();
};