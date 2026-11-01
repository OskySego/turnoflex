// Estas reglas deben verificarse SIEMPRE en el servidor.
// El vínculo médico-turno y la titularidad del paciente se verifican aparte con BD.
const ROL_MEDICO = 'profesional';
const ROL_SECRETARIA = 'personal';
const ROL_PACIENTE = 'cliente';

function puedeSubirEstudio(rol) { return rol === ROL_SECRETARIA; }
function puedeEscribirEvolucion(rol) { return rol === ROL_MEDICO; }
function puedeConsultarHistoria(rol) { return rol === ROL_MEDICO || rol === ROL_PACIENTE; }
function puedeRevisarEstudio(rol) { return rol === ROL_MEDICO; }

export {
  ROL_MEDICO, ROL_SECRETARIA, ROL_PACIENTE,
  puedeSubirEstudio, puedeEscribirEvolucion,
  puedeConsultarHistoria, puedeRevisarEstudio
};