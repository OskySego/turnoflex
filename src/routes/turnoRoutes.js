import { Turno } from '../models/Turno.js';
import { Router } from 'express';
import { Especialidad } from '../models/Especialidad.js';

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

// TF_DISPONIBILIDAD_ANTES_DE_CONFIRMAR: solo informa horarios ocupados.
router.get('/disponibilidad',
  asegurarAutenticacion,
  verificarRol('admin', 'personal', 'cliente'),
  catchAsync(async (req, res) => {
    const profesional_id = String(req.query.profesional_id || '');
    const fecha = String(req.query.fecha || '');

    if (!/^[a-f\d]{24}$/i.test(profesional_id) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: 'Profesional o fecha no vÃ¡lidos.' });
    }

    res.set('Cache-Control', 'no-store');
    const ocupados = await Turno.distinct('hora', {
      profesional_id,
      fecha,
      estado: { $in: ['reservado', 'pendiente_pago', 'En Espera'] }
    });
    return res.json({ ocupados });
  })
);


// ============================================================
// PRECIOS POR ESPECIALIDAD: consulta de solo lectura
// Antes de /:id para que Express no interprete 'precios' como ID.
// ============================================================
router.get('/precios', asegurarAutenticacion,
  verificarRol('admin', 'personal', 'cliente'),
  catchAsync(async (req, res) => {
    const especialidades = await Especialidad.find({ activa: { $ne: false } })
      .select('nombre precioParticular copagoObraSocial activa')
      .sort({ nombre: 1 })
      .lean();
    res.render('precios', {
      tituloPage: 'Aranceles y copagos',
      especialidades
    });
  })
);


// ============================================================
// NUEVO TURNO
// Admin / Recepción / Paciente
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
// LISTADO
// El controlador limita al paciente a sus propios turnos.
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
// CREAR TURNO
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
// COBRO EN EFECTIVO
//
// Solo Administración y Recepción.
// Un paciente nunca debe poder marcar su propio turno como pago.
// ============================================================

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


// ============================================================
// MERCADO PAGO
//
// Admin / Recepción:
// pueden generar el enlace desde el detalle.
//
// Paciente:
// puede pagar únicamente un turno propio.
// La validación de propiedad está en turnoController.js.
// ============================================================

// Regreso del checkout: protegido por sesión; consulta el pago con la API.
router.get(
  '/:id/verificar-pago',
  asegurarAutenticacion,
  verificarRol('admin', 'personal', 'cliente'),
  catchAsync(TurnoController.verificarPagoMP)
);

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
// MARCAR ATENDIDO
//
// Solamente Administración / Recepción.
//
// IMPORTANTE:
// el profesional utiliza sus rutas seguras bajo /medico,
// no estas rutas administrativas.
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


// ============================================================
// CANCELAR
// ============================================================

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
// PAGOFLEX: TRANSFERENCIA (no usa el simulador antiguo)
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
// DETALLE
//
// Lo dejamos AL FINAL de las rutas dinámicas para mantener
// una estructura clara y evitar futuras colisiones.
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