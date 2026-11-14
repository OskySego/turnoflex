/**
 * Modelo Mongoose para las historias clínicas y evoluciones médicas en TurnoFlex.
 * Vincula al paciente, el profesional tratante y el turno asociado junto con el detalle clínico y archivos adjuntos.
 */

import mongoose from 'mongoose';

// ============================================================
// DEFINICIÓN DEL ESQUEMA DE HISTORIA CLÍNICA
// ============================================================

const historiaClinicaSchema = new mongoose.Schema(
  {
    // Referencias principales: paciente, profesional que atiende y turno vinculado
    cliente_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: true
    },
    profesional_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    turno_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Turno'
    },

    // Fecha y registro clínico de la consulta médica
    fecha: {
      type: Date,
      default: Date.now
    },
    motivoConsulta: {
      type: String,
      required: true
    },
    evolucion: {
      type: String,
      required: true
    },
    diagnostico: {
      type: String,
      required: true
    },

    // Documentación y estudios complementarios adjuntos a la evolución
    archivosAdjuntos: [
      {
        nombreArchivo: String,
        url: String
      }
    ]
  },
  { timestamps: true }
);

// ============================================================
// EXPORTACIÓN DEL MODELO
// ============================================================

export const HistoriaClinica = mongoose.model('HistoriaClinica', historiaClinicaSchema);