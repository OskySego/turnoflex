import Nota from '../models/NotaClinica.js';
import Estudio from '../models/EstudioClinico.js';
import * as reglas from '../middlewares/politicasClinicas.js';

/**
 * Controlador responsable de visualizar la historia clínica.
 * Los permisos y la auditoría se inyectan desde el módulo de rutas.
 * No modifica turnos, datos clínicos ni archivos.
 */
export function crearHistoriaClinicaController({
  Cliente,
  lecturaAutorizada,
  auditar,
  resolverProfesionalId
}) {
  if (
    !Cliente ||
    typeof lecturaAutorizada !== 'function' ||
    typeof auditar !== 'function' ||
    typeof resolverProfesionalId !== 'function'
  ) {
    throw new Error('Faltan dependencias del controlador de historia clínica.');
  }

  const idDe = x => String(
    x && typeof x === 'object'
      ? x._id || x.id || ''
      : x || ''
  );

  async function verHistoria(req, res) {
    const { pacienteId } = req.params;
    const usuario = req.usuarioClinica;

    // Recepción no puede leer diagnósticos ni evoluciones.
    if (reglas.puedeSubirEstudio(usuario.rol)) {
      return res.redirect(302, '/clientes/' + pacienteId);
    }

    if (!(await lecturaAutorizada(req, pacienteId))) {
      return res.sendStatus(403);
    }

    const paciente = await Cliente.findById(pacienteId)
      .select('_id nombre dni')
      .lean();

    if (!paciente) {
      return res.sendStatus(404);
    }

    const [notas, estudios] = await Promise.all([
      Nota.find({ pacienteId })
        .sort({ registradoEn: -1 })
        .lean(),
      Estudio.find({ pacienteId })
        .sort({ registradoEn: -1 })
        .lean()
    ]);

    await auditar(req, pacienteId, 'CONSULTAR_HISTORIA');

    const esMedico = reglas.puedeEscribirEvolucion(usuario.rol);

    const profesionalActualId = esMedico
      ? idDe(await resolverProfesionalId(usuario, req))
      : null;

    return res.render('clinica/historia', {
      user: usuario,
      paciente,
      notas,
      estudios,
      esMedico,
      esPaciente: usuario.rol === reglas.ROL_PACIENTE,
      profesionalActualId,
      usuarioClinicoId: idDe(usuario),
      tituloPage: 'Historia clínica'
    });
  }

  return { verHistoria };
}