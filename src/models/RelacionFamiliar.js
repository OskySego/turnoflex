/**
 * Modelo Mongoose para el vínculo bidireccional entre pacientes en TurnoFlex.
 * Gestiona las relaciones familiares, evita duplicados simétricos mediante clave única y soporta baja lógica.
 */

import mongoose from 'mongoose';

// ============================================================
// DEFINICIÓN DEL ESQUEMA DE RELACIÓN FAMILIAR
// ============================================================

const relacionFamiliarSchema = new mongoose.Schema(
  {
    // Referencias a los dos pacientes vinculados en la relación
    pacienteA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: true,
      index: true
    },
    pacienteB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: true,
      index: true
    },

    // Rol o parentesco que tiene B respecto de A (ej: A ve a B como "hijo/a")
    parentescoAConB: {
      type: String,
      required: true,
      enum: [
        'padre',
        'madre',
        'hijo/a',
        'pareja',
        'esposo/a',
        'hermano/a',
        'abuelo/a',
        'nieto/a',
        'tío/a',
        'sobrino/a',
        'tutor/a',
        'persona a cargo',
        'otro familiar'
      ]
    },

    // Rol o parentesco inverso que tiene A respecto de B (ej: B ve a A como "padre")
    parentescoBConA: {
      type: String,
      required: true,
      enum: [
        'padre',
        'madre',
        'hijo/a',
        'pareja',
        'esposo/a',
        'hermano/a',
        'abuelo/a',
        'nieto/a',
        'tío/a',
        'sobrino/a',
        'tutor/a',
        'persona a cargo',
        'otro familiar'
      ]
    },

    // Clave compuesta normalizada para impedir vínculos duplicados aunque se invierta el orden A/B
    claveRelacion: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // Flag de baja lógica para desactivar el vínculo sin perder historial
    activo: {
      type: Boolean,
      default: true,
      index: true
    },

    // Usuario del sistema que registró la vinculación
    creadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// ============================================================
// HOOKS DE VALIDACIÓN Y NORMALIZACIÓN DE CLAVE
// ============================================================

relacionFamiliarSchema.pre('validate', function () {
  if (!this.pacienteA || !this.pacienteB) {
    return;
  }

  const idA = this.pacienteA.toString();
  const idB = this.pacienteB.toString();

  // Cortamos si se intenta vincular un paciente consigo mismo
  if (idA === idB) {
    throw new Error('Un paciente no puede ser asociado como familiar de sí mismo.');
  }

  // Ordenamos los ObjectId alfabéticamente para generar siempre la misma clave simétrica
  const idsOrdenados = [idA, idB].sort();
  this.claveRelacion = `${idsOrdenados[0]}_${idsOrdenados[1]}`;
});

// ============================================================
// ÍNDICES COMPUESTOS Y EXPORTACIÓN DEL MODELO
// ============================================================

// Índices para acelerar la búsqueda de familiares activos desde cualquiera de los dos extremos
relacionFamiliarSchema.index({ pacienteA: 1, activo: 1 });
relacionFamiliarSchema.index({ pacienteB: 1, activo: 1 });

export const RelacionFamiliar = mongoose.model('RelacionFamiliar', relacionFamiliarSchema);

export default RelacionFamiliar;