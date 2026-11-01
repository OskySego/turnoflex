import mongoose from 'mongoose';
const { Schema } = mongoose;

// Registro no sobrescribible por la API. No es una firma digital.
const notaSchema = new Schema({
  pacienteId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Cliente' },
  turnoId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Turno' },
  profesionalId: { type: Schema.Types.ObjectId, required: true, index: true },
  usuarioAutorId: { type: Schema.Types.ObjectId, required: true },
  tipo: { type: String, enum: ['evolucion', 'rectificacion'], default: 'evolucion', required: true },
  rectificaNotaId: { type: Schema.Types.ObjectId, ref: 'TFNotaClinica', default: null },
  motivoRectificacion: { type: String, default: '', maxlength: 1000 },
  motivoConsulta: { type: String, required: true, maxlength: 2000 },
  anamnesis: { type: String, default: '', maxlength: 8000 },
  examenFisico: { type: String, default: '', maxlength: 8000 },
  diagnostico: { type: String, default: '', maxlength: 4000 },
  indicaciones: { type: String, default: '', maxlength: 8000 },
  // Se conserva como PENDIENTE hasta integrar una firma digital válida.
  estadoFirma: { type: String, enum: ['pendiente_firma_digital'], default: 'pendiente_firma_digital' },
  registradoEn: { type: Date, required: true, default: Date.now, immutable: true }
}, { versionKey: false, strict: 'throw', collection: 'tf_notas_clinicas' });

notaSchema.index({ pacienteId: 1, registradoEn: -1 });
notaSchema.pre('save', function() {
  if (!this.isNew) throw new Error('Las notas existentes no se editan: cree un asiento de rectificación.');
});
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndRemove']) {
  notaSchema.pre(op, function() { throw new Error('Operación prohibida sobre notas clínicas.'); });
}
export default mongoose.models.TFNotaClinica || mongoose.model('TFNotaClinica', notaSchema);