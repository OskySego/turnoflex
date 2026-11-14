/**
 * Reglas base de autorización por rol para el Módulo Clínico.
 * Estas políticas se validan siempre del lado del servidor; la relación médico-turno y la titularidad se chequean aparte contra la BD.
 */

// ============================================================
// CONSTANTES DE ROLES DEL SISTEMA
// ============================================================

const ROL_MEDICO = 'profesional';
const ROL_SECRETARIA = 'personal';
const ROL_PACIENTE = 'cliente';

// ============================================================
// POLÍTICAS DE ACCESO Y PERMISOS POR ACCIÓN
// ============================================================

// Solo secretaría o personal administrativo puede adjuntar estudios nuevos
function puedeSubirEstudio(rol) { return rol === ROL_SECRETARIA; }

// Únicamente el profesional médico puede registrar evoluciones clínicas
function puedeEscribirEvolucion(rol) { return rol === ROL_MEDICO; }

// La historia clínica es accesible solo para el profesional médico o el propio paciente
function puedeConsultarHistoria(rol) { return rol === ROL_MEDICO || rol === ROL_PACIENTE; }

// Solo el médico tiene permisos para revisar y validar estudios cargados
function puedeRevisarEstudio(rol) { return rol === ROL_MEDICO; }

// ============================================================
// EXPORTACIÓN DE CONSTANTES Y REGLAS
// ============================================================

export {
  ROL_MEDICO, ROL_SECRETARIA, ROL_PACIENTE,
  puedeSubirEstudio, puedeEscribirEvolucion,
  puedeConsultarHistoria, puedeRevisarEstudio
};