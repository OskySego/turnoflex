import mongoose from 'mongoose';
import { randomBytes, timingSafeEqual } from 'node:crypto';

import { Turno } from '../models/Turno.js';
import { Cliente } from '../models/Cliente.js';
import { Profesional } from '../models/Profesional.js';
import { Especialidad } from '../models/Especialidad.js';
import { sincronizarPagoMercadoPago } from './mercadoPagoWebhookController.js';

import {
  MercadoPagoConfig,
  Preference
} from 'mercadopago';


// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function crearError(
  mensaje,
  statusCode = 500
) {

  const error =
    new Error(mensaje);

  error.statusCode =
    statusCode;

  return error;

}


// ============================================================
// MERCADO PAGO CHECKOUT PRO: URLS DE RETORNO
// ============================================================
// El checkout es externo. Nunca se marca un turno como pagado
// por el solo regreso del navegador; la confirmación exige
// validar el pago desde el webhook en el servidor.
function configurarCheckoutPro(body, turnoId) {
  const basePublica = String(process.env.TF_PUBLIC_URL || '').trim();

  if (basePublica) {
    let direccion;
    try {
      direccion = new URL(basePublica);
    } catch {
      throw crearError('TF_PUBLIC_URL debe ser una URL pública HTTPS válida.', 500);
    }
    if (
      direccion.protocol !== 'https:' ||
      ['localhost', '127.0.0.1', '::1'].includes(direccion.hostname) ||
      direccion.username || direccion.password ||
      direccion.search || direccion.hash
    ) {
      throw crearError('TF_PUBLIC_URL debe ser una URL pública HTTPS sin parámetros.', 500);
    }

    const base = direccion.href.replace(/\/+$/, '');
    const detalle = `${base}/turnos/${encodeURIComponent(String(turnoId))}`;
    body.back_urls = {
      success: `${base}/turnos/${encodeURIComponent(String(turnoId))}/verificar-pago?resultadoPago=exito`,
      pending: `${base}/turnos/${encodeURIComponent(String(turnoId))}/verificar-pago?resultadoPago=pendiente`,
      failure: `${base}/turnos/${encodeURIComponent(String(turnoId))}/verificar-pago?resultadoPago=rechazado`
    };
    body.auto_return = 'approved';
  }

  // Configurar MP_WEBHOOK_URL solo con la dirección REAL del
  // webhook montado en app.js, cuando exista un despliegue HTTPS.
  const webhookPublico = String(process.env.MP_WEBHOOK_URL || '').trim();
  if (webhookPublico) {
    let direccion;
    try {
      direccion = new URL(webhookPublico);
    } catch {
      throw crearError('MP_WEBHOOK_URL debe ser una URL HTTPS válida.', 500);
    }
    if (direccion.protocol !== 'https:' ||
        ['localhost', '127.0.0.1', '::1'].includes(direccion.hostname)) {
      throw crearError('MP_WEBHOOK_URL requiere una URL pública HTTPS.', 500);
    }
    body.notification_url = direccion.href;
  }
}

// ============================================================
// USUARIO ACTUAL
// ============================================================

function obtenerUsuarioId(
  usuario
) {

  if (!usuario) {
    return null;
  }

  const posibleId =
    usuario._id ||
    usuario.id;

  if (
    !posibleId ||
    !mongoose.Types.ObjectId.isValid(
      posibleId
    )
  ) {

    return null;

  }

  return posibleId;

}


function obtenerRol(
  usuario
) {

  return usuario?.rol || '';

}


// ============================================================
// AUDITORÍA
// ============================================================

function registrarAuditoria(
  turno,
  {
    accion,
    usuario,
    detalle = '',
    estadoAnterior = '',
    estadoNuevo = '',
    estadoPagoAnterior = '',
    estadoPagoNuevo = ''
  }
) {

  if (!turno.auditoria) {
    turno.auditoria = [];
  }

  turno.auditoria.push({

    accion,

    realizadoPor:
      obtenerUsuarioId(
        usuario
      ),

    rol:
      obtenerRol(
        usuario
      ),

    detalle,

    estadoAnterior,

    estadoNuevo,

    estadoPagoAnterior,

    estadoPagoNuevo,

    fecha:
      new Date()

  });

}


// ============================================================
// SOCKET.IO
// ============================================================

function emitirActualizacion(
  req,
  datos
) {

  const io =
    req.app.get(
      'socketio'
    );

  if (io) {

    io.emit(
      'actualizacion_agenda',
      datos
    );

  }

}


// ============================================================
// PAGOFLEX: VALIDACIONES COMPARTIDAS Y API LOCAL DE DEMOSTRACION
// ============================================================

async function obtenerTurnoParaCobro(req) {
  const id = req.params.id;
  const usuario = req.session?.usuario;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw crearError('Identificador de turno inválido.', 400);
  }
  if (!usuario || !['admin', 'personal', 'cliente'].includes(usuario.rol)) {
    throw crearError('Acceso no autorizado.', 403);
  }
  const turno = await Turno.findById(id).populate('cliente_id', 'email nombre');
  if (!turno) throw crearError('Turno no encontrado.', 404);
  if (usuario.rol === 'cliente' &&
      (!turno.cliente_id?.email || turno.cliente_id.email !== usuario.email)) {
    throw crearError('No podés operar el pago de otro paciente.', 403);
  }
  return turno;
}

// ============================================================
// PAGO PARTICULAR / COPAGO Y TRANSFERENCIA
// ============================================================
function importeValidado(valor, etiqueta, permitirCero = false) {
  const numero = Number(valor);
  if (valor === undefined || valor === null || valor === '' ||
      !Number.isFinite(numero) || numero < 0 || (!permitirCero && numero === 0) ||
      numero > 100_000_000) {
    throw crearError(`${etiqueta} no está configurado correctamente.`, 400);
  }
  return Math.round(numero * 100) / 100;
}

function descuentoTransferencia() {
  const crudo = String(process.env.TRANSFERENCIA_DESCUENTO_PCT ?? '0');
  const valor = Number(crudo);
  if (!Number.isFinite(valor) || valor < 0 || valor > 50) {
    throw crearError('TRANSFERENCIA_DESCUENTO_PCT debe estar entre 0 y 50.', 500);
  }
  return valor;
}

