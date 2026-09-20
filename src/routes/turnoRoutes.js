import { Router } from 'express';
import { TurnoController } from '../controllers/turnoController.js';
import {
  validarCamposCreacionTurno,
  validarExistenciaTurno
} from '../middlewares/turnoMiddleware.js';

const router = Router();

// 1. RUTA ESTÁTICA PARA NUEVO (DEBE IR PRIMERO ANTES DE CUALQUIER :id)
router.get(
  '/turnos/nuevo',
  TurnoController.getFormNuevoTurno
);

// Ruta GET para obtener/renderizar el listado de turnos
router.get(
  '/turnos',
  TurnoController.getTurnos
);

// Ruta POST para crear un turno con validación previa de body
router.post(
  '/turnos',
  validarCamposCreacionTurno,
  TurnoController.crearTurno
);

// 2. RUTAS DINÁMICAS (Van después para que no intercepten la palabra 'nuevo')
router.get(
  '/turnos/:id',
  validarExistenciaTurno,
  TurnoController.getDetalleTurno
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