import { Router } from 'express';

import { ProfesionalController } from '../controllers/profesionalController.js';

import {
  validarCamposCreacionProfesional,
  validarExistenciaProfesional
} from '../middlewares/profesionalMiddleware.js';

const router = Router();

// RUTAS API (JSON)

// Obtener todos los profesionales
router.get(
  '/profesionales',
  ProfesionalController.getProfesionales
);

// Obtener un profesional por ID
router.get(
  '/profesionales/:id',
  validarExistenciaProfesional,
  ProfesionalController.getDetalleProfesional
);

// Crear un profesional
router.post(
  '/profesionales',
  validarCamposCreacionProfesional,
  ProfesionalController.crearProfesional
);


// RUTAS VISTAS (HTML)

// Listado de profesionales
router.get(
  '/vista/profesionales',
  ProfesionalController.getProfesionalesVista
);

// Detalle de un profesional
router.get(
  '/vista/profesionales/:id',
  validarExistenciaProfesional,
  ProfesionalController.getDetalleProfesionalVista
);

export default router;