function calcularPrecio(especialidad, cliente, profesional, metodoPago, tipoCobroSolicitado = null) {
  if (!especialidad || especialidad.activa === false) {
    throw crearError('La especialidad no tiene aranceles activos configurados.', 400);
  }
  const conCobertura = Boolean(String(cliente?.obraSocial?.empresa || '').trim());
  const aceptaCobertura = profesional?.tipoCobertura !== 'particular';
  const aptoCopago = conCobertura && aceptaCobertura;

  let tipoCobro;
  if (tipoCobroSolicitado !== null) {
    if (!['particular', 'copago', 'sin_cargo'].includes(tipoCobroSolicitado)) {
      throw crearError('Seleccioná el tipo de atención: particular, copago o cobertura total.', 400);
    }
    if (tipoCobroSolicitado !== 'particular' && !aptoCopago) {
      throw crearError('No corresponde aplicar copago o cobertura total a este paciente y profesional.', 409);
    }
    tipoCobro = tipoCobroSolicitado;
  } else {
    // Se conserva la selección automática existente para pacientes.
    tipoCobro = aptoCopago
      ? (Number(especialidad.copagoObraSocial) === 0 ? 'sin_cargo' : 'copago')
      : 'particular';
  }

  let precioBase;
  if (tipoCobro === 'particular') {
    precioBase = importeValidado(especialidad.precioParticular, 'El precio particular');
  } else {
    precioBase = importeValidado(especialidad.copagoObraSocial, 'El copago', true);
    if (tipoCobro === 'sin_cargo' && precioBase !== 0) {
      throw crearError('La cobertura total requiere un copago configurado de $0.', 409);
    }
    if (tipoCobro === 'copago' && precioBase === 0) {
      throw crearError('Este arancel es $0. Seleccioná cobertura total, previa verificación.', 409);
    }
  }

  // El descuento es configurado por la clínica y únicamente se aplica a
  // consultas particulares mediante transferencia. Nunca a copagos.
  const porcentaje = tipoCobro === 'particular' && metodoPago === 'transferencia'
    ? descuentoTransferencia() : 0;
  const baseCentavos = Math.round(precioBase * 100);
  const descuentoCentavos = Math.round(baseCentavos * porcentaje / 100);
  return {
    tipoCobro,
    precioBase,
    descuentoPorcentaje: porcentaje,
    descuentoMonto: descuentoCentavos / 100,
    montoTotal: (baseCentavos - descuentoCentavos) / 100
  };
}

function datosTransferencia() {
  return {
    alias: String(process.env.TRANSFERENCIA_ALIAS || '').trim(),
    cbu: String(process.env.TRANSFERENCIA_CBU || '').trim(),
    titular: String(process.env.TRANSFERENCIA_TITULAR || '').trim()
  };
}

function validarCsrfTransferencia(req) {
  const esperado = req.session?.transferenciaCsrf;
  const recibido = req.body?._transferenciaCsrf;
  if (typeof esperado !== 'string' || typeof recibido !== 'string' ||
      !/^[a-f0-9]{64}$/.test(esperado) || !/^[a-f0-9]{64}$/.test(recibido) ||
      !timingSafeEqual(Buffer.from(esperado, 'hex'), Buffer.from(recibido, 'hex'))) {
    throw crearError('Formulario vencido. Recargá el detalle del turno.', 403);
  }
}

function asegurarTransferenciaOperable(turno) {
  if (['cancelado','atendido'].includes(turno.estado) || turno.estadoPago !== 'pendiente') {
    throw crearError('Este turno ya no admite nuevas operaciones de cobro.', 409);
  }
  if (turno.mercadoPago?.preferenceId || turno.pagoFlex?.ordenId) {
    throw crearError('Hay un cobro anterior iniciado. Revisalo antes de cambiar el medio.', 409);
  }
  if (!['particular','copago'].includes(turno.tipoCobro)) {
    throw crearError('Este turno es histórico: no se puede convertir automáticamente a copago o particular.', 409);
  }
}

// ============================================================
// CONTROLADOR
// ============================================================

export class TurnoController {


  // ==========================================================
  // 1. LISTADO DE TURNOS
  // ==========================================================

  static async getTurnos(
    req,
    res
  ) {

    const usuario =
      req.session.usuario;


    const {

      estado,

      fecha,

      profesional_id,

      page = 1,

      limit = 10

    } = req.query;


    const filtro = {};


    // --------------------------------------------------------
    // SEGURIDAD DEL PACIENTE
    // --------------------------------------------------------

    if (
      usuario?.rol ===
      'cliente'
    ) {

      const cliente =
        await Cliente.findOne({

          email:
            usuario.email

        }).lean();


      if (!cliente) {

        throw crearError(
          'No encontramos el perfil del paciente asociado a esta cuenta.',
          404
        );

      }


      filtro.cliente_id =
        cliente._id;

    }


    // --------------------------------------------------------
    // FILTROS
    // --------------------------------------------------------

    if (estado) {

      filtro.estado =
        estado;

    }


    if (fecha) {

      filtro.fecha =
        fecha;

    }


    if (profesional_id) {

      if (
        !mongoose.Types.ObjectId.isValid(
          profesional_id
        )
      ) {

        throw crearError(
          'El profesional seleccionado no es válido.',
          400
        );

      }

      filtro.profesional_id =
        profesional_id;

    }


    // --------------------------------------------------------
    // PAGINACIÓN
    // --------------------------------------------------------

    const limite =
      Math.min(
        Math.max(
          parseInt(
            limit,
            10
          ) || 10,
          1
        ),
        50
      );


    const paginaActual =
      Math.max(
        parseInt(
          page,
          10
        ) || 1,
        1
      );


    const salto =
      (
        paginaActual -
        1
      ) *
      limite;


    const [

      turnos,

      totalDocumentos

    ] = await Promise.all([

      Turno.find(
        filtro
      )
        .populate(
          'cliente_id'
        )
        .populate(
          'profesional_id'
        )
        .sort({
          fecha: 1,
          hora: 1
        })
        .skip(
          salto
        )
        .limit(
          limite
        )
        .lean({
          virtuals: true
        }),

      Turno.countDocuments(
        filtro
      )

    ]);


    const totalPaginas =
      Math.max(
        Math.ceil(
          totalDocumentos /
          limite
        ),
        1
      );


    if (
      req.accepts('json') &&
      !req.accepts('html')
    ) {

      return res.status(
        200
      ).json({

        status:
          'success',

        data:
          turnos,

        paginacion: {

          totalTurnos:
            totalDocumentos,

          totalPaginas,

          paginaActual,

          limite

        }

      });

    }


    return res.render(
      'turnos',
      {

        tituloPage:
          'Listado de Turnos',

        turnos,

        paginacion: {

          totalTurnos:
            totalDocumentos,

          totalPaginas,

          paginaActual,

          tieneSiguiente:
            paginaActual <
            totalPaginas,

          tieneAnterior:
            paginaActual >
            1

        }

      }
    );

  }


