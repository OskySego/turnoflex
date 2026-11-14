/**
 * Modelo Mongoose para la gestión integral de Turnos en TurnoFlex.
 * Incluye agenda, fotografía congelada de aranceles, pasarelas de pago (Mercado Pago, transferencia y PagoFlex),
 * seguimiento en sala de espera, historial de estados y trazabilidad completa mediante auditoría embebida.
 */

import mongoose from 'mongoose';

// ============================================================
// SUBDOCUMENTO DE AUDITORÍA DE MOVIMIENTOS
// ============================================================

const auditoriaSchema = new mongoose.Schema(
  {
    // Tipo de evento registrado sobre el ciclo de vida del turno o su cobro
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

    // Usuario que ejecutó la acción y rol activo en ese momento
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

    // Trazabilidad de transiciones de estado operativo y financiero
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
// DEFINICIÓN DEL ESQUEMA PRINCIPAL DE TURNO
// ============================================================

const turnoSchema = new mongoose.Schema(
  {
    // Referencias principales y coordenadas de agenda
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
    // Registro cuándo llega el paciente a la clínica.
    // Esto no significa que ya recibió atención.
    presentadoEn: {
      type: Date,
      default: null
    },
    // Guardo quién confirmó la llegada en recepción.
    presentadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null
    },
    // Conservo el último llamado para la sala de espera.
    // No debo declarar este campo dos veces.
    ultimoLlamadoSalaEn: {
      type: Date,
      default: null
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

    // Configuración general de cobro y estado financiero
    metodoPago: {
      type: String,
      enum: [
        'efectivo',
        'mercadopago',
        'pagoflex', // históricos de demostración
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

    // Se mantiene por compatibilidad con webhooks y registros históricos
    montoSena: {
      type: Number,
      min: 0,
      default: 0
    },

    // Fotografía congelada de aranceles al momento de reservar (no se recalcula si cambian tarifas)
    tipoCobro: {
      type: String,
      enum: ['legacy', 'particular', 'copago', 'sin_cargo'],
      default: 'legacy'
    },
    precioBase: { type: Number, min: 0, default: null },
    descuentoPorcentaje: { type: Number, min: 0, max: 50, default: 0 },
    descuentoMonto: { type: Number, min: 0, default: 0 },
    montoTotal: { type: Number, min: 0, default: null },

    // ========================================================
    // CANALES Y PASARELAS DE PAGO
    // ========================================================

    // Transferencia bancaria real: la acreditación se valida manualmente contra extracto
    transferencia: {
      estado: {
        type: String,
        enum: ['sin_iniciar', 'iniciada', 'informada', 'acreditada', 'rechazada'],
        default: 'sin_iniciar'
      },
      referencia: { type: String, maxlength: 80, default: '' },
      informadaEn: { type: Date, default: null },
      acreditadaEn: { type: Date, default: null },
      verificadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null }
    },

    // Datos de integración con Mercado Pago
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

    // Datos de órdenes PagoFlex (entorno de demostración)
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
    // OBSERVACIONES, SALA DE ESPERA Y TRAZABILIDAD
    // ========================================================

    notasMedicas: {
      type: String,
      default: ''
    },

    creadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null
    },

    // Timestamp del último llamado a consultorio (solo impacto visual en sala de espera)
    ultimoLlamadoSalaEn: {
      type: Date,
      default: null,
      index: true
    },

    // Historial legado de cambios de estado (conservado por retrocompatibilidad)
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

    // Bitácora detallada de eventos operativos y financieros del turno
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
// ÍNDICES COMPUESTOS Y EXPORTACIÓN DEL MODELO
// ============================================================

// Índice único para impedir doble reserva en mismo profesional, fecha y horario
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

// Índices de consulta frecuente para agenda diaria, historial de paciente y pantalla de sala
turnoSchema.index({ fecha: 1, estado: 1 });
turnoSchema.index({ cliente_id: 1, fecha: 1 });
turnoSchema.index({ fecha: 1, ultimoLlamadoSalaEn: -1 });

export const Turno = mongoose.model('Turno', turnoSchema);

export default Turno;