import { Router } from 'express';
import mongoose from 'mongoose';
import { ProfesionalController } from '../controllers/profesionalController.js';
import { Profesional } from '../models/Profesional.js';
import { Usuario } from '../models/Usuario.js';
import { validarCamposCreacionProfesional, validarExistenciaProfesional } from '../middlewares/profesionalMiddleware.js';
import { asegurarAutenticacion, permitirRoles } from '../middlewares/authMiddleware.js';

const router = Router();

const acceso = [
  asegurarAutenticacion,
  permitirRoles('admin', 'personal')
];

const diasValidos = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo'
];

function listaDias(valor) {
  const lista = Array.isArray(valor)
    ? valor
    : valor ? [valor] : [];

  if (lista.some(dia => !diasValidos.includes(dia))) {
    throw new Error('Se recibieron días de atención inválidos.');
  }

  return [...new Set(lista)];
}

function validarHorario(inicio, fin, descripcion) {
  const patron = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (
    typeof inicio !== 'string' ||
    typeof fin !== 'string' ||
    !patron.test(inicio) ||
    !patron.test(fin) ||
    inicio >= fin
  ) {
    throw new Error(
      `Los horarios de ${descripcion} no son válidos.`
    );
  }
}

function textoObligatorio(valor, campo) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new Error(`El campo ${campo} es obligatorio.`);
  }

  return valor.trim();
}

// ============================================================
// LISTADO
// ============================================================

router.get(
  '/',
  ...acceso,
  ProfesionalController.getProfesionales
);

// ============================================================
// NUEVO PROFESIONAL
// ============================================================

router.get(
  '/nuevo',
  ...acceso,
  (req, res) => {
    return res.render('nuevo-profesional', {
      tituloPage: 'Nuevo Profesional - TurnoFlex'
    });
  }
);

// ============================================================
// CREAR PROFESIONAL
// ============================================================

router.post(
  '/',
  ...acceso,
  validarCamposCreacionProfesional,
  ProfesionalController.crearProfesional
);

// ============================================================
// ABRIR EDICIÓN
// ============================================================

router.get(
  '/:id/editar',
  ...acceso,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).send(
          'Identificador de profesional inválido.'
        );
      }

      const profesional = await Profesional
        .findById(id)
        .lean();

      if (!profesional || profesional.activo === false) {
        return res.status(404).send(
          'Profesional no encontrado.'
        );
      }

      return res.render('editar-profesional', {
        tituloPage: 'Editar profesional - TurnoFlex',
        profesional
      });

    } catch (error) {
      return next(error);
    }
  }
);

// ============================================================
// GUARDAR TODOS LOS CAMBIOS
// ============================================================

