
import { Router } from 'express';

import {
  ProfesionalDashboardController
} from '../controllers/profesionalDashboardController.js';

import {
  TurnoController
} from '../controllers/turnoController.js';

import {
  asegurarAutenticacion,
  permitirRoles
} from '../middlewares/authMiddleware.js';

const router = Router();

// ============================================================
// MI AGENDA MÉDICA
// GET /medico/agenda
// ============================================================

router.get(
  '/agenda',

  asegurarAutenticacion,

  permitirRoles('profesional'),

  ProfesionalDashboardController.verMiAgenda
);

// ============================================================
// MARCAR TURNO COMO ATENDIDO
// POST /medico/turnos/:id/atendido
// ============================================================

router.post(
  '/turnos/:id/atendido',

  asegurarAutenticacion,

  permitirRoles('profesional'),

  ProfesionalDashboardController.marcarAtendido
);

// ============================================================
// CANCELAR TURNO
// POST /medico/turnos/:id/cancelar
// ============================================================

router.post(
  '/turnos/:id/cancelar',

  asegurarAutenticacion,

  permitirRoles('profesional'),

  ProfesionalDashboardController.cancelarTurno
);

// ============================================================
// LLAMAR PACIENTE A SALA DE ESPERA
// POST /medico/turnos/:id/llamar
// ============================================================

router.post(
  '/turnos/:id/llamar',

  asegurarAutenticacion,

  permitirRoles('profesional'),

  TurnoController.llamarPaciente
);

// ============================================================
// EXPORTAR RUTAS
// ============================================================

export default router;
