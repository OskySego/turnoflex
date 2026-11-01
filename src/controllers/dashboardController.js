import { Turno } from '../models/Turno.js';


// ============================================================
// UTILIDADES
// ============================================================

function formatearFecha(fecha) {

  const anio =
    fecha.getFullYear();


  const mes =
    String(
      fecha.getMonth() + 1
    ).padStart(
      2,
      '0'
    );


  const dia =
    String(
      fecha.getDate()
    ).padStart(
      2,
      '0'
    );


  return `${anio}-${mes}-${dia}`;

}


function porcentaje(valor, total) {

  if (
    !total ||
    total <= 0
  ) {

    return '0.0';

  }


  return (
    (
      Number(valor || 0) /
      Number(total)
    ) * 100
  ).toFixed(1);

}


// ============================================================
// CONTROLADOR
// ============================================================

export class DashboardController {


  // ==========================================================
  // CENTRO DE INTELIGENCIA GERENCIAL
  // ==========================================================

  static async getEstadisticas(
    req,
    res,
    next
  ) {

    try {

      // ========================================================
      // FECHAS
      // ========================================================

      const hoy =
        new Date();


      const fechaHoy =
        formatearFecha(
          hoy
        );


      const fechasUltimos7Dias =
        [];


      for (
        let i = 6;
        i >= 0;
        i--
      ) {

        const fecha =
          new Date(
            hoy
          );


        fecha.setDate(
          hoy.getDate() - i
        );


        fechasUltimos7Dias.push(
          formatearFecha(
            fecha
          )
        );

      }


      // ========================================================
      // CONSULTAS GERENCIALES EN PARALELO
      // ========================================================

      const [

        topProfesionales,

        topEspecialidades,

        statsEstados,

        statsMetodosPago,

        statsEstadosPago,

        evolucionTurnos,

        turnosHoy,

        resumenMontos

      ] = await Promise.all([


        // ======================================================
        // 1. PROFESIONALES MÁS DEMANDADOS
        // ======================================================

        Turno.aggregate([

          {
            $lookup: {

              from:
                'profesionals',

              localField:
                'profesional_id',

              foreignField:
                '_id',

              as:
                'profesional'

            }
          },


          {
            $unwind: {

              path:
                '$profesional',

              preserveNullAndEmptyArrays:
                false

            }
          },


          {
            $group: {

              _id:
                '$profesional.nombre',

              especialidad: {

                $first:
                  '$profesional.especialidad'

              },

              cantidadTurnos: {

                $sum:
                  1

              }

            }
          },


          {
            $sort: {

              cantidadTurnos:
                -1

            }
          },


          {
            $limit:
              5
          }

        ]),


        // ======================================================
        // 2. ESPECIALIDADES MÁS DEMANDADAS
        // ======================================================

        Turno.aggregate([

          {
            $lookup: {

              from:
                'profesionals',

              localField:
                'profesional_id',

              foreignField:
                '_id',

              as:
                'profesional'

            }
          },


          {
            $unwind: {

              path:
                '$profesional',

              preserveNullAndEmptyArrays:
                false

            }
          },


          {
            $group: {

              _id: {

                $ifNull: [

                  '$profesional.especialidad',

                  'General'

                ]

              },

              cantidad: {

                $sum:
                  1

              }

            }
          },


          {
            $sort: {

              cantidad:
                -1

            }
          },


          {
            $limit:
              5
          }

        ]),


        // ======================================================
        // 3. ESTADOS DE TURNOS
        // ======================================================

        Turno.aggregate([

          {
            $group: {

              _id: {

                $ifNull: [

                  '$estado',

                  'sin_definir'

                ]

              },

              cantidad: {

                $sum:
                  1

              }

            }
          }

        ]),


        // ======================================================
        // 4. MÉTODOS DE PAGO
        // ======================================================

        Turno.aggregate([

          {
            $group: {

              _id: {

                $ifNull: [

                  '$metodoPago',

                  'sin_definir'

                ]

              },

              cantidad: {

                $sum:
                  1

              }

            }
          }

        ]),


        // ======================================================
        // 5. ESTADOS DE PAGO
        // ======================================================

        Turno.aggregate([

          {
            $group: {

              _id: {

                $ifNull: [

                  '$estadoPago',

                  'sin_definir'

                ]

              },

              cantidad: {

                $sum:
                  1

              }

            }
          }

        ]),


        // ======================================================
        // 6. EVOLUCIÓN ÚLTIMOS 7 DÍAS
        // ======================================================

        Turno.aggregate([

          {
            $match: {

              fecha: {

                $in:
                  fechasUltimos7Dias

              }

            }
          },


          {
            $group: {

              _id:
                '$fecha',

              cantidad: {

                $sum:
                  1

              }

            }
          },


          {
            $sort: {

              _id:
                1

            }
          }

        ]),


        // ======================================================
        // 7. TURNOS DE HOY
        // ======================================================

        Turno.countDocuments({

          fecha:
            fechaHoy

        }),


        // ======================================================
        // 8. RESUMEN DE MONTOS
        // ======================================================

        Turno.aggregate([

          {
            $group: {

              _id:
                null,

              montoSenasRegistradas: {

                $sum: {

                  $ifNull: [

                    '$montoSena',

                    0

                  ]

                }

              },

              montoConfirmado: {

                $sum: {

                  $cond: [

                    {
                      $in: [

                        '$estadoPago',

                        [
                          'sena_pagada',
                          'total_pagado'
                        ]

                      ]
                    },

                    {
                      $ifNull: [

                        '$montoSena',

                        0

                      ]
                    },

                    0

                  ]

                }

              }

            }
          }

        ])

      ]);


      // ========================================================
      // ESTADOS OPERATIVOS
      // ========================================================

      const estados = {

        atendido:
          0,

        cancelado:
          0,

        reservado:
          0,

        pendiente_pago:
          0,

        'En Espera':
          0,

        sin_definir:
          0

      };


      let total =
        0;


      statsEstados.forEach(
        (registro) => {

          const cantidad =
            Number(
              registro.cantidad ||
              0
            );


          total +=
            cantidad;


          if (
            Object.prototype.hasOwnProperty.call(
              estados,
              registro._id
            )
          ) {

            estados[
              registro._id
            ] =
              cantidad;

          } else {

            estados.sin_definir +=
              cantidad;

          }

        }
      );


      const atendidos =
        estados.atendido;


      const cancelados =
        estados.cancelado;


      const reservados =
        estados.reservado;


      const pendientesPago =
        estados.pendiente_pago;


      const enEspera =
        estados['En Espera'];


      // ========================================================
      // INDICADORES OPERATIVOS
      // ========================================================

      /*
       * Por ahora TurnoFlex no tiene un estado independiente
       * "ausente". Por eso esta métrica utiliza cancelaciones
       * como aproximación histórica del indicador.
       */

      const tasaAusentismo =
        porcentaje(
          cancelados,
          total
        );


      const turnosFinalizados =
        atendidos +
        cancelados;


      const tasaEfectividad =
        porcentaje(
          atendidos,
          turnosFinalizados
        );


      // ========================================================
      // MÉTODOS DE PAGO
      // ========================================================

      let mercadoPago =
        0;


      let efectivo =
        0;


      let metodoSinDefinir =
        0;


      statsMetodosPago.forEach(
        (registro) => {

          const cantidad =
            Number(
              registro.cantidad ||
              0
            );


          if (
            registro._id ===
            'mercadopago'
          ) {

            mercadoPago =
              cantidad;

          } else if (
            registro._id ===
            'efectivo'
          ) {

            efectivo =
              cantidad;

          } else {

            metodoSinDefinir +=
              cantidad;

          }

        }
      );


      // ========================================================
      // ESTADOS FINANCIEROS
      // ========================================================

      let pagosPendientes =
        0;


      let senasPagadas =
        0;


      let pagosTotales =
        0;


      let pagosSinDefinir =
        0;


      statsEstadosPago.forEach(
        (registro) => {

          const cantidad =
            Number(
              registro.cantidad ||
              0
            );


          switch (
            registro._id
          ) {

            case 'pendiente':

              pagosPendientes =
                cantidad;

              break;


            case 'sena_pagada':

              senasPagadas =
                cantidad;

              break;


            case 'total_pagado':

              pagosTotales =
                cantidad;

              break;


            default:

              pagosSinDefinir +=
                cantidad;

              break;

          }

        }
      );


      const pagosConfirmados =
        senasPagadas +
        pagosTotales;


      const operacionesConPago =
        pagosConfirmados +
        pagosPendientes;


      const tasaCobro =
        porcentaje(
          pagosConfirmados,
          operacionesConPago
        );


      // ========================================================
      // MONTOS
      // ========================================================

      const resumenMonto =
        resumenMontos &&
        resumenMontos.length > 0
          ? resumenMontos[0]
          : {};


      const montoSenasRegistradas =
        Number(
          resumenMonto.montoSenasRegistradas ||
          0
        );


      const montoConfirmado =
        Number(
          resumenMonto.montoConfirmado ||
          0
        );


      // ========================================================
      // EVOLUCIÓN SEMANAL
      // ========================================================

      const mapaEvolucion =
        new Map();


      evolucionTurnos.forEach(
        (registro) => {

          mapaEvolucion.set(

            registro._id,

            Number(
              registro.cantidad ||
              0
            )

          );

        }
      );


      const evolucion7Dias =
        fechasUltimos7Dias.map(
          (fecha) => {

            return {

              fecha,

              cantidad:
                mapaEvolucion.get(
                  fecha
                ) || 0

            };

          }
        );


      // ========================================================
      // MÉTRICAS PARA LA VISTA
      // ========================================================

      const metricas = {

        // ------------------------------------------------------
        // Operación
        // ------------------------------------------------------

        total,

        atendidos,

        cancelados,

        reservados,

        pendientesPago,

        enEspera,

        estadosSinDefinir:
          estados.sin_definir,


        // ------------------------------------------------------
        // Rendimiento
        // ------------------------------------------------------

        tasaAusentismo,

        tasaEfectividad,


        // ------------------------------------------------------
        // Jornada
        // ------------------------------------------------------

        turnosHoy,


        // ------------------------------------------------------
        // Métodos de pago
        // ------------------------------------------------------

        mercadoPago,

        efectivo,

        metodoSinDefinir,


        // ------------------------------------------------------
        // Estado financiero
        // ------------------------------------------------------

        pagosPendientes,

        senasPagadas,

        pagosTotales,

        pagosConfirmados,

        pagosSinDefinir,

        tasaCobro,


        // ------------------------------------------------------
        // Importes
        // ------------------------------------------------------

        montoSenasRegistradas,

        montoConfirmado

      };


      // ========================================================
      // RENDER
      // ========================================================

      return res.render(
        'dashboard',
        {

          tituloPage:
            'Centro de Inteligencia Gerencial',

          topProfesionales,

          topEspecialidades,

          evolucion7Dias,

          metricas

        }
      );


    } catch (error) {

      console.error(
        '❌ Error en TurnoFlex Intelligence:',
        error
      );


      if (
        !error.statusCode
      ) {

        error.statusCode =
          500;

      }


      return next(
        error
      );

    }

  }

}


export default DashboardController;