  // ==========================================================
  // 2. DETALLE DE TURNO
  // ==========================================================

  static async getDetalleTurno(
    req,
    res
  ) {

    const {
      id
    } = req.params;


    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {

      throw crearError(
        'El identificador del turno no es válido.',
        400
      );

    }


    const turno =
      await Turno.findById(
        id
      )
        .populate(
          'cliente_id'
        )
        .populate(
          'profesional_id'
        )
        .populate(
          'creadoPor',
          'nombre email rol'
        )
        .populate(
          'historialEstados.modificadoPor',
          'nombre email rol'
        )
        .populate(
          'auditoria.realizadoPor',
          'nombre email rol'
        )
        .lean({
          virtuals: true
        });


    if (!turno) {

      throw crearError(
        'El turno solicitado no existe.',
        404
      );

    }


    // --------------------------------------------------------
    // SEGURIDAD PACIENTE
    // --------------------------------------------------------

    if (
      req.session.usuario?.rol ===
      'cliente'
    ) {

      const emailCliente =
        turno.cliente_id?.email;


      if (
        !emailCliente ||
        emailCliente !==
        req.session.usuario.email
      ) {

        throw crearError(
          'No tenés permisos para consultar este turno.',
          403
        );

      }

    }


    if (
      req.accepts('json') &&
      !req.accepts('html')
    ) {

      return res.status(
        200
      ).json({

        status:
          'success',

        data:
          turno

      });

    }


    return res.render(
      'detalle-turno',
      {

        tituloPage:
          'Detalle del Turno',

        turno,

        transferenciaCsrf: req.session.transferenciaCsrf ||= randomBytes(32).toString('hex'),
        datosBanco: datosTransferencia(),

        mensajeExito:
          req.query.exito ||
          req.query.info ||
          null

      }
    );

  }


  // ============================================================
// 3. FORMULARIO DE NUEVO TURNO
// Permite abrir:
// /turnos/nuevo?cliente=ID_DEL_PACIENTE
// ============================================================

  // ==========================================================
  // COTIZACIÓN DE NUEVO TURNO: SOLO RECEPCIÓN / ADMINISTRACIÓN
  // Consulta de lectura; NO crea pagos ni modifica turnos.
  // ==========================================================
  static async cotizarTurnoRecepcion(req, res) {
    try {
    const usuario = req.session?.usuario;
    if (!usuario || !['admin', 'personal'].includes(usuario.rol)) {
      return res.sendStatus(403);
    }
    const clienteId = String(req.query.cliente_id || '');
    const profesionalId = String(req.query.profesional_id || '');
    const tipoCobro = String(req.query.tipoCobro || '');
    const metodoPago = String(req.query.metodoPago || '');
    if (!mongoose.Types.ObjectId.isValid(clienteId) ||
        !mongoose.Types.ObjectId.isValid(profesionalId) ||
        !['particular', 'copago', 'sin_cargo'].includes(tipoCobro) ||
        !['efectivo', 'mercadopago', 'transferencia'].includes(metodoPago)) {
      throw crearError('Seleccioná paciente, profesional, atención y medio de pago válidos.', 400);
    }
    const [cliente, profesional] = await Promise.all([
      Cliente.findById(clienteId).lean(),
      Profesional.findById(profesionalId).lean()
    ]);
    if (!cliente || !profesional) {
      throw crearError('No se encontró el paciente o el profesional.', 404);
    }
    const especialidad = await Especialidad.findOne({
      nombre: profesional.especialidad, activa: { $ne: false }
    }).lean();
    const datos = calcularPrecio(especialidad, cliente, profesional, metodoPago, tipoCobro);
    res.set('Cache-Control', 'private, no-store');
    return res.json({
      especialidad: profesional.especialidad,
      ...datos,
      metodoPago: datos.tipoCobro === 'sin_cargo' ? 'ninguno' : metodoPago,
      requiereVerificacionCobertura: tipoCobro !== 'particular',
      aviso: tipoCobro === 'particular'
        ? 'El precio particular se toma del arancel de la especialidad.'
        : 'Recepción debe comprobar el convenio y plan antes de guardar. El arancel actual es general por especialidad.'
    });
    } catch (error) {
      res.set('Cache-Control', 'no-store');
      const estado = error.statusCode || 500;
      return res.status(estado).json({
        error: estado >= 500 ? 'No se pudo cotizar el turno. Revisá los aranceles.' : error.message
      });
    }
  }

static async getFormNuevoTurno(req, res) {

  const profesionales =
    await Profesional
      .find()
      .sort({ nombre: 1 })
      .lean({ virtuals: true });


  const especialidades =
    await Especialidad
      .find()
      .lean();


  const usuario =
    req.session?.usuario;


  let clientes = [];

  let clienteSeleccionadoId = '';


  // ==========================================================
  // PACIENTE
  // Solo puede generar turnos para su propia ficha.
  // ==========================================================

  if (
    usuario &&
    usuario.rol === 'cliente'
  ) {

    const miPerfil =
      await Cliente
        .findOne({
          email: usuario.email
        })
        .lean({
          virtuals: true
        });


    if (miPerfil) {

      clientes = [
        miPerfil
      ];


      clienteSeleccionadoId =
        miPerfil._id.toString();

    }


  } else {

    // ========================================================
    // ADMINISTRACIÓN / RECEPCIÓN
    // ========================================================

    clientes =
      await Cliente
        .find()
        .sort({
          nombre: 1
        })
        .lean({
          virtuals: true
        });


    // Ejemplo:
    //
    // /turnos/nuevo?cliente=671234...
    //
    const clienteDesdeUrl =
      String(
        req.query.cliente || ''
      ).trim();


    if (
      clienteDesdeUrl &&
      mongoose.Types.ObjectId.isValid(
        clienteDesdeUrl
      )
    ) {

      // Confirmamos que realmente exista dentro
      // de los pacientes disponibles.
      const existePaciente =
        clientes.some(
          function (cliente) {

            const id =
              cliente._id ||
              cliente.id;


            return (
              id &&
              id.toString() ===
                clienteDesdeUrl
            );

          }
        );


      if (existePaciente) {

        clienteSeleccionadoId =
          clienteDesdeUrl;

      }

    }

  }


  res.render(
    'nuevo-turno',
    {

      tituloPage:
        'Solicitar Nuevo Turno',

      clientes:
        clientes,

      profesionales:
        profesionales || [],

      especialidades:
        especialidades || [],

      // NUEVO
      clienteSeleccionadoId,
      transferenciaDescuentoPct: descuentoTransferencia()

    }
  );
}


