import path from 'path';

import express from 'express';

import { createServer } from 'http';

import { Server } from 'socket.io';

import helmet from 'helmet';

import 'dotenv/config';

import session from 'express-session';

import TurnoController from './src/controllers/turnoController.js';

import accesosInstitucionalesRoutes from './src/routes/accesosInstitucionalesRoutes.js';

import { verificarCuentaHabilitada } from './src/middlewares/verificarCuentaHabilitada.js';

import { getUltimosLlamadosSalaEspera } from './src/controllers/salaEsperaHistorialController.js';

// ============================================================
// CONFIGURACIÓN
// ============================================================

import {
  connectDB
} from './src/config/db.js';


// ============================================================
// RUTAS
// ============================================================

import authRoutes
  from './src/routes/authRoutes.js';

import turnoRoutes
  from './src/routes/turnoRoutes.js';

import profesionalRoutes
  from './src/routes/profesionalRoutes.js';

import clienteRoutes
  from './src/routes/clienteRoutes.js';

import dashboardRoutes
  from './src/routes/dashboardRoutes.js';

import profesionalDashboardRoutes
  from './src/routes/profesionalDashboardRoutes.js';

import mercadoPagoWebhookRoutes 
  from './src/routes/mercadoPagoWebhookRoutes.js';


import recepcionResumenRoutes 
from './src/routes/recepcionResumenRoutes.js';

// ============================================================
// MIDDLEWARES
// ============================================================

import {
  asegurarAutenticacion
} from './src/middlewares/authMiddleware.js';

import {
  errorHandler
} from './src/middlewares/errorHandler.js';

// ============================================================
// SERVICIOS
// ============================================================

import {
  iniciarCronJobs
} from './src/cron/recordatorios.js';

import {
  iniciarWhatsApp
} from './src/utils/whatsapp.js';


// ============================================================
// MODELOS
// ============================================================

import {
  Cliente
} from './src/models/Cliente.js';

import {
  Turno
} from './src/models/Turno.js';


import pruebaWhatsAppRoutes
  from './src/routes/pruebaWhatsAppRoutes.js';

// Historia clínica con permisos por paciente y profesional (Etapa 4).
import { crearRouterParaTurnoFlex } from './src/routes/crearRouterParaTurnoFlex.js';


// ============================================================
// APP
// ============================================================

const app =
  express();


const PORT =
  process.env.PORT ||
  3000;


// ============================================================
// CONFIGURACIÓN EXPRESS
// ============================================================

app.disable(
  'x-powered-by'
);


app.set(
  'view engine',
  'pug'
);


app.set(
  'views',
  path.join(
    process.cwd(),
    'src/views'
  )
);


// Para despliegues detrás de proxy,
// por ejemplo Vercel / Render / Railway.
if (process.env.TF_CLOUDFLARE_TUNNEL === '1') {
  app.set('trust proxy', 'loopback');
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}


// ============================================================
// HTTP + SOCKET.IO
// ============================================================

const httpServer =
  createServer(app);


const io =
  new Server(
    httpServer
  );


app.set(
  'socketio',
  io
);


// Las rutas de la sala de espera se registran más abajo,
// cuando la sesión y los permisos ya están configurados.

// ============================================================
// INICIO CONTROLADO: primero MongoDB, luego servicios externos.
// NODE_ENV=test no conecta a MongoDB, ni inicia WhatsApp/cron/HTTP.
// ============================================================

if (process.env.NODE_ENV !== 'test') {
  try {
    await connectDB();
  } catch (error) {
    console.error('❌ TurnoFlex no se iniciará sin conexión a MongoDB.');
    process.exit(1);
  }

  // Ambos servicios originales se conservan; arrancan con MongoDB lista.
  iniciarWhatsApp(io);
  iniciarCronJobs();
}


// ============================================================
// SEGURIDAD HTTP
// ============================================================

app.use(
  helmet({

    // Actualmente TurnoFlex utiliza algunos recursos
    // externos como Bootstrap, Flatpickr y Chart.js.
    // Por eso mantenemos CSP desactivado por ahora.
    contentSecurityPolicy:
      false

  })
);


