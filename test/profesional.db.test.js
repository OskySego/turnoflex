
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  test,
  expect,
  jest
} from '@jest/globals';

import { Profesional } from '../src/models/Profesional.js';

// La primera ejecución puede descargar MongoDB temporal.
jest.setTimeout(180000);

let mongoTemporal;
let conexionPruebas;
let ProfesionalPrueba;

// Datos completamente ficticios.
function datosProfesional(cambios = {}) {
  return {
    nombre: 'María Fernández',
    dni: '30000123',
    genero: 'Femenino',
    email: 'medica@turnoflex.test',
    telefono: '1100000000',
    matricula: 'MAT-PRUEBA-100',
    especialidad: 'Clínica Médica',
    subespecialidad: 'General',
    tipoCobertura: 'ambas',
    diasAtencion: ['Lunes', 'Miércoles'],
    sede: 'Sede Central - Consultorio 6',
    horaInicio: '08:00',
    horaFin: '14:00',
    duracionTurnoMinutos: 30,
    ...cambios
  };
}

// ========================================
// CREAR BASE TEMPORAL
// ========================================

beforeAll(async () => {
  mongoTemporal = await MongoMemoryServer.create();

  conexionPruebas = await mongoose
    .createConnection(mongoTemporal.getUri(), {
      serverSelectionTimeoutMS: 15000
    })
    .asPromise();

  // Usamos el esquema real de TurnoFlex,
  // pero conectado a MongoDB temporal.
  ProfesionalPrueba = conexionPruebas.model(
    'Profesional',
    Profesional.schema
  );

  // Esperar la creación de índices únicos.
  await ProfesionalPrueba.init();
});

// ========================================
// LIMPIAR REGISTROS ENTRE PRUEBAS
// ========================================

afterEach(async () => {
  if (ProfesionalPrueba) {
    await ProfesionalPrueba.deleteMany({});
  }
});

// ========================================
// CERRAR BASE TEMPORAL
// ========================================

afterAll(async () => {
  if (conexionPruebas) {
    await conexionPruebas.close();
  }

  if (mongoTemporal) {
    await mongoTemporal.stop();
  }
});

// ========================================
// PRUEBAS DE INTEGRACIÓN
// ========================================

describe('TurnoFlex - MongoDB profesionales', () => {

  test('Debe guardar un profesional en MongoDB', async () => {

    const creado = await ProfesionalPrueba.create(
      datosProfesional()
    );

    const guardado = await ProfesionalPrueba.findById(
      creado._id
    ).lean();

    expect(guardado).not.toBeNull();

    expect(guardado.nombre).toBe(
      'María Fernández'
    );

    expect(guardado.especialidad).toBe(
      'Clínica Médica'
    );

    expect(guardado.sede).toBe(
      'Sede Central - Consultorio 6'
    );
  });

  test('Debe actualizar días y horarios de atención', async () => {

    const creado = await ProfesionalPrueba.create(
      datosProfesional()
    );

    await ProfesionalPrueba.findByIdAndUpdate(
      creado._id,
      {
        $set: {
          diasAtencion: [
            'Martes',
            'Jueves',
            'Viernes'
          ],
          horaInicio: '09:00',
          horaFin: '17:00',
          duracionTurnoMinutos: 45
        }
      },
      {
        runValidators: true
      }
    );

    const actualizado = await ProfesionalPrueba.findById(
      creado._id
    ).lean();

    expect(actualizado.diasAtencion).toEqual([
      'Martes',
      'Jueves',
      'Viernes'
    ]);

    expect(actualizado.horaInicio).toBe('09:00');
    expect(actualizado.horaFin).toBe('17:00');

    expect(actualizado.duracionTurnoMinutos).toBe(45);
  });

  test('Debe guardar sobreturnos y telemedicina', async () => {

    const creado = await ProfesionalPrueba.create(
      datosProfesional()
    );

    await ProfesionalPrueba.findByIdAndUpdate(
      creado._id,
      {
        $set: {
          permiteSobreturnos: true,
          diasSobreturnos: ['Viernes'],
          horaInicioSobreturnos: '17:00',
          horaFinSobreturnos: '19:00',
          cantidadMaximaSobreturnos: 3,

          ofreceTelemedicina: true,
          diasTelemedicina: ['Sábado'],
          horaInicioTelemedicina: '09:00',
          horaFinTelemedicina: '12:00'
        }
      },
      {
        runValidators: true
      }
    );

    const actualizado = await ProfesionalPrueba.findById(
      creado._id
    ).lean();

    expect(actualizado.permiteSobreturnos).toBe(true);
    expect(actualizado.diasSobreturnos).toEqual([
      'Viernes'
    ]);
    expect(actualizado.cantidadMaximaSobreturnos).toBe(3);

    expect(actualizado.ofreceTelemedicina).toBe(true);
    expect(actualizado.diasTelemedicina).toEqual([
      'Sábado'
    ]);
    expect(actualizado.horaInicioTelemedicina).toBe('09:00');
    expect(actualizado.horaFinTelemedicina).toBe('12:00');
  });

  test('Debe impedir registrar dos profesionales con el mismo DNI', async () => {

    await ProfesionalPrueba.create(
      datosProfesional()
    );

    const repetido = datosProfesional({
      nombre: 'Otro Profesional',
      email: 'otro@turnoflex.test',
      matricula: 'MAT-PRUEBA-200'
    });

    await expect(
      ProfesionalPrueba.create(repetido)
    ).rejects.toMatchObject({
      code: 11000
    });
  });

});