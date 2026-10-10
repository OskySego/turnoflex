import { Router } from 'express';
import { TurnoController } from '../controllers/turnoController.js';
import {
  validarCamposCreacionTurno,
  validarExistenciaTurno
} from '../middlewares/turnoMiddleware.js';

const router = Router();

// 1. RUTA PARA NUEVO (Debe ir antes de /:id)
router.get(
  '/nuevo',
  TurnoController.getFormNuevoTurno
);

// Ruta GET para obtener/renderizar el listado de turnos
router.get(
  '/',
  TurnoController.getTurnos
);

// Ruta POST para crear un turno con validación previa de body
router.post(
  '/',
  validarCamposCreacionTurno,
  TurnoController.crearTurno
);

// 2. RUTA DINÁMICA DE DETALLE
router.get(
  '/:id',
  validarExistenciaTurno,
  TurnoController.getDetalleTurno
);

// 3. RUTAS PARA LOS BOTONES DE LA VISTA (Atendido y Cancelar)
router.post(
  '/:id/atendido',
  validarExistenciaTurno,
  TurnoController.marcarAtendido
);

router.post(
  '/:id/cancelar',
  validarExistenciaTurno,
  TurnoController.cancelarTurno
);

export default router;