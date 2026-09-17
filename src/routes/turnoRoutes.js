import { Router } from 'express';
import { TurnoController } from '../controllers/turnoController.js';
import {
  validarCamposCreacionTurno,
  validarExistenciaTurno
} from '../middlewares/turnoMiddleware.js';

const router = Router();

// Ruta dinámica GET para obtener/renderizar el detalle de un turno
router.get('/turnos/:id', validarExistenciaTurno, TurnoController.getDetalleTurno);

// Ruta POST para crear un turno con validación previa de body
router.post('/turnos', validarCamposCreacionTurno, TurnoController.crearTurno);

// Ruta dinámica POST / PATCH para cambiar el estado de un turno
router.post('/turnos/:id/estado', validarExistenciaTurno, TurnoController.cambiarEstadoTurno);
router.patch('/turnos/:id/estado', validarExistenciaTurno, TurnoController.cambiarEstadoTurno);

export default router;