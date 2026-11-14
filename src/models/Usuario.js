/**
 * Modelo Mongoose para las cuentas de usuario y credenciales en TurnoFlex.
 * Gestiona autenticación, roles de acceso, identidad institucional, estados de activación y encriptación de contraseñas.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// ============================================================
// DEFINICIÓN DEL ESQUEMA DE USUARIO
// ============================================================

const usuarioSchema = new mongoose.Schema(
  {
    // Datos básicos de acceso y rol dentro del sistema
    nombre: { type: String, required: true },
    // Correo personal real del usuario (donde se envían las invitaciones y avisos)
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    rol: {
      type: String,
      enum: ['admin', 'personal', 'cliente', 'profesional'],
      default: 'cliente',
      required: true
    },

    // Identidad institucional interna (alias sin buzón asociado)
    emailInstitucional: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true
    },

    // Control de estado de cuenta: diferenciamos invitación pendiente de una suspensión administrativa
    activo: { type: Boolean, default: true },
    suspendidoAdministrativamente: { type: Boolean, default: false },

    // Vínculo opcional con la ficha médica cuando el usuario tiene rol profesional
    profesional_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profesional',
      default: null
    },

    // Tokens temporales para flujo de activación inicial (ocultos por defecto en consultas)
    activacionHash: { type: String, select: false },
    activacionHasta: { type: Date, select: false }
  },
  { timestamps: true }
);

// ============================================================
// HOOKS DE SEGURIDAD Y ENCRIPTACIÓN
// ============================================================

// Hasheamos la contraseña con bcrypt únicamente si fue creada o modificada
usuarioSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ============================================================
// MÉTODOS DE INSTANCIA Y EXPORTACIÓN DEL MODELO
// ============================================================

// Compara la contraseña ingresada en el login contra el hash almacenado en BD
usuarioSchema.methods.compararPassword = async function (passwordCandidate) {
  return bcrypt.compare(passwordCandidate, this.password);
};

export const Usuario = mongoose.model('Usuario', usuarioSchema);