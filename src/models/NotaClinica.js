/**
 * Modelo Mongoose para las notas clínicas (evoluciones y rectificaciones) en TurnoFlex.
 * Implementa un registro inmutable (append-only): las notas guardadas no se editan ni borran, solo se rectifican con un nuevo asiento.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ============================================================
// DEFINICIÓN DEL ESQUEMA DE NOTA CLÍNICA
// ============================================================

const notaSchema = new Schema(
  {
    // Referencias principales: paciente, turno, profesional tratante y usuario que registra
    pacienteId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Cliente' },
    turnoId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Turno' },
    profesionalId: { type: Schema.Types.ObjectId, required: true, index: true },
    usuarioAutorId: { type: Schema.Types.ObjectId, required: true },

    // Tipo de asiento clínico y referencia en caso de tratarse de una rectificación
    tipo: { type: String, enum: ['evolucion', 'rectificacion'], default: 'evolucion', required: true },
    rectificaNotaId: { type: Schema.Types.ObjectId, ref: 'TFNotaClinica', default: null },
    motivoRectificacion: { type: String, default: '', maxlength: 1000 },

    // Contenido médico de la atención registrada
    motivoConsulta: { type: String, required: true, maxlength: 2000 },
    anamnesis: { type: String, default: '', maxlength: 8000 },
    examenFisico: { type: String, default: '', maxlength: 8000 },
    diagnostico: { type: String, default: '', maxlength: 4000 },
    indicaciones: { type: String, default: '', maxlength: 8000 },

    // Se mantiene pendiente hasta integrar firma digital válida; la fecha de carga es inmutable
    estadoFirma: { type: String, enum: ['pendiente_firma_digital'], default: 'pendiente_firma_digital' },
    registradoEn: { type: Date, required: true, default: Date.now, immutable: true }
  },
  {
    versionKey: false,
    strict: 'throw',
    collection: 'tf_notas_clinicas'
  }
);

// ============================================================
// ÍNDICES Y HOOKS DE INMUTABILIDAD
// ============================================================

// Índice compuesto para listar la evolución clínica del paciente en orden cronológico inverso
notaSchema.index({ pacienteId: 1, registradoEn: -1 });

// Bloqueamos cualquier intento de sobrescritura sobre documentos ya persistidos
notaSchema.pre('save', function() {
  if (!this.isNew) throw new Error('Las notas existentes no se editan: cree un asiento de rectificación.');
});

// Prohibimos operaciones directas de actualización o borrado a nivel de consultas Mongoose
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndRemove']) {
  notaSchema.pre(op, function() { throw new Error('Operación prohibida sobre notas clínicas.'); });
}

// ============================================================
// EXPORTACIÓN DEL MODELO
// ============================================================

// Evitamos recompilar el modelo si ya fue cargado en la instancia actual de Mongoose
export default mongoose.models.TFNotaClinica || mongoose.model('NotaClinica', notaSchema);