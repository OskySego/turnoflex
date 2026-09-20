import { TurnoModel } from '../models/TurnoModel.js';

const turnoModel = new TurnoModel();

/**
 * Middleware que verifica si un turno existe según el ID del parámetro dinámico de la ruta.
 */
export const validarExistenciaTurno = (req, res, next) => {
  const { id } = req.params;
  const turno = turnoModel.findById(id);

  if (!turno) {
    // Si la petición espera una API (JSON), devolvemos error 404 estructurado
    if (req.headers['accept']?.includes('application/json')) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: `El turno con ID '${id}' no fue encontrado en el sistema.`
      });
    }

    // Si es petición web web/HTML, renderizamos pantalla semántica de error 404
    return res.status(404).render('detalle-turno', {
      tituloPage: 'Turno no encontrado',
      error: `El turno con ID "${id}" no existe en la base de datos.`
    });
  }

  // Adjuntamos la entidad encontrada al objeto request para optimizar lectura
  req.turnoEncontrado = turno;
  next();
};

/**
 * Middleware que valida la presencia de los campos obligatorios antes de intentar crear un turno.
 */
export const validarCamposCreacionTurno = (req, res, next) => {
  // CORRECCIÓN: Ahora busca "cliente_id" para coincidir con la vista y el modelo
  const { cliente_id, profesional_id, fecha, hora } = req.body;
  const camposFaltantes = [];

  if (!cliente_id) camposFaltantes.push('cliente_id');
  if (!profesional_id) camposFaltantes.push('profesional_id');
  if (!fecha) camposFaltantes.push('fecha');
  if (!hora) camposFaltantes.push('hora');

  if (camposFaltantes.length > 0) {
    return res.status(400).json({
      status: 'fail',
      code: 400,
      message: 'Faltan campos obligatorios en el cuerpo de la solicitud.',
      camposFaltantes
    });
  }

  next();
};