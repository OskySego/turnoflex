import { Router } from 'express';

import {
  ProfesionalController
} from '../controllers/profesionalController.js';

import {
  validarCamposCreacionProfesional,
  validarExistenciaProfesional
} from '../middlewares/profesionalMiddleware.js';

import {
  asegurarAutenticacion,
  permitirRoles
} from '../middlewares/authMiddleware.js';


const router = Router();


// ============================================================
// LISTADO DE PROFESIONALES
// ============================================================

router.get(
  '/',

  asegurarAutenticacion,

  permitirRoles(
    'admin',
    'personal'
  ),

  ProfesionalController.getProfesionales
);


// ============================================================
// FORMULARIO NUEVO PROFESIONAL
// Debe estar antes de /:id.
// ============================================================

router.get(
  '/nuevo',

  asegurarAutenticacion,

  permitirRoles(
    'admin',
    'personal'
  ),

  (req, res) => {

    return res.render(
      'nuevo-profesional',
      {
        tituloPage:
          'Nuevo Profesional - TurnoFlex'
      }
    );

  }
);


// ============================================================
// CREAR PROFESIONAL
// ============================================================

router.post(
  '/',

  asegurarAutenticacion,

  permitirRoles(
    'admin',
    'personal'
  ),

  validarCamposCreacionProfesional,

  ProfesionalController.crearProfesional
);


// ============================================================
// DETALLE DEL PROFESIONAL
// SIEMPRE debe quedar al final.
// ============================================================

router.get(
  '/:id',

  asegurarAutenticacion,

  permitirRoles(
    'admin',
    'personal'
  ),

  validarExistenciaProfesional,

  ProfesionalController.getDetalleProfesional
);


export default router;