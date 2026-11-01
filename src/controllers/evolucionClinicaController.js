import Nota from '../models/NotaClinica.js';
import * as reglas from '../middlewares/politicasClinicas.js';

/**
 * TurnoFlex - Controlador de Evoluciones Clínicas
 *
 * Responsabilidades:
 * - Mostrar el formulario de evolución.
 * - Registrar evoluciones médicas.
 * - Mostrar el formulario de rectificación.
 * - Registrar rectificaciones sin modificar notas anteriores.
 *
 * Los permisos clínicos y la auditoría se reutilizan
 * desde el módulo principal mediante inyección de dependencias.
 */

export function crearEvolucionClinicaController({
  medicoAutorizado,
  buscarPaciente,
  auditar
}) {

  if (
    typeof medicoAutorizado !== 'function' ||
    typeof buscarPaciente !== 'function' ||
    typeof auditar !== 'function'
  ) {
    throw new Error(
      'Faltan dependencias del controlador de evoluciones.'
    );
  }

  const idDe = valor => String(
    valor && typeof valor === 'object'
      ? valor._id || valor.id || ''
      : valor || ''
  );

  const esId = valor =>
    /^[0-9a-fA-F]{24}$/.test(String(valor || ''));

  const texto = (valor, max) =>
    String(valor || '').trim().slice(0, max);

  const esMedico = req =>
    reglas.puedeEscribirEvolucion(req.usuarioClinica?.rol);


  // =====================================================
  // 1. MOSTRAR FORMULARIO DE EVOLUCIÓN
  // =====================================================

  async function mostrarFormulario(req, res) {

    const { pacienteId } = req.params;
    const turnoId = req.query.turnoId;

    const autorizacion = await medicoAutorizado(
      req,
      pacienteId,
      turnoId,
      { paraEscritura: true }
    );

    if (!turnoId || !autorizacion) {
      return res.sendStatus(403);
    }

    const paciente = await buscarPaciente(pacienteId);

    if (!paciente) {
      return res.sendStatus(404);
    }

    return res.render('clinica/evolucion-nueva', {
      user: req.usuarioClinica,
      paciente,
      turnoId,
      tituloPage: 'Nueva evolución'
    });
  }


  // =====================================================
  // 2. GUARDAR EVOLUCIÓN MÉDICA
  // =====================================================

  async function guardarEvolucion(req, res) {

    const { pacienteId } = req.params;
    const turnoId = req.body.turnoId;

    const autorizacion = await medicoAutorizado(
      req,
      pacienteId,
      turnoId,
      { paraEscritura: true }
    );

    if (!autorizacion) {
      return res.sendStatus(403);
    }

    const motivoConsulta = texto(
      req.body.motivoConsulta,
      2000
    );

    if (!motivoConsulta) {
      return res.status(400).send(
        'El motivo de consulta es obligatorio.'
      );
    }

    const nota = await Nota.create({
      pacienteId,
      turnoId,
      profesionalId: autorizacion.profesionalId,
      usuarioAutorId: idDe(req.usuarioClinica),
      motivoConsulta,
      anamnesis: texto(req.body.anamnesis, 8000),
      examenFisico: texto(req.body.examenFisico, 8000),
      diagnostico: texto(req.body.diagnostico, 4000),
      indicaciones: texto(req.body.indicaciones, 8000)
    });

    await auditar(
      req,
      pacienteId,
      'CREAR_EVOLUCION',
      nota._id
    );

    return res.redirect(
      303,
      `/clinica/pacientes/${pacienteId}/historia`
    );
  }


  // =====================================================
  // 3. VERIFICAR AUTORIZACIÓN PARA RECTIFICAR
  // =====================================================

  async function obtenerRectificacionAutorizada(req, res) {

    const { pacienteId, notaId } = req.params;

    if (!esId(notaId) || !esMedico(req)) {
      res.sendStatus(403);
      return null;
    }

    const anterior = await Nota.findOne({
      _id: notaId,
      pacienteId
    }).lean();

    if (!anterior) {
      res.sendStatus(404);
      return null;
    }

    const autorizacion = await medicoAutorizado(
      req,
      pacienteId,
      anterior.turnoId,
      { paraEscritura: true }
    );

    if (
      !autorizacion ||
      idDe(anterior.profesionalId) !== autorizacion.profesionalId ||
      idDe(anterior.usuarioAutorId) !== idDe(req.usuarioClinica)
    ) {
      res.sendStatus(403);
      return null;
    }

    return { anterior, autorizacion };
  }


  // =====================================================
  // 4. MOSTRAR FORMULARIO DE RECTIFICACIÓN
  // =====================================================

  async function mostrarRectificacion(req, res) {

    const resultado =
      await obtenerRectificacionAutorizada(req, res);

    if (!resultado) return;

    const paciente = await buscarPaciente(
      req.params.pacienteId
    );

    if (!paciente) {
      return res.sendStatus(404);
    }

    return res.render('clinica/rectificacion-nueva', {
      user: req.usuarioClinica,
      paciente,
      anterior: resultado.anterior,
      tituloPage: 'Rectificar una evolución'
    });
  }


  // =====================================================
  // 5. GUARDAR RECTIFICACIÓN
  // =====================================================

  async function guardarRectificacion(req, res) {

    const resultado =
      await obtenerRectificacionAutorizada(req, res);

    if (!resultado) return;

    const { pacienteId } = req.params;
    const { anterior, autorizacion } = resultado;

    const motivoRectificacion = texto(
      req.body.motivoRectificacion,
      1000
    );

    const motivoConsulta = texto(
      req.body.motivoConsulta,
      2000
    );

    if (!motivoRectificacion || !motivoConsulta) {
      return res.status(400).send(
        'Indicar motivo de rectificación y contenido corregido.'
      );
    }

    const nueva = await Nota.create({
      tipo: 'rectificacion',
      pacienteId,
      turnoId: anterior.turnoId,
      profesionalId: autorizacion.profesionalId,
      usuarioAutorId: idDe(req.usuarioClinica),
      rectificaNotaId: anterior._id,
      motivoRectificacion,
      motivoConsulta,
      anamnesis: texto(req.body.anamnesis, 8000),
      examenFisico: texto(req.body.examenFisico, 8000),
      diagnostico: texto(req.body.diagnostico, 4000),
      indicaciones: texto(req.body.indicaciones, 8000)
    });

    await auditar(
      req,
      pacienteId,
      'RECTIFICAR_EVOLUCION',
      nueva._id
    );

    return res.redirect(
      303,
      `/clinica/pacientes/${pacienteId}/historia`
    );
  }


  // =====================================================
  // EXPORTAR MÉTODOS DEL CONTROLADOR
  // =====================================================

  return {
    mostrarFormulario,
    guardarEvolucion,
    mostrarRectificacion,
    guardarRectificacion
  };
}