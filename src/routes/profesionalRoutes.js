import { Router } from 'express';

import { ProfesionalController } from '../controllers/profesionalController.js';

import {
  validarCamposCreacionProfesional,
  validarExistenciaProfesional
} from '../middlewares/profesionalMiddleware.js';

const router = Router();

// 1. Ruta GET para obtener todos los profesionales
router.get(
  '/',
  ProfesionalController.getProfesionales
);

// 2. Ruta para mostrar el formulario de creación (¡Ojo al orden: req, res y antes de /:id!)
router.get('/nuevo', (req, res) => {
  res.render('nuevo-profesional', { tituloPage: 'Nuevo Profesional' });
});

// 3. Ruta POST para crear un profesional con validación previa del body
router.post(
  '/',
  validarCamposCreacionProfesional,
  ProfesionalController.crearProfesional
);

// 4. Ruta dinámica GET para obtener un profesional por su ID (Debe ir siempre AL FINAL de las rutas fijas)
router.get('/:id', 
  ProfesionalController.getDetalleProfesional
);

export default router;