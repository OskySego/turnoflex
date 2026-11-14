/**
 * Middleware de verificación de estado de cuenta para TurnoFlex.
 * Comprueba en cada petición que los usuarios operativos (profesionales y personal) sigan activos y sin suspensiones.
 */

import mongoose from 'mongoose';
import { Usuario } from '../models/Usuario.js';
import { Profesional } from '../models/Profesional.js';

// ============================================================
// VERIFICACIÓN DE ESTADO ACTIVO DE LA CUENTA
// ============================================================

export async function verificarCuentaHabilitada(req, res, next) {
  try {
    const sesion = req.session?.usuario;

    // Solo aplicamos este control estricto a roles operativos (médicos y secretaría/personal)
    if (!sesion || !['profesional', 'personal'].includes(sesion.rol)) {
      return next();
    }

    // Validamos que el ID guardado en sesión sea un ObjectId válido antes de consultar Mongo
    const id = sesion.id || sesion._id;
    if (!mongoose.isValidObjectId(id)) {
      return cerrarSesion(req, res);
    }

    // Consultamos el estado actual del usuario en la base de datos
    const cuenta = await Usuario.findById(id)
      .select('activo suspendidoAdministrativamente rol profesional_id')
      .lean();

    // Marcamos como deshabilitada si no existe, está inactiva, suspendida o cambió de rol
    let deshabilitada = !cuenta ||
      cuenta.activo === false ||
      cuenta.suspendidoAdministrativamente === true ||
      cuenta.rol !== sesion.rol;

    // Si es médico y la cuenta está OK, validamos también que su ficha profesional siga activa
    if (!deshabilitada && cuenta.rol === 'profesional') {
      // Mantenemos fallback por email para cuentas médicas viejas sin profesional_id enlazado
      const filtroPerfil = cuenta.profesional_id
        ? { _id: cuenta.profesional_id }
        : { email: String(sesion.email || '').trim().toLowerCase() };

      const perfilVigente = await Profesional.exists({
        ...filtroPerfil,
        activo: { $ne: false }
      });

      deshabilitada = !perfilVigente;
    }

    // Si falló alguna validación de vigencia, forzamos el cierre de sesión inmediato
    if (deshabilitada) return cerrarSesion(req, res);

    return next();
  } catch (error) {
    return next(error);
  }
}

// ============================================================
// HELPER DE CIERRE FORZADO DE SESIÓN
// ============================================================

function cerrarSesion(req, res) {
  // Limpia la cookie de sesión y responde según el tipo de cliente (JSON o redirección web)
  const finalizar = () => {
    res.clearCookie('turnoflex.sid', { path: '/' });

    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(401).json({ error: 'Tu cuenta está deshabilitada.' });
    }

    return res.redirect(303, '/auth/login');
  };

  if (!req.session) return finalizar();

  // Destruimos la sesión en el store antes de limpiar la cookie
  req.session.destroy(error => {
    if (error) return res.status(503).send('No se pudo cerrar la sesión.');
    return finalizar();
  });
}