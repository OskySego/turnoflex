import { Turno } from '../models/Turno.js';
import { Profesional } from '../models/Profesional.js';
import { Usuario } from '../models/Usuario.js';


export class ProfesionalDashboardController {


  // ============================================================
  // BUSCAR EL PERFIL DEL PROFESIONAL LOGUEADO
  // ============================================================

  // Esta función me sirve para saber qué médico está conectado actualmente.
  // Busco su perfil usando el id que tengo guardado en la sesión.
  static async obtenerProfesionalSesion(req) {

    // Si no hay sesión o le falta el mail, reboto porque no es un usuario válido.
    if (
      !req.session ||
      !req.session.usuario ||
      !req.session.usuario.email
    ) {
      return null;
    }


    const usuarioSesion = req.session.usuario;

    // Busco primero si el usuario tiene una cuenta vinculada oficialmente.
    // Confío ciegamente en este vínculo (profesional_id) porque es el método más seguro.
    const cuenta = usuarioSesion.id || usuarioSesion._id
      ? await Usuario.findById(usuarioSesion.id || usuarioSesion._id)
          .select('rol profesional_id').lean()
      : null;

    // Si no es un profesional o no lo encuentro, corto la ejecución acá.
    if (!cuenta || cuenta.rol !== 'profesional') return null;
    
    // Si la cuenta tiene el vínculo configurado, traigo el perfil directamente.
    if (cuenta.profesional_id) {
      return Profesional.findById(cuenta.profesional_id);
    }

    // Dejo este parche temporal por si quedó alguna agenda vieja dando vueltas 
    // que todavía no tiene su cuenta de usuario vinculada por ID.
    // OJO: Este parche no le va a dar permiso para firmar historias clínicas.
    const profesional = await Profesional.findOne({
      email: req.session.usuario.email
    });
    
    return profesional;

  }


  // ============================================================
  // 1. VER MI AGENDA
  // ============================================================

  // Renderizo la pantalla principal del médico con todos sus turnos.
  static async verMiAgenda(req, res) {

    try {

      // Traigo al médico que está logueado
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


      // Busco en la base de datos todos los turnos que estén asignados exclusivamente a este médico.
      // Le inyecto los datos del cliente (paciente) y los ordeno cronológicamente.
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


      // Le mando toda la info armada a la vista de Pug
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

  // Hago una función genérica centralizada para no repetir código
  // cada vez que el médico marca un turno como "atendido" o "cancelado".
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
      // FILTRO DE SEGURIDAD
      // ========================================================
      // Hago la búsqueda exigiendo que el profesional_id coincida.
      // De esta manera me aseguro de que un médico "vivo" no pueda
      // alterar el turno de un colega modificando el ID en la URL.

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


      // Evito que se toquen turnos que ya se cobraron, se cancelaron, etc.
      // El médico solo puede accionar sobre turnos que están "reservados" (pendientes).
      if (
        turno.estado !== 'reservado'
      ) {

        return res.redirect(
          '/medico/agenda?exito=El+turno+ya+se+encuentra+finalizado'
        );

      }


      // Hago una lista blanca de estados para que no puedan inyectar
      // un estado falopa desde el formulario web.
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
      // REGISTRO DE AUDITORÍA
      // ========================================================
      // Dejo asentado en el historial quién tocó el turno, a qué hora 
      // y qué estado le puso, por si mañana hay algún reclamo.

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


      // Aplico el cambio real y lo guardo en Mongo
      turno.estado =
        nuevoEstado;


      await turno.save();


      // ========================================================
      // ACTUALIZAR PANTALLAS EN TIEMPO REAL (Socket.IO)
      // ========================================================
      // Aviso al servidor de websockets que el turno cambió de estado 
      // para que a la secretaria (o al paciente) se le actualice la 
      // pantalla automáticamente sin tener que apretar F5.

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


      // Si todo salió bien, lo mando de vuelta a su agenda con un cartelito verde
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