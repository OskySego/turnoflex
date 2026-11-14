/**
 * Middlewares de autenticación y control de acceso por roles (RBAC).
 * Protege rutas privadas, evita accesos duplicados al login y valida permisos de sesión.
 */

// ============================================================
// VERIFICACIÓN DE SESIÓN ACTIVA
// ============================================================

export const asegurarAutenticacion = (req, res, next) => {
  // Si hay sesión activa, dejamos pasar la petición
  if (req.session && req.session.usuario) {
    return next();
  }

  // Para peticiones API/Fetch devolvemos 401 en JSON en lugar de redirigir
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(401).json({ status: 'error', message: 'No autorizado. Debe iniciar sesión.' });
  }

  res.redirect('/auth/login');
};

// ============================================================
// CONTROL DE ACCESO A VISTAS PÚBLICAS DE AUTH
// ============================================================

export const evitarDobleLogin = (req, res, next) => {
  // Si ya está logueado, no tiene sentido mostrar login o registro
  if (req.session && req.session.usuario) {
    return res.redirect('/');
  }

  next();
};

// ============================================================
// AUTORIZACIÓN POR ROL DE USUARIO
// ============================================================

export const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    // Chequeo preventivo por si este middleware se usa sin asegurarAutenticacion antes
    if (!req.session.usuario) {
      return res.redirect('/auth/login');
    }

    const rolUsuario = req.session.usuario.rol;

    // Si el rol actual no está dentro de los habilitados, cortamos con error 403
    if (!rolesPermitidos.includes(rolUsuario)) {
      const error = new Error('No tienes permisos suficientes para acceder a esta sección');
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};