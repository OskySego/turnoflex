/**
 * TURNOFLEX | MIGRACIÓN Y POBLACIÓN DE BASE DE DATOS
 *
 * Versión 3.0 | Tercera versión de la base de datos.
 * Se modificaron los precios de las especialidades, se optimizó el esquema de pagos
 * y se incluyeron registros de historias clínicas reales para los pacientes.
 */
import mongoose from 'mongoose';
import 'dotenv/config';
import { Cliente } from './src/models/Cliente.js';
import { Profesional } from './src/models/Profesional.js';
import { Turno } from './src/models/Turno.js';
import { Usuario } from './src/models/Usuario.js';
import { HistoriaClinica } from './src/models/HistoriaClinica.js';
import { Especialidad } from './src/models/Especialidad.js';

const usuariosBase = [
      { nombre: 'Oscar Segovia', email: 'segoviainfo2012@gmail.com', password: 'password123', rol: 'admin' },
      { nombre: 'Neuyin Rosana Herrera', email: 'neuyin.herrera.sun@gmail.com', password: 'password123', rol: 'admin' },
      { nombre: 'Maximiliano Carlos Ratti', email: 'telcom.web@gmail.com', password: 'password123', rol: 'admin' },
      { nombre: 'Karina Ajhuacho Choque', email: 'Kariajh11@gmail.com', password: 'password123', rol: 'admin' },
      { nombre: 'Mariana Recepción', email: 'secretaria1@turnoflex.com', password: 'password123', rol: 'personal' },
      { nombre: 'Claudia Secretaría', email: 'secretaria2@turnoflex.com', password: 'password123', rol: 'personal' },
      { nombre: 'Dra. María Gómez', email: 'maria.gomez@turnoflex.com', password: 'password123', rol: 'profesional' },
      { nombre: 'Dr. Roberto Sánchez', email: 'roberto.sanchez@turnoflex.com', password: 'password123', rol: 'profesional' },
      { nombre: 'Dr. Carlos Pérez', email: 'carlos.perez@turnoflex.com', password: 'password123', rol: 'profesional' },
      { nombre: 'Dra. Lucía Fernández', email: 'lucia.fernandez@turnoflex.com', password: 'password123', rol: 'profesional' },
      { nombre: 'Dr. Esteban Quito', email: 'esteban.quito@turnoflex.com', password: 'password123', rol: 'profesional' },
      { nombre: 'Dra. Sofía Benítez', email: 'sofia.benitez@turnoflex.com', password: 'password123', rol: 'profesional' },
      { nombre: 'Dr. Martín Varela', email: 'martin.varela@turnoflex.com', password: 'password123', rol: 'profesional' },
      { nombre: 'Dra. Jimena Torres', email: 'jimena.torres@turnoflex.com', password: 'password123', rol: 'profesional' },
      { nombre: 'Oscar Segovia', email: 'oscar@ejemplo.com', password: 'password123', rol: 'cliente' },
      { nombre: 'Valeria Román', email: 'valeria@ejemplo.com', password: 'password123', rol: 'cliente' },
      { nombre: 'Martín Pérez', email: 'martin@ejemplo.com', password: 'password123', rol: 'cliente' },
      { nombre: 'Carla Ruiz', email: 'carla.ruiz@ejemplo.com', password: 'password123', rol: 'cliente' },
      { nombre: 'Lucas Giménez', email: 'lucas.gimenez@ejemplo.com', password: 'password123', rol: 'cliente' },
      { nombre: 'Ana Gómez', email: 'ana.gomez@ejemplo.com', password: 'password123', rol: 'cliente' },
      { nombre: 'Diego Torres', email: 'diego.torres@ejemplo.com', password: 'password123', rol: 'cliente' },
      { nombre: 'Florencia Sosa', email: 'florencia.sosa@ejemplo.com', password: 'password123', rol: 'cliente' }
];

