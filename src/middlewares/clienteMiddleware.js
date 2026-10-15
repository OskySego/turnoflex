import mongoose from 'mongoose';
import { Cliente } from '../models/Cliente.js';

// Validar que el ID sea un ObjectId válido de MongoDB y que el cliente exista
export const validarExistenciaCliente = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('El ID del cliente no es válido.');
    }

    const cliente = await Cliente.findById(id);
    if (!cliente) {
      return res.status(404).send('Cliente no encontrado.');
    }

    next();
  } catch (error) {
    res.status(500).send('Error de validación: ' + error.message);
  }
};

// Validar que vengan los campos obligatorios al crear
export const validarCamposCreacionCliente = (req, res, next) => {
  const { nombre, email } = req.body;

  if (!nombre || !email) {
    return res.status(400).send('El nombre y el email son campos obligatorios.');
  }

  next();
};