// ============================================================
// SESIONES
// ============================================================

// No permitir un secreto predeterminado cuando la aplicación se despliegue.
// En desarrollo se conserva temporalmente el valor previo para no alterar
// sesiones existentes, pero configurá un secreto fuerte en tu propio .env.
const secretoConfigurado = String(process.env.SESSION_SECRET || '').trim();
if (process.env.NODE_ENV === 'production' && secretoConfigurado.length < 32) {
  throw new Error('SESSION_SECRET debe estar configurada con al menos 32 caracteres en producción.');
}
if (!secretoConfigurado && process.env.NODE_ENV !== 'test') {
  console.warn('⚠️ SESSION_SECRET no está definida; configurala en .env antes de usar TurnoFlex fuera de pruebas locales.');
}
const sessionSecret = secretoConfigurado || 'TurnoFlexSecretKeySuperSegura2026';



const sessionMiddleware = session({
  name: 'turnoflex.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto',
    maxAge: 1000 * 60 * 60 * 8
  }
});

// Compartimos la misma sesión en HTTP y Socket.IO.
app.use(sessionMiddleware);

// Requiere Socket.IO 4.6 o superior.
io.engine.use(sessionMiddleware);

// El servidor decide qué conexiones pueden
// ingresar a la sala de espera.
io.on('connection', (socket) => {
  const usuario = socket.request.session?.usuario;

  const autorizado = ['admin', 'personal'].includes(
    usuario?.rol
  );


  // Conecto a los médicos con las novedades de recepción.
  if (usuario?.rol === 'profesional') {
    socket.join('agenda-medica');
  }

  if (autorizado) {
    socket.join('sala-espera');
  }

  console.log(
    '⚡ Socket.IO conectado. Acceso a sala:',
    autorizado ? 'autorizado' : 'no autorizado'
  );

  socket.on('disconnect', () => {
    console.log('🔌 Socket.IO desconectado');
  });
});



// ============================================================
// PARSERS
// ============================================================

app.use(
  express.json({
    limit: '1mb'
  })
);


app.use(
  express.urlencoded({

    extended:
      true,

    limit:
      '1mb'

  })
);


// ============================================================
// WEBHOOKS PÚBLICOS
//
// No requieren sesión de TurnoFlex.
// La autenticidad de Mercado Pago se valida mediante x-signature.
// ============================================================

app.use(
  '/webhooks',
  mercadoPagoWebhookRoutes
);

// ============================================================
// BOOTSTRAP LOCAL - TURNOFLEX
// ============================================================

app.use(
  '/vendor/bootstrap',
  express.static(
    path.join(
      process.cwd(),
      'node_modules',
      'bootstrap',
      'dist'
    )
  )
);

// ============================================================
// ARCHIVOS ESTÁTICOS
// ============================================================

app.use(
  express.static(
    path.join(
      process.cwd(),
      'public'
    )
  )
);


// ============================================================
// FAVICON
//
// Evita que el navegador genere un 404 innecesario si solicita
// /favicon.ico mientras usamos favicon.svg.
// ============================================================

app.get(
  '/favicon.ico',
  (req, res) => {

    return res
      .status(204)
      .end();

  }
);


// ============================================================
// USUARIO GLOBAL EN TODAS LAS VISTAS
// ============================================================

app.use(
  (req, res, next) => {

    res.locals.user =
      req.session &&
      req.session.usuario
        ? req.session.usuario
        : null;


    next();

  }
);



// ============================================================
// TURNOFLEX - SALA DE ESPERA PROTEGIDA
// ============================================================

function autorizarSalaEspera(req, res, next) {
  const usuario = req.session?.usuario;
  const esApi = req.path.startsWith('/api/');

  res.set('Cache-Control', 'no-store');

  // Sesión no iniciada.
  if (!usuario) {
    if (esApi) {
      return res.status(401).json({
        error: 'Iniciá sesión para acceder.'
      });
    }

    return res.redirect('/auth/login');
  }

  // Solo administración y recepción.
  if (!['admin', 'personal'].includes(usuario.rol)) {
    if (esApi) {
      return res.status(403).json({
        error: 'No autorizado.'
      });
    }

    return res.status(403).send(
      'No tenés permisos para abrir la sala de espera.'
    );
  }

  return next();
}