  // ==========================================================
  // 4. CREAR TURNO
  // ==========================================================

  static async crearTurno(
    req,
    res
  ) {

    const usuario =
      req.session.usuario;


    let {

      cliente_id,

      profesional_id,

      fecha,

      hora,

      modalidadTurno

    } = req.body;


    // Aceptamos ambas variantes para no romper formularios
    // anteriores de TurnoFlex.

    const metodoPagoElegido =
      req.body.metodo_pago ||
      req.body.metodoPago;

    // La elección administrativa afecta únicamente turnos nuevos.
    // No se acepta un importe numérico del navegador.
    const esRecepcion = ['admin', 'personal'].includes(usuario?.rol);
    const tipoCobroRecepcion = esRecepcion ? String(req.body.tipoCobro || '') : null;
    if (esRecepcion) {
      if (!['particular', 'copago', 'sin_cargo'].includes(tipoCobroRecepcion)) {
        throw crearError('Recepción debe seleccionar el tipo de atención.', 400);
      }
      if (tipoCobroRecepcion !== 'sin_cargo' &&
          !['efectivo', 'mercadopago', 'transferencia'].includes(metodoPagoElegido)) {
        throw crearError('Seleccioná un medio de pago válido.', 400);
      }
      if (tipoCobroRecepcion !== 'particular' &&
          req.body.coberturaVerificada !== 'si') {
        throw crearError('Verificá el convenio y plan antes de aplicar copago o cobertura total.', 400);
      }
    }


    // --------------------------------------------------------
    // CAMPOS OBLIGATORIOS
    // --------------------------------------------------------

    if (
      !profesional_id ||
      !fecha ||
      !hora
    ) {

      throw crearError(
        'Completá profesional, fecha y horario para reservar el turno.',
        400
      );

    }


    if (
      !mongoose.Types.ObjectId.isValid(
        profesional_id
      )
    ) {

      throw crearError(
        'El profesional seleccionado no es válido.',
        400
      );

    }


    // --------------------------------------------------------
    // PACIENTE LOGUEADO
    // --------------------------------------------------------

    if (
      usuario?.rol ===
      'cliente'
    ) {

      const miPerfil =
        await Cliente.findOne({

          email:
            usuario.email

        });


      if (!miPerfil) {

        throw crearError(
          'No encontramos tu perfil de paciente.',
          404
        );

      }


      cliente_id =
        miPerfil._id;

    }


    if (
      !cliente_id ||
      !mongoose.Types.ObjectId.isValid(
        cliente_id
      )
    ) {

      throw crearError(
        'El paciente seleccionado no es válido.',
        400
      );

    }


    // --------------------------------------------------------
    // VALIDAR ENTIDADES
    // --------------------------------------------------------

    const [

      cliente,

      profesional

    ] = await Promise.all([

      Cliente.findById(
        cliente_id
      ),

      Profesional.findById(
        profesional_id
      )

    ]);


    if (!cliente) {

      throw crearError(
        'El paciente seleccionado no existe.',
        404
      );

    }


    if (!profesional) {

      throw crearError(
        'El profesional seleccionado no existe.',
        404
      );

    }


    // --------------------------------------------------------
    // MODALIDAD
    // --------------------------------------------------------

    const modalidadesValidas = [

      'regular',

      'presencial',

      'sobreturno',

      'telemedicina'

    ];


    let modalidad =
      modalidadTurno ||
      'regular';


    if (
      !modalidadesValidas.includes(
        modalidad
      )
    ) {

      modalidad =
        'regular';

    }


    // --------------------------------------------------------
    // DISPONIBILIDAD
    // --------------------------------------------------------

    const turnoExistente =
      await Turno.findOne({

        profesional_id,

        fecha,

        hora,

        estado: {
          $in: [
            'reservado',
            'pendiente_pago',
            'En Espera'
          ]
        }

      });


    if (turnoExistente) {

      throw crearError(
        'Ese horario acaba de ser reservado. Elegí otro turno disponible.',
        409
      );

    }


    // --------------------------------------------------------
    // PRECIO PARTICULAR O COPAGO (calculado en servidor)
    // --------------------------------------------------------
    const especialidadData = await Especialidad.findOne({ nombre: profesional.especialidad });
    const datosPrecio = calcularPrecio(especialidadData, cliente, profesional, metodoPagoElegido, tipoCobroRecepcion);
    const montoSena = datosPrecio.montoTotal; // campo legado de MP: monto completo en turnos nuevos

    // --------------------------------------------------------
    // REGLAS DE PAGO
    // --------------------------------------------------------

    let metodoPago =
      'efectivo';


    let estadoPago =
      'pendiente';


    let estadoTurno =
      'reservado';


    if (
      usuario?.rol ===
      'cliente'
    ) {

      if (
        ![
          'efectivo',
          'mercadopago',
          'transferencia'
        ].includes(
          metodoPagoElegido
        )
      ) {

        throw crearError(
          'Seleccioná un medio de pago válido.',
          400
        );

      }


      metodoPago =
        metodoPagoElegido;


      if (metodoPago === 'mercadopago' || metodoPago === 'transferencia') {
        estadoTurno = 'pendiente_pago';
      }

    }


    // Los turnos creados por recepción conservan el medio de pago elegido.
    // Mercado Pago se habilita desde el detalle; no se genera una preferencia
    // durante la creación administrativa. La transferencia se verificará
    // manualmente mediante el flujo existente de PagoFlex.
    if (esRecepcion) {
      metodoPago = tipoCobroRecepcion === 'sin_cargo' ? 'efectivo' : metodoPagoElegido;
      if (metodoPago === 'mercadopago' || metodoPago === 'transferencia') {
        estadoTurno = 'pendiente_pago';
      }
    }

    // No corresponde cobrar dinero si el convenio fija copago cero.
    if (datosPrecio.tipoCobro === 'sin_cargo') {
      estadoPago = 'sin_cargo';
      metodoPago = 'efectivo';
      estadoTurno = 'reservado';
    }

    // --------------------------------------------------------
    // VALIDAR MERCADO PAGO ANTES DE RESERVAR
    // --------------------------------------------------------

    if (
      metodoPago ===
      'mercadopago' &&
      !process.env.MP_ACCESS_TOKEN
    ) {

      throw crearError(
        'Mercado Pago no se encuentra configurado en este momento.',
        503
      );

    }


    // --------------------------------------------------------
    // CREAR TURNO
    // --------------------------------------------------------

    const nuevoTurno =
      new Turno({

        cliente_id,

        profesional_id,

        fecha,

        hora,

        modalidad,

        estado:
          estadoTurno,

        metodoPago,

        estadoPago,

        montoSena,
        ...datosPrecio,

        creadoPor:
          obtenerUsuarioId(
            usuario
          )

      });


    // --------------------------------------------------------
    // AUDITORÍA DE CREACIÓN
    // --------------------------------------------------------

    registrarAuditoria(
      nuevoTurno,
      {

        accion:
          'creacion',

        usuario,

        detalle:
          `Turno creado para ${fecha} a las ${hora} hs. ` +
          `Tipo: ${datosPrecio.tipoCobro}; arancel: $${datosPrecio.precioBase}; ` +
          `descuento: $${datosPrecio.descuentoMonto}; total: $${datosPrecio.montoTotal}; ` +
          `medio: ${metodoPago}.` +
          (esRecepcion && tipoCobroRecepcion !== 'particular'
            ? ' Cobertura declarada como verificada por recepción.' : ''),

        estadoNuevo:
          estadoTurno,

        estadoPagoNuevo:
          estadoPago

      }
    );


    try {

      await nuevoTurno.save();

    } catch (error) {

      if (
        error.code ===
        11000
      ) {

        throw crearError(
          'Ese horario ya no está disponible.',
          409
        );

      }

      throw error;

    }


    // --------------------------------------------------------
    // NOTIFICACIÓN EN TIEMPO REAL
    // --------------------------------------------------------

    emitirActualizacion(
      req,
      {

        tipo:
          'NUEVO',

        id:
          nuevoTurno._id,

        mensaje:
          `Nuevo turno para el ${fecha} a las ${hora} hs.`

      }
    );


    // --------------------------------------------------------
    // ADMIN / RECEPCIÓN
    // --------------------------------------------------------

    if (
      usuario?.rol ===
        'admin' ||
      usuario?.rol ===
        'personal'
    ) {

      return res.redirect(
        `/turnos/${nuevoTurno._id}?exito=Turno+creado+correctamente`
      );

    }


    // --------------------------------------------------------
    // PACIENTE - EFECTIVO
    // --------------------------------------------------------

    if (
      metodoPago === 'efectivo' || metodoPago === 'transferencia'
    ) {

      return res.redirect(
        `/turnos/${nuevoTurno._id}?exito=Turno+reservado+correctamente`
      );

    }


    // --------------------------------------------------------
    // PACIENTE - MERCADO PAGO
    // --------------------------------------------------------

    try {

      const client =
        new MercadoPagoConfig({

          accessToken:
            process.env.MP_ACCESS_TOKEN

        });


      const preference =
        new Preference(
          client
        );


      const body = {

        items: [

          {

            id:
              nuevoTurno._id.toString(),

            title:
              `Pago de consulta - ${profesional.nombre} (${profesional.especialidad})`,

            quantity:
              1,

            currency_id:
              'ARS',

            unit_price:
              montoSena

          }

        ],

        external_reference:
          nuevoTurno._id.toString()

      };

      configurarCheckoutPro(body, nuevoTurno._id);

      const resultado =
        await preference.create({
          body
        });


      nuevoTurno.mercadoPago.preferenceId =
        resultado.id ||
        '';


      registrarAuditoria(
        nuevoTurno,
        {

          accion:
            'generacion_pago_mp',

          usuario,

          detalle:
            `Se generó una preferencia de Mercado Pago por $${montoSena}.`,

          estadoAnterior:
            nuevoTurno.estado,

          estadoNuevo:
            nuevoTurno.estado,

          estadoPagoAnterior:
            nuevoTurno.estadoPago,

          estadoPagoNuevo:
            nuevoTurno.estadoPago

        }
      );


      await nuevoTurno.save();


      if (
        !resultado.init_point
      ) {

        throw crearError(
          'Mercado Pago no devolvió un enlace de pago válido.',
          502
        );

      }


      return res.redirect(
        resultado.init_point
      );


    } catch (error) {

      // Si Mercado Pago falla durante la creación inicial,
      // liberamos nuevamente el horario.

      await Turno.findByIdAndDelete(
        nuevoTurno._id
      );


      if (
        error.statusCode
      ) {

        throw error;

      }


      throw crearError(
        'No fue posible iniciar el pago con Mercado Pago.',
        502
      );

    }

  }


