import { Router } from 'express';

import {
  ProfesionalDashboardController
} from '../controllers/profesionalDashboardController.js';

import {
  asegurarAutenticacion,
  permitirRoles
} from '../middlewares/authMiddleware.js';


const router = Router();


// ============================================================
// MI AGENDA
// GET /medico/agenda
// ============================================================

router.get(
  '/agenda',

  asegurarAutenticacion,

  permitirRoles(
    'profesional'
  ),

  ProfesionalDashboardController.verMiAgenda
);


// ============================================================
// MARCAR TURNO PROPIO COMO ATENDIDO
// POST /medico/turnos/:id/atendido
// ============================================================

router.post(
  '/turnos/:id/atendido',

  asegurarAutenticacion,

  permitirRoles(
    'profesional'
  ),

  ProfesionalDashboardController.marcarAtendido
);


// ============================================================
// CANCELAR TURNO PROPIO
// POST /medico/turnos/:id/cancelar
// ============================================================

router.post(
  '/turnos/:id/cancelar',

  asegurarAutenticacion,

  permitirRoles(
    'profesional'
  ),

  ProfesionalDashboardController.cancelarTurno
);


export default router;