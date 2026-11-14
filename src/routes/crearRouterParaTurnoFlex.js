/**
 * Fábrica adaptadora para inicializar el enrutador clínico conectado al core de TurnoFlex.
 * Inyecta los modelos de Mongoose (Cliente, Profesional, Turno, Usuario) y los adaptadores de identidad.
 */

import { Cliente } from '../models/Cliente.js';
import { Profesional } from '../models/Profesional.js';
import { Turno } from '../models/Turno.js';
import { Usuario } from '../models/Usuario.js';
import { crearRouterClinica } from './crearRouterClinica.js';
import { crearAdaptadoresIdentidad } from '../services/crearAdaptadoresIdentidad.js';

// ============================================================
// INICIALIZACIÓN DEL ROUTER CLÍNICO
// ============================================================

export function crearRouterParaTurnoFlex(opciones = {}) {
  // Conectamos los modelos reales de TurnoFlex y los adaptadores de identidad (excluyendo accesos sin vínculo)
  return crearRouterClinica({
    Cliente,
    Turno,
    directorioPrivado: opciones.directorioPrivado,
    ...crearAdaptadoresIdentidad({ Usuario, Cliente, Profesional })
  });
}