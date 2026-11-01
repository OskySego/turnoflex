import mongoose from 'mongoose';

import { Cliente } from '../models/Cliente.js';
import { RelacionFamiliar } from '../models/RelacionFamiliar.js';


// ============================================================
// PARENTESCOS PERMITIDOS
// ============================================================

const PARENTESCOS_PERMITIDOS = [
  'padre',
  'madre',
  'hijo/a',
  'pareja',
  'esposo/a',
  'hermano/a',
  'abuelo/a',
  'nieto/a',
  'tío/a',
  'sobrino/a',
  'tutor/a',
  'persona a cargo',
  'otro familiar'
];


// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function crearError(mensaje, statusCode = 400) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}


function validarObjectId(id, nombreCampo = 'ID') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw crearError(`${nombreCampo} inválido.`, 400);
  }
}


function obtenerUsuarioId(req) {
  const id =
    req.session?.usuario?.id ||
    req.session?.usuario?._id ||
    null;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return id;
}


function generarClaveRelacion(idA, idB) {
  return [idA.toString(), idB.toString()]
    .sort()
    .join('_');
}


// Evita que caracteres especiales rompan la búsqueda.
function escaparRegex(texto = '') {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// ============================================================
// RELACIÓN INVERSA
//
// Ejemplo:
//
// Oscar -> Juan = hijo/a
// Juan  -> Oscar = padre
// ============================================================

function obtenerParentescoInverso(
  parentesco,
  generoFamiliar = ''
) {
  const genero =
    String(generoFamiliar)
      .trim()
      .toLowerCase();

  switch (parentesco) {

    case 'padre':
    case 'madre':
      return 'hijo/a';

    case 'hijo/a':

      if (genero === 'masculino') {
        return 'padre';
      }

      if (genero === 'femenino') {
        return 'madre';
      }

      return 'otro familiar';

    case 'pareja':
      return 'pareja';

    case 'esposo/a':
      return 'esposo/a';

    case 'hermano/a':
      return 'hermano/a';

    case 'abuelo/a':
      return 'nieto/a';

    case 'nieto/a':
      return 'abuelo/a';

    case 'tío/a':
      return 'sobrino/a';

    case 'sobrino/a':
      return 'tío/a';

    case 'tutor/a':
      return 'persona a cargo';

    case 'persona a cargo':
      return 'tutor/a';

    default:
      return 'otro familiar';
  }
}


// ============================================================
// CREAR O REACTIVAR RELACIÓN
// ============================================================

async function crearOActualizarRelacion({
  pacientePrincipal,
  familiar,
  parentesco,
  parentescoInverso,
  creadoPor
}) {

  if (!PARENTESCOS_PERMITIDOS.includes(parentesco)) {
    throw crearError(
      'Seleccioná un parentesco válido.',
      400
    );
  }


  let relacionInversa =
    parentescoInverso;


  // Si no viene indicada desde el formulario,
  // TurnoFlex intenta calcularla automáticamente.
  if (
    !relacionInversa ||
    !PARENTESCOS_PERMITIDOS.includes(relacionInversa)
  ) {

    relacionInversa =
      obtenerParentescoInverso(
        parentesco,
        familiar.genero
      );
  }


  const idPrincipal =
    pacientePrincipal._id.toString();

  const idFamiliar =
    familiar._id.toString();


  if (idPrincipal === idFamiliar) {

    throw crearError(
      'Un paciente no puede asociarse como familiar de sí mismo.',
      400
    );

  }


  const claveRelacion =
    generarClaveRelacion(
      idPrincipal,
      idFamiliar
    );


  // ==========================================================
  // ¿YA EXISTE?
  // ==========================================================

  const existente =
    await RelacionFamiliar.findOne({
      claveRelacion
    });


  if (existente) {

    const principalEsA =
      existente.pacienteA.toString() ===
      idPrincipal;


    if (principalEsA) {

      existente.parentescoAConB =
        parentesco;

      existente.parentescoBConA =
        relacionInversa;

    } else {

      existente.parentescoBConA =
        parentesco;

      existente.parentescoAConB =
        relacionInversa;

    }


    existente.activo =
      true;

    existente.creadoPor =
      creadoPor;


    await existente.save();


    return {
      relacion: existente,
      reactivada: true
    };

  }


  // ==========================================================
  // NUEVA RELACIÓN
  // ==========================================================

  const nuevaRelacion =
    await RelacionFamiliar.create({

      pacienteA:
        pacientePrincipal._id,

      pacienteB:
        familiar._id,

      parentescoAConB:
        parentesco,

      parentescoBConA:
        relacionInversa,

      claveRelacion,

      activo:
        true,

      creadoPor

    });


  return {
    relacion: nuevaRelacion,
    reactivada: false
  };
}


// ============================================================
// CONTROLADOR
// ============================================================

export class RelacionFamiliarController {


  // ==========================================================
  // 1. OBTENER FAMILIARES DE UN PACIENTE
  // ==========================================================

  static async obtenerFamiliares(req, res) {

    const { id } =
      req.params;


    validarObjectId(
      id,
      'ID del paciente'
    );


    const paciente =
      await Cliente
        .findById(id)
        .lean();


    if (!paciente) {

      throw crearError(
        'El paciente solicitado no existe.',
        404
      );

    }


    const relaciones =
      await RelacionFamiliar
        .find({
          activo: true,

          $or: [
            { pacienteA: id },
            { pacienteB: id }
          ]
        })

        .populate(
          'pacienteA',
          'nombre dni fechaNacimiento genero telefono email obraSocial'
        )

        .populate(
          'pacienteB',
          'nombre dni fechaNacimiento genero telefono email obraSocial'
        )

        .sort({
          createdAt: 1
        })

        .lean();


    // Convertimos la relación técnica en algo fácil
    // de utilizar desde la vista.
    const familiares =
      relaciones.map(function (relacion) {

        const pacienteActualEsA =
          relacion.pacienteA &&
          relacion.pacienteA._id.toString() ===
            id.toString();


        const familiar =
          pacienteActualEsA
            ? relacion.pacienteB
            : relacion.pacienteA;


        const parentesco =
          pacienteActualEsA
            ? relacion.parentescoAConB
            : relacion.parentescoBConA;


        return {

          relacionId:
            relacion._id,

          parentesco,

          paciente:
            familiar,

          creado:
            relacion.createdAt

        };

      });


    return res.status(200).json({

      status:
        'success',

      paciente: {
        _id: paciente._id,
        nombre: paciente.nombre,
        dni: paciente.dni
      },

      total:
        familiares.length,

      familiares

    });
  }


  // ==========================================================
  // 2. BUSCAR PACIENTES PARA ASOCIAR
  // ==========================================================

  static async buscarPacientes(req, res) {

    const { id } =
      req.params;

    const texto =
      String(req.query.q || '')
        .trim();


    validarObjectId(
      id,
      'ID del paciente'
    );


    // No hacemos búsquedas enormes con un campo vacío.
    if (texto.length < 2) {

      return res.status(200).json({

        status:
          'success',

        data:
          []

      });

    }


    const regex =
      new RegExp(
        escaparRegex(texto),
        'i'
      );


    const pacientes =
      await Cliente
        .find({

          _id: {
            $ne: id
          },

          $or: [

            {
              nombre:
                regex
            },

            {
              dni:
                regex
            },

            {
              email:
                regex
            }

          ]

        })

        .select(
          'nombre dni genero email telefono obraSocial'
        )

        .sort({
          nombre: 1
        })

        .limit(20)

        .lean();


    return res.status(200).json({

      status:
        'success',

      data:
        pacientes

    });
  }


  // ==========================================================
  // 3. ASOCIAR UN PACIENTE YA EXISTENTE
  // ==========================================================

  static async asociarExistente(req, res) {

    const { id } =
      req.params;


    const {
      familiarId,
      parentesco,
      parentescoInverso
    } = req.body;


    validarObjectId(
      id,
      'ID del paciente'
    );


    validarObjectId(
      familiarId,
      'ID del familiar'
    );


    const [
      pacientePrincipal,
      familiar
    ] = await Promise.all([

      Cliente.findById(id),

      Cliente.findById(familiarId)

    ]);


    if (!pacientePrincipal) {

      throw crearError(
        'El paciente principal no existe.',
        404
      );

    }


    if (!familiar) {

      throw crearError(
        'El familiar seleccionado no existe.',
        404
      );

    }


    const resultado =
      await crearOActualizarRelacion({

        pacientePrincipal,

        familiar,

        parentesco,

        parentescoInverso,

        creadoPor:
          obtenerUsuarioId(req)

      });


    // Si más adelante usamos esta ruta desde JavaScript,
    // también puede responder JSON.
    if (
      req.accepts('json') &&
      !req.accepts('html')
    ) {

      return res.status(200).json({

        status:
          'success',

        message:
          resultado.reactivada
            ? 'La relación familiar fue actualizada correctamente.'
            : 'El familiar fue asociado correctamente.',

        data:
          resultado.relacion

      });

    }


    return res.redirect(
      `/clientes/${id}?familia=asociada`
    );
  }


  // ==========================================================
  // 4. REGISTRAR NUEVO PACIENTE Y ASOCIARLO
  // ==========================================================

  static async registrarYAsociar(req, res) {

    const { id } =
      req.params;


    validarObjectId(
      id,
      'ID del paciente'
    );


    const pacientePrincipal =
      await Cliente.findById(id);


    if (!pacientePrincipal) {

      throw crearError(
        'El paciente principal no existe.',
        404
      );

    }


    const {

      nombre,
      dni,
      fechaNacimiento,
      genero,
      telefono,
      email,

      calle,
      numero,
      localidad,
      provincia,

      empresa,
      numeroAfiliado,
      plan,

      parentesco,
      parentescoInverso

    } = req.body;


    // ========================================================
    // CAMPOS OBLIGATORIOS
    // ========================================================

    if (
      !nombre ||
      !dni ||
      !telefono ||
      !email ||
      !parentesco
    ) {

      throw crearError(
        'Completá nombre, DNI, teléfono, email y parentesco.',
        400
      );

    }


    // ========================================================
    // EVITAR PACIENTES DUPLICADOS
    // ========================================================

    const pacienteExistente =
      await Cliente.findOne({
        dni: String(dni).trim()
      });


    if (pacienteExistente) {

      const error =
        crearError(
          'Ya existe un paciente con ese DNI. En lugar de registrarlo nuevamente, utilizá "Asociar paciente existente".',
          409
        );

      error.pacienteExistenteId =
        pacienteExistente._id;

      throw error;

    }


    let nuevoFamiliar =
      null;


    try {

      // ======================================================
      // CREAR PACIENTE
      // ======================================================

      nuevoFamiliar =
        await Cliente.create({

          nombre:
            String(nombre).trim(),

          dni:
            String(dni).trim(),

          fechaNacimiento:
            fechaNacimiento || undefined,

          genero:
            genero || '',

          telefono:
            String(telefono).trim(),

          email:
            String(email).trim().toLowerCase(),

          domicilio: {

            calle:
              calle || '',

            numero:
              numero || '',

            localidad:
              localidad || '',

            provincia:
              provincia || ''

          },

          obraSocial: {

            empresa:
              empresa || '',

            numeroAfiliado:
              numeroAfiliado || '',

            plan:
              plan || ''

          }

        });


      // ======================================================
      // ASOCIAR AUTOMÁTICAMENTE
      // ======================================================

      await crearOActualizarRelacion({

        pacientePrincipal,

        familiar:
          nuevoFamiliar,

        parentesco,

        parentescoInverso,

        creadoPor:
          obtenerUsuarioId(req)

      });


    } catch (error) {

      // Si se creó el nuevo paciente pero falló la relación,
      // eliminamos ese registro para no dejar un alta incompleta.
      if (nuevoFamiliar) {

        await Cliente.findByIdAndDelete(
          nuevoFamiliar._id
        );

      }


      throw error;
    }


    if (
      req.accepts('json') &&
      !req.accepts('html')
    ) {

      return res.status(201).json({

        status:
          'success',

        message:
          'El familiar fue registrado y asociado correctamente.',

        data:
          nuevoFamiliar

      });

    }


    return res.redirect(
      `/clientes/${id}?familia=creada`
    );
  }


  // ==========================================================
  // 5. DESVINCULAR FAMILIAR
  //
  // No eliminamos físicamente la relación.
  // La dejamos inactiva para conservar trazabilidad.
  // ==========================================================

  static async desasociar(req, res) {

    const {
      id,
      relacionId
    } = req.params;


    validarObjectId(
      id,
      'ID del paciente'
    );


    validarObjectId(
      relacionId,
      'ID de la relación'
    );


    const relacion =
      await RelacionFamiliar.findById(
        relacionId
      );


    if (!relacion) {

      throw crearError(
        'La relación familiar no existe.',
        404
      );

    }


    const perteneceAlPaciente =
      relacion.pacienteA.toString() ===
        id.toString() ||
      relacion.pacienteB.toString() ===
        id.toString();


    if (!perteneceAlPaciente) {

      throw crearError(
        'La relación indicada no pertenece a este paciente.',
        403
      );

    }


    relacion.activo =
      false;


    await relacion.save();


    if (
      req.accepts('json') &&
      !req.accepts('html')
    ) {

      return res.status(200).json({

        status:
          'success',

        message:
          'La relación familiar fue desvinculada correctamente.'

      });

    }


    return res.redirect(
      `/clientes/${id}?familia=desvinculada`
    );
  }
}


export default RelacionFamiliarController;