import { ProfesionalModel } from '../models/ProfesionalModel.js';

const profesionalModel = new ProfesionalModel();

export class ProfesionalController {
  /**
   * GET /profesionales
   * Renderiza el listado de profesionales.
   */
  static getProfesionales(req, res) {
    try {
      const profesionales = profesionalModel.findAll();

      res.render('profesionales', {
        tituloPage: 'Profesionales - TurnoFlex',
        profesionales
      });
    } catch (error) {
      res.status(500).send(`Error de servidor: ${error.message}`);
    }
  }

  /**
   * GET /profesionales/:id
   * Renderiza el detalle de un profesional.
   */
  static getDetalleProfesional(req, res) {
    try {
      const { id } = req.params;

      const profesional =
        req.profesionalEncontrado || profesionalModel.findById(id);

      res.render('detalle-profesional', {
        tituloPage: `${profesional.nombre} - TurnoFlex`,
        profesional
      });
    } catch (error) {
      res.status(500).send(`Error de servidor: ${error.message}`);
    }
  }

  /**
   * POST /profesionales
   * Crea un nuevo profesional enviado por Body JSON.
   */
  static crearProfesional(req, res) {
    try {
      const {
        nombre,
        especialidad,
        dias_disponibles,
        horarios
      } = req.body;

      const nuevoProfesional = profesionalModel.create({
        nombre,
        especialidad,
        dias_disponibles,
        horarios
      });

      res.status(201).json({
        status: 'success',
        data: nuevoProfesional
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  }
}