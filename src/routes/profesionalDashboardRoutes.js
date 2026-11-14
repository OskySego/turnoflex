/**
 * Enrutador del panel de control y gestión operativa para profesionales en TurnoFlex.
 * Define las rutas protegidas para visualización de agenda médica, control de atención, cancelaciones y llamados a sala.
 */

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
// GESTIÓN DE AGENDA MÉDICA
// ============================================================

// Visualización de la agenda y turnos asignados al profesional logueado
router.get(
  '/agenda',

  asegurarAutenticacion,

  permitirRoles('profesional'),

  ProfesionalDashboardController.verMiAgenda
);

// ============================================================
// ACCIONES SOBRE EL ESTADO DE LOS TURNOS
// ============================================================

// Marcar un turno como atendido tras la consulta
router.post(
  '/turnos/:id/atendido',

  asegurarAutenticacion,

  permitirRoles('profesional'),

  ProfesionalDashboardController.marcarAtendido
);

// Cancelar un turno desde la vista del profesional
router.post(
  '/turnos/:id/cancelar',

  asegurarAutenticacion,

  permitirRoles('profesional'),

  ProfesionalDashboardController.cancelarTurno
);

// Disparar el llamado al paciente hacia el consultorio (sala de espera)
router.post(
  '/turnos/:id/llamar',

  asegurarAutenticacion,

  permitirRoles('profesional'),

  TurnoController.llamarPaciente
);

// ============================================================
// EXPORTACIÓN DEL ENRUTADOR
// ============================================================

export default router;