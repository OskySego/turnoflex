/**
 * Enrutador de accesos institucionales y gestión de altas en TurnoFlex.
 * Define las rutas protegidas para creación de cuentas de secretaría, activación por token con rate limit y reenvío de invitaciones.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asegurarAutenticacion, permitirRoles } from '../middlewares/authMiddleware.js';
import { AccesosInstitucionalesController as C } from '../controllers/accesosInstitucionalesController.js';

const router = Router();

// ============================================================
// CONFIGURACIÓN DE RATE LIMIT PARA ACTIVACIÓN DE CUENTAS
// ============================================================

// Limitamos los intentos sobre los endpoints públicos de activación (20 peticiones cada 15 min)
const limiteActivaciones = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================
// RUTAS DE ALTA DE SECRETARÍAS (SOLO ADMIN)
// ============================================================

router.get('/secretarias/nueva', asegurarAutenticacion, permitirRoles('admin'), C.nuevaSecretaria);
router.post('/secretarias', asegurarAutenticacion, permitirRoles('admin'), C.crearSecretaria);

// ============================================================
// RUTAS PÚBLICAS DE ACTIVACIÓN POR TOKEN Y REENVÍO
// ============================================================

// Flujo de validación y establecimiento inicial de contraseña mediante token
router.get('/activar/:token', limiteActivaciones, C.verActivacion);
router.post('/activar/:token', limiteActivaciones, C.activar);

// Reenvío manual de invitación institucional (habilitado para administración y personal)
router.post('/reenviar/:id', asegurarAutenticacion, permitirRoles('admin', 'personal'), C.reenviar);

// ============================================================
// EXPORTACIÓN DEL ENRUTADOR
// ============================================================

export default router;