  // ==========================================================
  // 5. CAMBIAR ESTADO
  // ==========================================================

  static async cambiarEstadoTurno(
    req,
    res
  ) {

    const {
      id
    } = req.params;


    const {
      nuevoEstado
    } = req.body;


    const usuario =
      req.session.usuario;


    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {

      throw crearError(
        'El identificador del turno no es válido.',
        400
      );

    }


    const turnoActual =
      await Turno.findById(
        id
      );


    if (!turnoActual) {

      throw crearError(
        'Turno no encontrado.',
        404
      );

    }


    const estadosValidos = [

      'reservado',

      'cancelado',

      'atendido',

      'pendiente_pago',

      'En Espera'

    ];


    if (
      !nuevoEstado ||
      !estadosValidos.includes(
        nuevoEstado
      )
    ) {

      throw crearError(
        'El estado solicitado no es válido.',
        400
      );

    }


    if (
      turnoActual.estado ===
      nuevoEstado
    ) {

      return res.redirect(
        `/turnos/${id}?info=El+turno+ya+se+encuentra+en+ese+estado`
      );

    }


    if (
      (
        turnoActual.estado ===
          'atendido' &&
        nuevoEstado ===
          'cancelado'
      ) ||
      (
        turnoActual.estado ===
          'cancelado' &&
        nuevoEstado ===
          'atendido'
      )
    ) {

      throw crearError(
        `No se puede pasar directamente de ${turnoActual.estado} a ${nuevoEstado}.`,
        400
      );

    }


    const estadoAnterior =
      turnoActual.estado;


    const usuarioId =
      obtenerUsuarioId(
        usuario
      );


    // --------------------------------------------------------
    // HISTORIAL LEGACY
    // --------------------------------------------------------

    turnoActual.historialEstados.push({

      estadoAnterior,

      estadoNuevo:
        nuevoEstado,

      modificadoPor:
        usuarioId,

      fechaModificacion:
        new Date()

    });


    // --------------------------------------------------------
    // AUDITORÍA GENERAL
    // --------------------------------------------------------

    registrarAuditoria(
      turnoActual,
      {

        accion:
          'cambio_estado',

        usuario,

        detalle:
          `Estado actualizado de ${estadoAnterior} a ${nuevoEstado}.`,

        estadoAnterior,

        estadoNuevo:
          nuevoEstado,

        estadoPagoAnterior:
          turnoActual.estadoPago,

        estadoPagoNuevo:
          turnoActual.estadoPago

      }
    );


    turnoActual.estado =
      nuevoEstado;


    await turnoActual.save();


    emitirActualizacion(
      req,
      {

        tipo:
          'ESTADO',

        id:
          turnoActual._id,

        nuevoEstado:
          turnoActual.estado

      }
    );


    if (
      req.accepts('json') &&
      !req.accepts('html')
    ) {

      return res.status(
        200
      ).json({

        status:
          'success',

        data:
          turnoActual

      });

    }


    return res.redirect(
      `/turnos/${id}?exito=Estado+actualizado+correctamente`
    );

  }


