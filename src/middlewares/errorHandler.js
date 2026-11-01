export const errorHandler = (err, req, res, next) => {
  // 1. Definir el código de estado (500 por defecto si no viene especificado)
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Ocurrió un error interno en el servidor.';

  // 2. Imprimir el error en la consola para el equipo de desarrollo
  console.error(`❌ [Error ${statusCode}]: ${message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack); // Muestra la ruta exacta del error en desarrollo
  }

  // 3. Responder en formato API (JSON)
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(statusCode).json({
      status: 'error',
      statusCode,
      message
    });
  }

  // 4. Responder en formato Web (Pug)
  res.status(statusCode).render('error', {
    tituloPage: 'Error en el Sistema',
    error: message
  });
};