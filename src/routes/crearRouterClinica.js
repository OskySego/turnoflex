import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';

import Estudio from '../models/EstudioClinico.js';
import Auditoria from '../models/AuditoriaClinica.js';
import * as reglas from '../middlewares/politicasClinicas.js';
import { crearEvolucionClinicaController } from '../controllers/evolucionClinicaController.js';
import { crearHistoriaClinicaController } from '../controllers/historiaClinicaController.js';

const MAX_ARCHIVO = 10 * 1024 * 1024;

const asyncRoute = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const esId = x =>
  /^[0-9a-fA-F]{24}$/.test(String(x || ''));

const idDe = x =>
  String(
    x && typeof x === 'object'
      ? x._id || x.id || ''
      : x || ''
  );

const texto = (valor, max) =>
  String(valor || '').trim().slice(0, max);

const fechaValida = valor =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) &&
  !Number.isNaN(new Date(`${valor}T12:00:00Z`).getTime()) &&
  new Date(`${valor}T12:00:00Z`).toISOString().slice(0, 10) === valor;


// =====================================================
// VALIDACIÓN DEL CONTENIDO REAL DEL ARCHIVO
// =====================================================

function tipoReal(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    return null;
  }

  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { mime: 'application/pdf', ext: 'pdf' };
  }

  if (
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  return null;
}


// =====================================================
// ROUTER PRINCIPAL DE HISTORIA CLÍNICA
// =====================================================

