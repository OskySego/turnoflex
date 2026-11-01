import { Cliente } from '../models/Cliente.js';
import { Profesional } from '../models/Profesional.js';
import { Turno } from '../models/Turno.js';
import { Usuario } from '../models/Usuario.js';
import { crearRouterClinica } from './crearRouterClinica.js';
import { crearAdaptadoresIdentidad } from '../services/crearAdaptadoresIdentidad.js';

/**
 * Adaptador de identidad compatible con los modelos reales suministrados.
 * Los usuarios sin vínculo persistido quedan excluidos del acceso clínico.
 */
export function crearRouterParaTurnoFlex(opciones = {}) {
  return crearRouterClinica({
    Cliente,
    Turno,
    directorioPrivado: opciones.directorioPrivado,
    ...crearAdaptadoresIdentidad({ Usuario, Cliente, Profesional })
  });
}