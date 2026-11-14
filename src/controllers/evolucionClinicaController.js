import Nota from '../models/NotaClinica.js';
import * as reglas from '../middlewares/politicasClinicas.js';

// ============================================================
// CONTROLADOR DE EVOLUCIONES CLÍNICAS
// ============================================================
// Este módulo me encarga de manejar la redacción de las evoluciones médicas.
// Uso inyección de dependencias para no repetir todo el código de permisos y auditoría.
// La regla de oro acá es la inmutabilidad: no dejo editar ni borrar historias clínicas, 
// solo permito agregar rectificaciones como anexo.

export function crearEvolucionClinicaController({
  medicoAutorizado,
  buscarPaciente,
  auditar
}) {

  // Chequeo de seguridad de arranque por si me olvido de inyectar alguna dependencia en las rutas
  if (
    typeof medicoAutorizado !== 'function' ||
    typeof buscarPaciente !== 'function' ||
    typeof auditar !== 'function'
  ) {
    throw new Error('Faltan dependencias del controlador de evoluciones.');
  }


  // ==========================================================
  // FUNCIONES AUXILIARES INTERNAS
  // ==========================================================

  // Me armo esto para limpiar y estandarizar los IDs que me llegan de Mongoose o de la sesión
  const idDe = valor => String(
    valor && typeof valor === 'object'
      ? valor._id || valor.id || ''
      : valor || ''
  );

  // Valido rápido con Regex que no me inyecten basura en las URLs
  const esId = valor =>
    /^[0-9a-fA-F]{24}$/.test(String(valor || ''));

  // Trunco los textos gigantes por seguridad para no colapsar la base de datos
  const texto = (valor, max) =>
    String(valor || '').trim().slice(0, max);

  // Reviso rápido si el usuario en sesión es un médico
  const esMedico = req =>
    reglas.puedeEscribirEvolucion(req.usuarioClinica?.rol);


  // =====================================================
  // 1. MOSTRAR FORMULARIO DE EVOLUCIÓN
  // =====================================================

  async function mostrarFormulario(req, res) {
    const { pacienteId } = req.params;
    const turnoId = req.query.turnoId;

    // Antes de renderizarle la pantalla al usuario, le pregunto a mi dependencia de seguridad
    // si este médico en particular tiene permiso para escribir sobre este turno.
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
  // 2. GUARDAR EVOLUCIÓN MÉDICA (POST)
  // =====================================================

  async function guardarEvolucion(req, res) {
    const { pacienteId } = req.params;
    const turnoId = req.body.turnoId;

    // Vuelvo a chequear los permisos antes de tocar la base de datos (doble barrera)
    const autorizacion = await medicoAutorizado(
      req,
      pacienteId,
      turnoId,
      { paraEscritura: true }
    );

    if (!autorizacion) {
      return res.sendStatus(403);
    }

    const motivoConsulta = texto(req.body.motivoConsulta, 2000);

    // No dejo grabar si me mandan la evolución vacía
    if (!motivoConsulta) {
      return res.status(400).send('El motivo de consulta es obligatorio.');
    }

    // Impacto en MongoDB el nuevo documento. Trunco todos los campos por seguridad.
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

    // Dejo asentado en el log de auditoría quién hizo esta operación
    await auditar(req, pacienteId, 'CREAR_EVOLUCION', nota._id);

    // Lo pateo de vuelta a la historia clínica para que vea lo que acaba de guardar
    return res.redirect(303, `/clinica/pacientes/${pacienteId}/historia`);
  }


  // =====================================================
  // 3. MIDDLEWARE INTERNO: CHEQUEO DE RECTIFICACIÓN
  // =====================================================
  // Centralizo esta validación porque la voy a usar tanto para abrir el form 
  // de rectificación como para procesar el guardado.
  // Regla de oro: solo podés rectificar lo que vos mismo escribiste.

  async function obtenerRectificacionAutorizada(req, res) {
    const { pacienteId, notaId } = req.params;

    if (!esId(notaId) || !esMedico(req)) {
      res.sendStatus(403);
      return null;
    }

    // Busco la nota original que vamos a rectificar
    const anterior = await Nota.findOne({
      _id: notaId,
      pacienteId
    }).lean();

    if (!anterior) {
      res.sendStatus(404);
      return null;
    }

    // Verifico autorización actual para ese turno
    const autorizacion = await medicoAutorizado(
      req,
      pacienteId,
      anterior.turnoId,
      { paraEscritura: true }
    );

    // Acá está la magia: me aseguro que el ID del médico y el ID del usuario en sesión 
    // sean exactamente los mismos que los que redactaron la nota original.
    // Ningún otro colega puede pisarte tus notas.
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
    // Paso por el filtro estricto que armé arriba
    const resultado = await obtenerRectificacionAutorizada(req, res);

    if (!resultado) return; // Si rebotó, la función ya se encargó de mandar el error HTTP

    const paciente = await buscarPaciente(req.params.pacienteId);

    if (!paciente) {
      return res.sendStatus(404);
    }

    // Le renderizo el formulario mandándole la info de la nota anterior 
    // para que el médico no tenga que reescribir todo de cero.
    return res.render('clinica/rectificacion-nueva', {
      user: req.usuarioClinica,
      paciente,
      anterior: resultado.anterior,
      tituloPage: 'Rectificar una evolución'
    });
  }


  // =====================================================
  // 5. GUARDAR RECTIFICACIÓN (POST)
  // =====================================================

  async function guardarRectificacion(req, res) {
    // Doble chequeo de seguridad antes de grabar
    const resultado = await obtenerRectificacionAutorizada(req, res);

    if (!resultado) return;

    const { pacienteId } = req.params;
    const { anterior, autorizacion } = resultado;

    const motivoRectificacion = texto(req.body.motivoRectificacion, 1000);
    const motivoConsulta = texto(req.body.motivoConsulta, 2000);

    // Exijo un motivo claro de por qué está corrigiendo un documento médico
    if (!motivoRectificacion || !motivoConsulta) {
      return res.status(400).send('Indicar motivo de rectificación y contenido corregido.');
    }

    // Guardo un DOCUMENTO NUEVO. Por diseño de la arquitectura (Inmutabilidad), 
    // JAMÁS le hacemos un `Update` a la nota original. Creamos una nueva vinculándola 
    // mediante el campo `rectificaNotaId`.
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

    await auditar(req, pacienteId, 'RECTIFICAR_EVOLUCION', nueva._id);

    return res.redirect(303, `/clinica/pacientes/${pacienteId}/historia`);
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