/**
 * Middleware de autorización por roles para TurnoFlex.
 *
 * Ejemplo:
 *
 * verificarRol('admin', 'personal')
 *
 * Solo permite continuar a usuarios cuyo rol esté
 * incluido entre los roles permitidos.
 */

export const verificarRol = (...rolesPermitidos) => {

  return (req, res, next) => {

    // ==========================================================
    // 1. VERIFICAR AUTENTICACIÓN
    // ==========================================================

    if (
      !req.session ||
      !req.session.usuario
    ) {

      // Para peticiones API dejamos que el errorHandler
      // entregue una respuesta JSON estructurada.
      if (
        req.accepts('json') &&
        !req.accepts('html')
      ) {

        const error =
          new Error(
            'Necesitás iniciar sesión para acceder a este recurso.'
          );

        error.statusCode =
          401;

        return next(error);

      }


      // Para navegación web normal enviamos al login.
      return res.redirect(
        '/auth/login'
      );

    }


    // ==========================================================
    // 2. OBTENER ROL
    // ==========================================================

    const usuarioRol =
      req.session.usuario.rol;


    // ==========================================================
    // 3. VALIDAR QUE EL USUARIO TENGA ROL
    // ==========================================================

    if (!usuarioRol) {

      const error =
        new Error(
          'Tu cuenta no tiene un rol de acceso configurado.'
        );

      error.statusCode =
        403;

      return next(error);

    }


    // ==========================================================
    // 4. VALIDAR PERMISOS
    // ==========================================================

    if (
      !rolesPermitidos.includes(
        usuarioRol
      )
    ) {

      const error =
        new Error(
          'No tenés permisos para acceder a esta sección de TurnoFlex.'
        );

      error.statusCode =
        403;

      return next(error);

    }


    // ==========================================================
    // 5. ACCESO AUTORIZADO
    // ==========================================================

    return next();

  };

};