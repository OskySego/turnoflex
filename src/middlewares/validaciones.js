/**
 * Reglas y middlewares de validación con express-validator para TurnoFlex.
 * Centraliza el chequeo de datos de entrada (registro, turnos y DNI) y delega fallos al errorHandler global.
 */

import { body, validationResult } from 'express-validator';

// ============================================================
// INTERCEPTOR DE RESULTADOS DE VALIDACIÓN
// ============================================================

export const revisarErrores = (req, res, next) => {
  const errores = validationResult(req);

  if (!errores.isEmpty()) {
    // Tomamos el primer error de la lista para devolver un mensaje claro al cliente
    const mensajeError = errores.array()[0].msg;

    // Armamos un error HTTP 400 y se lo pasamos al manejador global
    const error = new Error(`Error de validación: ${mensajeError}`);
    error.statusCode = 400;
    return next(error);
  }

  next();
};

// ============================================================
// REGLAS PARA REGISTRO DE USUARIOS
// ============================================================

export const validarRegistro = [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio.').trim(),
  body('email').isEmail().withMessage('Debe proporcionar un correo electrónico válido.').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.'),
  revisarErrores
];

// ============================================================
// REGLAS PARA ALTA Y GESTIÓN DE TURNOS
// ============================================================

export const validarTurno = [
  body('cliente_id').isMongoId().withMessage('El paciente seleccionado no es válido.'),
  body('profesional_id').isMongoId().withMessage('El profesional seleccionado no es válido.'),
  body('fecha').notEmpty().withMessage('La fecha es obligatoria.')
    .custom((value) => {
      // Comparamos contra la fecha actual en zona horaria Argentina (formato YYYY-MM-DD)
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
      if (value < hoy) {
        throw new Error('No se pueden solicitar turnos para fechas pasadas.');
      }
      return true;
    }),
  body('hora').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('La hora debe tener formato válido (HH:MM).'),
  revisarErrores
];

// ============================================================
// REGLAS DE DOCUMENTO DE IDENTIDAD (DNI)
// ============================================================

export const validarDni = [
  body('dni')
    .isNumeric().withMessage('El DNI debe contener exclusivamente números.')
    .isLength({ min: 7, max: 8 }).withMessage('El DNI debe tener entre 7 y 8 dígitos.'),
  revisarErrores
];