import mongoose from 'mongoose';

const relacionFamiliarSchema = new mongoose.Schema(
  {
    // Primer paciente de la relación
    pacienteA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: true,
      index: true
    },

    // Segundo paciente de la relación
    pacienteB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: true,
      index: true
    },

    // Cómo ve el paciente A al paciente B
    // Ejemplo:
    // Oscar -> Juan = "hijo/a"
    parentescoAConB: {
      type: String,
      required: true,
      enum: [
        'padre',
        'madre',
        'hijo/a',
        'pareja',
        'esposo/a',
        'hermano/a',
        'abuelo/a',
        'nieto/a',
        'tío/a',
        'sobrino/a',
        'tutor/a',
        'persona a cargo',
        'otro familiar'
      ]
    },

    // Cómo ve el paciente B al paciente A
    // Ejemplo:
    // Juan -> Oscar = "padre"
    parentescoBConA: {
      type: String,
      required: true,
      enum: [
        'padre',
        'madre',
        'hijo/a',
        'pareja',
        'esposo/a',
        'hermano/a',
        'abuelo/a',
        'nieto/a',
        'tío/a',
        'sobrino/a',
        'tutor/a',
        'persona a cargo',
        'otro familiar'
      ]
    },

    // Evita que dos pacientes sean asociados dos veces,
    // incluso si intentamos invertir A y B.
    claveRelacion: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // Permite desactivar una relación sin borrarla físicamente
    activo: {
      type: Boolean,
      default: true,
      index: true
    },

    // Usuario de TurnoFlex que creó la asociación
    creadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null
    }
  },
  {
    timestamps: true
  }
);


// ============================================================
// VALIDACIONES AUTOMÁTICAS
// ============================================================

relacionFamiliarSchema.pre('validate', function () {

  if (!this.pacienteA || !this.pacienteB) {
    return;
  }

  const idA = this.pacienteA.toString();
  const idB = this.pacienteB.toString();

  // Una persona no puede asociarse consigo misma.
  if (idA === idB) {
    throw new Error(
      'Un paciente no puede ser asociado como familiar de sí mismo.'
    );
  }

  // Ordenamos los IDs siempre igual.
  // Así:
  //
  // Oscar -> Juan
  //
  // y
  //
  // Juan -> Oscar
  //
  // generan exactamente la misma clave.
  const idsOrdenados = [idA, idB].sort();

  this.claveRelacion =
    `${idsOrdenados[0]}_${idsOrdenados[1]}`;
});


// ============================================================
// ÍNDICES
// ============================================================

relacionFamiliarSchema.index({
  pacienteA: 1,
  activo: 1
});

relacionFamiliarSchema.index({
  pacienteB: 1,
  activo: 1
});


// ============================================================
// MODELO
// ============================================================

export const RelacionFamiliar =
  mongoose.model(
    'RelacionFamiliar',
    relacionFamiliarSchema
  );

export default RelacionFamiliar;