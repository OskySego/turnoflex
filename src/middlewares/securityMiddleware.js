import rateLimit from 'express-rate-limit';

// Limitador específico para la ruta de Login (Previene ataques de fuerza bruta)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Límite de 5 intentos fallidos por IP
  message: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor, intenta de nuevo en 15 minutos.',
  standardHeaders: true, // Retorna la info del límite en los headers `RateLimit-*`
  legacyHeaders: false, // Deshabilita los headers obsoletos `X-RateLimit-*`
  
  // Interceptamos el bloqueo para enviarlo a tu hermoso Global Error Handler
  handler: (req, res, next, options) => {
    const error = new Error(options.message);
    error.statusCode = 429; // Código HTTP 429: Too Many Requests
    next(error);
  }
});