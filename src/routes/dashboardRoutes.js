/**
 * Enrutador del panel de control / métricas (Dashboard) para TurnoFlex.
 * Centraliza el acceso al área gerencial de estadísticas protegida exclusivamente para administradores.
 */

import { Router } from 'express';

import {
  DashboardController
} from '../controllers/dashboardController.js';

import {
  asegurarAutenticacion
} from '../middlewares/authMiddleware.js';

import {
  verificarRol
} from '../middlewares/roleMiddleware.js';

import {
  catchAsync
} from '../utils/catchAsync.js';


const router =
  Router();


// ============================================================
// TURNOFLEX INTELLIGENCE - PANEL GERENCIAL
// ============================================================

// Vista principal de métricas y estadísticas (restringida a administradores)
router.get(
  '/',

  asegurarAutenticacion,

  verificarRol(
    'admin'
  ),

  catchAsync(
    DashboardController.getEstadisticas
  )
);


// ============================================================
// EXPORTACIÓN DEL ENRUTADOR
// ============================================================

export default router;