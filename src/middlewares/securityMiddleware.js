
import rateLimit from 'express-rate-limit';

// ============================================================
// TURNOFLEX - PROTECCIÓN DE INICIO DE SESIÓN
// ============================================================

// En desarrollo permitimos más solicitudes para realizar
// pruebas con diferentes usuarios y roles.
//
// En producción mantenemos un límite más estricto.

const esProduccion =
  process.env.NODE_ENV === 'production';

const limiteIntentos = esProduccion ? 5 : 20;

export const loginLimiter = rateLimit({

  // Ventana de 15 minutos.
  windowMs: 15 * 60 * 1000,

  // Producción: 5 solicitudes.
  // Desarrollo: 20 solicitudes.
  max: limiteIntentos,

  // Información estándar del límite HTTP.
  standardHeaders: true,
  legacyHeaders: false,

  message:
    'Demasiados intentos de inicio de sesión. ' +
    'Intentá nuevamente más tarde.',

  // Responder sin generar una excepción innecesaria.
  handler: (req, res) => {

    const mensaje =
      'Se alcanzó el límite de intentos de inicio ' +
      'de sesión. Intentá nuevamente en unos minutos.';

    // Respuesta para clientes que esperan JSON.
    if (
      req.accepts('json') &&
      !req.accepts('html')
    ) {
      return res.status(429).json({
        status: 'error',
        message: mensaje
      });
    }

    // Mostrar el mensaje en el formulario de login.
    return res.status(429).render('auth/login', {
      tituloPage: 'Iniciar Sesión - TurnoFlex',
      error: mensaje
    });
  }

});
