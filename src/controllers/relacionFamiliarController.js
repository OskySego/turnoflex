import mongoose from 'mongoose';

import { Cliente } from '../models/Cliente.js';
import { RelacionFamiliar } from '../models/RelacionFamiliar.js';


// ============================================================
// PARENTESCOS PERMITIDOS
// ============================================================

// Defino la lista exacta de parentescos que aceptamos en el sistema 
// para evitar que ingresen cualquier texto.
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

// Armo un helper rápido para estandarizar los errores que le mando al usuario
function crearError(mensaje, statusCode = 400) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}


// Me aseguro de que los IDs sean de MongoDB válidos antes de hacer consultas locas
function validarObjectId(id, nombreCampo = 'ID') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw crearError(`${nombreCampo} inválido.`, 400);
  }
}


// Agarro el ID del usuario desde la sesión para guardar quién armó la relación
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


// Creo un ID único y ordenado alfabéticamente para que no importe 
// quién es el paciente A y quién es el B (Oscar_Juan es lo mismo que Juan_Oscar)
function generarClaveRelacion(idA, idB) {
  return [idA.toString(), idB.toString()]
    .sort()
    .join('_');
}


// Limpio el texto antes de tirarlo a una búsqueda con RegExp para evitar que nos inyecten caracteres raros
function escaparRegex(texto = '') {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// ============================================================
// RELACIÓN INVERSA
// ============================================================

// Si el usuario me dice que Juan es el "padre" de Oscar,
// automáticamente deduzco que Oscar es el "hijo/a" de Juan.
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
// CREAR O REACTIVAR RELACIÓN (Función Central)
// ============================================================

async function crearOActualizarRelacion({
  pacientePrincipal,
  familiar,
  parentesco,
  parentescoInverso,
  creadoPor
}) {

  // Valido que no nos estén mandando fruta
  if (!PARENTESCOS_PERMITIDOS.includes(parentesco)) {
    throw crearError(
      'Seleccioná un parentesco válido.',
      400
    );
  }


  let relacionInversa =
    parentescoInverso;


  // Si la vista no me mandó la relación inversa, uso la función que armé arriba para calcularla sola
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


  // Obvio, no podés ser familiar de vos mismo
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
  // BUSCO SI YA ESTABAN VINCULADOS ANTES
  // ==========================================================

  const existente =
    await RelacionFamiliar.findOne({
      claveRelacion
    });


  // Si ya existía (por ahí la habían desactivado), la reciclo y le actualizo los datos 
  // para no llenar la base de datos de basura.
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
  // COMO NO EXISTE, CREO UNA RELACIÓN NUEVA
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


    // Traigo todas las relaciones activas donde este paciente sea el A o el B
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


    // Proceso el array para que la vista reciba un formato fácil de leer,
    // donde siempre vea a la otra persona como "el familiar".
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
  // 2. BUSCAR PACIENTES PARA ASOCIAR (Buscador Autocomplete)
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


    // Corto la ejecución si tipearon muy poco, no voy a escanear toda la DB por 1 letra.
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


    // Busco por nombre, dni o email y excluyo al propio paciente
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
  // 3. ASOCIAR UN PACIENTE QUE YA EXISTE EN EL SISTEMA
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


    // Los pido a los dos al mismo tiempo para ganar rendimiento
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


    // Uso la función gigante que armé arriba para procesarlo
    const resultado =
      await crearOActualizarRelacion({

        pacientePrincipal,

        familiar,

        parentesco,

        parentescoInverso,

        creadoPor:
          obtenerUsuarioId(req)

      });


    // Soporto respuestas JSON por si después pego el frontend con AJAX
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
  // 4. CREAR A LA PERSONA DESDE CERO Y ASOCIARLA
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
    // CHEQUEOS DE SEGURIDAD BÁSICOS
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


    const pacienteExistente =
      await Cliente.findOne({
        dni: String(dni).trim()
      });


    // Freno si el paciente ya existe para evitar fichas duplicadas.
    // Le digo al usuario que use el otro método.
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

      // Primero creo la ficha completa
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


      // Ahora vinculo la nueva ficha con el paciente principal
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

      // IMPORTANTE: Si la ficha se creó pero falló la relación, 
      // borro el perfil nuevo a mano (Rollback) para no dejar basura suelta en la DB.
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


    // Me aseguro de que el usuario no esté intentando borrar una relación ajena modificando el ID
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


    // Hago un borrado lógico (la oculto) en vez de borrarla de verdad, 
    // así mantengo el historial de la clínica intacto por cuestiones legales.
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