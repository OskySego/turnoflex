/**
 * Fábrica de vínculos clínicos: depende únicamente de modelos inyectados.
 * Importante: no se acepta ninguna asociación inferida por nombre, email ni DNI.
 */
const id = x => String(x?._id || x || '');

export function crearAdaptadoresIdentidad({ Usuario, Cliente, Profesional }) {
  if (!Usuario || !Cliente || !Profesional) throw new Error('Faltan modelos de identidad.');
  return {
    async obtenerUsuarioAutorizado(usuarioId) {
      return Usuario.findById(usuarioId)
        .select('_id nombre rol cliente_id profesional_id')
        .lean();
    },
    async resolverProfesionalId(usuario) {
      if (usuario?.rol !== 'profesional' || !usuario.profesional_id) return null;
      const encontrado = await Profesional.exists({ _id: usuario.profesional_id });
      return encontrado ? id(usuario.profesional_id) : null;
    },
    async resolverPacienteId(usuario) {
      if (usuario?.rol !== 'cliente' || !usuario.cliente_id) return null;
      const encontrado = await Cliente.exists({ _id: usuario.cliente_id });
      return encontrado ? id(usuario.cliente_id) : null;
    },
    async esPacienteTitular({ usuario, pacienteId }) {
      if (usuario?.rol !== 'cliente' || !usuario.cliente_id || id(usuario.cliente_id) !== id(pacienteId)) return false;
      return Boolean(await Cliente.exists({ _id: usuario.cliente_id }));
    }
  };
}