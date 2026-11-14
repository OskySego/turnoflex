/**
 * Modelo Mongoose para los estudios clínicos adjuntos en TurnoFlex.
 * Registra los metadatos del archivo almacenado en disco privado, su hash de integridad y el estado de revisión médica.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ============================================================
// DEFINICIÓN DEL ESQUEMA DE ESTUDIO CLÍNICO
// ============================================================

const estudioSchema = new Schema(
  {
    // Referencias y datos generales del estudio
    pacienteId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Cliente' },
    cargadoPorUsuarioId: { type: Schema.Types.ObjectId, required: true },
    tipoEstudio: { type: String, required: true, maxlength: 120 },
    fechaEstudio: { type: Date, required: true },

    // Metadatos técnicos del archivo físico y control de integridad
    nombreOriginal: { type: String, required: true, maxlength: 200 },
    nombreGuardado: { type: String, required: true, unique: true },
    mimeType: { type: String, enum: ['application/pdf', 'image/png', 'image/jpeg'], required: true },
    pesoBytes: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    registradoEn: { type: Date, default: Date.now, required: true },

    // Seguimiento y validación médica del estudio cargado
    revision: {
      estado: { type: String, enum: ['pendiente', 'revisado'], default: 'pendiente' },
      profesionalId: { type: Schema.Types.ObjectId, default: null },
      usuarioRevisorId: { type: Schema.Types.ObjectId, default: null },
      fecha: { type: Date, default: null },
      observacion: { type: String, default: '', maxlength: 3000 }
    }
  },
  {
    versionKey: '__v',
    collection: 'tf_estudios_clinicos'
  }
);

// ============================================================
// ÍNDICES Y EXPORTACIÓN DEL MODELO
// ============================================================

// Índice compuesto para listar los estudios de un paciente ordenados del más reciente al más antiguo
estudioSchema.index({ pacienteId: 1, registradoEn: -1 });

// Evitamos recompilar el modelo si ya fue registrado en la instancia de Mongoose
export default mongoose.models.TFEstudioClinico || mongoose.model('TFEstudioClinico', estudioSchema);