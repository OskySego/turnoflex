import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  // Email REAL del usuario. Las invitaciones llegan aquí.
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rol: {
    type: String,
    enum: ['admin', 'personal', 'cliente', 'profesional'],
    default: 'cliente',
    required: true
  },

  // NUEVOS CAMPOS: identidad institucional sin buzón.
  emailInstitucional: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true
  },
  activo: { type: Boolean, default: true },
  // Diferente de activo: una invitación pendiente no es una suspensión.
  suspendidoAdministrativamente: { type: Boolean, default: false },
  profesional_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profesional',
    default: null
  },
  activacionHash: { type: String, select: false },
  activacionHasta: { type: Date, select: false }
}, { timestamps: true });

// Se conserva el mecanismo original de hash antes de guardar.
usuarioSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

usuarioSchema.methods.compararPassword = async function (passwordCandidate) {
  return bcrypt.compare(passwordCandidate, this.password);
};

export const Usuario = mongoose.model('Usuario', usuarioSchema);
