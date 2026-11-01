import mongoose from 'mongoose';


// ============================================================
// SUBDOCUMENTO DE AUDITORÍA
// ============================================================

const auditoriaSchema = new mongoose.Schema(
  {
    accion: {
      type: String,
      enum: [
        'creacion',
        'cambio_estado',
        'cobro_efectivo',
        'generacion_pago_mp',
        'pago_mp_confirmado',
        'orden_pagoflex_creada',
        'pago_pagoflex_aprobado',
        'pago_pagoflex_rechazado',
        'modificacion',
        'transferencia_iniciada',
        'transferencia_informada',
        'transferencia_confirmada',
        'transferencia_rechazada'
      ],
      required: true
    },

    realizadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null
    },

    rol: {
      type: String,
      default: ''
    },

    detalle: {
      type: String,
      default: ''
    },

    estadoAnterior: {
      type: String,
      default: ''
    },

    estadoNuevo: {
      type: String,
      default: ''
    },

    estadoPagoAnterior: {
      type: String,
      default: ''
    },

    estadoPagoNuevo: {
      type: String,
      default: ''
    },

    fecha: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true
  }
);


// ============================================================
// MODELO TURNO
// ============================================================

const turnoSchema = new mongoose.Schema(
  {
    cliente_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: true,
      index: true
    },

    profesional_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profesional',
      required: true,
      index: true
    },

    fecha: {
      type: String,
      required: true,
      index: true
    },

    hora: {
      type: String,
      required: true
    },

    modalidad: {
      type: String,
      enum: [
        'regular',
        'presencial',
        'sobreturno',
        'telemedicina'
      ],
      default: 'regular'
    },

    estado: {
      type: String,
      enum: [
        'reservado',
        'pendiente_pago',
        'atendido',
        'cancelado',
        'En Espera'
      ],
      default: 'reservado',
      index: true
    },

    metodoPago: {
      type: String,
      enum: [
        'efectivo',
        'mercadopago',
        'pagoflex',  // históricos de demostración
        'transferencia'
      ],
      default: 'efectivo'
    },

    estadoPago: {
      type: String,
      enum: [
        'pendiente',
        'sena_pagada',
        'total_pagado',
        'sin_cargo'
      ],
      default: 'pendiente',
      index: true
    },

    // Compatibilidad con el webhook y turnos históricos.
    montoSena: {
      type: Number,
      min: 0,
      default: 0
    },

    // Fotografía del precio en el momento de reservar (NO se recalcula después).
    tipoCobro: {
      type: String,
      enum: ['legacy', 'particular', 'copago', 'sin_cargo'],
      default: 'legacy'
    },
    precioBase: { type: Number, min: 0, default: null },
    descuentoPorcentaje: { type: Number, min: 0, max: 50, default: 0 },
    descuentoMonto: { type: Number, min: 0, default: 0 },
    montoTotal: { type: Number, min: 0, default: null },

    // PagoFlex es una transferencia real, NO un simulador.
    // Su recepción se confirma manualmente cotejando el banco.
    transferencia: {
      estado: {
        type: String,
        enum: ['sin_iniciar','iniciada','informada','acreditada','rechazada'],
        default: 'sin_iniciar'
      },
      referencia: { type: String, maxlength: 80, default: '' },
      informadaEn: { type: Date, default: null },
      acreditadaEn: { type: Date, default: null },
      verificadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null }
    },


    // ========================================================
    // MERCADO PAGO
    // ========================================================

    mercadoPago: {

      preferenceId: {
        type: String,
        default: ''
      },

      paymentId: {
        type: String,
        default: ''
      },

      status: {
        type: String,
        default: ''
      },

      statusDetail: {
        type: String,
        default: ''
      }

    },


    // ========================================================
    // PAGOFLEX - PAGOS DE DEMOSTRACIÓN
    // ========================================================

    pagoFlex: {
      ordenId: {
        type: String,
        default: ''
      },
      referencia: {
        type: String,
        default: ''
      },
      importeCentavos: {
        type: Number,
        min: 0,
        default: 0
      },
      estado: {
        type: String,
        enum: ['sin_orden', 'pendiente', 'aprobado', 'rechazado'],
        default: 'sin_orden'
      },
      verificadoEn: {
        type: Date,
        default: null
      }
    },


    // ========================================================
    // INFORMACIÓN MÉDICA
    // ========================================================

    notasMedicas: {
      type: String,
      default: ''
    },


    // ========================================================
    // CREACIÓN
    // ========================================================

    creadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null
    },


    // ========================================================
    // HISTORIAL DE ESTADOS
    //
    // Lo conservamos para compatibilidad con lo que ya existe.
    // ========================================================

    historialEstados: [
      {
        estadoAnterior: {
          type: String,
          default: ''
        },

        estadoNuevo: {
          type: String,
          default: ''
        },

        modificadoPor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Usuario',
          default: null
        },

        fechaModificacion: {
          type: Date,
          default: Date.now
        }
      }
    ],


    // ========================================================
    // AUDITORÍA GENERAL TURNOFLEX
    // ========================================================

    auditoria: {
      type: [auditoriaSchema],
      default: []
    }

  },

  {
    timestamps: true
  }
);


// ============================================================
// ÍNDICES
// ============================================================

turnoSchema.index(
  {
    profesional_id: 1,
    fecha: 1,
    hora: 1
  },
  {
    unique: true
  }
);


turnoSchema.index(
  {
    fecha: 1,
    estado: 1
  }
);


turnoSchema.index(
  {
    cliente_id: 1,
    fecha: 1
  }
);


// ============================================================
// MODELO
// ============================================================

export const Turno =
  mongoose.model(
    'Turno',
    turnoSchema
  );


export default Turno;