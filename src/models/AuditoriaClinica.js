import mongoose from 'mongoose';
const { Schema } = mongoose;

const auditoriaSchema = new Schema({
  usuarioId: { type: Schema.Types.ObjectId, required: true },
  rol: { type: String, required: true },
  pacienteId: { type: Schema.Types.ObjectId, required: true, index: true },
  accion: { type: String, required: true },
  recursoId: { type: Schema.Types.ObjectId, default: null },
  fecha: { type: Date, required: true, default: Date.now },
  // No incluir diagnósticos, texto clínico ni contenido de archivos en este log.
  detallesTecnicos: { type: String, maxlength: 200, default: '' }
}, { versionKey: false, collection: 'tf_auditoria_clinica' });
auditoriaSchema.index({ pacienteId: 1, fecha: -1 });
export default mongoose.models.TFAuditoriaClinica || mongoose.model('TFAuditoriaClinica', auditoriaSchema);