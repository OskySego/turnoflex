import { Turno } from '../models/Turno.js';
import { Cliente } from '../models/Cliente.js';
import { Profesional } from '../models/Profesional.js';

export class TurnoController {

  // 1. Obtener listado de turnos
  static async getTurnos(req, res) {
    try {
      const { estado, fecha, profesional_id } = req.query;
      let filtro = {};

      if (estado) filtro.estado = estado;
      if (fecha) filtro.fecha = fecha;
      if (profesional_id) filtro.profesional_id = profesional_id;

      const turnos = await Turno.find(filtro)
        .populate('cliente_id')
        .populate('profesional_id')
        .lean({ virtuals: true });

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({ status: 'success', data: turnos });
      }

      res.render('turnos', {
        tituloPage: 'Listado de Turnos',
        turnos
      });
    } catch (error) {
      if (req.accepts('html') && !req.accepts('json')) {
        return res.status(500).render('detalle-turno', { tituloPage: 'Error', error: error.message });
      }
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 2. Ver detalle de un turno específico
  static async getDetalleTurno(req, res) {
    try {
      const { id } = req.params;
      const turno = await Turno.findById(id)
        .populate('cliente_id')
        .populate('profesional_id')
        .lean({ virtuals: true });

      if (!turno) {
        return res.status(404).render('detalle-turno', { tituloPage: 'No encontrado', error: 'El turno no existe' });
      }

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({ status: 'success', data: turno });
      }

      res.render('detalle-turno', {
        tituloPage: `Detalle del Turno #${turno.id || turno._id}`,
        turno,
        mensajeExito: req.query.exito || null
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 3. Renderizar formulario de nuevo turno
  static async getFormNuevoTurno(req, res) {
    try {
      const clientes = await Cliente.find().lean({ virtuals: true });
      const profesionales = await Profesional.find().lean({ virtuals: true });

      res.render('nuevo-turno', {
        tituloPage: 'Solicitar Nuevo Turno',
        clientes: clientes || [],
        profesionales: profesionales || []
      });
    } catch (error) {
      res.status(500).send(`Error al cargar el formulario: ${error.message}`);
    }
  }

  // 4. Crear un nuevo turno
  static async crearTurno(req, res) {
    try {
      const { cliente_id, profesional_id, fecha, hora } = req.body;

      const nuevoTurno = await Turno.create({
        cliente_id,
        profesional_id,
        fecha,
        hora
      });

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(201).json({ status: 'success', data: nuevoTurno });
      }

      res.redirect(`/turnos/${nuevoTurno._id}`);
    } catch (error) {
      if (req.accepts('html') && !req.accepts('json')) {
        return res.status(400).send(`Error al crear el turno: ${error.message}`);
      }
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // 5. Cambiar el estado del turno (Función base)
  static async cambiarEstadoTurno(req, res) {
    try {
      const { id } = req.params;
      const { nuevoEstado } = req.body;

      const turnoActual = await Turno.findById(id);
      if (!turnoActual) {
        return res.status(404).send('Turno no encontrado');
      }

      const estadosValidos = ['reservado', 'cancelado', 'atendido'];
      if (!nuevoEstado || !estadosValidos.includes(nuevoEstado)) {
        return res.status(400).send('Estado no válido');
      }

      // Regla de Negocio: Transiciones bloqueadas entre Atendido y Cancelado
      if (
        (turnoActual.estado === 'atendido' && nuevoEstado === 'cancelado') ||
        (turnoActual.estado === 'cancelado' && nuevoEstado === 'atendido')
      ) {
        const mensajeError = `Transición no permitida. Un turno ${turnoActual.estado} solo puede volver a reservado.`;
        return res.status(400).send(mensajeError);
      }

      turnoActual.estado = nuevoEstado;
      await turnoActual.save();

      if (req.accepts('html')) {
        return res.redirect(`/turnos/${id}?exito=Estado+actualizado+a+${nuevoEstado}`);
      }

      return res.status(200).json({ status: 'success', data: turnoActual });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 6. Marcar turno como atendido (Método independiente fuera de cambiarEstadoTurno)
  static async marcarAtendido(req, res) {
    req.body.nuevoEstado = 'atendido';
    return TurnoController.cambiarEstadoTurno(req, res);
  }
  
  // 7. Cancelar turno (Método independiente fuera de cambiarEstadoTurno)
  static async cancelarTurno(req, res) {
    req.body.nuevoEstado = 'cancelado';
    return TurnoController.cambiarEstadoTurno(req, res);
  }

}

export default TurnoController;