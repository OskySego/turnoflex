/**
 * Middleware global de manejo de errores para Express.
 * Centraliza el logueo en consola y adapta la respuesta según el cliente (JSON para API o vista Pug para web).
 */

// ============================================================
// MANEJADOR CENTRALIZADO DE EXCEPCIONES
// ============================================================

export const errorHandler = (err, req, res, next) => {
  // Definimos status HTTP y mensaje por defecto si el error no los trae cargados
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Ocurrió un error interno en el servidor.';

  // Logueamos el detalle en consola (el stack trace solo sale fuera de producción)
  console.error(`❌ [Error ${statusCode}]: ${message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Si la petición viene por fetch/API esperando JSON, respondemos con estructura estándar
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(statusCode).json({
      status: 'error',
      statusCode,
      message
    });
  }

  // Para navegación tradicional, renderizamos la vista de error en Pug
  res.status(statusCode).render('error', {
    tituloPage: 'Error en el Sistema',
    error: message
  });
};