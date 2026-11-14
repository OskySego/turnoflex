/**
 * Modelo Mongoose para la entidad Profesional en TurnoFlex.
 * Define datos personales, matrícula, especialidad, cobertura, esquemas horarios, sobreturnos y telemedicina.
 */

import mongoose from "mongoose";

// ============================================================
// DEFINICIÓN DEL ESQUEMA DE PROFESIONAL
// ============================================================

const profesionalSchema = new mongoose.Schema(
  {
    // Control de baja lógica (los registros previos sin este campo se toman como activos)
    activo: { type: Boolean, default: true, index: true },
    desactivadoEn: { type: Date, default: null },

    // Datos personales y de contacto del profesional
    nombre: { type: String, required: true },
    dni: { type: String, required: true, unique: true },
    genero: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telefono: { type: String, required: true },

    // Credenciales médicas, especialidad y modalidades de cobertura aceptadas
    matricula: { type: String, required: true, unique: true },
    especialidad: { type: String, required: true },
    subespecialidad: { type: String, required: true },
    tipoCobertura: {
      type: String,
      enum: ['particular', 'obra_social', 'ambas'],
      default: 'ambas',
      required: true
    },

    // Días habilitados según tipo de atención (formato texto)
    diasAtencion: { type: [String], default: [] },
    diasSobreturnos: { type: [String], default: [] },
    diasTelemedicina: { type: [String], default: [] },

    // Configuración de agenda general presencial / base
    sede: { type: String },
    horaInicio: { type: String, required: true },
    horaFin: { type: String, required: true },
    duracionTurnoMinutos: { type: Number, default: 30 },
    modalidad: { type: String, enum: ['presencial', 'telemedicina', 'ambas'], default: 'presencial' },

    // Parámetros para la gestión de sobreturnos
    permiteSobreturnos: { type: Boolean, default: false },
    horaInicioSobreturnos: { type: String },
    horaFinSobreturnos: { type: String },
    cantidadMaximaSobreturnos: { type: Number, max: 8, default: 4 },

    // Parámetros para atención por telemedicina
    ofreceTelemedicina: { type: Boolean, default: false },
    horaInicioTelemedicina: { type: String },
    horaFinTelemedicina: { type: String }
  },
  { timestamps: true }
);

// ============================================================
// EXPORTACIÓN DEL MODELO
// ============================================================

export const Profesional = mongoose.model('Profesional', profesionalSchema);