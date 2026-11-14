import mongoose from 'mongoose';

import { Profesional } from '../models/Profesional.js';
import { Usuario } from '../models/Usuario.js';
import { Turno } from '../models/Turno.js';
import { HistoriaClinica } from '../models/HistoriaClinica.js';


// ============================================================
// UTILIDADES
// ============================================================

function errorHttp(mensaje, codigo = 400) {
  const error = new Error(mensaje);
  error.statusCode = codigo;
  return error;
}

function verificarId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw errorHttp(
      'ID de profesional inválido.',
      400
    );
  }
}


// ============================================================
// TRANSACCIONES SEGURAS DE MONGODB
// ============================================================

async function dentroTransaccion(operacion) {
  const sesion = await mongoose.startSession();

  try {
    let resultado;

    await sesion.withTransaction(async () => {
      resultado = await operacion(sesion);
    });

    return resultado;

  } finally {
    await sesion.endSession();
  }
}


// ============================================================
// VERIFICAR REGISTROS RELACIONADOS
//
// No eliminar:
// - Turnos existentes
// - Historias clínicas
// - Auditorías relacionadas
// ============================================================

async function impedirBorradoConHistorial(
  profesionalId,
  cuentasIds,
  sesion
) {
  const referenciasTurno = [
    { profesional_id: profesionalId }
  ];

  if (cuentasIds.length) {
    referenciasTurno.push(
      {
        creadoPor: {
          $in: cuentasIds
        }
      },
      {
        'historialEstados.modificadoPor': {
          $in: cuentasIds
        }
      },
      {
        'auditoria.realizadoPor': {
          $in: cuentasIds
        }
      },
      {
        'transferencia.verificadaPor': {
          $in: cuentasIds
        }
      }
    );
  }

  const turnos = await Turno.exists({
    $or: referenciasTurno
  }).session(sesion);

  if (turnos) {
    throw errorHttp(
      'Hay turnos o auditorías vinculadas. Usá Desactivar.',
      409
    );
  }

  if (cuentasIds.length) {
    const historias = await HistoriaClinica.exists({
      profesional_id: {
        $in: cuentasIds
      }
    }).session(sesion);

    if (historias) {
      throw errorHttp(
        'El profesional tiene historias clínicas. Usá Desactivar.',
        409
      );
    }
  }
}


// ============================================================
// 1. DESACTIVAR PROFESIONAL
//
// Conserva:
// - Perfil profesional
// - Turnos
// - Historias clínicas
// - Cuenta institucional
//
// Bloquea el acceso y nuevas reservas.
// ============================================================

export async function desactivarProfesionalSeguro(id) {
  verificarId(id);

  return dentroTransaccion(async sesion => {

    const profesional = await Profesional
      .findById(id)
      .session(sesion);

    if (!profesional) {
      throw errorHttp(
        'Profesional no encontrado.',
        404
      );
    }

    if (profesional.activo === false) {
      throw errorHttp(
        'El profesional ya está desactivado.',
        409
      );
    }

    await Profesional.updateOne(
      {
        _id: profesional._id
      },
      {
        $set: {
          activo: false,
          desactivadoEn: new Date()
        }
      },
      {
        session: sesion
      }
    );

    await Usuario.updateMany(
      {
        profesional_id: profesional._id,
        rol: 'profesional'
      },
      {
        $set: {
          suspendidoAdministrativamente: true
        }
      },
      {
        session: sesion
      }
    );

    return profesional;
  });
}


// ============================================================
// 2. REACTIVAR PROFESIONAL
//
// Recupera el perfil y habilita nuevamente su cuenta.
// No crea una cuenta institucional duplicada.
// ============================================================

export async function reactivarProfesionalSeguro(id) {
  verificarId(id);

  return dentroTransaccion(async sesion => {

    const profesional = await Profesional
      .findById(id)
      .session(sesion);

    if (!profesional) {
      throw errorHttp(
        'Profesional no encontrado.',
        404
      );
    }

    if (profesional.activo !== false) {
      throw errorHttp(
        'El profesional ya está activo.',
        409
      );
    }

    await Profesional.updateOne(
      {
        _id: profesional._id
      },
      {
        $set: {
          activo: true
        },
        $unset: {
          desactivadoEn: 1
        }
      },
      {
        session: sesion
      }
    );

    await Usuario.updateMany(
      {
        profesional_id: profesional._id,
        rol: 'profesional'
      },
      {
        $set: {
          suspendidoAdministrativamente: false
        }
      },
      {
        session: sesion
      }
    );

    return profesional;
  });
}


