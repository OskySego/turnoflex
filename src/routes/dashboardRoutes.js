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
// TURNOFLEX INTELLIGENCE
//
// Área gerencial exclusiva para administradores.
// ============================================================

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


export default router;