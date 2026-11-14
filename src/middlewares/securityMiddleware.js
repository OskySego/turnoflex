/**
 * Middleware de seguridad y limitación de peticiones (Rate Limiting) para TurnoFlex.
 * Protege el endpoint de login contra ataques de fuerza bruta ajustando la tolerancia según el entorno.
 */

import rateLimit from 'express-rate-limit';

// ============================================================
// CONFIGURACIÓN DE LÍMITES SEGÚN ENTORNO
// ============================================================

// En desarrollo damos margen para testear distintos usuarios; en producción cerramos a 5 intentos
const esProduccion = process.env.NODE_ENV === 'production';
const limiteIntentos = esProduccion ? 5 : 20;

// ============================================================
// LIMITADOR DE INTENTOS DE INICIO DE SESIÓN
// ============================================================

export const loginLimiter = rateLimit({
  // Ventana de bloqueo de 15 minutos
  windowMs: 15 * 60 * 1000,

  // Máximo de solicitudes permitidas por IP dentro de la ventana
  max: limiteIntentos,

  // Enviamos cabeceras estándar RateLimit-* y desactivamos las legacy X-RateLimit-*
  standardHeaders: true,
  legacyHeaders: false,

  message:
    'Demasiados intentos de inicio de sesión. ' +
    'Intentá nuevamente más tarde.',

  // Manejador personalizado para devolver JSON o vista Pug sin tirar excepción no controlada
  handler: (req, res) => {
    const mensaje =
      'Se alcanzó el límite de intentos de inicio ' +
      'de sesión. Intentá nuevamente en unos minutos.';

    // Si la petición viene por fetch/API esperando JSON, respondemos con 429 estructurado
    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(429).json({
        status: 'error',
        message: mensaje
      });
    }

    // Para navegación tradicional, volvemos a renderizar el login con el aviso de bloqueo
    return res.status(429).render('auth/login', {
      tituloPage: 'Iniciar Sesión - TurnoFlex',
      error: mensaje
    });
  }
});