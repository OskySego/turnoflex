import { body, validationResult } from 'express-validator';

// 1. Interceptor: Revisa si alguna validación falló y lo envía al Global Error Handler
export const revisarErrores = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    // Tomamos el primer error de la lista para mostrarlo al usuario
    const mensajeError = errores.array()[0].msg;
    
    // Aprovechamos el manejador de errores que creamos en el Punto 1
    const error = new Error(`Error de validación: ${mensajeError}`);
    error.statusCode = 400;
    return next(error);
  }
  next();
};

// 2. Reglas para Registro de Usuarios (Email y Contraseña > 8)
export const validarRegistro = [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio.').trim(),
  body('email').isEmail().withMessage('Debe proporcionar un correo electrónico válido.').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.'),
  revisarErrores
];

// 3. Reglas para Crear Turnos (Fechas no retroactivas)
export const validarTurno = [
  body('cliente_id').isMongoId().withMessage('El paciente seleccionado no es válido.'),
  body('profesional_id').isMongoId().withMessage('El profesional seleccionado no es válido.'),
  body('fecha').notEmpty().withMessage('La fecha es obligatoria.')
    .custom((value) => {
      // Compara la fecha ingresada con la fecha actual de Argentina (YYYY-MM-DD)
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
      if (value < hoy) {
        throw new Error('No se pueden solicitar turnos para fechas pasadas.');
      }
      return true;
    }),
  body('hora').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('La hora debe tener formato válido (HH:MM).'),
  revisarErrores
];

// 4. Reglas para Clientes / Profesionales (DNI Numérico)
export const validarDni = [
  body('dni')
    .isNumeric().withMessage('El DNI debe contener exclusivamente números.')
    .isLength({ min: 7, max: 8 }).withMessage('El DNI debe tener entre 7 y 8 dígitos.'),
  revisarErrores
];