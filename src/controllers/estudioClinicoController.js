import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import Estudio from '../models/EstudioClinico.js';

/**
 * TURNOFLEX
 * Controlador de Estudios Clínicos
 *
 * Responsabilidades:
 * - Mostrar el formulario de carga.
 * - Guardar estudios y sus metadatos.
 * - Confirmar los estudios registrados.
 * - Entregar archivos a usuarios autorizados.
 * - Registrar la revisión médica.
 *
 * Multer, CSRF y autenticación permanecen en el router.
 */

export function crearEstudioClinicoController({
  carpetaPrivada,
  buscarPaciente,
  esSecretaria,
  esMedico,
  lecturaAutorizada,
  medicoAutorizado,
  auditar
}) {

  if (
    typeof carpetaPrivada !== 'string' ||
    [
      buscarPaciente,
      esSecretaria,
      esMedico,
      lecturaAutorizada,
      medicoAutorizado,
      auditar
    ].some(funcion => typeof funcion !== 'function')
  ) {
    throw new Error(
      'Faltan dependencias del controlador de estudios clínicos.'
    );
  }

  const esId = valor =>
    /^[0-9a-fA-F]{24}$/.test(String(valor || ''));

  const idDe = valor => String(
    valor && typeof valor === 'object'
      ? valor._id || valor.id || ''
      : valor || ''
  );

  const texto = (valor, max) =>
    String(valor || '').trim().slice(0, max);

  const fechaValida = valor =>
    /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) &&
    !Number.isNaN(
      new Date(`${valor}T12:00:00Z`).getTime()
    ) &&
    new Date(`${valor}T12:00:00Z`)
      .toISOString().slice(0, 10) === valor;


  // =====================================================
  // VALIDAR EL FORMATO REAL DEL ARCHIVO
  // =====================================================

  function tipoReal(buffer) {

    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      return null;
    }

    if (
      buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    ) {
      return {
        mime: 'application/pdf',
        ext: 'pdf'
      };
    }

    if (
      buffer.subarray(0, 8).equals(
        Buffer.from([
          137, 80, 78, 71, 13, 10, 26, 10
        ])
      )
    ) {
      return {
        mime: 'image/png',
        ext: 'png'
      };
    }

    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return {
        mime: 'image/jpeg',
        ext: 'jpg'
      };
    }

    return null;
  }


  // =====================================================
  // 1. MOSTRAR FORMULARIO DE CARGA
  // =====================================================

  async function mostrarFormulario(req, res) {

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
      user: req.usuarioClinica,
      paciente,
      tituloPage: 'Adjuntar estudio'
    });
  }


  // =====================================================
  // 2. GUARDAR ESTUDIO CLÍNICO
  // =====================================================

  async function guardarEstudio(req, res) {

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

    // Los archivos clínicos permanecen fuera de public.
    await fsp.mkdir(carpetaPrivada, {
      recursive: true,
      mode: 0o700
    });

    const nombreGuardado =
      `${crypto.randomUUID()}.${tipo.ext}`;

    const ubicacion = path.join(
      carpetaPrivada,
      nombreGuardado
    );

    await fsp.writeFile(
      ubicacion,
      req.file.buffer,
      {
        flag: 'wx',
        mode: 0o600
      }
    );

    let estudio;

    try {

      estudio = await Estudio.create({
        pacienteId,

        cargadoPorUsuarioId:
          idDe(req.usuarioClinica),

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

    } catch (error) {

      await fsp.unlink(ubicacion).catch(() => {});
      throw error;

    }

    await auditar(
      req,
      pacienteId,
      'CARGAR_ESTUDIO',
      estudio._id
    );

    // Recepción recibe confirmación,
    // pero no accede al expediente médico.
    return res.redirect(
      303,
      `/clinica/pacientes/${pacienteId}/estudios/${estudio._id}/confirmacion`
    );
  }


  // =====================================================
  // 3. MOSTRAR CONFIRMACIÓN DE CARGA
  // =====================================================

  async function mostrarConfirmacion(req, res) {

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
      cargadoPorUsuarioId:
        idDe(req.usuarioClinica)
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
      user: req.usuarioClinica,
      paciente,
      estudio,
      tituloPage: 'Estudio incorporado'
    });
  }


  // =====================================================
  // 4. ENTREGAR ARCHIVO DEL ESTUDIO
  // =====================================================

  async function descargarArchivo(req, res, next) {

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

    // Conservamos temporalmente la descarga actual.
    // La visualización en navegador se hará por separado.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreDescarga}"`
    );

    res.type(estudio.mimeType);

    const stream = fs.createReadStream(ubicacion);

    stream.on('error', next);
    stream.pipe(res);
  }


  // =====================================================
  // 5. REVISAR ESTUDIO MÉDICO
  // =====================================================

  async function revisarEstudio(req, res) {

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
            profesionalId:
              autorizacion.profesionalId,
            usuarioRevisorId:
              idDe(req.usuarioClinica),
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
  }


  // =====================================================
  // EXPORTAR LAS OPERACIONES
  // =====================================================

  return {
    mostrarFormulario,
    guardarEstudio,
    mostrarConfirmacion,
    descargarArchivo,
    revisarEstudio
  };
}