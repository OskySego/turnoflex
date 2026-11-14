import Nota from '../models/NotaClinica.js';
import Estudio from '../models/EstudioClinico.js';
import * as reglas from '../middlewares/politicasClinicas.js';

// ============================================================
// CONTROLADOR DE HISTORIA CLÍNICA
// ============================================================

// Armo el controlador usando inyección de dependencias. 
// Dejo que las rutas me pasen los modelos y las funciones de permisos 
// para no tener el código tan acoplado y que sea más fácil de testear.
export function crearHistoriaClinicaController({
  Cliente,
  lecturaAutorizada,
  auditar,
  resolverProfesionalId
}) {

  // Valido de entrada que no me falte ninguna pieza clave del rompecabezas
  if (
    !Cliente ||
    typeof lecturaAutorizada !== 'function' ||
    typeof auditar !== 'function' ||
    typeof resolverProfesionalId !== 'function'
  ) {
    throw new Error('Faltan dependencias del controlador de historia clínica.');
  }

  // Me armé esta funcioncita rápida para extraer el ID en formato string, 
  // ya sea que venga como un objeto complejo de Mongoose o como un texto suelto.
  const idDe = x => String(
    x && typeof x === 'object'
      ? x._id || x.id || ''
      : x || ''
  );

  // ==========================================================
  // VISUALIZAR LA HISTORIA CLÍNICA
  // ==========================================================

  async function verHistoria(req, res) {
    const { pacienteId } = req.params;
    const usuario = req.usuarioClinica;

    // Filtro de privacidad estricto: la secretaria (personal) solo puede subir estudios.
    // Si intenta entrar acá para leer diagnósticos médicos, la pateo de vuelta a 
    // la ficha normal del cliente para proteger los datos de salud.
    if (reglas.puedeSubirEstudio(usuario.rol)) {
      return res.redirect(302, '/clientes/' + pacienteId);
    }

    // Chequeo de permisos definitivo. Si la función me dice que no pasa, clavo un 403 prohibido.
    if (!(await lecturaAutorizada(req, pacienteId))) {
      return res.sendStatus(403);
    }

    // Traigo los datos básicos del paciente para mostrar en la cabecera de la vista
    const paciente = await Cliente.findById(pacienteId)
      .select('_id nombre dni')
      .lean();

    if (!paciente) {
      return res.sendStatus(404);
    }

    // Hago las dos búsquedas (notas de evolución y archivos de estudios) al mismo tiempo 
    // usando Promise.all para que la pantalla cargue mucho más rápido.
    const [notas, estudios] = await Promise.all([
      Nota.find({ pacienteId })
        .sort({ registradoEn: -1 })
        .lean(),
      Estudio.find({ pacienteId })
        .sort({ registradoEn: -1 })
        .lean()
    ]);

    // Dejo asentado en la base de datos exactamente quién y cuándo miró esta historia 
    // clínica para cubrirme legalmente y tener la trazabilidad.
    await auditar(req, pacienteId, 'CONSULTAR_HISTORIA');

    // Identifico si el usuario que está mirando la pantalla tiene rol de médico
    const esMedico = reglas.puedeEscribirEvolucion(usuario.rol);

    // Si es médico, resuelvo cuál es su ID exacto de profesional para después poder 
    // marcar visualmente cuáles evoluciones redactó él y cuáles son de otros colegas.
    const profesionalActualId = esMedico
      ? idDe(await resolverProfesionalId(usuario, req))
      : null;

    // Renderizo la vista mandándole toda la información bien masticada para que Pug la dibuje
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