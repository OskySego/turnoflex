/**
 * Enrutador de autenticación y gestión de sesiones en TurnoFlex.
 * Define las rutas para inicio de sesión, alta de cuentas nuevas y cierre de sesión, aplicando rate limiting y validaciones.
 */

import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { evitarDobleLogin } from '../middlewares/authMiddleware.js';
import { validarRegistro } from '../middlewares/validaciones.js';
import { loginLimiter } from '../middlewares/securityMiddleware.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = Router();

// ============================================================
// RUTAS DE INICIO DE SESIÓN (LOGIN)
// ============================================================

// Renderizamos el formulario de acceso
router.get(
  '/login',
  AuthController.getLogin
);

// Procesamos el ingreso con limitador de intentos (permite pisar una sesión anterior si hace falta)
router.post(
  '/login',
  loginLimiter,
  catchAsync(AuthController.postLogin)
);

// ============================================================
// RUTAS DE REGISTRO DE USUARIOS
// ============================================================

// Renderizamos el formulario de registro (bloqueado si ya existe una sesión activa)
router.get(
  '/register',
  evitarDobleLogin,
  AuthController.getRegister
);

// Validamos los campos de entrada y creamos la cuenta nueva
router.post(
  '/register',
  evitarDobleLogin,
  validarRegistro,
  catchAsync(AuthController.postRegister)
);

// ============================================================
// CIERRE DE SESIÓN Y EXPORTACIÓN
// ============================================================

// Finalizamos la sesión actual y limpiamos credenciales
router.get(
  '/logout',
  AuthController.logout
);

export default router;