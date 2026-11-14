// ============================================================
// SERVIDOR PRINCIPAL - TURNOFLEX
// ============================================================
// Punto de entrada de la aplicación Express + Socket.IO.
// Acá configuro la conexión a MongoDB, la seguridad HTTP, las sesiones
// compartidas en tiempo real, los webhooks públicos, la sala de espera
// protegida, el enrutamiento por roles y el manejo centralizado de errores.

import path from 'path';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import session from 'express-session';
import 'dotenv/config';

// ============================================================
// 1. IMPORTACIÓN DE CONFIGURACIÓN, SERVICIOS Y MODELOS
// ============================================================

import { connectDB } from './src/config/db.js';
import { iniciarCronJobs } from './src/cron/recordatorios.js';
import { iniciarWhatsApp } from './src/utils/whatsapp.js';
import { Cliente } from './src/models/Cliente.js';
import { Turno } from './src/models/Turno.js';

// Controladores y middlewares
import TurnoController from './src/controllers/turnoController.js';
import { getUltimosLlamadosSalaEspera } from './src/controllers/salaEsperaHistorialController.js';
import { asegurarAutenticacion } from './src/middlewares/authMiddleware.js';
import { verificarCuentaHabilitada } from './src/middlewares/verificarCuentaHabilitada.js';
import { errorHandler } from './src/middlewares/errorHandler.js';

// Rutas de módulos
import authRoutes from './src/routes/authRoutes.js';
import accesosInstitucionalesRoutes from './src/routes/accesosInstitucionalesRoutes.js';
import turnoRoutes from './src/routes/turnoRoutes.js';
import profesionalRoutes from './src/routes/profesionalRoutes.js';
import clienteRoutes from './src/routes/clienteRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import profesionalDashboardRoutes from './src/routes/profesionalDashboardRoutes.js';
import mercadoPagoWebhookRoutes from './src/routes/mercadoPagoWebhookRoutes.js';
import recepcionResumenRoutes from './src/routes/recepcionResumenRoutes.js';
import pruebaWhatsAppRoutes from './src/routes/pruebaWhatsAppRoutes.js';
import { crearRouterParaTurnoFlex } from './src/routes/crearRouterParaTurnoFlex.js';


// ============================================================
// 2. INICIALIZACIÓN DE EXPRESS, HTTP Y SOCKET.IO
// ============================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Configuro el motor de plantillas Pug y oculto la cabecera tecnológica
app.disable('x-powered-by');
app.set('view engine', 'pug');
app.set('views', path.join(process.cwd(), 'src/views'));

// Habilito confianza en proxy inverso cuando corro detrás de túneles o hosting cloud
if (process.env.TF_CLOUDFLARE_TUNNEL === '1') {
  app.set('trust proxy', 'loopback');
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Creo el servidor HTTP y vinculo la instancia de Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer);
app.set('socketio', io);


// ============================================================
// 3. INICIO CONTROLADO DE BASE DE DATOS Y SERVICIOS EXTERNOS
// ============================================================

// En entorno de test evito conectar a MongoDB y levantar WhatsApp o cron jobs
if (process.env.NODE_ENV !== 'test') {
  try {
    await connectDB();
  } catch (error) {
    console.error('❌ TurnoFlex no se iniciará sin conexión a MongoDB.');
    process.exit(1);
  }

  // Arranco WhatsApp y los recordatorios automáticos una vez conectada la base
  iniciarWhatsApp(io);
  iniciarCronJobs();
}


// ============================================================
// 4. SEGURIDAD HTTP, SESIONES Y SALAS DE SOCKET.IO
// ============================================================

// Desactivo CSP temporalmente porque cargo Bootstrap, Flatpickr y Chart.js desde CDN
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// Valido que en producción exista un secreto de sesión fuerte configurado en .env
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

// Comparto la misma sesión entre Express y el motor de Socket.IO
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

