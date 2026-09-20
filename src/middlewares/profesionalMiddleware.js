import { ProfesionalModel } from '../models/ProfesionalModel.js';

const profesionalModel = new ProfesionalModel();

/**
 * Middleware que verifica si un profesional existe según el ID
 * del parámetro dinámico de la ruta.
 */
export const validarExistenciaProfesional = (req, res, next) => {
  const { id } = req.params;
  const profesional = profesionalModel.findById(id);

  if (!profesional) {
    return res.status(404).json({
      status: 'error',
      code: 404,
      message: `El profesional con ID '${id}' no fue encontrado en el sistema.`
    });
  }

  // Adjuntamos el profesional encontrado al request
  // para que el controller no tenga que buscarlo nuevamente.
  req.profesionalEncontrado = profesional;

  next();
};

/**
 * Middleware que valida los campos obligatorios
 * antes de crear un profesional.
 */
export const validarCamposCreacionProfesional = (req, res, next) => {
  const {
    nombre,
    especialidad,
    dias_disponibles,
    horarios
  } = req.body;

  const camposFaltantes = [];

  if (!nombre) camposFaltantes.push('nombre');
  if (!especialidad) camposFaltantes.push('especialidad');
  if (!dias_disponibles) camposFaltantes.push('dias_disponibles');
  if (!horarios) camposFaltantes.push('horarios');

  if (camposFaltantes.length > 0) {
    return res.status(400).json({
      status: 'fail',
      code: 400,
      message: 'Faltan campos obligatorios en el cuerpo de la solicitud.',
      camposFaltantes
    });
  }

  if (!Array.isArray(dias_disponibles) || !Array.isArray(horarios)) {
    return res.status(400).json({
      status: 'fail',
      code: 400,
      message: 'dias_disponibles y horarios deben ser arreglos.'
    });
  }

  next();
};