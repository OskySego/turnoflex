import { Router } from 'express';

import { ProfesionalController } from '../controllers/profesionalController.js';

import {
  validarCamposCreacionProfesional,
  validarExistenciaProfesional
} from '../middlewares/profesionalMiddleware.js';

const router = Router();

// Ruta GET para obtener todos los profesionales
router.get(
  '/profesionales',
  ProfesionalController.getProfesionales
);

// Ruta dinámica GET para obtener un profesional por su ID
router.get(
  '/profesionales/:id',
  validarExistenciaProfesional,
  ProfesionalController.getDetalleProfesional
);

// Ruta POST para crear un profesional con validación previa del body
router.post(
  '/profesionales',
  validarCamposCreacionProfesional,
  ProfesionalController.crearProfesional
);

export default router;