import mongoose from 'mongoose';
import { Usuario } from '../models/Usuario.js';
import { Profesional } from '../models/Profesional.js';

export async function verificarCuentaHabilitada(req, res, next) {
  try {
    const sesion = req.session?.usuario;
    if (!sesion || !['profesional', 'personal'].includes(sesion.rol)) {
      return next();
    }

    const id = sesion.id || sesion._id;
    if (!mongoose.isValidObjectId(id)) {
      return cerrarSesion(req, res);
    }

    const cuenta = await Usuario.findById(id)
      .select('activo suspendidoAdministrativamente rol profesional_id')
      .lean();

    let deshabilitada = !cuenta ||
      cuenta.activo === false ||
      cuenta.suspendidoAdministrativamente === true ||
      cuenta.rol !== sesion.rol;

    if (!deshabilitada && cuenta.rol === 'profesional') {
      // Compatibilidad con cuentas médicas antiguas que todavía no
      // tienen profesional_id; no cambia sus permisos de historia clínica.
      const filtroPerfil = cuenta.profesional_id
        ? { _id: cuenta.profesional_id }
        : { email: String(sesion.email || '').trim().toLowerCase() };
      const perfilVigente = await Profesional.exists({
        ...filtroPerfil,
        activo: { $ne: false }
      });
      deshabilitada = !perfilVigente;
    }

    if (deshabilitada) return cerrarSesion(req, res);
    return next();
  } catch (error) {
    return next(error);
  }
}

function cerrarSesion(req, res) {
  const finalizar = () => {
    res.clearCookie('turnoflex.sid', { path: '/' });
    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(401).json({ error: 'Tu cuenta está deshabilitada.' });
    }
    return res.redirect(303, '/auth/login');
  };
  if (!req.session) return finalizar();
  req.session.destroy(error => {
    if (error) return res.status(503).send('No se pudo cerrar la sesión.');
    return finalizar();
  });
}