const pacientesBase = [
      { nombre: 'Oscar Segovia', dni: '33444555', fechaNacimiento: new Date('1989-01-06'), genero: 'Masculino', email: 'oscar@ejemplo.com', telefono: '1155443322', domicilio: { calle: 'Av. Rivadavia', numero: '1234', localidad: 'Morón', provincia: 'Buenos Aires' }, obraSocial: { empresa: 'OSDE', numeroAfiliado: '12345678', plan: '310' } },
      { nombre: 'Valeria Román', dni: '35666777', fechaNacimiento: new Date('1992-05-14'), genero: 'Femenino', email: 'valeria@ejemplo.com', telefono: '1122334455', domicilio: { calle: 'San Martín', numero: '456', localidad: 'La Matanza', provincia: 'Buenos Aires' }, obraSocial: { empresa: '', numeroAfiliado: '', plan: '' } },
      { nombre: 'Martín Pérez', dni: '28999888', fechaNacimiento: new Date('1980-11-20'), genero: 'Masculino', email: 'martin@ejemplo.com', telefono: '1199887766', domicilio: { calle: 'Belgrano', numero: '789', localidad: 'Morón', provincia: 'Buenos Aires' }, obraSocial: { empresa: 'Swiss Medical', numeroAfiliado: '98765432', plan: 'SM20' } },
      { nombre: 'Carla Ruiz', dni: '40111222', fechaNacimiento: new Date('1995-03-10'), genero: 'Femenino', email: 'carla.ruiz@ejemplo.com', telefono: '1166778899', domicilio: { calle: 'Mitre', numero: '321', localidad: 'San Justo', provincia: 'Buenos Aires' }, obraSocial: { empresa: 'Galeno', numeroAfiliado: '456123', plan: '220' } },
      { nombre: 'Lucas Giménez', dni: '33222111', fechaNacimiento: new Date('1988-07-25'), genero: 'Masculino', email: 'lucas.gimenez@ejemplo.com', telefono: '1133221100', domicilio: { calle: 'Roca', numero: '654', localidad: 'Haedo', provincia: 'Buenos Aires' }, obraSocial: { empresa: 'OSDE', numeroAfiliado: '789456', plan: '210' } },
      { nombre: 'Ana Gómez', dni: '37444555', fechaNacimiento: new Date('1991-09-12'), genero: 'Femenino', email: 'ana.gomez@ejemplo.com', telefono: '1144332211', domicilio: { calle: 'Av. Santa Fe', numero: '1500', localidad: 'Capital Federal', provincia: 'Buenos Aires' }, obraSocial: { empresa: 'Medicus', numeroAfiliado: '963852', plan: 'Azul' } },
      { nombre: 'Diego Torres', dni: '29888777', fechaNacimiento: new Date('1983-12-05'), genero: 'Masculino', email: 'diego.torres@ejemplo.com', telefono: '1188990011', domicilio: { calle: 'Güemes', numero: '852', localidad: 'Ramos Mejía', provincia: 'Buenos Aires' }, obraSocial: { empresa: 'Swiss Medical', numeroAfiliado: '147852', plan: 'SM30' } },
      { nombre: 'Florencia Sosa', dni: '42333444', fechaNacimiento: new Date('1998-04-18'), genero: 'Femenino', email: 'florencia.sosa@ejemplo.com', telefono: '1177665544', domicilio: { calle: 'Rawson', numero: '963', localidad: 'Castelar', provincia: 'Buenos Aires' }, obraSocial: { empresa: '', numeroAfiliado: '', plan: '' } }
];

