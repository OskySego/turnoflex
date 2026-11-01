/**
 * Verifica si el usuario ha iniciado sesión. Si no, lo redirige al login.
 */
export const asegurarAutenticacion = (req, res, next) => {
  if (req.session && req.session.usuario) {
    return next(); // El usuario está autenticado, puede continuar
  }
  
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(401).json({ status: 'error', message: 'No autorizado. Debe iniciar sesión.' });
  }

  res.redirect('/auth/login');
};

/**
 * Evita que un usuario ya logueado vuelva a ver las páginas de Login o Registro
 */
export const evitarDobleLogin = (req, res, next) => {
  if (req.session && req.session.usuario) {
    return res.redirect('/');
  }
  next();
};

// Middleware para restringir rutas según los roles permitidos
export const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.session.usuario) {
      return res.redirect('/auth/login');
    }

    const rolUsuario = req.session.usuario.rol;
    if (!rolesPermitidos.includes(rolUsuario)) {
      const error = new Error('No tienes permisos suficientes para acceder a esta sección');
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};