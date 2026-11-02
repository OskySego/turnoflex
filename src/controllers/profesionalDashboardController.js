import { Turno } from '../models/Turno.js';
import { Profesional } from '../models/Profesional.js';
import { Usuario } from '../models/Usuario.js';


export class ProfesionalDashboardController {


  // ============================================================
  // BUSCAR EL PERFIL DEL PROFESIONAL LOGUEADO
  // ============================================================

  static async obtenerProfesionalSesion(req) {

    if (
      !req.session ||
      !req.session.usuario ||
      !req.session.usuario.email
    ) {
      return null;
    }


    const usuarioSesion = req.session.usuario;

    // Primero, usar el vínculo explícito y verificado de la cuenta.
    // Si una cuenta tiene vínculo, nunca se recurre a su email como sustituto.
    const cuenta = usuarioSesion.id || usuarioSesion._id
      ? await Usuario.findById(usuarioSesion.id || usuarioSesion._id)
          .select('rol profesional_id').lean()
      : null;

    if (!cuenta || cuenta.rol !== 'profesional') return null;
    if (cuenta.profesional_id) {
      return Profesional.findById(cuenta.profesional_id);
    }

    // Compatibilidad TEMPORAL: agendas existentes aún sin cuenta vinculada.
    // Este fallback NO autoriza acceso a la historia clínica.
    const profesional = await Profesional.findOne({
      email: req.session.usuario.email
    });
    return profesional;

  }


  // ============================================================
  // 1. VER MI AGENDA
  // ============================================================

  static async verMiAgenda(req, res) {

    try {

      const profesional =
        await ProfesionalDashboardController
          .obtenerProfesionalSesion(req);


      if (!profesional) {

        return res.render(
          'error',
          {
            mensaje:
              'No se encontró un perfil profesional asociado a este usuario.'
          }
        );

      }


      const turnos =
        await Turno
          .find({
            profesional_id:
              profesional._id
          })
          .populate(
            'cliente_id'
          )
          .sort({
            fecha: 1,
            hora: 1
          })
          .lean({
            virtuals: true
          });


      return res.render(
        'profesional-agenda',
        {

          tituloPage:
            'Mi Agenda Médica',

          profesional:
            profesional.toObject(),

          turnos:
            turnos || [],

          mensajeExito:
            req.query.exito || null

        }
      );


    } catch (error) {

      console.error(
        '❌ Error al cargar agenda profesional:',
        error
      );


      return res
        .status(500)
        .send(
          'Error al cargar la agenda del profesional.'
        );

    }

  }


  // ============================================================
  // 2. CAMBIAR ESTADO DE UN TURNO PROPIO
  // ============================================================

  static async cambiarEstadoPropio(
    req,
    res,
    nuevoEstado
  ) {

    try {

      const profesional =
        await ProfesionalDashboardController
          .obtenerProfesionalSesion(req);


      if (!profesional) {

        return res
          .status(403)
          .send(
            'No se encontró el perfil profesional.'
          );

      }


      // ========================================================
      // SEGURIDAD:
      // buscamos el turno por ID Y profesional_id.
      // De esta forma un médico no puede modificar turnos
      // pertenecientes a otro profesional.
      // ========================================================

      const turno =
        await Turno.findOne({

          _id:
            req.params.id,

          profesional_id:
            profesional._id

        });


      if (!turno) {

        return res
          .status(404)
          .send(
            'El turno no existe o no pertenece a tu agenda.'
          );

      }


      // ========================================================
      // SOLO PERMITIMOS MODIFICAR TURNOS RESERVADOS
      // ========================================================

      if (
        turno.estado !== 'reservado'
      ) {

        return res.redirect(
          '/medico/agenda?exito=El+turno+ya+se+encuentra+finalizado'
        );

      }


      // ========================================================
      // ESTADOS QUE PUEDE UTILIZAR EL PROFESIONAL
      // ========================================================

      const estadosPermitidos = [
        'atendido',
        'cancelado'
      ];


      if (
        !estadosPermitidos.includes(
          nuevoEstado
        )
      ) {

        return res
          .status(400)
          .send(
            'Estado de turno no válido.'
          );

      }


      const estadoAnterior =
        turno.estado;


      // ========================================================
      // AUDITORÍA
      // ========================================================

      if (
        turno.historialEstados
      ) {

        turno.historialEstados.push({

          estadoAnterior:
            estadoAnterior,

          estadoNuevo:
            nuevoEstado,

          modificadoPor:
            (
              req.session.usuario.id ||
              req.session.usuario._id ||
              null
            )

        });

      }


      // ========================================================
      // CAMBIAR ESTADO
      // ========================================================

      turno.estado =
        nuevoEstado;


      await turno.save();


      // ========================================================
      // SOCKET.IO (UBICACIÓN CORRECTA)
      // ========================================================

      const io =
        req.app.get(
          'socketio'
        );


      if (io) {

        io.emit(
          'actualizacion_agenda',
          {

            tipo:
              'ESTADO',

            id:
              turno._id.toString(),

            nuevoEstado:
              turno.estado

          }
        );

      }


      // ========================================================
      // MENSAJE
      // ========================================================

      if (
        nuevoEstado === 'atendido'
      ) {

        return res.redirect(
          '/medico/agenda?exito=Turno+marcado+como+atendido'
        );

      }


      return res.redirect(
        '/medico/agenda?exito=Turno+cancelado+correctamente'
      );


    } catch (error) {

      console.error(
        '❌ Error al cambiar estado desde agenda médica:',
        error
      );


      return res
        .status(500)
        .send(
          'Error al actualizar el turno.'
        );

    }

  }


  // ============================================================
  // 3. MARCAR COMO ATENDIDO
  // ============================================================

  static async marcarAtendido(
    req,
    res
  ) {

    return ProfesionalDashboardController
      .cambiarEstadoPropio(
        req,
        res,
        'atendido'
      );

  }


  // ============================================================
  // 4. CANCELAR TURNO
  // ============================================================

  static async cancelarTurno(
    req,
    res
  ) {

    return ProfesionalDashboardController
      .cambiarEstadoPropio(
        req,
        res,
        'cancelado'
      );

  }

}


export default ProfesionalDashboardController;