import { TurnoModel } from '../models/TurnoModel.js';
import { ClienteModel } from '../models/ClienteModel.js'; // importar el modelo de Cliente
import { ProfesionalModel } from '../models/ProfesionalModel.js'; // importar el modelo de Profesional
const turnoModel = new TurnoModel();
// Instanciamos los repositorios / modelos
const clienteModel = new ClienteModel();
const profesionalModel = new ProfesionalModel();

export class TurnoController {

  // 1. Método para obtener la lista general o filtrada de turnos
  static getTurnos(req, res) {
    try {
      const { estado, fecha, profesional_id } = req.query;
      let turnos = turnoModel.findAll();

      if (estado) {
        turnos = turnos.filter((t) => t.estado === estado);
      }
      if (fecha) {
        turnos = turnos.filter((t) => t.fecha === fecha);
      }
      if (profesional_id) {
        turnos = turnos.filter((t) => t.profesional_id === profesional_id);
      }

      // Si la petición pide JSON (Postman / Thunder Client)
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({ status: 'success', data: turnos });
      }

      // Renderiza la vista del listado general (turnos.pug)
      res.render('turnos', {
        tituloPage: 'Listado de Turnos',
        turnos
      });
    } catch (error) {
      if (req.accepts('html') && !req.accepts('json')) {
        return res.status(500).render('error', { error: error.message });
      }
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 2. Método para ver el detalle de un turno específico
  static getDetalleTurno(req, res) {
    try {
      const turno = req.turnoEncontrado;

      // Si pide JSON (API REST)
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({ status: 'success', data: turno });
      }

      // Renderiza la vista individual (detalle-turno.pug)
      res.render('detalle-turno', {
        tituloPage: `Detalle del Turno #${turno.id}`,
        turno,
        mensajeExito: req.query.exito || null
      });
    } catch (error) {
      if (req.accepts('html') && !req.accepts('json')) {
        return res.status(500).render('detalle-turno', {
          tituloPage: 'Error de servidor',
          error: error.message
        });
      }
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 3. Método para crear un nuevo turno
  static crearTurno(req, res) {
    try {
      const {
        cliente_id,
        profesional_id,
        fecha,
        hora
      } = req.body;

      const nuevoTurno = turnoModel.create({
        cliente_id,
        profesional_id,
        fecha,
        hora
      });

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(201).json({
          status: 'success',
          data: nuevoTurno
        });
      }

      res.redirect(`/turnos/${nuevoTurno.id}`);
    } catch (error) {
      if (req.accepts('html') && !req.accepts('json')) {
        // En una app real acá se redirigiría con el error en la URL o renderizando un form
        return res.status(400).send(`Error: ${error.message}`); 
      }
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  }

  // 4. Método para cambiar el estado (atendido/cancelado/reservado)
  static cambiarEstadoTurno(req, res) {
    try {
      const { id } = req.params;
      const { nuevoEstado } = req.body;
      
      // Asumimos que el middleware validarExistenciaTurno te deja el turno actual acá
      const turnoActual = req.turnoEncontrado || turnoModel.findById(id); 

      const estadosValidos = [
        'reservado',
        'cancelado',
        'atendido'
      ];

      if (!nuevoEstado || !estadosValidos.includes(nuevoEstado)) {
        if (req.accepts('html') && !req.accepts('json')) {
          return res.status(400).render('detalle-turno', {
            tituloPage: 'Error al cambiar estado',
            turno: turnoActual,
            error: `Estado no permitido. Debe ser: ${estadosValidos.join(', ')}`
          });
        }
        return res.status(400).json({ status: 'error', message: `Estado no permitido.` });
      }

      // NUEVA REGLA: Bloquear si se intenta pasar de Atendido a Cancelado o viceversa
      if (
        (turnoActual.estado === 'atendido' && nuevoEstado === 'cancelado') ||
        (turnoActual.estado === 'cancelado' && nuevoEstado === 'atendido')
      ) {
        const mensajeError = `Transición no permitida. Un turno ${turnoActual.estado} solo puede volver al estado reservado.`;
        
        if (req.accepts('html') && !req.accepts('json')) {
          return res.status(400).render('detalle-turno', {
            tituloPage: 'Error de transición',
            turno: turnoActual,
            error: mensajeError
          });
        }
        return res.status(400).json({ status: 'error', message: mensajeError });
      }

      // Si pasa las validaciones, actualizamos
      const turnoActualizado = turnoModel.updateEstado(id, nuevoEstado);

      // Redirección directa para formularios HTML desde el navegador
      if (req.headers['content-type']?.includes('application/x-www-form-urlencoded') || req.accepts('html')) {
        return res.redirect(`/turnos/${id}?exito=El+estado+del+turno+se+actualizó+a+${nuevoEstado}`);
      }

      // Respuesta JSON para cliente API (Thunder Client / Postman)
      return res.status(200).json({
        status: 'success',
        data: turnoActualizado
      });
    } catch (error) {
      if (req.accepts('html') && !req.accepts('json')) {
        return res.status(500).render('detalle-turno', {
          tituloPage: 'Error de servidor',
          turno: turnoModel.findById(req.params.id),
          error: error.message
        });
      }
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
  // GET /turnos/nuevo - Mostrar formulario con clientes y profesionales cargados
  static async getFormNuevoTurno(req, res) {
    try {
      // Usamos findAll() en lugar de obtenerTodos()
      const clientes = clienteModel.findAll();
      const profesionales = profesionalModel.findAll(); // (Asegurate que ProfesionalModel tenga un método similar)

      res.render('nuevo-turno', {
        tituloPage: 'Solicitar Nuevo Turno',
        clientes: clientes || [],
        profesionales: profesionales || []
      });
    } catch (error) {
      res.status(500).send(`Error al cargar el formulario: ${error.message}`);
    }
  }

}