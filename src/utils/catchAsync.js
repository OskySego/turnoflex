/**
 * Utilidad para el manejo de rutas asíncronas en Express (catchAsync)[cite: 20].
 * Envuelve los controladores asíncronos para capturar automáticamente cualquier rechazo de promesas 
 * y derivarlo al middleware central de errores[cite: 20].
 */

// ============================================================
// WRAPPER ASÍNCRONO PARA EXPRESS
// ============================================================

export const catchAsync = (fn) => {
  return (req, res, next) => {
    // Ejecutamos la función y atrapamos errores enviándolos al siguiente middleware
    fn(req, res, next).catch(next);
  };
};