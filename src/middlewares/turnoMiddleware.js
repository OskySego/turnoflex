import { Turno } from '../models/Turno.js';

export const validarExistenciaTurno = async (req, res, next) => {
  const { id } = req.params;
  try {
    const turno = await Turno.findById(id).lean();
    if (!turno) {
      return res.status(404).render('detalle-turno', {
        tituloPage: 'Turno no encontrado',
        error: `El turno con ID "${id}" no existe en la base de datos.`
      });
    }
    req.turnoEncontrado = turno;
    next();
  } catch (error) {
    res.status(500).send('Error interno en el servidor.');
  }
};

export const validarCamposCreacionTurno = (req, res, next) => {
  const { cliente_id, profesional_id, fecha, hora } = req.body;
  if (!cliente_id || !profesional_id || !fecha || !hora) {
    return res.status(400).send('Faltan campos obligatorios para crear el turno.');
  }
  next();
};