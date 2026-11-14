/**
 * Fábrica de adaptadores e identidad para el módulo clínico de TurnoFlex.
 * Depende exclusivamente de modelos inyectados. Nota clave: no se acepta ninguna
 * asociación inferida por nombre, email ni DNI para garantizar la seguridad estricta de los datos.
 */

// ============================================================
// HELPER: CONVERSIÓN SEGURA DE IDENTIFICADORES
// ============================================================

const id = x => String(x?._id || x || '');

// ============================================================
// FÁBRICA PRINCIPAL DE ADAPTADORES
// ============================================================

export function crearAdaptadoresIdentidad({ Usuario, Cliente, Profesional }) {
  // Validamos que los modelos requeridos hayan sido inyectados correctamente
  if (!Usuario || !Cliente || !Profesional) throw new Error('Faltan modelos de identidad.');

  return {
    // ========================================================
    // OBTENER USUARIO AUTORIZADO
    // ========================================================
    async obtenerUsuarioAutorizado(usuarioId) {
      return Usuario.findById(usuarioId)
        .select('_id nombre rol cliente_id profesional_id')
        .lean();
    },

    // ========================================================
    // RESOLVER ID DE PROFESIONAL
    // ========================================================
    async resolverProfesionalId(usuario) {
      if (usuario?.rol !== 'profesional' || !usuario.profesional_id) return null;
      const encontrado = await Profesional.exists({ _id: usuario.profesional_id });
      return encontrado ? id(usuario.profesional_id) : null;
    },

    // ========================================================
    // RESOLVER ID DE PACIENTE
    // ========================================================
    async resolverPacienteId(usuario) {
      if (usuario?.rol !== 'cliente' || !usuario.cliente_id) return null;
      const encontrado = await Cliente.exists({ _id: usuario.cliente_id });
      return encontrado ? id(usuario.cliente_id) : null;
    },

    // ========================================================
    // VERIFICAR TITULARIDAD DEL PACIENTE
    // ========================================================
    async esPacienteTitular({ usuario, pacienteId }) {
      if (usuario?.rol !== 'cliente' || !usuario.cliente_id || id(usuario.cliente_id) !== id(pacienteId)) return false;
      return Boolean(await Cliente.exists({ _id: usuario.cliente_id }));
    }
  };
}