import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import Estudio from '../models/EstudioClinico.js';

// ============================================================
// CONTROLADOR DE ESTUDIOS CLÍNICOS
// ============================================================
// Armé este controlador para manejar todo el flujo de subir, guardar y mirar
// PDFs o imágenes de estudios médicos. Lo armé usando dependencias inyectadas
// para asegurarme de que la lógica de Multer y CSRF quede bien separada en las rutas.

export function crearEstudioClinicoController({
  carpetaPrivada,
  buscarPaciente,
  esSecretaria,
  esMedico,
  lecturaAutorizada,
  medicoAutorizado,
  auditar
}) {

  // Valido fuerte al principio: si me llaman a este controlador sin las funciones 
  // de seguridad necesarias, tiro un error y rompo todo para evitar fugas de datos.
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
    throw new Error('Faltan dependencias del controlador de estudios clínicos.');
  }


  // ==========================================================
  // FUNCIONES AUXILIARES INTERNAS
  // ==========================================================

  const esId = valor =>
    /^[0-9a-fA-F]{24}$/.test(String(valor || ''));

  const idDe = valor => String(
    valor && typeof valor === 'object'
      ? valor._id || valor.id || ''
      : valor || ''
  );

  const texto = (valor, max) =>
    String(valor || '').trim().slice(0, max);

  // Armé esta función para validar que la fecha tenga el formato ISO estricto 
  // y evitar que me inyecten fechas falopas desde postman.
  const fechaValida = valor =>
    /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) &&
    !Number.isNaN(new Date(`${valor}T12:00:00Z`).getTime()) &&
    new Date(`${valor}T12:00:00Z`).toISOString().slice(0, 10) === valor;


  // =====================================================
  // ANÁLISIS PROFUNDO DE ARCHIVOS (MIME TYPE REAL)
  // =====================================================
  // No me confío de la extensión del archivo ni de lo que me dice el navegador. 
  // Leo los "Magic Numbers" (los primeros bytes del buffer) para saber 
  // científicamente si es un PDF o una foto de verdad.

  function tipoReal(buffer) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      return null;
    }

    // Magic Number de PDF
    if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      return { mime: 'application/pdf', ext: 'pdf' };
    }

    // Magic Number de PNG
    if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      return { mime: 'image/png', ext: 'png' };
    }

    // Magic Number de JPG/JPEG
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: 'image/jpeg', ext: 'jpg' };
    }

    return null;
  }


  // =====================================================
  // 1. MOSTRAR FORMULARIO DE CARGA
  // =====================================================

  async function mostrarFormulario(req, res) {
    // Seguridad: esto es tarea exclusiva de la secretaria
    if (!esSecretaria(req)) {
      return res.sendStatus(403);
    }

    const paciente = await buscarPaciente(req.params.pacienteId);

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
  // 2. GUARDAR ESTUDIO CLÍNICO EN DISCO Y MONGO
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

    const tipoEstudio = texto(req.body.tipoEstudio, 120);
    const fechaEstudio = String(req.body.fechaEstudio || '');

    if (!req.file || !tipoEstudio || !fechaValida(fechaEstudio)) {
      return res.status(400).send('Completá el tipo, la fecha y el archivo del estudio.');
    }

    // Llamo a mi función de Magic Numbers para auditar el buffer del archivo
    const tipo = tipoReal(req.file.buffer);

    if (!tipo || req.file.mimetype !== tipo.mime) {
      return res.status(400).send('Archivo no válido o formato no permitido.');
    }

    // Guardo los archivos médicos bloqueados fuera de la carpeta pública (`/public`)
    // para que nadie pueda accederlos adivinando la URL en el navegador.
    await fsp.mkdir(carpetaPrivada, {
      recursive: true,
      mode: 0o700 // Permisos de Linux restrictivos
    });

    // Genero un nombre único y opaco con UUID
    const nombreGuardado = `${crypto.randomUUID()}.${tipo.ext}`;
    const ubicacion = path.join(carpetaPrivada, nombreGuardado);

    // Escribo el archivo físico en el disco
    await fsp.writeFile(
      ubicacion,
      req.file.buffer,
      { flag: 'wx', mode: 0o600 }
    );

    let estudio;

    try {
      // Impacto los metadatos en la base de datos
      estudio = await Estudio.create({
        pacienteId,
        cargadoPorUsuarioId: idDe(req.usuarioClinica),
        tipoEstudio,
        fechaEstudio: new Date(`${fechaEstudio}T12:00:00Z`),
        nombreOriginal: path.basename(req.file.originalname).slice(0, 200),
        nombreGuardado,
        mimeType: tipo.mime,
        pesoBytes: req.file.size,
        // Hago un hash SHA-256 del archivo para asegurar la integridad (Anti-Tampering)
        sha256: crypto.createHash('sha256').update(req.file.buffer).digest('hex')
      });

    } catch (error) {
      // ROLLBACK: si MongoDB tira error, borro el archivo físico recién creado 
      // para no dejar basura suelta ocupando espacio en el disco duro.
      await fsp.unlink(ubicacion).catch(() => {});
      throw error;
    }

    await auditar(req, pacienteId, 'CARGAR_ESTUDIO', estudio._id);

    // Mando a la secretaria a una pantalla de éxito, pero SIN darle
    // el link a la historia clínica (porque no tiene permisos para verla).
    return res.redirect(303, `/clinica/pacientes/${pacienteId}/estudios/${estudio._id}/confirmacion`);
  }


  // =====================================================
  // 3. PANTALLA DE CONFIRMACIÓN DE CARGA (Para Secretaría)
  // =====================================================

  async function mostrarConfirmacion(req, res) {
    const { pacienteId, estudioId } = req.params;

    if (!esSecretaria(req) || !esId(estudioId)) {
      return res.sendStatus(403);
    }

    // Obligo a que el ID del cargador coincida con el usuario logueado 
    // para que una secretaria no pueda chusmear qué estudios subieron las demás.
    const estudio = await Estudio.findOne({
      _id: estudioId,
      pacienteId,
      cargadoPorUsuarioId: idDe(req.usuarioClinica)
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
  // 4. STREAMING SEGURO DEL ARCHIVO (Descarga)
  // =====================================================

  async function descargarArchivo(req, res, next) {
    const { pacienteId, estudioId } = req.params;

    if (!esId(estudioId)) {
      return res.sendStatus(400);
    }

    // Le pregunto a mi middleware externo si este usuario tiene permiso 
    // de ver los datos clínicos de este paciente.
    if (!(await lecturaAutorizada(req, pacienteId))) {
      return res.sendStatus(403);
    }

    const estudio = await Estudio.findOne({
      _id: estudioId,
      pacienteId
    }).lean();

    if (!estudio) {
      return res.sendStatus(404);
    }

    // Validación paranoica de Path Traversal para que nadie intente meter un "../../" 
    // y descargarme el /etc/passwd del servidor.
    if (!/^[a-f0-9-]{36}\.(pdf|png|jpg)$/.test(estudio.nombreGuardado)) {
      return res.sendStatus(500);
    }

    const ubicacion = path.join(carpetaPrivada, estudio.nombreGuardado);

    if (!fs.existsSync(ubicacion)) {
      return res.sendStatus(404);
    }

    // Registro siempre quién se descargó el PDF del paciente
    await auditar(req, pacienteId, 'DESCARGAR_ESTUDIO', estudio._id);

    // Limpio caracteres raros del nombre original para no romper los headers del navegador
    const nombreDescarga = estudio.nombreOriginal
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .slice(0, 150) || 'estudio';

    // Lo mando como "attachment" para forzar la descarga y no abrirlo crudo en el navegador 
    // (previene algunos ataques XSS si el PDF estuviera inyectado).
    res.setHeader('Content-Disposition', `attachment; filename="${nombreDescarga}"`);
    res.type(estudio.mimeType);

    // Hago un stream directo desde el disco a la respuesta web para no saturar 
    // la memoria RAM de Node si me piden 50 PDFs al mismo tiempo.
    const stream = fs.createReadStream(ubicacion);
    stream.on('error', next);
    stream.pipe(res);
  }


  // =====================================================
  // 5. REGISTRAR REVISIÓN MÉDICA DEL ESTUDIO
  // =====================================================

  async function revisarEstudio(req, res) {
    const { pacienteId, estudioId } = req.params;

    if (!esId(estudioId) || !esMedico(req)) {
      return res.sendStatus(403);
    }

    const autorizacion = await medicoAutorizado(req, pacienteId);

    if (!autorizacion) {
      return res.sendStatus(403);
    }

    const observacion = texto(req.body.observacion, 3000);

    // Hago una actualización atómica exigiendo que el estado previo sea 'pendiente'.
    // Esto evita que dos médicos revisen el mismo estudio a la vez y me pisen los datos.
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
            usuarioRevisorId: idDe(req.usuarioClinica),
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
      return res.status(409).send('El estudio no existe o ya fue revisado.');
    }

    await auditar(req, pacienteId, 'REVISAR_ESTUDIO', estudio._id);

    return res.redirect(303, `/clinica/pacientes/${pacienteId}/historia`);
  }


  // =====================================================
  // EXPORTAR FUNCIONES AL ENRUTADOR
  // =====================================================
  return {
    mostrarFormulario,
    guardarEstudio,
    mostrarConfirmacion,
    descargarArchivo,
    revisarEstudio
  };
}