router.post(
  '/:id/editar',
  ...acceso,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).send(
          'Identificador de profesional inválido.'
        );
      }

      const profesional = await Profesional.findById(id);

      if (!profesional || profesional.activo === false) {
        return res.status(404).send(
          'Profesional no encontrado.'
        );
      }

      // ============================================
      // 1. IDENTIFICACIÓN
      // ============================================

      const camposObligatorios = [
        'nombre',
        'dni',
        'genero',
        'email',
        'telefono',
        'matricula',
        'especialidad',
        'subespecialidad'
      ];

      const cambios = {};

      for (const campo of camposObligatorios) {
        cambios[campo] = textoObligatorio(
          req.body[campo],
          campo
        );
      }

      const coberturas = [
        'particular',
        'obra_social',
        'ambas'
      ];

      if (!coberturas.includes(req.body.tipoCobertura)) {
        throw new Error('Cobertura médica inválida.');
      }

      cambios.tipoCobertura = req.body.tipoCobertura;

      cambios.sede = typeof req.body.sede === 'string'
        ? req.body.sede.trim()
        : '';

      // ============================================
      // 2. AGENDA REGULAR
      // ============================================

      const modalidades = [
        'presencial',
        'telemedicina',
        'ambas'
      ];

      if (!modalidades.includes(req.body.modalidad)) {
        throw new Error('Modalidad de atención inválida.');
      }

      cambios.modalidad = req.body.modalidad;

      cambios.diasAtencion = listaDias(
        req.body.diasAtencion
      );

      if (!cambios.diasAtencion.length) {
        throw new Error(
          'Seleccioná al menos un día de atención regular.'
        );
      }

      const horaInicio = textoObligatorio(
        req.body.horaInicio,
        'Hora de inicio'
      );

      const horaFin = textoObligatorio(
        req.body.horaFin,
        'Hora de finalización'
      );

      validarHorario(
        horaInicio,
        horaFin,
        'la agenda regular'
      );

      cambios.horaInicio = horaInicio;
      cambios.horaFin = horaFin;

      const duracion = Number(req.body.duracionTurnoMinutos);

      if (
        !Number.isInteger(duracion) ||
        duracion < 5 ||
        duracion > 120
      ) {
        throw new Error('Duración de turno inválida.');
      }

      cambios.duracionTurnoMinutos = duracion;

      // ============================================
      // 3. SOBRETURNOS
      // ============================================

      cambios.permiteSobreturnos =
        req.body.permiteSobreturnos === 'on';

      if (cambios.permiteSobreturnos) {

        cambios.diasSobreturnos = listaDias(
          req.body.diasSobreturnos
        );

        if (!cambios.diasSobreturnos.length) {
          throw new Error(
            'Seleccioná días para sobreturnos.'
          );
        }

        const inicioSob = textoObligatorio(
          req.body.horaInicioSobreturnos,
          'Inicio de sobreturnos'
        );

        const finSob = textoObligatorio(
          req.body.horaFinSobreturnos,
          'Fin de sobreturnos'
        );

        validarHorario(
          inicioSob,
          finSob,
          'sobreturnos'
        );

        const cantidad = Number(
          req.body.cantidadMaximaSobreturnos
        );

        if (
          !Number.isInteger(cantidad) ||
          cantidad < 1 ||
          cantidad > 8
        ) {
          throw new Error(
            'La cantidad máxima de sobreturnos debe estar entre 1 y 8.'
          );
        }

        cambios.horaInicioSobreturnos = inicioSob;
        cambios.horaFinSobreturnos = finSob;
        cambios.cantidadMaximaSobreturnos = cantidad;

      } else {

        cambios.diasSobreturnos = [];
        cambios.horaInicioSobreturnos = '';
        cambios.horaFinSobreturnos = '';
        cambios.cantidadMaximaSobreturnos = 4;
      }

      // ============================================
      // 4. TELEMEDICINA
      // ============================================

      cambios.ofreceTelemedicina =
        req.body.ofreceTelemedicina === 'on';

      if (cambios.ofreceTelemedicina) {

        cambios.diasTelemedicina = listaDias(
          req.body.diasTelemedicina
        );

        if (!cambios.diasTelemedicina.length) {
          throw new Error(
            'Seleccioná días para telemedicina.'
          );
        }

        const inicioTele = textoObligatorio(
          req.body.horaInicioTelemedicina,
          'Inicio de telemedicina'
        );

        const finTele = textoObligatorio(
          req.body.horaFinTelemedicina,
          'Fin de telemedicina'
        );

        validarHorario(
          inicioTele,
          finTele,
          'telemedicina'
        );

        cambios.horaInicioTelemedicina = inicioTele;
        cambios.horaFinTelemedicina = finTele;

      } else {

        cambios.diasTelemedicina = [];
        cambios.horaInicioTelemedicina = '';
        cambios.horaFinTelemedicina = '';
      }

      // ============================================
      // 5. GUARDAR EN MONGODB
      // ============================================

      // Sincronizar el correo particular con el usuario institucional
      // para que la agenda y la cuenta no pierdan su vínculo.
      const emailAnterior = profesional.email;
      const cuentaVinculada = await Usuario.findOne({
        profesional_id: profesional._id,
        rol: 'profesional'
      });

      if (cuentaVinculada) {
        cambios.email = cambios.email.trim().toLowerCase();
        if (cuentaVinculada.email !== cambios.email) {
          const existeOtroUsuario = await Usuario.exists({
            email: cambios.email,
            _id: { $ne: cuentaVinculada._id }
          });
          if (existeOtroUsuario) {
            return res.status(409).send('Ese correo ya está asignado a otro usuario.');
          }
        }
      }

      profesional.set(cambios);
      await profesional.save();

      if (cuentaVinculada && cuentaVinculada.email !== cambios.email) {
        try {
          await Usuario.updateOne(
            { _id: cuentaVinculada._id, rol: 'profesional' },
            { $set: { email: cambios.email } }
          );
        } catch (error) {
          // Mantener consistente el campo correo si falla la segunda escritura.
          await Profesional.updateOne(
            { _id: profesional._id },
            { $set: { email: emailAnterior } }
          ).catch(e => console.error('Error restaurando email:', e));
          throw error;
        }
      }

      console.log(
        '✅ Profesional actualizado:',
        profesional._id,
        '| Usuario:',
        req.session?.usuario?.rol
      );

      return res.redirect(
        `/profesionales/${profesional._id}`
      );

    } catch (error) {

      console.error(
        '❌ Error al editar profesional:',
        error
      );

      if (error.code === 11000) {
        return res.status(409).send(
          'El DNI, correo o matrícula ya está registrado.'
        );
      }

      if (error.name === 'ValidationError') {
        return res.status(400).send(error.message);
      }

      if (
        error.message &&
        (
          error.message.includes('inválid') ||
          error.message.includes('obligatorio') ||
          error.message.includes('Seleccioná') ||
          error.message.includes('horarios') ||
          error.message.includes('cantidad máxima')
        )
      ) {
        return res.status(400).send(error.message);
      }

      return next(error);
    }
  }
);

// ============================================================
// LIBERAR EMAIL DE PRUEBA QUE QUEDÓ HUÉRFANO
// Esta ruta FIJA va antes de /:id.
// ============================================================
router.post(
  '/cuentas-huerfanas/liberar',
  asegurarAutenticacion,
  permitirRoles('admin'),
  ProfesionalController.liberarCorreoHuerfano
);

// ============================================================
// DESACTIVAR (COMPATIBLE CON EL FORMULARIO ANTERIOR)
// ============================================================
router.post(
  '/:id/eliminar',
  ...acceso,
  ProfesionalController.eliminarProfesional
);

// ============================================================
// REACTIVAR / ELIMINAR DEFINITIVAMENTE: SOLO ADMIN
// ============================================================
router.post(
  '/:id/reactivar',
  asegurarAutenticacion,
  permitirRoles('admin'),
  ProfesionalController.reactivarProfesional
);

router.post(
  '/:id/eliminar-definitivamente',
  asegurarAutenticacion,
  permitirRoles('admin'),
  ProfesionalController.eliminarProfesionalDefinitivamente
);

// ============================================================
// 2. DETALLE PROFESIONAL (SIEMPRE AL FINAL)
// ============================================================

router.get(
  '/:id',
  ...acceso,
  validarExistenciaProfesional,
  ProfesionalController.getDetalleProfesional
);

export default router;