import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rol: { 
    type: String, 
    enum: ['admin', 'personal', 'cliente', 'profesional'], // 🟢 Añadido 'profesional' aquí
    default: 'cliente',
    required: true 
  },
  // Vínculos clínicos opcionales. NO se infieren del email, nombre ni DNI.
  // Solo el procedimiento administrativo de vinculación puede establecerlos.
  cliente_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', default: null },
  profesional_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profesional', default: null }
}, { timestamps: true });

usuarioSchema.index({ cliente_id: 1 }, { unique: true, partialFilterExpression: { cliente_id: { $type: 'objectId' } } });
usuarioSchema.index({ profesional_id: 1 }, { unique: true, partialFilterExpression: { profesional_id: { $type: 'objectId' } } });

// ✅ CORREGIDO: Sin 'next' y sin llamar a next()
usuarioSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Método para comparar contraseñas en el Login
usuarioSchema.methods.compararPassword = async function(passwordCandidate) {
  return await bcrypt.compare(passwordCandidate, this.password);
};

export const Usuario = mongoose.model('Usuario', usuarioSchema);