  // ==========================================================
  // 6. MARCAR ATENDIDO
  // ==========================================================

  static async marcarAtendido(
    req,
    res
  ) {

    req.body.nuevoEstado =
      'atendido';


    return TurnoController
      .cambiarEstadoTurno(
        req,
        res
      );

  }


  // ==========================================================
  // 7. CANCELAR
  // ==========================================================

  static async cancelarTurno(
    req,
    res
  ) {

    req.body.nuevoEstado =
      'cancelado';


    return TurnoController
      .cambiarEstadoTurno(
        req,
        res
      );

  }


  // ==========================================================
  // 8. COBRAR EN EFECTIVO
  // ==========================================================

  static async cobrarEfectivo(
    req,
    res
  ) {

    const {
      id
    } = req.params;


    const usuario =
      req.session.usuario;


    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {

      throw crearError(
        'El identificador del turno no es válido.',
        400
      );

    }


    const turno =
      await Turno.findById(
        id
      );


    if (!turno) {

      throw crearError(
        'Turno no encontrado.',
        404
      );

    }


    if (
      turno.estado ===
      'cancelado'
    ) {

      throw crearError(
        'No se puede registrar un cobro sobre un turno cancelado.',
        409
      );

    }


    if (
      turno.estadoPago !== 'pendiente'
    ) {

      return res.redirect(
        `/turnos/${id}?info=El+pago+ya+estaba+registrado`
      );

    }


    if (turno.mercadoPago?.preferenceId || turno.pagoFlex?.ordenId ||
        turno.metodoPago === 'transferencia') {
      throw crearError('Existe otra operación de cobro iniciada. Debe resolverse antes de cobrar efectivo.', 409);
    }

    const estadoAnterior =
      turno.estado;


    const estadoPagoAnterior =
      turno.estadoPago;


    turno.metodoPago =
      'efectivo';


    turno.estadoPago =
      'total_pagado';


    if (
      turno.estado ===
      'pendiente_pago'
    ) {

      turno.estado =
        'reservado';


      turno.historialEstados.push({

        estadoAnterior:
          'pendiente_pago',

        estadoNuevo:
          'reservado',

        modificadoPor:
          obtenerUsuarioId(
            usuario
          ),

        fechaModificacion:
          new Date()

      });

    }


    registrarAuditoria(
      turno,
      {

        accion:
          'cobro_efectivo',

        usuario,

        detalle:
          'Pago registrado en efectivo desde caja.',

        estadoAnterior,

        estadoNuevo:
          turno.estado,

        estadoPagoAnterior,

        estadoPagoNuevo:
          'total_pagado'

      }
    );


    await turno.save();


    emitirActualizacion(
      req,
      {

        tipo:
          'PAGO',

        id:
          turno._id,

        metodoPago:
          'efectivo',

        estadoPago:
          turno.estadoPago,

        nuevoEstado:
          turno.estado

      }
    );


    if (
      req.accepts('json') &&
      !req.accepts('html')
    ) {

      return res.status(
        200
      ).json({

        status:
          'success',

        data:
          turno

      });

    }


    return res.redirect(
      `/turnos/${id}?exito=Pago+en+efectivo+registrado+correctamente`
    );

  }


  // ==========================================================
  // 9. GENERAR / REGENERAR MERCADO PAGO
  // ==========================================================

