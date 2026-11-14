import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { Usuario } from '../models/Usuario.js';
import {
  crearCuentaInstitucional,
  reenviarInvitacionInstitucional,
  hashTokenActivacion
} from '../services/accesosInstitucionales.js';

// ============================================================
// FUNCIONES AUXILIARES INTERNAS
// ============================================================

// Blanqueo los headers para evitar que el navegador guarde en caché 
// datos sensibles de activación o tokens de un solo uso.
function noCache(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
}

// Centralizo la vista de éxito cuando damos de alta una cuenta institucional o reenviamos el mail.
function mostrarAlta(res, cuenta, enviado) {
  return res.render('resultado-alta-institucional', {
    tituloPage: 'Cuenta institucional - TurnoFlex',
    cuenta: {
      id: String(cuenta._id),
      nombre: cuenta.nombre,
      email: cuenta.email,
      emailInstitucional: cuenta.emailInstitucional,
      rol: cuenta.rol
    },
    enviado
  });
}


// ============================================================
// CONTROLADOR DE ACCESOS INSTITUCIONALES
// ============================================================

export class AccesosInstitucionalesController {

  // 1. Mostrar el formulario para registrar a una nueva secretaria
  static nuevaSecretaria(req, res) {
    return res.render('nueva-secretaria', {
      tituloPage: 'Nueva secretaria - TurnoFlex'
    });
  }

  // 2. Procesar el alta de la secretaria y disparar el correo de activación
  static async crearSecretaria(req, res, next) {
    try {
      const { nombre, email } = req.body;
      
      const { cuenta, enviado } = await crearCuentaInstitucional({
        nombre,
        correoPersonal: email,
        rol: 'personal'
      });

      return mostrarAlta(res, cuenta, enviado);

    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).send('Cuenta duplicada.');
      }
      console.error('Error al crear secretaria:', error);
      return res.status(400).send(error.message);
    }
  }

  // 3. Mostrar la pantalla donde el usuario ingresa su contraseña por primera vez usando el token del mail
  static async verActivacion(req, res, next) {
    try {
      noCache(res);
      
      const token = String(req.params.token || '');

      // Valido que el token tenga el formato exacto de un hash SHA-256 (64 hex)
      if (!/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).send('Enlace de activación inválido.');
      }

      // Busco la cuenta que coincida con el hash, que no haya expirado y que siga inactiva
      const cuenta = await Usuario.findOne({
        activacionHash: hashTokenActivacion(token),
        activacionHasta: { $gt: new Date() },
        activo: false,
        suspendidoAdministrativamente: { $ne: true }
      });

      if (!cuenta) {
        return res.status(400).send('El enlace ya fue utilizado o venció.');
      }

      return res.render('activar-cuenta', {
        tituloPage: 'Activar cuenta - TurnoFlex',
        token,
        alias: cuenta.emailInstitucional,
        error: null
      });

    } catch (error) {
      return next(error);
    }
  }

  // 4. Procesar la activación definitiva (Guardar contraseña y activar la cuenta)
  static async activar(req, res, next) {
    try {
      noCache(res);

      const token = String(req.params.token || '');
      const password = String(req.body.password ?? '');
      const confirmacion = String(req.body.confirmacion ?? '');

      if (!/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).send('Enlace de activación inválido.');
      }

      // Validación de seguridad para la contraseña institucional
      if (password.length < 12 || password.length > 128 || password !== confirmacion) {
        return res.status(400).render('activar-cuenta', {
          tituloPage: 'Activar cuenta - TurnoFlex',
          token,
          alias: '',
          error: 'Usá una contraseña de 12 a 128 caracteres e ingresá la misma dos veces.'
        });
      }

      // IMPORTANTE: 
      // Como uso findOneAndUpdate, este método NO ejecuta el middleware pre-save de Mongoose.
      // Por eso tengo que hashear la clave explícitamente y limpiar el token de un solo uso en la misma query.
      const passwordHash = await bcrypt.hash(password, 12);
      
      const cuenta = await Usuario.findOneAndUpdate(
        {
          activacionHash: hashTokenActivacion(token),
          activacionHasta: { $gt: new Date() },
          activo: false,
          suspendidoAdministrativamente: { $ne: true }
        },
        {
          $set: { password: passwordHash, activo: true },
          $unset: { activacionHash: 1, activacionHasta: 1 }
        },
        { new: true }
      );

      if (!cuenta) {
        return res.status(400).send('El enlace ya fue utilizado o venció.');
      }

      // Regenero la sesión y logueo al usuario automáticamente tras activar su cuenta
      await new Promise((resolve, reject) => {
        req.session.regenerate(error => error ? reject(error) : resolve());
      });

      req.session.usuario = {
        id: cuenta._id,
        nombre: cuenta.nombre,
        email: cuenta.email,
        rol: cuenta.rol
      };

      await new Promise((resolve, reject) => {
        req.session.save(error => error ? reject(error) : resolve());
      });

      return res.redirect('/');

    } catch (error) {
      return next(error);
    }
  }

  // 5. Reenviar invitación institucional si el link expiró o se perdió el correo
  static async reenviar(req, res, next) {
    try {
      const id = String(req.params.id || '');

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).send('ID inválido.');
      }

      const cuenta = await Usuario.findById(id);

      if (!cuenta || !['profesional', 'personal'].includes(cuenta.rol)) {
        return res.status(404).send('Cuenta institucional no encontrada.');
      }

      // Restricción de permisos: solo el admin puede reenviar cuentas de personal, 
      // o el propio sistema según corresponda.
      if (req.session?.usuario?.rol !== 'admin' && cuenta.rol !== 'profesional') {
        return res.status(403).send('No tenés permisos para reenviar esta invitación.');
      }

      const enviado = await reenviarInvitacionInstitucional(cuenta);

      return mostrarAlta(res, cuenta, enviado);

    } catch (error) {
      return next(error);
    }
  }
}

export default AccesosInstitucionalesController;