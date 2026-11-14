/**
 * Middleware de autorización por roles para TurnoFlex.
 * Restringe el acceso a rutas según los roles habilitados (ej: verificarRol('admin', 'personal')).
 */

// ============================================================
// VALIDACIÓN DE ACCESO POR ROL
// ============================================================

export const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    // 1. Chequeamos que haya una sesión de usuario activa
    if (!req.session || !req.session.usuario) {
      // Para llamadas API/Fetch delegamos al errorHandler para devolver JSON 401
      if (req.accepts('json') && !req.accepts('html')) {
        const error = new Error('Necesitás iniciar sesión para acceder a este recurso.');
        error.statusCode = 401;
        return next(error);
      }

      // Para navegación tradicional redirigimos directo al login
      return res.redirect('/auth/login');
    }

    // 2. Extraemos el rol asignado en la sesión
    const usuarioRol = req.session.usuario.rol;

    // 3. Verificamos que la cuenta tenga un rol configurado
    if (!usuarioRol) {
      const error = new Error('Tu cuenta no tiene un rol de acceso configurado.');
      error.statusCode = 403;
      return next(error);
    }

    // 4. Validamos si el rol actual está dentro de los permitidos
    if (!rolesPermitidos.includes(usuarioRol)) {
      const error = new Error('No tenés permisos para acceder a esta sección de TurnoFlex.');
      error.statusCode = 403;
      return next(error);
    }

    // 5. Todo en orden, dejamos pasar la petición
    return next();
  };
};