// Consulto el último llamado del día para recuperar la pantalla
// después de actualizarla o reconectarla.
async function consultarUltimoLlamadoSalaEspera(req, res) {
  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const dato = (tipo) =>
      partes.find((parte) => parte.type === tipo)?.value || '';

    const hoy = `${dato('year')}-${dato('month')}-${dato('day')}`;

    const turno = await Turno.findOne({
      fecha: hoy,
      ultimoLlamadoSalaEn: { $ne: null },
      estado: { $ne: 'cancelado' }
    })
      .select('_id cliente_id profesional_id hora ultimoLlamadoSalaEn')
      .populate('cliente_id', 'nombre')
      .populate('profesional_id', 'nombre sede')
      .sort({ ultimoLlamadoSalaEn: -1 })
      .lean();

    if (!turno?.ultimoLlamadoSalaEn) {
      return res.status(200).json({ llamado: null });
    }

    const sede = String(turno.profesional_id?.sede || '').trim();
    const coincidencia = sede.match(/consultorio\s*[-#:]?\s*[\w]+/i);
    const consultorio = coincidencia
      ? coincidencia[0].replace(/^consultorio/i, 'Consultorio')
      : sede || 'Consultorio no asignado';

    return res.status(200).json({
      llamado: {
        turnoId: String(turno._id),
        paciente: String(turno.cliente_id?.nombre || 'Paciente'),
        profesional: String(turno.profesional_id?.nombre || 'Profesional'),
        consultorio,
        hora: String(turno.hora || ''),
        fecha: new Date(turno.ultimoLlamadoSalaEn).toISOString()
      }
    });
  } catch (error) {
    console.error('Error al consultar el último llamado de sala:', error);
    return res.status(500).json({
      error: 'No se pudo obtener el último llamado de la sala.'
    });
  }
}

// Muestro los turnos de espera solamente a personal autorizado.
app.get(
  '/api/sala-espera/activos',
  autorizarSalaEspera,
  TurnoController.getTurnosSalaEspera
);

// Recupero el último llamado para mantener la pantalla actualizada.
app.get(
  '/api/sala-espera/ultimo-llamado',
  autorizarSalaEspera,
  consultarUltimoLlamadoSalaEspera
);

// Muestro los últimos cinco llamados del día.
app.get(
  '/api/sala-espera/ultimos-llamados',
  autorizarSalaEspera,
  getUltimosLlamadosSalaEspera
);

// Esta pantalla también requiere una sesión autorizada.
app.get(
  '/sala-espera',
  autorizarSalaEspera,
  (req, res) => res.render('sala-espera')
);


 // ============================================================
 // TURNOFLEX - PORTADA PREMIUM
 // ============================================================

 // Permite visitar la portada en cualquier momento
 app.get('/bienvenida', (req, res) => {
   return res.render('bienvenida');
 });

 // Muestra la portada a los visitantes sin sesión
 app.get('/', (req, res, next) => {
   if (req.session?.usuario) {
     return next();
   }

   return res.render('bienvenida');
 });


// ============================================================
// PÁGINA PRINCIPAL
// REDIRECCIÓN / PANEL SEGÚN ROL
// ============================================================

app.get(
  '/',

  asegurarAutenticacion,

  async (req, res, next) => {

    try {

      const usuario =
        req.session.usuario;


      if (!usuario) {

        return res.redirect(
          '/auth/login'
        );

      }


      const rol =
        usuario.rol;


      // ======================================================
      // PROFESIONAL
      // ======================================================

      if (
        rol ===
        'profesional'
      ) {

        return res.redirect(
          '/medico/agenda'
        );

      }


      // ======================================================
      // ADMINISTRADOR
      // ======================================================

      if (
        rol ===
        'admin'
      ) {

        return res.render(
          'inicio-admin',
          {

            tituloPage:
              'Centro de Operaciones'

          }
        );

      }


      // ======================================================
      // RECEPCIÓN
      // ======================================================

      if (
        rol ===
        'personal'
      ) {

        return res.render(
          'inicio-secretaria',
          {

            tituloPage:
              'Centro Operativo'

          }
        );

      }


      // ======================================================
      // PACIENTE
      // ======================================================

      if (
        rol ===
        'cliente'
      ) {

        const clientePerfil =
          await Cliente.findOne({

            email:
              usuario.email

          })
            .lean();


        let turnosAsignados =
          [];


        if (
          clientePerfil
        ) {

          turnosAsignados =
            await Turno.find({

              cliente_id:
                clientePerfil._id

            })

              .populate(
                'profesional_id'
              )

              .sort({

                fecha: 1,

                hora: 1

              })

              .lean();

        }


        return res.render(
          'inicio-cliente',
          {

            tituloPage:
              'Mi Portal',

            turnosAsignados

          }
        );

      }


      // ======================================================
      // ROL DESCONOCIDO
      // ======================================================

      const error =
        new Error(
          'Tu cuenta no tiene un perfil de acceso válido en TurnoFlex.'
        );


      error.statusCode =
        403;


      throw error;


    } catch (error) {

      // Ahora cualquier problema llega al
      // errorHandler global y a error.pug.
      return next(
        error
      );

    }

  }
);

// ============================================================
// TURNOFLEX - VERIFICAR CUENTAS ACTIVAS
// ============================================================

app.use(verificarCuentaHabilitada);

// ============================================================
// RUTAS PROTEGIDAS
// ============================================================

app.use(
  '/auth',
  authRoutes
);

// ============================================================
// TURNOFLEX - CUENTAS INSTITUCIONALES
// ============================================================

app.use(
  '/accesos',
  accesosInstitucionalesRoutes
);

app.use(
  '/turnos',

  asegurarAutenticacion,

  turnoRoutes
);


app.use(
  '/profesionales',

  asegurarAutenticacion,

  profesionalRoutes
);


app.use(
  '/clientes',

  asegurarAutenticacion,

  clienteRoutes
);


app.use(
  '/dashboard',

  asegurarAutenticacion,

  dashboardRoutes
);


app.use(
  '/medico',

  asegurarAutenticacion,

  profesionalDashboardRoutes
);


 // ============================================================
 // PRUEBA DE WHATSAPP - ADMINISTRADOR
 // ============================================================

 app.use('/admin/prueba-whatsapp', pruebaWhatsAppRoutes);


 
// ============================================================
// API DE RECEPCIÓN - AGENDA Y RESUMEN DIARIO
// ============================================================

app.use('/api/recepcion', recepcionResumenRoutes);

// Módulo clínico: sesiones y res.locals ya están establecidos.
// NO montar dentro de /public ni después del handler 404.
app.use('/clinica', asegurarAutenticacion, crearRouterParaTurnoFlex());


// ============================================================
// RUTA 404
//
// Debe estar después de todas las rutas reales.
// ============================================================

app.use(
  (req, res, next) => {

    console.log(
      `❌ 404 - Ruta solicitada: ${req.originalUrl}`
    );


    const error =
      new Error(
        'La página o recurso que buscás no existe.'
      );


    error.statusCode =
      404;


    return next(
      error
    );

  }
);


// ============================================================
// MANEJADOR GLOBAL DE ERRORES
//
// SIEMPRE debe ser el último middleware.
// ============================================================

app.use(
  errorHandler
);


// ============================================================
// INICIAR SERVIDOR
// ============================================================

if (
  process.env.NODE_ENV !==
  'test'
) {

  httpServer.listen(
    PORT,
    () => {

      console.log(
        '================================='
      );

      console.log(
        ' TurnoFlex'
      );

      console.log(
        ' Gestión Médica Inteligente'
      );

      console.log(
        '---------------------------------'
      );

      console.log(
        ` Inicio: http://localhost:${PORT}`
      );

      console.log(
        ` Entorno: ${process.env.NODE_ENV || 'development'}`
      );

      console.log(
        ' Socket.IO: Activo'
      );

      console.log(
        '================================='
      );

    }
  );

}


// ============================================================
// EXPORTACIONES
// ============================================================

export {
  app,
  httpServer
};