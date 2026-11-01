import { Router } from 'express';

import { ClienteController } from '../controllers/clienteController.js';

import { RelacionFamiliarController } from '../controllers/relacionFamiliarController.js';

import {
  validarExistenciaCliente,
  validarCamposCreacionCliente
} from '../middlewares/clienteMiddleware.js';

import {
  asegurarAutenticacion,
  permitirRoles
} from '../middlewares/authMiddleware.js';

import { catchAsync } from '../utils/catchAsync.js';


const router = Router();


// ============================================================
// 1. LISTADO DE PACIENTES
// ============================================================

router.get(
  '/',
  asegurarAutenticacion,
  permitirRoles('admin', 'personal'),
  ClienteController.getClientes
);


// ============================================================
// 2. NUEVO PACIENTE
// ============================================================

router.get(
  '/nuevo',
  permitirRoles('admin', 'personal'),
  (req, res) => {

    res.render(
      'nuevo-cliente',
      {
        tituloPage: 'Nuevo Paciente'
      }
    );

  }
);


// ============================================================
// 3. CREAR PACIENTE
// ============================================================

router.post(
  '/',
  permitirRoles('admin', 'personal'),
  validarCamposCreacionCliente,
  ClienteController.crearCliente
);


// ============================================================
// 4. MI PERFIL
// Solo paciente
// ============================================================

router.get(
  '/mi-perfil',
  asegurarAutenticacion,
  permitirRoles('cliente'),
  ClienteController.miPerfil
);


router.post(
  '/mi-perfil/editar',
  asegurarAutenticacion,
  permitirRoles('cliente'),
  ClienteController.actualizarMiPerfil
);


// ============================================================
// SISTEMA ANTIGUO DE GRUPO FAMILIAR
//
// Lo dejamos funcionando por ahora.
// Más adelante podremos migrarlo al nuevo sistema.
// ============================================================

router.post(
  '/mi-perfil/familiar',
  asegurarAutenticacion,
  permitirRoles('cliente'),
  ClienteController.agregarFamiliar
);


// ============================================================
// 5. NUEVO SISTEMA DE RELACIONES FAMILIARES
// ============================================================


// ------------------------------------------------------------
// OBTENER FAMILIARES DE UN PACIENTE
//
// GET
// /clientes/:id/familiares
// ------------------------------------------------------------

router.get(
  '/:id/familiares',

  permitirRoles(
    'admin',
    'personal'
  ),

  catchAsync(
    RelacionFamiliarController.obtenerFamiliares
  )
);


// ------------------------------------------------------------
// BUSCAR PACIENTES EXISTENTES
//
// Ejemplo:
//
// /clientes/ID/familiares/buscar?q=juan
//
// o
//
// /clientes/ID/familiares/buscar?q=40123456
// ------------------------------------------------------------

router.get(
  '/:id/familiares/buscar',

  permitirRoles(
    'admin',
    'personal'
  ),

  catchAsync(
    RelacionFamiliarController.buscarPacientes
  )
);


// ------------------------------------------------------------
// ASOCIAR PACIENTE EXISTENTE
//
// POST
// /clientes/:id/familiares/asociar
// ------------------------------------------------------------

router.post(
  '/:id/familiares/asociar',

  permitirRoles(
    'admin',
    'personal'
  ),

  catchAsync(
    RelacionFamiliarController.asociarExistente
  )
);


// ------------------------------------------------------------
// REGISTRAR NUEVO PACIENTE + ASOCIARLO
//
// POST
// /clientes/:id/familiares/registrar
// ------------------------------------------------------------

router.post(
  '/:id/familiares/registrar',

  permitirRoles(
    'admin',
    'personal'
  ),

  catchAsync(
    RelacionFamiliarController.registrarYAsociar
  )
);


// ------------------------------------------------------------
// DESVINCULAR FAMILIAR
//
// POST
// /clientes/:id/familiares/:relacionId/desasociar
// ------------------------------------------------------------

router.post(
  '/:id/familiares/:relacionId/desasociar',

  permitirRoles(
    'admin',
    'personal'
  ),

  catchAsync(
    RelacionFamiliarController.desasociar
  )
);


// ============================================================
// 6. DETALLE DE PACIENTE
//
// IMPORTANTE:
// ESTA RUTA DEBE PERMANECER AL FINAL.
// ============================================================

router.get(
  '/:id',
  asegurarAutenticacion,
  permitirRoles('admin', 'personal'),
  validarExistenciaCliente,
  ClienteController.getDetalleCliente
);


export default router;