// ============================================================
// 3. ELIMINAR DEFINITIVAMENTE
//
// Elimina:
// - Perfil profesional
// - Cuenta institucional vinculada
//
// No elimina registros médicos ni turnos.
// Si existe historial, impide el borrado.
// ============================================================

export async function eliminarProfesionalSeguro(id) {
  verificarId(id);

  return dentroTransaccion(async sesion => {

    const profesional = await Profesional
      .findById(id)
      .session(sesion);

    if (!profesional) {
      throw errorHttp(
        'Profesional no encontrado.',
        404
      );
    }

    const cuentas = await Usuario.find({
      profesional_id: profesional._id,
      rol: 'profesional'
    })
      .select('_id')
      .session(sesion);

    // Detectar cuentas antiguas sin vínculo explícito.
    const cuentaAntiguaSinVinculo =
      await Usuario.exists({
        email: profesional.email,
        rol: 'profesional',
        $or: [
          {
            profesional_id: null
          },
          {
            profesional_id: {
              $exists: false
            }
          }
        ]
      }).session(sesion);

    if (cuentaAntiguaSinVinculo) {
      throw errorHttp(
        'Existe una cuenta antigua sin vínculo verificado. Revisala antes de eliminar.',
        409
      );
    }

    await impedirBorradoConHistorial(
      profesional._id,
      cuentas.map(cuenta => cuenta._id),
      sesion
    );

    const usuariosEliminados =
      await Usuario.deleteMany(
        {
          profesional_id: profesional._id,
          rol: 'profesional'
        },
        {
          session: sesion
        }
      );

    await Profesional.deleteOne(
      {
        _id: profesional._id
      },
      {
        session: sesion
      }
    );

    return {
      nombre: profesional.nombre,
      usuariosEliminados:
        usuariosEliminados.deletedCount || 0
    };
  });
}


// ============================================================
// 4. LIBERAR CORREO DE UNA CUENTA HUÉRFANA
//
// Para recuperar un Gmail que quedó ocupado cuando
// se eliminó el profesional pero no su usuario.
//
// Si no hay historial, elimina la cuenta huérfana.
//
// Si hay historial, archiva la identidad anterior
// y libera el correo particular.
// ============================================================

export async function liberarCorreoProfesionalHuerfano(
  correoPersonal
) {
  const email = String(correoPersonal || '')
    .trim()
    .toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    throw errorHttp(
      'Ingresá un correo particular válido.'
    );
  }

  return dentroTransaccion(async sesion => {

    const cuenta = await Usuario.findOne({
      email,
      rol: 'profesional'
    }).session(sesion);

    if (!cuenta) {
      throw errorHttp(
        'No encontramos una cuenta profesional con ese correo.',
        404
      );
    }

    if (!cuenta.profesional_id) {
      throw errorHttp(
        'La cuenta no tiene vínculo verificable. Requiere revisión manual.',
        409
      );
    }

    const profesionalExistente =
      await Profesional.exists({
        _id: cuenta.profesional_id
      }).session(sesion);

    if (profesionalExistente) {
      throw errorHttp(
        'El profesional todavía existe. Usá las opciones de su tarjeta.',
        409
      );
    }

    try {
      await impedirBorradoConHistorial(
        cuenta.profesional_id,
        [cuenta._id],
        sesion
      );

    } catch (error) {

      if (error.statusCode !== 409) {
        throw error;
      }

      // Existe historial: conservar la referencia,
      // pero liberar el correo para futuras pruebas.

      const nuevoEmail =
        `archivado-${cuenta._id}@turnoflex.internal`;

      const resultado = await Usuario.updateOne(
        {
          _id: cuenta._id,
          rol: 'profesional',
          email
        },
        {
          $set: {
            email: nuevoEmail,
            activo: false,
            suspendidoAdministrativamente: true
          },
          $unset: {
            activacionHash: 1,
            activacionHasta: 1
          }
        },
        {
          session: sesion
        }
      );

      if (resultado.modifiedCount !== 1) {
        throw errorHttp(
          'No se pudo archivar la cuenta huérfana.',
          409
        );
      }

      return {
        email,
        cuentaArchivada: true
      };
    }

    // No hay historial: eliminar la cuenta huérfana.
    const borrado = await Usuario.deleteOne(
      {
        _id: cuenta._id,
        rol: 'profesional',
        profesional_id: cuenta.profesional_id
      },
      {
        session: sesion
      }
    );

    if (borrado.deletedCount !== 1) {
      throw errorHttp(
        'No se pudo liberar el correo.',
        409
      );
    }

    return {
      email,
      cuentaArchivada: false
    };
  });
}