const profesionalesBase = [
      { nombre: "Dra. María Gómez", dni: "25412365", genero: "Femenino", email: "maria.gomez@turnoflex.com", telefono: "1144556677", matricula: "MN 45892", especialidad: "Clínica Médica", subespecialidad: "Medicina Preventiva", tipoCobertura: "obra_social", sede: "Sede Central - Consultorio 2", diasAtencion: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'], horaInicio: "08:00", horaFin: "14:00", duracionTurnoMinutos: 30, modalidad: "presencial", permiteSobreturnos: false, ofreceTelemedicina: false },
      { nombre: "Dr. Roberto Sánchez", dni: "20111222", genero: "Masculino", email: "roberto.sanchez@turnoflex.com", telefono: "1166778899", matricula: "MN 55412", especialidad: "Clínica Médica", subespecialidad: "Geriatría", tipoCobertura: "ambas", sede: "Sede Central - Consultorio 5", diasAtencion: ['Lunes', 'Miércoles', 'Viernes'], horaInicio: "09:00", horaFin: "15:00", duracionTurnoMinutos: 30, modalidad: "ambas", permiteSobreturnos: true, diasSobreturnos: ['Lunes', 'Miércoles'], horaInicioSobreturnos: "14:00", horaFinSobreturnos: "15:00", ofreceTelemedicina: true, diasTelemedicina: ['Viernes'], horaInicioTelemedicina: "16:00", horaFinTelemedicina: "18:00" },
      { nombre: "Dr. Carlos Pérez", dni: "22896321", genero: "Masculino", email: "carlos.perez@turnoflex.com", telefono: "1199887766", matricula: "MN 78910", especialidad: "Cardiología", subespecialidad: "Electrocardiografía", tipoCobertura: "particular", sede: "Sede Norte - Consultorio 4", diasAtencion: ['Martes', 'Jueves'], horaInicio: "10:00", horaFin: "16:00", duracionTurnoMinutos: 20, modalidad: "presencial", permiteSobreturnos: true, diasSobreturnos: ['Martes'], horaInicioSobreturnos: "15:00", horaFinSobreturnos: "16:00", ofreceTelemedicina: false },
      { nombre: "Dra. Lucía Fernández", dni: "27333444", genero: "Femenino", email: "lucia.fernandez@turnoflex.com", telefono: "1122334455", matricula: "MN 99887", especialidad: "Pediatría", subespecialidad: "Puericultura", tipoCobertura: "ambas", sede: "Sede Oeste - Consultorio 1", diasAtencion: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'], horaInicio: "08:30", horaFin: "13:30", duracionTurnoMinutos: 30, modalidad: "presencial", permiteSobreturnos: true, diasSobreturnos: ['Miércoles'], horaInicioSobreturnos: "13:00", horaFinSobreturnos: "13:30", ofreceTelemedicina: true, diasTelemedicina: ['Martes', 'Jueves'], horaInicioTelemedicina: "14:00", horaFinTelemedicina: "16:00" },
      { nombre: "Dr. Esteban Quito", dni: "29555666", genero: "Masculino", email: "esteban.quito@turnoflex.com", telefono: "1177889900", matricula: "MN 33221", especialidad: "Dermatología", subespecialidad: "Estética", tipoCobertura: "particular", sede: "Sede Sur - Consultorio 3", diasAtencion: ['Miércoles', 'Jueves', 'Viernes'], horaInicio: "13:00", horaFin: "19:00", duracionTurnoMinutos: 30, modalidad: "ambas", permiteSobreturnos: false, ofreceTelemedicina: false },
      { nombre: "Dra. Sofía Benítez", dni: "31444555", genero: "Femenino", email: "sofia.benitez@turnoflex.com", telefono: "1122113344", matricula: "MN 44112", especialidad: "Oftalmología", subespecialidad: "Cirugía Refractiva", tipoCobertura: "ambas", sede: "Sede Central - Consultorio 6", diasAtencion: ['Lunes', 'Miércoles', 'Viernes'], horaInicio: "09:00", horaFin: "17:00", duracionTurnoMinutos: 30, modalidad: "presencial", permiteSobreturnos: false, ofreceTelemedicina: false },
      { nombre: "Dr. Martín Varela", dni: "28777666", genero: "Masculino", email: "martin.varela@turnoflex.com", telefono: "1166554433", matricula: "MN 66789", especialidad: "Traumatología", subespecialidad: "Medicina Deportiva", tipoCobertura: "ambas", sede: "Sede Norte - Consultorio 2", diasAtencion: ['Martes', 'Jueves', 'Sábados'], horaInicio: "08:00", horaFin: "12:00", duracionTurnoMinutos: 30, modalidad: "ambas", permiteSobreturnos: true, ofreceTelemedicina: false },
      { nombre: "Dra. Jimena Torres", dni: "32555444", genero: "Femenino", email: "jimena.torres@turnoflex.com", telefono: "1155443311", matricula: "MN 11223", especialidad: "Neurología", subespecialidad: "Trastornos del Sueño", tipoCobertura: "particular", sede: "Sede Oeste - Consultorio 5", diasAtencion: ['Lunes', 'Jueves'], horaInicio: "14:00", horaFin: "19:00", duracionTurnoMinutos: 45, modalidad: "ambas", permiteSobreturnos: false, ofreceTelemedicina: true }
];

// Precios modificados y actualizados para la Versión 3.0
const especialidadesBase = [
  { nombre: 'Clínica Médica', precioParticular: 25000, copagoObraSocial: 8000, montoSena: 8000, activa: true },
  { nombre: 'Cardiología', precioParticular: 30000, copagoObraSocial: 10000, montoSena: 10000, activa: true },
  { nombre: 'Pediatría', precioParticular: 26000, copagoObraSocial: 8500, montoSena: 8500, activa: true },
  { nombre: 'Dermatología', precioParticular: 28000, copagoObraSocial: 9000, montoSena: 9000, activa: true },
  { nombre: 'Oftalmología', precioParticular: 29000, copagoObraSocial: 9500, montoSena: 9500, activa: true },
  { nombre: 'Traumatología', precioParticular: 28500, copagoObraSocial: 9000, montoSena: 9000, activa: true },
  { nombre: 'Neurología', precioParticular: 32000, copagoObraSocial: 11000, montoSena: 11000, activa: true },
  { nombre: 'Ginecología', precioParticular: 30000, copagoObraSocial: 10500, montoSena: 10500, activa: true },
  { nombre: 'Obstetricia', precioParticular: 30500, copagoObraSocial: 10500, montoSena: 10500, activa: true },
  { nombre: 'Endocrinología', precioParticular: 32000, copagoObraSocial: 11500, montoSena: 11500, activa: true },
  { nombre: 'Gastroenterología', precioParticular: 33000, copagoObraSocial: 11500, montoSena: 11500, activa: true },
  { nombre: 'Nutrición', precioParticular: 22000, copagoObraSocial: 7500, montoSena: 7500, activa: true },
  { nombre: 'Psiquiatría', precioParticular: 35000, copagoObraSocial: 12000, montoSena: 12000, activa: true },
  { nombre: 'Cirugía General', precioParticular: 40000, copagoObraSocial: 15000, montoSena: 15000, activa: true }
];

// Historias clínicas reales y detalladas para probar el módulo de pacientes
const historialesClinicos = [
  { motivo: "Control cardiológico anual", evolucion: "Paciente asintomático. Refiere buena tolerancia al ejercicio. Tensión arterial 120/80 mmHg. Frecuencia cardíaca 72 lpm. Se solicita ECG y laboratorio de control.", diagnostico: "Paciente sano en seguimiento preventivo." },
  { motivo: "Dolor abdominal agudo", evolucion: "Paciente refiere dolor en fosa ilíaca derecha de 24hs de evolución, acompañado de náuseas. Abdomen blando, depresible, muy doloroso a la palpación profunda. Blumberg positivo.", diagnostico: "Cuadro compatible con apendicitis aguda. Se deriva de urgencia a guardia quirúrgica." },
  { motivo: "Dolor lumbar crónico", evolucion: "Dolor lumbar persistente que empeora al estar mucho tiempo sentado. Sin irradiación a miembros inferiores. Lasegue negativo. Se indica elongación y kinesiología.", diagnostico: "Lumbalgia mecánica postural." },
  { motivo: "Chequeo pediátrico de rutina", evolucion: "Control anual. Curva de peso y talla en percentilos adecuados para su edad. Esquema de vacunación nacional completo. Se extienden certificados escolares.", diagnostico: "Paciente pediátrico en óptimo estado general." },
  { motivo: "Dermatitis irritativa", evolucion: "Presenta lesiones eritematosas pruriginosas en dorso de ambas manos tras exposición a productos de limpieza sin protección. Ausencia de sobreinfección.", diagnostico: "Dermatitis por contacto. Se indica corticoide tópico por 5 días." },
  { motivo: "Control oftalmológico", evolucion: "Refiere visión borrosa de lejos al leer carteles. Se realiza fondo de ojo: normal. Agudeza visual OD 20/40, OI 20/30.", diagnostico: "Miopía leve. Se emite receta para anteojos aéreos." },
  { motivo: "Seguimiento traumatológico", evolucion: "Evolución muy favorable post-esguince de tobillo derecho. Movilidad recuperada en un 90%. Tolerancia a la carga completa sin dolor.", diagnostico: "Esguince de tobillo en etapa de resolución final. Alta médica." },
  { motivo: "Cefalea tensional", evolucion: "Episodios de cefalea opresiva bitemporal vespertina, asociada a estrés laboral. Examen neurológico sin particularidades, reflejos conservados.", diagnostico: "Cefalea tensional episódica. Se ajusta analgesia y se recomienda descanso." }
];

const notasEvolucion = [
  { anamnesis: "Refiere buen descanso. Sin dolor precordial en las últimas semanas.", examen: "CV: R1 y R2 normofonéticos, sin soplos. Pulsos periféricos presentes y simétricos.", diagnostico: "Normotenso.", indicaciones: "Continuar con dieta hiposódica y actividad física aeróbica 3 veces por semana." },
  { anamnesis: "Dolor abdominal intenso post ingesta copiosa.", examen: "Abdomen distendido, ruidos hidroaéreos conservados, doloroso a palpación profunda en epigastrio.", diagnostico: "Dispepsia biliar.", indicaciones: "Omeprazol 20mg en ayunas por 14 días. Dieta hepatoprotectora." },
  { anamnesis: "Molestia lumbar persistente. Refiere sedentarismo laboral.", examen: "Tensión evidente en musculatura paravertebral bilateral. Limitación leve a la flexión del tronco.", diagnostico: "Contractura muscular lumbar.", indicaciones: "Kinesiología 10 sesiones, Ibuprofeno 600mg condicional al dolor." },
  { anamnesis: "Control de salud requerido para apto físico deportivo.", examen: "Paciente lúcido, hidratado, afebril. Auscultación pulmonar con buena entrada de aire bilateral.", diagnostico: "Examen físico normal.", indicaciones: "Se entrega apto físico. Realizar hemograma de control anual." },
  { anamnesis: "Picazón intensa en ambas manos de 48hs de evolución.", examen: "Eritema franco y descamación en dorso de manos. Piel seca.", diagnostico: "Dermatitis atópica/contacto.", indicaciones: "Crema con betametasona cada 12hs por 5 días. Uso de guantes para tareas domésticas." },
  { anamnesis: "Dificultad para enfocar pantallas luego de jornadas laborales largas.", examen: "Test de agudeza visual revela déficit miópico. Resto del examen oftalmológico dentro de parámetros normales.", diagnostico: "Miopía y fatiga visual.", indicaciones: "Uso de lentes de descanso con filtro azul durante jornada laboral." },
  { anamnesis: "Mejoría sustancial del dolor en tobillo. Puede caminar sin asistencia.", examen: "Sin edema residual. Ligamentos laterales estables. Dolor leve a la eversión forzada.", diagnostico: "Esguince grado II en remisión.", indicaciones: "Retomar actividad deportiva progresivamente utilizando tobillera elástica." },
  { anamnesis: "Dolor de cabeza focalizado en la región occipital al finalizar el día.", examen: "Examen neurológico completo conservado. Sin signos de foco motor ni sensitivo.", diagnostico: "Cefalea tensional.", indicaciones: "Higiene del sueño, manejo del estrés y Paracetamol 1g ante episodios agudos." }
];

const citasBase = [
  { paciente: 0, profesional: 0, fecha: '2026-10-05', hora: '09:30', estado: 'atendido', origen: 'migracion v3' },
  { paciente: 1, profesional: 1, fecha: '2026-10-12', hora: '14:00', estado: 'atendido', origen: 'migracion v3' },
  { paciente: 2, profesional: 2, fecha: '2026-10-14', hora: '10:20', estado: 'atendido', origen: 'migracion v3' },
  { paciente: 3, profesional: 3, fecha: '2026-10-15', hora: '09:00', estado: 'atendido', origen: 'migracion v3' },
  { paciente: 4, profesional: 4, fecha: '2026-10-19', hora: '13:30', estado: 'atendido', origen: 'migracion v3' },
  { paciente: 5, profesional: 5, fecha: '2026-10-21', hora: '11:00', estado: 'atendido', origen: 'migracion v3' },
  { paciente: 6, profesional: 6, fecha: '2026-10-22', hora: '08:30', estado: 'atendido', origen: 'migracion v3' },
  { paciente: 7, profesional: 7, fecha: '2026-10-23', hora: '15:30', estado: 'atendido', origen: 'migracion v3' }
];

function patronExacto(valor) {
  const escapado = String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escapado}$`, 'i');
}
const iguales = (a, b) => String(a?._id || a || '') === String(b?._id || b || '');
const resumen = Object.fromEntries(
  ['usuarios', 'pacientes', 'profesionales', 'especialidades', 'turnos', 'historiasClinicas', 'notasEvolucion']
    .map(tipo => [tipo, { nuevos: 0, existentes: 0, omitidos: 0 }])
);
const contar = (tipo, accion) => { resumen[tipo][accion] += 1; };

function validarModelos() {
  const camposTurno = ['cliente_id', 'profesional_id', 'fecha', 'hora', 'estado', 'metodoPago', 'estadoPago', 'montoSena'];
  const faltantesTurno = camposTurno.filter(campo => !Turno.schema.path(campo));
  if (faltantesTurno.length) throw new Error(`Turno.js: faltan ${faltantesTurno.join(', ')}`);
}

async function crearUsuarios() {
  const r = [];
  for (const datos of usuariosBase) {
    let usuario = await Usuario.findOne({ email: patronExacto(datos.email) });
    if (!usuario) {
      usuario = await Usuario.create(datos);
      contar('usuarios', 'nuevos');
    } else {
      contar('usuarios', 'existentes');
    }
    r.push(usuario);
  }
  return r;
}

async function crearPacientes() {
  const r = [];
  for (const datos of pacientesBase) {
    let paciente = await Cliente.findOne({ dni: datos.dni });
    if (!paciente) {
      paciente = await Cliente.create(datos);
      contar('pacientes', 'nuevos');
    } else {
      contar('pacientes', 'existentes');
    }
    r.push(paciente);
  }
  return r;
}

async function crearProfesionales() {
  const r = [];
  for (const datos of profesionalesBase) {
    let profesional = await Profesional.findOne({ matricula: datos.matricula });
    if (!profesional) {
      profesional = await Profesional.create(datos);
      contar('profesionales', 'nuevos');
    } else {
      contar('profesionales', 'existentes');
    }
    r.push(profesional);
  }
  return r;
}

async function crearEspecialidades() {
  for (const datos of especialidadesBase) {
    const existe = await Especialidad.findOne({ nombre: datos.nombre });
    if (existe) {
      // Actualiza los precios a la versión 3.0
      await Especialidad.updateOne({ nombre: datos.nombre }, { $set: { precioParticular: datos.precioParticular, copagoObraSocial: datos.copagoObraSocial, montoSena: datos.montoSena } });
      contar('especialidades', 'existentes');
    } else {
      await Especialidad.create(datos);
      contar('especialidades', 'nuevos');
    }
  }
}

async function crearTurnos(pacientes, profesionales) {
  const r = [];
  for (const cita of citasBase) {
    const paciente = pacientes[cita.paciente];
    const profesional = profesionales[cita.profesional];
    if (!paciente || !profesional) continue;

    let turno = await Turno.findOne({ profesional_id: profesional._id, fecha: cita.fecha, hora: cita.hora });
    
    if (!turno) {
      const especialidad = await Especialidad.findOne({ nombre: profesional.especialidad });
      const conCobertura = Boolean(String(paciente.obraSocial?.empresa || '').trim());
      const admiteObraSocial = ['obra_social', 'ambas'].includes(profesional.tipoCobertura);
      const precio = conCobertura && admiteObraSocial ? Number(especialidad.copagoObraSocial) : Number(especialidad.precioParticular);

      turno = await Turno.create({
        cliente_id: paciente._id, 
        profesional_id: profesional._id,
        fecha: cita.fecha, 
        hora: cita.hora, 
        estado: cita.estado, 
        modalidad: 'presencial',
        metodoPago: 'efectivo', 
        estadoPago: precio > 0 ? 'total_pagado' : 'sin_cargo',
        montoSena: especialidad.montoSena || 5000, 
      });
      contar('turnos', 'nuevos');
    } else {
      contar('turnos', 'existentes');
    }
    r.push(turno);
  }
  return r;
}

async function vincularCuentas(usuarios, pacientes, profesionales) {
  const enlaces = [
    ...pacientes.map((item, i) => ({ tipo: 'cliente_id', ficha: item, usuario: usuariosBase.findIndex(u => u.rol === 'cliente' && u.email === pacientesBase[i].email) })),
    ...profesionales.map((item, i) => ({ tipo: 'profesional_id', ficha: item, usuario: usuariosBase.findIndex(u => u.rol === 'profesional' && u.email === profesionalesBase[i].email) }))
  ];
  for (const { tipo, ficha, usuario: i } of enlaces) {
    if (!ficha || i < 0 || !usuarios[i]) continue;
    await Usuario.collection.updateOne({ _id: usuarios[i]._id, [tipo]: null }, { $set: { [tipo]: ficha._id } });
  }
}

async function crearHistorias(pacientes, profesionales, usuarios, turnos) {
  for (let p = 0; p < pacientes.length; p++) {
    const paciente = pacientes[p];
    const usuarioProfesional = usuarios.find(u => u?.rol === 'profesional' && u.email === profesionalesBase[p]?.email);
    const turno = turnos[p];
    
    if (!paciente || !usuarioProfesional || !turno || turno.estado !== 'atendido') continue;

    const historiaDatos = historialesClinicos[p] || historialesClinicos[0];
    
    const datos = {
      cliente_id: paciente._id, 
      profesional_id: usuarioProfesional._id, 
      turno_id: turno._id,
      fecha: new Date(`${turno.fecha}T${turno.hora}:00-03:00`),
      motivoConsulta: historiaDatos.motivo,
      evolucion: historiaDatos.evolucion,
      diagnostico: historiaDatos.diagnostico,
      archivosAdjuntos: []
    };
    
    const existe = await HistoriaClinica.findOne({ cliente_id: paciente._id, motivoConsulta: datos.motivoConsulta });
    if (existe) { contar('historiasClinicas', 'existentes'); continue; }
    
    await HistoriaClinica.create(datos);
    contar('historiasClinicas', 'nuevos');
  }
}

async function crearNotasClinicas(pacientes, profesionales, usuarios, turnos) {
  let TFNotaClinica;
  try {
    ({ default: TFNotaClinica } = await import('./src/models/NotaClinica.js'));
  } catch (e) {
    return; // Si el módulo no existe, se ignora
  }
  if (!TFNotaClinica) return;
  
  for (let p = 0; p < pacientes.length; p++) {
    const paciente = pacientes[p];
    const profesional = profesionales[p];
    const usuarioProfesional = usuarios.find(u => u?.rol === 'profesional' && u.email === profesionalesBase[p]?.email);
    const turno = turnos[p];
    
    if (!paciente || !profesional || !usuarioProfesional || !turno || turno.estado !== 'atendido') continue;

    const notaDatos = notasEvolucion[p] || notasEvolucion[0];
    const motivoBase = historialesClinicos[p]?.motivo || "Control general";

    const existe = await TFNotaClinica.findOne({ pacienteId: paciente._id, motivoConsulta: motivoBase });
    if (existe) { contar('notasEvolucion', 'existentes'); continue; }
    
    await TFNotaClinica.create({
      pacienteId: paciente._id, 
      turnoId: turno._id, 
      profesionalId: profesional._id,
      usuarioAutorId: usuarioProfesional._id, 
      tipo: 'evolucion',
      registradoEn: new Date(new Date(`${turno.fecha}T${turno.hora}:00-03:00`).getTime() + 1800000),
      motivoConsulta: motivoBase,
      anamnesis: notaDatos.anamnesis,
      examenFisico: notaDatos.examen,
      diagnostico: notaDatos.diagnostico,
      indicaciones: notaDatos.indicaciones
    });
    contar('notasEvolucion', 'nuevos');
  }
}

async function vistaPrevia() {
  const actuales = await Promise.all([
    Usuario.countDocuments(), Cliente.countDocuments(), Profesional.countDocuments(),
    Especialidad.countDocuments(), Turno.countDocuments(), HistoriaClinica.countDocuments()
  ]);
  console.log('VISTA PREVIA DE MIGRACIÓN V3.0');
  console.log('Base Conectada:', mongoose.connection.name);
  console.log('Esta es la tercera versión de la base de datos de TurnoFlex.');
  console.log('Se modificarán los precios de las especialidades y se incluirán historias clínicas reales.');
  console.log('Para confirmar la migración ejecutá: node seed.js --aplicar');
}

async function ejecutar() {
  const aplicar = process.argv.includes('--aplicar');
  validarModelos();
  if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI en .env.');
  
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  try {
    if (!aplicar) return await vistaPrevia();
    console.log('Iniciando migración v3.0 e inyección de datos clínicos...');
    
    const usuarios = await crearUsuarios();
    const pacientes = await crearPacientes();
    const profesionales = await crearProfesionales();
    await crearEspecialidades();
    const turnos = await crearTurnos(pacientes, profesionales);
    
    await vincularCuentas(usuarios, pacientes, profesionales);
    await crearHistorias(pacientes, profesionales, usuarios, turnos);
    await crearNotasClinicas(pacientes, profesionales, usuarios, turnos);
    
    console.log('MIGRACIÓN COMPLETADA. RESUMEN:', JSON.stringify(resumen, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

ejecutar().catch(async e => {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
  try { await mongoose.disconnect(); } catch {}
});