  static async generarPagoMP(
    req,
    res
  ) {

    const {
      id
    } = req.params;


    const usuario =
      req.session.usuario;


    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {

      throw crearError(
        'El identificador del turno no es válido.',
        400
      );

    }


    const turno =
      await Turno.findById(
        id
      )
        .populate(
          'profesional_id'
        )
        .populate(
          'cliente_id'
        );


    if (!turno) {

      throw crearError(
        'Turno no encontrado.',
        404
      );

    }


    // --------------------------------------------------------
    // SEGURIDAD DEL PACIENTE
    // --------------------------------------------------------

    if (
      usuario?.rol ===
      'cliente'
    ) {

      if (
        turno.cliente_id?.email !==
        usuario.email
      ) {

        throw crearError(
          'No tenés permisos para pagar este turno.',
          403
        );

      }

    }


    if (
      turno.estado ===
        'cancelado' ||
      turno.estado ===
        'atendido'
    ) {

      throw crearError(
        'Este turno ya no admite operaciones de pago.',
        409
      );

    }


    // No iniciar una segunda seña con ningún proveedor.
    if (turno.estadoPago !== 'pendiente') {
      return res.redirect(
        `/turnos/${id}?info=Este+turno+ya+tiene+una+se%C3%B1a+registrada`
      );
    }

    if (turno.metodoPago === 'transferencia') {
      throw crearError('Este turno ya eligió transferencia. Debe resolverse ese medio de pago.', 409);
    }

    if (turno.mercadoPago?.preferenceId && turno.tipoCobro !== 'legacy') {
      throw crearError('Ya hay un checkout de Mercado Pago iniciado para este turno. Revisá el estado antes de volver a cobrar.', 409);
    }

    if (turno.pagoFlex?.ordenId) {
      throw crearError('Este turno ya tiene una orden PagoFlex. Verificá ese pago primero.', 409);
    }

    const accessToken =
      process.env.MP_ACCESS_TOKEN;


    if (!accessToken) {

      throw crearError(
        'Mercado Pago no se encuentra configurado.',
        503
      );

    }


    const profesional =
      turno.profesional_id;


    if (!profesional) {

      throw crearError(
        'No encontramos el profesional asociado al turno.',
        404
      );

    }


    const especialidadData =
      await Especialidad.findOne({

        nombre:
          profesional.especialidad

      });


    // No recalcular un precio particular/copago ya fijado al reservar.
    const montoSena = turno.tipoCobro && turno.tipoCobro !== 'legacy'
      ? importeValidado(turno.montoTotal, 'El importe total')
      : importeValidado(turno.montoSena || especialidadData?.montoSena, 'El importe histórico');


    const client =
      new MercadoPagoConfig({

        accessToken

      });


    const preference =
      new Preference(
        client
      );


    const body = {

      items: [

        {

          id:
            turno._id.toString(),

          title:
            `Pago de consulta - ${profesional.nombre} (${profesional.especialidad})`,

          quantity:
            1,

          currency_id:
            'ARS',

          unit_price:
            montoSena

        }

      ],

      external_reference:
        turno._id.toString()

    };

    configurarCheckoutPro(body, turno._id);

    let resultado;


    try {

      resultado =
        await preference.create({
          body
        });

    } catch (error) {

      console.error(
        '❌ Mercado Pago:',
        error
      );


      throw crearError(
        'No fue posible generar el enlace de Mercado Pago.',
        502
      );

    }


    if (
      !resultado.init_point
    ) {

      throw crearError(
        'Mercado Pago no devolvió un enlace válido.',
        502
      );

    }


    const estadoAnterior =
      turno.estado;


    const estadoPagoAnterior =
      turno.estadoPago;


    turno.metodoPago =
      'mercadopago';


    turno.montoSena =
      montoSena;


    turno.mercadoPago.preferenceId =
      resultado.id ||
      '';


    if (
      turno.estadoPago ===
      'pendiente'
    ) {

      turno.estado =
        'pendiente_pago';

    }


    registrarAuditoria(
      turno,
      {

        accion:
          'generacion_pago_mp',

        usuario,

        detalle:
          `Preferencia de Mercado Pago generada por $${montoSena}.`,

        estadoAnterior,

        estadoNuevo:
          turno.estado,

        estadoPagoAnterior,

        estadoPagoNuevo:
          turno.estadoPago

      }
    );


    if (
      estadoAnterior !==
      turno.estado
    ) {

      turno.historialEstados.push({

        estadoAnterior,

        estadoNuevo:
          turno.estado,

        modificadoPor:
          obtenerUsuarioId(
            usuario
          ),

        fechaModificacion:
          new Date()

      });

    }


    await turno.save();


    emitirActualizacion(
      req,
      {

        tipo:
          'PAGO_MP',

        id:
          turno._id,

        nuevoEstado:
          turno.estado,

        estadoPago:
          turno.estadoPago

      }
    );


    return res.redirect(
      resultado.init_point
    );

  }


