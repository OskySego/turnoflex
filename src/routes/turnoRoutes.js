/**
 * Enrutador integral para la gestión de Turnos en TurnoFlex.
 * Centraliza las rutas de alta, listado, control de pagos (efectivo, Mercado Pago y transferencias), estados operativos y detalles.
 */

import { Router } from 'express';

import { TurnoController } from '../controllers/turnoController.js';

import {
  asegurarAutenticacion
} from '../middlewares/authMiddleware.js';

import {
  verificarRol
} from '../middlewares/roleMiddleware.js';

import {
  validarTurno
} from '../middlewares/validaciones.js';

import {
  catchAsync
} from '../utils/catchAsync.js';


const router = Router();


// ============================================================
// 1. COTIZACIÓN ADMINISTRATIVA
// ============================================================

// Cálculo previo de aranceles antes de confirmar una reserva desde recepción
router.get('/cotizacion',
  asegurarAutenticacion,
  verificarRol('admin', 'personal'),
  catchAsync(TurnoController.cotizarTurnoRecepcion)
);


// ============================================================
// 2. FORMULARIO DE NUEVO TURNO
// ============================================================

router.get(
  '/nuevo',

  asegurarAutenticacion,

  verificarRol(
    'admin',
    'personal',
    'cliente'
  ),

  catchAsync(
    TurnoController.getFormNuevoTurno
  )
);


// ============================================================
// 3. LISTADO GENERAL DE TURNOS
// (El controlador filtra automáticamente según el rol del usuario logueado)
// ============================================================

router.get(
  '/',

  asegurarAutenticacion,

  verificarRol(
    'admin',
    'personal',
    'cliente'
  ),

  catchAsync(
    TurnoController.getTurnos
  )
);


// ============================================================
// 4. CREACIÓN DE NUEVO TURNO
// ============================================================

router.post(
  '/',

  asegurarAutenticacion,

  verificarRol(
    'admin',
    'personal',
    'cliente'
  ),

  validarTurno,

  catchAsync(
    TurnoController.crearTurno
  )
);


// ============================================================
// 5. GESTIÓN FINANCIERA Y PAGOS
// ============================================================

// Cobro en efectivo en mostrador (restringido a administración y personal)
router.post(
  '/:id/cobrar',

  asegurarAutenticacion,

  verificarRol(
    'admin',
    'personal'
  ),

  catchAsync(
    TurnoController.cobrarEfectivo
  )
);


// Retorno del checkout de Mercado Pago: protegido por sesión, consulta el estado directo en la API
router.get(
  '/:id/verificar-pago',
  asegurarAutenticacion,
  verificarRol('admin', 'personal', 'cliente'),
  catchAsync(TurnoController.verificarPagoMP)
);

// Generación de preferencia de pago en Mercado Pago
router.get(
  '/:id/pagar-mp',

  asegurarAutenticacion,

  verificarRol(
    'admin',
    'personal',
    'cliente'
  ),

  catchAsync(
    TurnoController.generarPagoMP
  )
);


// ============================================================
// 6. FLUJO DE TRANSFERENCIAS BANCARIAS Y PAGO-FLEX
// ============================================================

router.post('/:id/transferencia/iniciar', asegurarAutenticacion,
  verificarRol('admin','personal','cliente'), catchAsync(TurnoController.iniciarTransferencia));

router.post('/:id/transferencia/informar', asegurarAutenticacion,
  verificarRol('admin','personal','cliente'), catchAsync(TurnoController.informarTransferencia));

router.post('/:id/transferencia/confirmar', asegurarAutenticacion,
  verificarRol('admin','personal'), catchAsync(TurnoController.confirmarTransferencia));

router.post('/:id/transferencia/rechazar', asegurarAutenticacion,
  verificarRol('admin','personal'), catchAsync(TurnoController.rechazarTransferencia));


// ============================================================
// 7. CAMBIOS DE ESTADO OPERATIVO (ATENCIÓN Y CANCELACIÓN)
// Nota: El profesional maneja sus acciones desde su propio enrutador /medico
// ============================================================

router.post(
  '/:id/atendido',

  asegurarAutenticacion,

  verificarRol(
    'admin',
    'personal'
  ),

  catchAsync(
    TurnoController.marcarAtendido
  )
);

router.post(
  '/:id/cancelar',

  asegurarAutenticacion,

  verificarRol(
    'admin',
    'personal'
  ),

  catchAsync(
    TurnoController.cancelarTurno
  )
);


// ============================================================
// 8. DETALLE DE TURNO
// IMPORTANTE: Esta ruta dinámica debe permanecer siempre al final
// para evitar colisiones con los endpoints anteriores.
// ============================================================

router.get(
  '/:id',

  asegurarAutenticacion,

  verificarRol(
    'admin',
    'personal',
    'cliente'
  ),

  catchAsync(
    TurnoController.getDetalleTurno
  )
);


export default router;