import { Turno } from '../models/Turno.js';

// Defino la zona horaria fija para evitar desfases con el servidor
const ZONA = 'America/Argentina/Buenos_Aires';

// ============================================================
// FUNCIONES AUXILIARES (Las armé para formatear datos rápido)
// ============================================================

// Saco la fecha de hoy en formato YYYY-MM-DD respetando nuestro huso horario local
function obtenerFechaArgentina() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const dato = tipo =>
    partes.find(p => p.type === tipo)?.value || '';

  return `${dato('year')}-${dato('month')}-${dato('day')}`;
}

// Extraigo solo la palabra "Consultorio" y el número de la sede asignada al profesional
function obtenerConsultorio(sede) {
  const texto = String(sede || '').trim();

  const coincidencia = texto.match(
    /consultorio\s*[-#:]?\s*\w+/i
  );

  return coincidencia
    ? coincidencia[0].replace(
        /^consultorio/i,
        'Consultorio'
      )
    : 'Consultorio no asignado';
}

// Formateo la hora para que se vea bien en la pantalla de la clínica (HH:MM)
function obtenerHora(fecha) {
  if (!fecha) return '--:--';

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(fecha));
}

// ============================================================
// CONTROLADOR PRINCIPAL: ÚLTIMOS LLAMADOS PARA SALA DE ESPERA
// ============================================================

export async function getUltimosLlamadosSalaEspera(req, res) {
  try {
    // Bloqueo el acceso por las dudas. Como la sala muestra nombres de pacientes, 
    // me aseguro de que solo puedan entrar los de administración y recepción.
    const rol = req.session?.usuario?.rol;

    if (!['admin', 'personal'].includes(rol)) {
      return res.status(403).json({
        error: 'Acceso no autorizado.'
      });
    }

    const hoy = obtenerFechaArgentina();

    // Busco en la base de datos los turnos de hoy que ya fueron llamados a sala y descarto los cancelados
    const turnos = await Turno.find({
      fecha: hoy,

      ultimoLlamadoSalaEn: {
        $exists: true,
        $ne: null
      },

      estado: { $ne: 'cancelado' }
    })
      .select(
        'cliente_id profesional_id ultimoLlamadoSalaEn estado'
      )
      .populate('cliente_id', 'nombre')
      .populate('profesional_id', 'nombre sede')
      .sort({
        ultimoLlamadoSalaEn: -1,
        _id: -1
      })
      .limit(5)
      .lean();

    // Mapeo los datos crudos para mandarlos bien limpios al frontend de la pantalla
    const ultimosLlamados = turnos.map(turno => ({
      turnoId: String(turno._id),

      paciente: String(
        turno.cliente_id?.nombre || 'Paciente'
      ),

      profesional: String(
        turno.profesional_id?.nombre || ''
      ),

      consultorio: obtenerConsultorio(
        turno.profesional_id?.sede
      ),

      hora: obtenerHora(
        turno.ultimoLlamadoSalaEn
      ),

      // Si el médico ya lo marcó como atendido, muestro "Atendido", sino sigue como "Llamado"
      estado: turno.estado === 'atendido'
        ? 'Atendido'
        : 'Llamado'
    }));

    // Evito que el navegador cachee esta respuesta porque necesito que la sala se actualice en tiempo real
    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      fecha: hoy,
      ultimosLlamados
    });

  } catch (error) {
    console.error(
      'Error al obtener últimos llamados:',
      error
    );

    return res.status(500).json({
      error: 'No fue posible consultar los últimos llamados.'
    });
  }
}