  // ============================================================
  // MERCADO PAGO: REGRESO DESDE CHECKOUT PRO
  // Nunca confiamos en status/collection_status del navegador.
  // El payment_id se consulta nuevamente en Mercado Pago.
  // ============================================================
  static async verificarPagoMP(req, res) {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw crearError('Turno no válido.', 400);
    }
    const turno = await Turno.findById(id).populate('cliente_id', 'email');
    if (!turno) throw crearError('Turno inexistente.', 404);
    const usuario = req.session?.usuario;
    if (!usuario || !['admin', 'personal', 'cliente'].includes(usuario.rol)) {
      throw crearError('No autorizado.', 403);
    }
    if (usuario.rol === 'cliente' &&
        (!turno.cliente_id?.email || turno.cliente_id.email !== usuario.email)) {
      throw crearError('No podés verificar un turno ajeno.', 403);
    }
    if (turno.estadoPago !== 'pendiente') {
      return res.redirect(303, `/turnos/${id}?info=El+pago+ya+esta+registrado`);
    }
    if (turno.metodoPago !== 'mercadopago' || !turno.mercadoPago?.preferenceId) {
      return res.redirect(303, `/turnos/${id}?info=No+hay+un+pago+de+Mercado+Pago+iniciado`);
    }
    const idPago = String(req.query.payment_id || req.query.collection_id || '');
    if (!/^\d{1,30}$/.test(idPago)) {
      // Puede ocurrir con pagos pendientes o si el usuario vuelve sin pagar.
      return res.redirect(303, `/turnos/${id}?info=Pago+pendiente+de+verificacion`);
    }
    // La URL de retorno NO autoriza el pago: lo determina la API del proveedor.
    const resultado = await sincronizarPagoMercadoPago(idPago, req.app, id);
    const mensaje = resultado.estado === 'aprobado'
      ? (turno.tipoCobro === 'legacy' ? 'Se%C3%B1a+confirmada+por+Mercado+Pago' : 'Pago+de+consulta+confirmado')
      : resultado.estado === 'registrado'
        ? 'Pago+ya+registrado'
        : resultado.estado === 'pendiente'
          ? 'Pago+pendiente+en+Mercado+Pago'
          : 'Pago+no+aprobado+por+Mercado+Pago';
    return res.redirect(303, `/turnos/${id}?info=${mensaje}`);
  }

  // ============================================================
  // PAGOFLEX - TRANSFERENCIA BANCARIA REAL, CONTROL ADMINISTRATIVO
  // No acepta comprobantes como acreditación automática.
  // ============================================================
  static async iniciarTransferencia(req, res) {
    validarCsrfTransferencia(req);
    const turno = await obtenerTurnoParaCobro(req);
    asegurarTransferenciaOperable(turno);
    const banco = datosTransferencia();
    if (!banco.alias || !banco.cbu || !banco.titular) {
      throw crearError('La cuenta receptora de transferencias todavía no está configurada.', 503);
    }
    if (turno.transferencia?.estado === 'iniciada' || turno.transferencia?.estado === 'informada') {
      return res.redirect(303, `/turnos/${turno.id}?info=Transferencia+ya+iniciada`);
    }
    if (turno.metodoPago !== 'transferencia') {
      // El descuento solo corresponde a particulares y se calcula en el servidor.
      const baseCentavos = Math.round(Number(turno.precioBase) * 100);
      const pct = turno.tipoCobro === 'particular' ? descuentoTransferencia() : 0;
      if (!Number.isSafeInteger(baseCentavos) || baseCentavos <= 0) {
        throw crearError('El precio de esta consulta no es válido.', 400);
      }
      const rebajaCentavos = Math.round(baseCentavos * pct / 100);
      turno.descuentoPorcentaje = pct;
      turno.descuentoMonto = rebajaCentavos / 100;
      turno.montoTotal = (baseCentavos - rebajaCentavos) / 100;
      turno.montoSena = turno.montoTotal; // compatibilidad histórica
    }
    const estadoAnterior = turno.estado;
    turno.metodoPago = 'transferencia';
    turno.estado = 'pendiente_pago';
    turno.transferencia.estado = 'iniciada';
    registrarAuditoria(turno, {
      accion: 'transferencia_iniciada', usuario: req.session.usuario,
      detalle: `Se ofreció transferencia bancaria por $${turno.montoTotal}. Pendiente de acreditación.`,
      estadoAnterior, estadoNuevo: turno.estado,
      estadoPagoAnterior: turno.estadoPago, estadoPagoNuevo: turno.estadoPago
    });
    await turno.save();
    return res.redirect(303, `/turnos/${turno.id}?info=Datos+de+transferencia+disponibles`);
  }

  static async informarTransferencia(req, res) {
    validarCsrfTransferencia(req);
    const turno = await obtenerTurnoParaCobro(req);
    if (turno.metodoPago !== 'transferencia' || turno.estadoPago !== 'pendiente' ||
        !['iniciada','rechazada'].includes(turno.transferencia?.estado) ||
        ['cancelado','atendido'].includes(turno.estado)) {
      throw crearError('La transferencia no está disponible para informar en este turno.', 409);
    }
    const referencia = String(req.body.referencia || '').trim();
    if (referencia.length < 4 || referencia.length > 80 || !/^[\p{L}\p{N} ._\/-]+$/u.test(referencia)) {
      throw crearError('Ingresá una referencia de operación válida (4 a 80 caracteres).', 400);
    }
    const ahora = new Date();
    const actualizado = await Turno.findOneAndUpdate({
      _id: turno._id, metodoPago: 'transferencia', estadoPago: 'pendiente',
      'transferencia.estado': turno.transferencia.estado, estado: turno.estado
    }, {
      $set: { 'transferencia.referencia': referencia, 'transferencia.informadaEn': ahora,
        'transferencia.estado': 'informada' },
      $push: { auditoria: {
        accion: 'transferencia_informada', realizadoPor: obtenerUsuarioId(req.session.usuario),
        rol: obtenerRol(req.session.usuario),
        detalle: `Transferencia informada. Referencia: ${referencia}. Requiere conciliación bancaria.`,
        estadoAnterior: turno.estado, estadoNuevo: turno.estado,
        estadoPagoAnterior: 'pendiente', estadoPagoNuevo: 'pendiente', fecha: ahora
      }}
    }, {new:true});
    if (!actualizado) throw crearError('Esta transferencia ya fue informada o procesada.', 409);
    return res.redirect(303, `/turnos/${turno.id}?info=Transferencia+informada.+Esperando+validacion`);
  }

  static async confirmarTransferencia(req, res) {
    validarCsrfTransferencia(req);
    if (!['admin','personal'].includes(req.session?.usuario?.rol)) throw crearError('Acceso denegado.', 403);
    const turno = await obtenerTurnoParaCobro(req);
    if (turno.metodoPago !== 'transferencia' || turno.estadoPago !== 'pendiente' ||
        turno.transferencia?.estado !== 'informada' || ['cancelado','atendido'].includes(turno.estado)) {
      throw crearError('No hay una transferencia pendiente de conciliar para este turno.', 409);
    }
    // La acreditación se comprueba FUERA de TurnoFlex en la cuenta bancaria real.
    const nuevoEstado = turno.estado === 'pendiente_pago' ? 'reservado' : turno.estado;
    const ahora = new Date();
    const update = {
      $set: {
        estadoPago: 'total_pagado', estado: nuevoEstado,
        'transferencia.estado': 'acreditada', 'transferencia.acreditadaEn': ahora,
        'transferencia.verificadaPor': obtenerUsuarioId(req.session.usuario)
      },
      $push: {
        auditoria: {
          accion: 'transferencia_confirmada', realizadoPor: obtenerUsuarioId(req.session.usuario),
          rol: obtenerRol(req.session.usuario),
          detalle: `Acreditación bancaria verificada manualmente. Referencia: ${turno.transferencia.referencia}. Importe: $${turno.montoTotal}.`,
          estadoAnterior: turno.estado, estadoNuevo: nuevoEstado,
          estadoPagoAnterior: 'pendiente', estadoPagoNuevo: 'total_pagado', fecha: ahora
        }
      }
    };
    if (turno.estado !== nuevoEstado) {
      update.$push.historialEstados = {
        estadoAnterior: turno.estado, estadoNuevo: nuevoEstado,
        modificadoPor: obtenerUsuarioId(req.session.usuario), fechaModificacion: ahora
      };
    }
    const actualizado = await Turno.findOneAndUpdate({
      _id: turno._id, metodoPago: 'transferencia', estadoPago: 'pendiente',
      'transferencia.estado': 'informada', estado: turno.estado
    }, update, { new: true });
    if (!actualizado) throw crearError('La transferencia ya fue procesada. Recargá el turno.', 409);
    emitirActualizacion(req, {tipo:'PAGO_TRANSFERENCIA',id:turno._id,estadoPago:'total_pagado',nuevoEstado});
    return res.redirect(303, `/turnos/${turno.id}?exito=Transferencia+acreditada`);
  }

  static async rechazarTransferencia(req, res) {
    validarCsrfTransferencia(req);
    if (!['admin','personal'].includes(req.session?.usuario?.rol)) throw crearError('Acceso denegado.', 403);
    const turno = await obtenerTurnoParaCobro(req);
    if (turno.metodoPago !== 'transferencia' || turno.estadoPago !== 'pendiente' ||
        turno.transferencia?.estado !== 'informada') {
      throw crearError('No hay una transferencia informada para rechazar.', 409);
    }
    const ahora = new Date();
    const actualizado = await Turno.findOneAndUpdate({
      _id: turno._id, metodoPago: 'transferencia', estadoPago: 'pendiente', 'transferencia.estado': 'informada'
    }, {
      $set: {'transferencia.estado': 'rechazada'},
      $push: {auditoria: {
        accion: 'transferencia_rechazada', realizadoPor: obtenerUsuarioId(req.session.usuario),
        rol: obtenerRol(req.session.usuario),
        detalle: 'Recepción no pudo comprobar la acreditación bancaria. Sigue pendiente.',
        estadoAnterior: turno.estado, estadoNuevo: turno.estado,
        estadoPagoAnterior: 'pendiente', estadoPagoNuevo: 'pendiente', fecha: ahora
      }}
    }, { new:true });
    if (!actualizado) throw crearError('La transferencia ya fue procesada.', 409);
    return res.redirect(303, `/turnos/${turno.id}?info=Transferencia+no+acreditada`);
  }


}


export default TurnoController;