// Asigno cada conexión de Socket.IO a su sala correspondiente según el rol de sesión
io.on('connection', (socket) => {
  const usuario = socket.request.session?.usuario;
  const autorizado = ['admin', 'personal'].includes(usuario?.rol);

  // Conecto a los profesionales con las novedades de presencia de recepción
  if (usuario?.rol === 'profesional') {
    socket.join('agenda-medica');
  }

  // Permito acceso a los eventos de sala de espera solo a administración y recepción
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
// 5. PARSERS, WEBHOOKS PÚBLICOS Y ARCHIVOS ESTÁTICOS
// ============================================================

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Registro el webhook de Mercado Pago antes de las sesiones; se valida por firma x-signature
app.use('/webhooks', mercadoPagoWebhookRoutes);

// Sirvo Bootstrap local desde node_modules y los recursos estáticos públicos
app.use(
  '/vendor/bootstrap',
  express.static(path.join(process.cwd(), 'node_modules', 'bootstrap', 'dist'))
);
app.use(express.static(path.join(process.cwd(), 'public')));

// Respondo 204 a /favicon.ico para evitar errores 404 en consola cuando uso favicon.svg
app.get('/favicon.ico', (req, res) => {
  return res.status(204).end();
});

// Expongo el usuario autenticado de forma global en todas las vistas Pug
app.use((req, res, next) => {
  res.locals.user = req.session && req.session.usuario ? req.session.usuario : null;
  next();
});


// ============================================================
// 6. SALA DE ESPERA EN VIVO Y ENDPOINTS DE CONSULTA
// ============================================================

// Middleware que restringe la pantalla y las APIs de sala de espera a admin y recepción
function autorizarSalaEspera(req, res, next) {
  const usuario = req.session?.usuario;
  const esApi = req.path.startsWith('/api/');

  res.set('Cache-Control', 'no-store');

  if (!usuario) {
    if (esApi) {
      return res.status(401).json({ error: 'Iniciá sesión para acceder.' });
    }
    return res.redirect('/auth/login');
  }

  if (!['admin', 'personal'].includes(usuario.rol)) {
    if (esApi) {
      return res.status(403).json({ error: 'No autorizado.' });
    }
    return res.status(403).send('No tenés permisos para abrir la sala de espera.');
  }

  return next();
}

// Recupero el último llamado del día en horario de Buenos Aires para reconstruir la pantalla al recargar
async function consultarUltimoLlamadoSalaEspera(req, res) {
  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const dato = (tipo) => partes.find((parte) => parte.type === tipo)?.value || '';
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

app.get('/api/sala-espera/activos', autorizarSalaEspera, TurnoController.getTurnosSalaEspera);
app.get('/api/sala-espera/ultimo-llamado', autorizarSalaEspera, consultarUltimoLlamadoSalaEspera);
app.get('/api/sala-espera/ultimos-llamados', autorizarSalaEspera, getUltimosLlamadosSalaEspera);
app.get('/sala-espera', autorizarSalaEspera, (req, res) => res.render('sala-espera'));


// ============================================================
// 7. PORTADA PÚBLICA Y PANEL PRINCIPAL POR ROL
// ============================================================

// Permito acceder directamente a la portada institucional
app.get('/bienvenida', (req, res) => {
  return res.render('bienvenida');
});

// Si el visitante no inició sesión, muestro la portada; si está logueado, paso al panel por rol
app.get('/', (req, res, next) => {
  if (req.session?.usuario) {
    return next();
  }
  return res.render('bienvenida');
});

// Redirijo o renderizo el inicio correspondiente según el rol del usuario autenticado
app.get('/', asegurarAutenticacion, async (req, res, next) => {
  try {
    const usuario = req.session.usuario;
    if (!usuario) {
      return res.redirect('/auth/login');
    }

    const rol = usuario.rol;

    // Panel del profesional médico
    if (rol === 'profesional') {
      return res.redirect('/medico/agenda');
    }

    // Panel del administrador
    if (rol === 'admin') {
      return res.render('inicio-admin', {
        tituloPage: 'Centro de Operaciones'
      });
    }

    // Panel de secretaría / recepción
    if (rol === 'personal') {
      return res.render('inicio-secretaria', {
        tituloPage: 'Centro Operativo'
      });
    }

    // Portal del paciente con sus turnos ordenados cronológicamente
    if (rol === 'cliente') {
      const clientePerfil = await Cliente.findOne({ email: usuario.email }).lean();
      let turnosAsignados = [];

      if (clientePerfil) {
        turnosAsignados = await Turno.find({ cliente_id: clientePerfil._id })
          .populate('profesional_id')
          .sort({ fecha: 1, hora: 1 })
          .lean();
      }

      return res.render('inicio-cliente', {
        tituloPage: 'Mi Portal',
        turnosAsignados
      });
    }

    // Rechazo cuentas que no tengan un rol reconocido
    const error = new Error('Tu cuenta no tiene un perfil de acceso válido en TurnoFlex.');
    error.statusCode = 403;
    throw error;

  } catch (error) {
    return next(error);
  }
});


// ============================================================
// 8. CONTROL DE CUENTAS ACTIVAS Y RUTAS DE LA APLICACIÓN
// ============================================================

// Verifico que la cuenta siga habilitada antes de entrar a los módulos internos
app.use(verificarCuentaHabilitada);

// Autenticación y gestión de accesos institucionales
app.use('/auth', authRoutes);
app.use('/accesos', accesosInstitucionalesRoutes);

// Módulos operativos protegidos por sesión
app.use('/turnos', asegurarAutenticacion, turnoRoutes);
app.use('/profesionales', asegurarAutenticacion, profesionalRoutes);
app.use('/clientes', asegurarAutenticacion, clienteRoutes);
app.use('/dashboard', asegurarAutenticacion, dashboardRoutes);
app.use('/medico', asegurarAutenticacion, profesionalDashboardRoutes);

// Herramientas administrativas, API de recepción y módulo de historia clínica
app.use('/admin/prueba-whatsapp', pruebaWhatsAppRoutes);
app.use('/api/recepcion', recepcionResumenRoutes);
app.use('/clinica', asegurarAutenticacion, crearRouterParaTurnoFlex());


// ============================================================
// 9. MANEJO DE RUTAS INEXISTENTES (404) Y ERRORES GLOBALES
// ============================================================

// Capturo cualquier ruta no declarada y la derivo al manejador global
app.use((req, res, next) => {
  console.log(`❌ 404 - Ruta solicitada: ${req.originalUrl}`);
  const error = new Error('La página o recurso que buscás no existe.');
  error.statusCode = 404;
  return next(error);
});

// Middleware final de manejo de errores
app.use(errorHandler);


// ============================================================
// 10. ARRANQUE DEL SERVIDOR Y EXPORTACIONES
// ============================================================

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log('=================================');
    console.log(' TurnoFlex');
    console.log(' Gestión Médica Inteligente');
    console.log('---------------------------------');
    console.log(` Inicio: http://localhost:${PORT}`);
    console.log(` Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(' Socket.IO: Activo');
    console.log('=================================');
  });
}

export { app, httpServer };