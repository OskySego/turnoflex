import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { evitarDobleLogin } from '../middlewares/authMiddleware.js';
import { validarRegistro } from '../middlewares/validaciones.js';
import { loginLimiter } from '../middlewares/securityMiddleware.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = Router();

// Mostrar formulario de inicio de sesión
router.get(
  '/login',
  AuthController.getLogin
);

// Procesar login, incluso si existe una sesión anterior
router.post(
  '/login',
  loginLimiter,
  catchAsync(AuthController.postLogin)
);

// Mostrar formulario de registro
router.get(
  '/register',
  evitarDobleLogin,
  AuthController.getRegister
);

// Procesar registro
router.post(
  '/register',
  evitarDobleLogin,
  validarRegistro,
  catchAsync(AuthController.postRegister)
);

// Cerrar sesión
router.get(
  '/logout',
  AuthController.logout
);

export default router;