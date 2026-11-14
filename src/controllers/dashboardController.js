import { Turno } from '../models/Turno.js';


// ============================================================
// UTILIDADES
// ============================================================

// Me armo esta funcioncita rápida para formatear cualquier objeto Date a un string YYYY-MM-DD limpio
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


// Saco el porcentaje redondeado a un decimal y evito divisiones por cero que me rompan la vista
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

  // Recopilo todas las estadísticas operativas y financieras del sistema 
  // para alimentar el dashboard gerencial de la clínica.
  static async getEstadisticas(
    req,
    res,
    next
  ) {

    try {

      // ========================================================
      // CÁLCULO DE FECHAS
      // ========================================================

      const hoy =
        new Date();


      const fechaHoy =
        formatearFecha(
          hoy
        );


      // Armo el array con los últimos 7 días hacia atrás para la gráfica de evolución
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
      // CONSULTAS GERENCIALES EN PARALELO (Promise.all)
      // ========================================================
      // Lanzo todas las agregaciones de MongoDB juntas para que la página 
      // cargue de un solo saque y no muera en el intento.

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
        // Hago un $lookup contra la colección de profesionales para contar 
        // cuántos turnos tiene cada uno y ordenar de mayor a menor.

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
        // Agrupo por especialidad médica para ver qué áreas tienen más movimiento.

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
        // Cuento cuántos turnos hay en cada estado operativo (atendido, cancelado, etc.)

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
        // Mido cuántos eligen Mercado Pago frente a los que pagan en efectivo.

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
        // Analizo cómo viene la recaudación (señas pagadas, total pagado o pendientes).

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
        // Filtro los turnos que cayeron en el rango de los últimos 7 días para armar la línea de tiempo.

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
        // Un simple count para saber cuánta gente pasa hoy por la clínica.

        Turno.countDocuments({

          fecha:
            fechaHoy

        }),


        // ======================================================
        // 8. RESUMEN DE MONTOS
        // ======================================================
        // Sumo el dinero de las señas registradas y separo lo que ya ingresó de verdad 
        // a las arcas de la clínica en base al estado del pago.

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
      // MAPEO Y PROCESAMIENTO DE ESTADOS OPERATIVOS
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
      // CÁLCULO DE INDICADORES DE RENDIMIENTO (KPIs)
      // ========================================================

      /*
       * Nota mental: Como TurnoFlex todavía no maneja un estado nativo de "ausente", 
       * utilizo las cancelaciones como una aproximación histórica para medir el ausentismo.
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
      // PROCESAMIENTO DE MÉTODOS DE PAGO
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
      // PROCESAMIENTO DE ESTADOS FINANCIEROS
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
      // CONSOLIDACIÓN DE MONTOS
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
      // ARMAR EL MAPA DE EVOLUCIÓN SEMANAL
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


      // Me aseguro de rellenar con ceros los días que no tuvieron turnos para que el gráfico no se rompa
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
      // EMPAQUETAR MÉTRICAS PARA LA VISTA
      // ========================================================

      const metricas = {

        // ------------------------------------------------------
        // Operación general
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
        // Indicadores de rendimiento
        // ------------------------------------------------------

        tasaAusentismo,

        tasaEfectividad,


        // ------------------------------------------------------
        // Jornada actual
        // ------------------------------------------------------

        turnosHoy,


        // ------------------------------------------------------
        // Desglose de pagos
        // ------------------------------------------------------

        mercadoPago,

        efectivo,

        metodoSinDefinir,


        // ------------------------------------------------------
        // Estado financiero detallado
        // ------------------------------------------------------

        pagosPendientes,

        senasPagadas,

        pagosTotales,

        pagosConfirmados,

        pagosSinDefinir,

        tasaCobro,


        // ------------------------------------------------------
        // Importes económicos
        // ------------------------------------------------------

        montoSenasRegistradas,

        montoConfirmado

      };


      // ========================================================
      // RENDERIZAR VISTA DEL DASHBOARD
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