function crearRouterClinica(config) {

  if (
    !config?.Cliente ||
    !config?.Turno ||
    typeof config.resolverProfesionalId !== 'function' ||
    typeof config.esPacienteTitular !== 'function' ||
    typeof config.obtenerUsuarioAutorizado !== 'function'
  ) {
    throw new Error(
      'Historia clínica: faltan modelos o adaptadores obligatorios de identidad.'
    );
  }

  const {
    Cliente,
    Turno,
    resolverProfesionalId,
    esPacienteTitular
  } = config;

  const resolverPacienteId = config.resolverPacienteId;

  const carpetaPrivada = path.resolve(
    config.directorioPrivado ||
    process.env.TF_CLINICA_PRIVATE_DIR ||
    path.join(process.cwd(), 'storage_privado', 'clinica')
  );

  const directorioPublico = path.resolve(
    process.cwd(),
    'public'
  );

  // Los estudios nunca deben guardarse en public.
  if (
    carpetaPrivada === directorioPublico ||
    carpetaPrivada.startsWith(directorioPublico + path.sep)
  ) {
    throw new Error(
      'Historia clínica: el directorio de estudios no puede estar dentro de public/.'
    );
  }

  const router = express.Router();

  // Módulo de demostración: no habilitar en producción
  // sin una revisión de seguridad y cumplimiento.
  router.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).send(
        'Módulo clínico de demostración no habilitado en producción.'
      );
    }

    next();
  });


  // =====================================================
  // CONFIGURACIÓN DE ARCHIVOS
  // =====================================================

  const subida = multer({
    storage: multer.memoryStorage(),

    limits: {
      fileSize: MAX_ARCHIVO,
      files: 1
    },

    fileFilter: (req, archivo, cb) => {
      if (
        [
          'application/pdf',
          'image/png',
          'image/jpeg'
        ].includes(archivo.mimetype)
      ) {
        cb(null, true);
      } else {
        cb(new Error('Solo se admiten PDF, PNG y JPG.'));
      }
    }
  });


  // =====================================================
  // IDENTIFICACIÓN DEL USUARIO
  // =====================================================

  router.use(asyncRoute(async (req, res, next) => {

    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('X-Content-Type-Options', 'nosniff');

    const usuarioSesion = req.session?.usuario;
    const usuarioId = idDe(usuarioSesion);

    if (
      !esId(usuarioId) ||
      typeof config.obtenerUsuarioAutorizado !== 'function'
    ) {
      return res.status(401).send(
        'Sesión no autenticada.'
      );
    }

    const usuario = await config.obtenerUsuarioAutorizado(
      usuarioId,
      req
    );

    if (
      !usuario ||
      idDe(usuario) !== usuarioId ||
      ![
        'admin',
        'personal',
        'cliente',
        'profesional'
      ].includes(usuario.rol)
    ) {
      return res.status(401).send(
        'Sesión no válida.'
      );
    }

    req.usuarioClinica = usuario;
    next();
  }));


  // =====================================================
  // SEGURIDAD DE FORMULARIOS CSRF
  // =====================================================

  router.use((req, res, next) => {

    if (!req.session) {
      return res.status(503).send(
        'Historia clínica requiere una sesión de servidor.'
      );
    }

    if (!req.session.tfClinicaCsrf) {
      req.session.tfClinicaCsrf =
        crypto.randomBytes(32).toString('hex');
    }

    res.locals.tfClinicaCsrf =
      req.session.tfClinicaCsrf;

    next();
  });

  function verificarCsrf(req, res, next) {

    const esperado = String(
      req.session?.tfClinicaCsrf || ''
    );

    const recibido = String(
      req.body?._tfClinicaCsrf ||
      req.get('X-TF-CLINICA-CSRF') ||
      ''
    );

    if (
      esperado.length !== 64 ||
      recibido.length !== 64 ||
      !crypto.timingSafeEqual(
        Buffer.from(esperado),
        Buffer.from(recibido)
      )
    ) {
      return res.status(403).send(
        'Token de seguridad inválido. Recargá el formulario.'
      );
    }

    next();
  }


  // =====================================================
  // HISTORIA CLÍNICA DEL PACIENTE AUTENTICADO
  // =====================================================

  router.get(
    '/mi-historia',
    asyncRoute(async (req, res) => {

      if (
        req.usuarioClinica.rol !== reglas.ROL_PACIENTE
      ) {
        return res.sendStatus(403);
      }

      if (typeof resolverPacienteId !== 'function') {
        return res.status(503).send(
          'Vínculo usuario-paciente aún no configurado.'
        );
      }

      const pacienteId = idDe(
        await resolverPacienteId(
          req.usuarioClinica,
          req
        )
      );

      if (!esId(pacienteId)) {
        return res.sendStatus(403);
      }

      const titular = await esPacienteTitular({
        usuario: req.usuarioClinica,
        pacienteId,
        req
      });

      if (!titular) {
        return res.sendStatus(403);
      }

      return res.redirect(
        302,
        `/clinica/pacientes/${pacienteId}/historia`
      );
    })
  );


  // =====================================================
  // VALIDAR IDENTIFICADOR DEL PACIENTE
  // =====================================================

  router.use(
    '/pacientes/:pacienteId',
    (req, res, next) => {

      if (!esId(req.params.pacienteId)) {
        return res.status(400).send(
          'Identificador de paciente inválido.'
        );
      }

      next();
    }
  );


  // =====================================================
  // FUNCIONES DE ROLES
  // =====================================================

  const usr = req => req.usuarioClinica;

  const esSecretaria = req =>
    reglas.puedeSubirEstudio(usr(req).rol);

  const esMedico = req =>
    reglas.puedeEscribirEvolucion(usr(req).rol);


  async function buscarPaciente(id) {
    return Cliente.findById(id)
      .select('_id nombre dni')
      .lean();
  }


  // =====================================================
  // AUTORIZACIÓN DEL MÉDICO
  // =====================================================

  async function medicoAutorizado(
    req,
    pacienteId,
    turnoId = null,
    { paraEscritura = false } = {}
  ) {

    if (!esMedico(req)) {
      return null;
    }

    const profesionalId = idDe(
      await resolverProfesionalId(usr(req), req)
    );

    if (!esId(profesionalId)) {
      return null;
    }

    const filtro = {
      cliente_id: pacienteId,
      profesional_id: profesionalId,
      estado: {
        $nin: ['cancelado', 'ausente']
      }
    };

    if (turnoId) {
      if (!esId(turnoId)) {
        return null;
      }

      filtro._id = turnoId;
    }

    const turno = await Turno.findOne(filtro)
      .select('_id estado fecha hora')
      .lean();

    if (!turno) {
      return null;
    }

    if (
      turnoId &&
      ['cancelado', 'ausente'].includes(
        String(turno.estado || '').toLowerCase()
      )
    ) {
      return null;
    }

    if (paraEscritura) {

      const partes = new Intl.DateTimeFormat(
        'en-US',
        {
          timeZone: 'America/Argentina/Buenos_Aires',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }
      ).formatToParts(new Date());

      const parte = nombre =>
        partes.find(d => d.type === nombre)?.value || '';

      const hoy =
        `${parte('year')}-${parte('month')}-${parte('day')}`;

      if (
        !turnoId ||
        !turno.fecha ||
        turno.fecha > hoy
      ) {
        return null;
      }
    }

    return {
      profesionalId,
      turno
    };
  }


  // =====================================================
  // AUTORIZACIÓN PARA LEER HISTORIA CLÍNICA
  // =====================================================

  async function lecturaAutorizada(req, pacienteId) {

    const usuario = usr(req);

    if (usuario.rol === reglas.ROL_PACIENTE) {
      return !!(
        await esPacienteTitular({
          usuario,
          pacienteId,
          req
        })
      );
    }

    if (usuario.rol === reglas.ROL_MEDICO) {
      return !!(
        await medicoAutorizado(req, pacienteId)
      );
    }

    return false;
  }


  // =====================================================
  // AUDITORÍA DE ACCIONES CLÍNICAS
  // =====================================================

  async function auditar(
    req,
    pacienteId,
    accion,
    recursoId = null
  ) {

    await Auditoria.create({
      usuarioId: idDe(usr(req)),
      rol: usr(req).rol,
      pacienteId,
      accion,
      recursoId: esId(recursoId)
        ? recursoId
        : null
    });
  }


  // Controlador MVC: dependencias verificadas del router.
  const historiaClinicaController = crearHistoriaClinicaController({
    Cliente,
    lecturaAutorizada,
    auditar,
    resolverProfesionalId
  });

  // =====================================================
  // VISUALIZAR HISTORIA CLÍNICA
  // =====================================================

  router.get(
    '/pacientes/:pacienteId/historia',
    asyncRoute(historiaClinicaController.verHistoria)
  );

  // Controlador MVC de evoluciones y rectificaciones.
  const evolucionClinicaController = crearEvolucionClinicaController({
    medicoAutorizado,
    buscarPaciente,
    auditar
  });

  // =====================================================
  // NUEVA EVOLUCIÓN MÉDICA - FORMULARIO
  // =====================================================

  router.get(
    '/pacientes/:pacienteId/evoluciones/nueva',
    asyncRoute(evolucionClinicaController.mostrarFormulario)
  );


  // =====================================================
  // GUARDAR EVOLUCIÓN MÉDICA
  // =====================================================

  router.post(
    '/pacientes/:pacienteId/evoluciones',
    verificarCsrf,
    asyncRoute(evolucionClinicaController.guardarEvolucion)
  );


  // =====================================================
  // FORMULARIO DE RECTIFICACIÓN MÉDICA
  // =====================================================

  router.get(
    '/pacientes/:pacienteId/evoluciones/:notaId/rectificar',
    asyncRoute(evolucionClinicaController.mostrarRectificacion)
  );


  // =====================================================
  // GUARDAR RECTIFICACIÓN MÉDICA
  // =====================================================

  router.post(
    '/pacientes/:pacienteId/evoluciones/:notaId/rectificar',
    verificarCsrf,
    asyncRoute(evolucionClinicaController.guardarRectificacion)
  );


  // =====================================================
  // SECRETARÍA: FORMULARIO PARA ADJUNTAR ESTUDIO
  // =====================================================

  router.get(
    '/pacientes/:pacienteId/estudios/nuevo',
    asyncRoute(async (req, res) => {

      if (!esSecretaria(req)) {
        return res.sendStatus(403);
      }

      const paciente = await buscarPaciente(
        req.params.pacienteId
      );

      if (!paciente) {
        return res.sendStatus(404);
      }

      return res.render('clinica/estudio-nuevo', {
        user: usr(req),
        paciente,
        tituloPage: 'Adjuntar estudio'
      });
    })
  );


  // =====================================================
  // SECRETARÍA: GUARDAR ESTUDIO
  // =====================================================

  router.post(
    '/pacientes/:pacienteId/estudios',

    (req, res, next) => {

      if (!esSecretaria(req)) {
        return res.sendStatus(403);
      }

      subida.single('archivo')(
        req,
        res,
        err => err ? next(err) : next()
      );
    },

    verificarCsrf,

    asyncRoute(async (req, res) => {

      const { pacienteId } = req.params;

      if (!esSecretaria(req)) {
        return res.sendStatus(403);
      }

      const paciente = await buscarPaciente(pacienteId);

      if (!paciente) {
        return res.sendStatus(404);
      }

      const tipoEstudio = texto(
        req.body.tipoEstudio,
        120
      );

      const fechaEstudio = String(
        req.body.fechaEstudio || ''
      );

      if (
        !req.file ||
        !tipoEstudio ||
        !fechaValida(fechaEstudio)
      ) {
        return res.status(400).send(
          'Completá el tipo, la fecha y el archivo del estudio.'
        );
      }

      const tipo = tipoReal(req.file.buffer);

      if (
        !tipo ||
        req.file.mimetype !== tipo.mime
      ) {
        return res.status(400).send(
          'Archivo no válido o formato no permitido.'
        );
      }

      await fsp.mkdir(
        carpetaPrivada,
        { recursive: true, mode: 0o700 }
      );

      const nombreGuardado =
        `${crypto.randomUUID()}.${tipo.ext}`;

      const ubicacion = path.join(
        carpetaPrivada,
        nombreGuardado
      );

      await fsp.writeFile(
        ubicacion,
        req.file.buffer,
        { flag: 'wx', mode: 0o600 }
      );

      let estudio;

      try {

        estudio = await Estudio.create({
          pacienteId,
          cargadoPorUsuarioId: idDe(usr(req)),
          tipoEstudio,
          fechaEstudio: new Date(
            `${fechaEstudio}T12:00:00Z`
          ),
          nombreOriginal: path.basename(
            req.file.originalname
          ).slice(0, 200),
          nombreGuardado,
          mimeType: tipo.mime,
          pesoBytes: req.file.size,
          sha256: crypto
            .createHash('sha256')
            .update(req.file.buffer)
            .digest('hex')
        });

      } catch (err) {

        await fsp.unlink(ubicacion).catch(() => {});
        throw err;
      }

      await auditar(
        req,
        pacienteId,
        'CARGAR_ESTUDIO',
        estudio._id
      );

      // Secretaría recibe confirmación, no historia médica.
      return res.redirect(
        303,
        `/clinica/pacientes/${pacienteId}/estudios/${estudio._id}/confirmacion`
      );
    })
  );


  // =====================================================
  // CONFIRMACIÓN DEL ESTUDIO CARGADO
  // =====================================================

  router.get(
    '/pacientes/:pacienteId/estudios/:estudioId/confirmacion',
    asyncRoute(async (req, res) => {

      const { pacienteId, estudioId } = req.params;

      if (
        !esSecretaria(req) ||
        !esId(estudioId)
      ) {
        return res.sendStatus(403);
      }

      const estudio = await Estudio.findOne({
        _id: estudioId,
        pacienteId,
        cargadoPorUsuarioId: idDe(usr(req))
      })
        .select('_id tipoEstudio nombreOriginal pacienteId')
        .lean();

      if (!estudio) {
        return res.sendStatus(404);
      }

      const paciente = await buscarPaciente(pacienteId);

      if (!paciente) {
        return res.sendStatus(404);
      }

      return res.render('clinica/estudio-cargado', {
        user: usr(req),
        paciente,
        estudio,
        tituloPage: 'Estudio incorporado'
      });
    })
  );


  // =====================================================
  // DESCARGAR UN ESTUDIO
  // =====================================================

  router.get(
    '/pacientes/:pacienteId/estudios/:estudioId/archivo',
    asyncRoute(async (req, res, next) => {

      const { pacienteId, estudioId } = req.params;

      if (!esId(estudioId)) {
        return res.sendStatus(400);
      }

      if (
        !(await lecturaAutorizada(req, pacienteId))
      ) {
        return res.sendStatus(403);
      }

      const estudio = await Estudio.findOne({
        _id: estudioId,
        pacienteId
      }).lean();

      if (!estudio) {
        return res.sendStatus(404);
      }

      if (
        !/^[a-f0-9-]{36}\.(pdf|png|jpg)$/.test(
          estudio.nombreGuardado
        )
      ) {
        return res.sendStatus(500);
      }

      const ubicacion = path.join(
        carpetaPrivada,
        estudio.nombreGuardado
      );

      if (!fs.existsSync(ubicacion)) {
        return res.sendStatus(404);
      }

      await auditar(
        req,
        pacienteId,
        'DESCARGAR_ESTUDIO',
        estudio._id
      );

      const nombreDescarga = estudio.nombreOriginal
        .replace(/[^a-zA-Z0-9_.-]/g, '_')
        .slice(0, 150) || 'estudio';

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombreDescarga}"`
      );

      res.type(estudio.mimeType);

      const stream = fs.createReadStream(ubicacion);

      stream.on('error', next);
      stream.pipe(res);
    })
  );


  // =====================================================
  // MÉDICO: REVISAR UN ESTUDIO
  // =====================================================

  router.post(
    '/pacientes/:pacienteId/estudios/:estudioId/revisar',
    verificarCsrf,
    asyncRoute(async (req, res) => {

      const { pacienteId, estudioId } = req.params;

      if (
        !esId(estudioId) ||
        !esMedico(req)
      ) {
        return res.sendStatus(403);
      }

      const autorizacion = await medicoAutorizado(
        req,
        pacienteId
      );

      if (!autorizacion) {
        return res.sendStatus(403);
      }

      const observacion = texto(
        req.body.observacion,
        3000
      );

      const estudio = await Estudio.findOneAndUpdate(
        {
          _id: estudioId,
          pacienteId,
          'revision.estado': 'pendiente'
        },
        {
          $set: {
            revision: {
              estado: 'revisado',
              profesionalId: autorizacion.profesionalId,
              usuarioRevisorId: idDe(usr(req)),
              fecha: new Date(),
              observacion
            }
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!estudio) {
        return res.status(409).send(
          'El estudio no existe o ya fue revisado.'
        );
      }

      await auditar(
        req,
        pacienteId,
        'REVISAR_ESTUDIO',
        estudio._id
      );

      return res.redirect(
        303,
        `/clinica/pacientes/${pacienteId}/historia`
      );
    })
  );


  // =====================================================
  // ERRORES DE CARGA DE ARCHIVOS
  // =====================================================

  router.use((err, req, res, next) => {

    if (
      err instanceof multer.MulterError ||
      /Solo se admiten/.test(err.message || '')
    ) {
      return res.status(400).send(
        'Archivo no válido, excedido o formato no permitido (máximo 10 MB).'
      );
    }

    next(err);
  });


  return router;
}

export { crearRouterClinica };