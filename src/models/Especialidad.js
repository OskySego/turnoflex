/**
 * Modelo Mongoose para las especialidades médicas y profesionales en TurnoFlex.
 * Define los aranceles (particular y obra social), el monto de seña para reservas y su estado de vigencia.
 */

import mongoose from 'mongoose';

// ============================================================
// DEFINICIÓN DEL ESQUEMA DE ESPECIALIDAD
// ============================================================

const especialidadSchema = new mongoose.Schema(
  {
    // Nombre único de la especialidad dentro del sistema
    nombre: {
      type: String,
      required: true,
      unique: true
    },

    // Valores de consulta y seña requerida al agendar turno
    precioParticular: {
      type: Number,
      required: true
    },
    copagoObraSocial: {
      type: Number,
      required: true
    },
    montoSena: {
      type: Number,
      required: true
    },

    // Flag para habilitar o pausar la especialidad sin borrar el registro
    activa: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// ============================================================
// EXPORTACIÓN DEL MODELO
// ============================================================

export const Especialidad = mongoose.model('Especialidad', especialidadSchema);