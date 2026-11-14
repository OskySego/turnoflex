/**
 * Modelo Mongoose para el registro de auditoría del Módulo Clínico (TurnoFlex).
 * Almacena la trazabilidad de accesos y operaciones sobre historias clínicas sin guardar contenido médico sensible.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ============================================================
// DEFINICIÓN DEL ESQUEMA DE AUDITORÍA CLÍNICA
// ============================================================

const auditoriaSchema = new Schema(
  {
    usuarioId: { type: Schema.Types.ObjectId, required: true },
    rol: { type: String, required: true },
    pacienteId: { type: Schema.Types.ObjectId, required: true, index: true },
    accion: { type: String, required: true },
    recursoId: { type: Schema.Types.ObjectId, default: null },
    fecha: { type: Date, required: true, default: Date.now },

    // Importante: nunca guardar diagnósticos, texto clínico ni contenido de archivos en este campo
    detallesTecnicos: { type: String, maxlength: 200, default: '' }
  },
  {
    versionKey: false,
    collection: 'tf_auditoria_clinica'
  }
);

// ============================================================
// ÍNDICES Y EXPORTACIÓN DEL MODELO
// ============================================================

// Índice compuesto para acelerar consultas cronológicas por paciente
auditoriaSchema.index({ pacienteId: 1, fecha: -1 });

// Evitamos recompilar el modelo si ya existe en la instancia de Mongoose
export default mongoose.models.TFAuditoriaClinica || mongoose.model('TFAuditoriaClinica', auditoriaSchema);