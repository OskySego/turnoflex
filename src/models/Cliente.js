/**
 * Modelo Mongoose para la entidad Cliente / Paciente en TurnoFlex.
 * Define los datos personales, contacto, domicilio, cobertura médica y grupo familiar asociado.
 */

import mongoose from 'mongoose';

// ============================================================
// DEFINICIÓN DEL ESQUEMA DE CLIENTE
// ============================================================

const clienteSchema = new mongoose.Schema(
  {
    // Datos personales y de contacto obligatorios
    nombre: { type: String, required: true },
    dni: { type: String, required: true },
    fechaNacimiento: { type: Date },
    genero: { type: String },
    telefono: { type: String, required: true },
    email: { type: String, required: true },

    // Dirección y ubicación del paciente
    domicilio: {
      calle: String,
      numero: String,
      localidad: String,
      provincia: String
    },

    // Datos de cobertura médica / obra social
    obraSocial: {
      empresa: String,
      numeroAfiliado: String,
      plan: String
    },

    // Lista de integrantes del grupo familiar a cargo
    grupoFamiliar: [
      {
        nombre: { type: String, required: true },
        dni: { type: String, required: true },
        parentesco: { type: String, required: true }
      }
    ]
  },
  { timestamps: true }
);

// ============================================================
// EXPORTACIÓN DEL MODELO
// ============================================================

export const Cliente = mongoose.model('Cliente', clienteSchema);