import mongoose from 'mongoose';
const { Schema } = mongoose;

const estudioSchema = new Schema({
  pacienteId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Cliente' },
  cargadoPorUsuarioId: { type: Schema.Types.ObjectId, required: true },
  tipoEstudio: { type: String, required: true, maxlength: 120 },
  fechaEstudio: { type: Date, required: true },
  nombreOriginal: { type: String, required: true, maxlength: 200 },
  nombreGuardado: { type: String, required: true, unique: true },
  mimeType: { type: String, enum: ['application/pdf', 'image/png', 'image/jpeg'], required: true },
  pesoBytes: { type: Number, required: true, min: 1 },
  sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  registradoEn: { type: Date, default: Date.now, required: true },
  revision: {
    estado: { type: String, enum: ['pendiente', 'revisado'], default: 'pendiente' },
    profesionalId: { type: Schema.Types.ObjectId, default: null },
    usuarioRevisorId: { type: Schema.Types.ObjectId, default: null },
    fecha: { type: Date, default: null },
    observacion: { type: String, default: '', maxlength: 3000 }
  }
}, { versionKey: '__v', collection: 'tf_estudios_clinicos' });
estudioSchema.index({ pacienteId: 1, registradoEn: -1 });
export default mongoose.models.TFEstudioClinico || mongoose.model('TFEstudioClinico', estudioSchema);