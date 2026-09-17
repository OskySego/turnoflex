import { TurnoModel } from '../models/TurnoModel.js';

const turnoModel = new TurnoModel();

export class TurnoController {
  /**
   * GET /turnos/:id
   * Renderiza la vista Pug con los detalles completos del turno.
   */
  static getDetalleTurno(req, res) {
    try {
      const { id } = req.params;
      // El middleware previno que llegara acá si no existía, pero se puede re-verificar
      const turno = req.turnoEncontrado || turnoModel.findById(id);

      res.render('detalle-turno', {
        tituloPage: `Detalle del Turno #${turno.id}`,
        turno
      });
    } catch (error) {
      res.status(500).render('detalle-turno', {
        tituloPage: 'Error de servidor',
        error: error.message
      });
    }
  }

  /**
   * POST /turnos
   * Crea un nuevo turno enviado por Body JSON o Formulario.
   */
  static crearTurno(req, res) {
    try {
      const { usuario_id, profesional_id, fecha, hora } = req.body;
      const nuevoTurno = turnoModel.create({ usuario_id, profesional_id, fecha, hora });

      // Responder API JSON o Redireccionar según el Request Header
      if (req.accepts('json')) {
        return res.status(201).json({ status: 'success', data: nuevoTurno });
      }
      res.redirect(`/turnos/${nuevoTurno.id}`);
    } catch (error) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  /**
   * PATCH o POST /turnos/:id/estado
   * Modifica el estado del turno (cancelar o confirmar/atender).
   */
  static cambiarEstadoTurno(req, res) {
    try {
      const { id } = req.params;
      const { nuevoEstado } = req.body;

      const estadosValidos = ['reservado', 'cancelado', 'atendido'];
      if (!nuevoEstado || !estadosValidos.includes(nuevoEstado)) {
        return res.status(400).json({
          status: 'fail',
          message: `Estado inválido. Los valores permitidos son: ${estadosValidos.join(', ')}`
        });
      }

      const turnoActualizado = turnoModel.updateEstado(id, nuevoEstado);

      if (req.accepts('json')) {
        return res.status(200).json({
          status: 'success',
          message: `Estado del turno actualizado a ${nuevoEstado}`,
          data: turnoActualizado
        });
      }

      res.redirect(`/turnos/${id}`);
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
}