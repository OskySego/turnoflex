import { Router } from 'express';

import { TurnoController } from '../controllers/turnoController.js';

import {
  validarCamposCreacionTurno,
  validarExistenciaTurno
} from '../middlewares/turnoMiddleware.js';

const router = Router();

// Ruta GET para obtener/renderizar el listado de turnos
router.get(
  '/turnos',
  TurnoController.getTurnos
);

// Ruta dinámica GET para obtener/renderizar el detalle de un turno
router.get(
  '/turnos/:id',
  validarExistenciaTurno,
  TurnoController.getDetalleTurno
);

// Ruta POST para crear un turno con validación previa de body
router.post(
  '/turnos',
  validarCamposCreacionTurno,
  TurnoController.crearTurno
);

// Ruta dinámica POST para cambiar el estado de un turno
router.post(
  '/turnos/:id/estado',
  validarExistenciaTurno,
  TurnoController.cambiarEstadoTurno
);

// Ruta dinámica PATCH para cambiar el estado de un turno
router.patch(
  '/turnos/:id/estado',
  validarExistenciaTurno,
  TurnoController.cambiarEstadoTurno
);

export default router;