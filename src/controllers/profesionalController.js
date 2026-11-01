import { Profesional } from '../models/Profesional.js';


export class ProfesionalController {

  // ============================================================
  // 1. LISTAR PROFESIONALES
  // ============================================================

  static async getProfesionales(req, res) {

    try {

      const profesionales =
        await Profesional
          .find()
          .lean({
            virtuals: true
          });


      if (
        req.accepts('json') &&
        !req.accepts('html')
      ) {

        return res.status(200).json({

          status: 'success',

          data:
            profesionales || []

        });

      }


      return res.render(
        'profesionales',
        {

          tituloPage:
            'Listado de Profesionales',

          profesionales:
            profesionales || []

        }
      );


    } catch (error) {

      console.error(
        '❌ Error al obtener profesionales:',
        error
      );


      return res
        .status(500)
        .send(
          'Error al obtener profesionales: ' +
          error.message
        );

    }

  }


  // ============================================================
  // 2. DETALLE DE PROFESIONAL
  // ============================================================

  static async getDetalleProfesional(req, res) {

    try {

      const { id } =
        req.params;


      const profesional =
        await Profesional
          .findById(id)
          .lean({
            virtuals: true
          });


      if (!profesional) {

        return res
          .status(404)
          .render(
            'detalle-profesional',
            {

              tituloPage:
                'Profesional no encontrado',

              error:
                `El profesional con ID '${id}' no fue encontrado en el sistema.`

            }
          );

      }


      if (
        req.accepts('json') &&
        !req.accepts('html')
      ) {

        return res
          .status(200)
          .json({

            status:
              'success',

            data:
              profesional

          });

      }


      return res.render(
        'detalle-profesional',
        {

          tituloPage:
            `Detalle de ${profesional.nombre}`,

          profesional

        }
      );


    } catch (error) {

      console.error(
        '❌ Error al obtener detalle del profesional:',
        error
      );


      return res
        .status(500)
        .send(
          'Error al obtener el detalle: ' +
          error.message
        );

    }

  }


  // ============================================================
  // 3. CREAR PROFESIONAL
  // ============================================================

  static async crearProfesional(req, res) {

    try {

      const {

        nombre,
        dni,
        genero,
        email,
        telefono,

        matricula,
        especialidad,
        subespecialidades,
        tipoCobertura,

        sede,

        diasAtencion,
        horaInicio,
        horaFin,
        duracionTurnoMinutos,
        modalidad,

        permiteSobreturnos,
        diasSobreturnos,
        horaInicioSobreturnos,
        horaFinSobreturnos,
        cantidadMaximaSobreturnos,

        ofreceTelemedicina,
        diasTelemedicina,
        horaInicioTelemedicina,
        horaFinTelemedicina

      } = req.body;


      // ========================================================
      // CONVERTIR CAMPOS DE DÍAS A ARRAY
      // ========================================================

      const parseArrayStrings =
        (valor) => {

          if (!valor) {
            return [];
          }


          if (
            Array.isArray(valor)
          ) {

            return valor;

          }


          return [valor];

        };


      // ========================================================
      // CREAR PROFESIONAL
      // ========================================================

      const nuevoProfesional =
        await Profesional.create({

          nombre,

          dni,

          genero,

          email,

          telefono,

          matricula,

          especialidad,

          subespecialidades,

          tipoCobertura:
            tipoCobertura || 'ambas',

          sede,


          // ----------------------------------------------------
          // AGENDA GENERAL
          // ----------------------------------------------------

          diasAtencion:
            parseArrayStrings(
              diasAtencion
            ),

          horaInicio:
            horaInicio || '08:00',

          horaFin:
            horaFin || '18:00',

          duracionTurnoMinutos:
            Number(
              duracionTurnoMinutos
            ) || 30,

          modalidad:
            modalidad || 'presencial',


          // ----------------------------------------------------
          // SOBRETURNOS
          // ----------------------------------------------------

          permiteSobreturnos:
            permiteSobreturnos === 'on' ||
            permiteSobreturnos === true,

          diasSobreturnos:
            parseArrayStrings(
              diasSobreturnos
            ),

          horaInicioSobreturnos:
            horaInicioSobreturnos || '',

          horaFinSobreturnos:
            horaFinSobreturnos || '',

          cantidadMaximaSobreturnos:
            Math.min(
              Number(
                cantidadMaximaSobreturnos
              ) || 4,
              8
            ),


          // ----------------------------------------------------
          // TELEMEDICINA
          // ----------------------------------------------------

          ofreceTelemedicina:
            ofreceTelemedicina === 'on' ||
            ofreceTelemedicina === true,

          diasTelemedicina:
            parseArrayStrings(
              diasTelemedicina
            ),

          horaInicioTelemedicina:
            horaInicioTelemedicina || '',

          horaFinTelemedicina:
            horaFinTelemedicina || ''

        });


      // ========================================================
      // RESPUESTA JSON
      // ========================================================

      if (
        req.accepts('json') &&
        !req.accepts('html')
      ) {

        return res
          .status(201)
          .json({

            status:
              'success',

            data:
              nuevoProfesional

          });

      }


      // ========================================================
      // REDIRECCIÓN HTML
      // ========================================================

      return res.redirect(
        '/profesionales'
      );


    } catch (error) {

      console.error(
        '❌ Error al crear profesional:',
        error
      );


      return res
        .status(400)
        .send(
          'Error al crear profesional: ' +
          error.message
        );

    }

  }

}


export default ProfesionalController;