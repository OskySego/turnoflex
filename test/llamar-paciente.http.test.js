
import express from 'express';
import request from 'supertest';

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest
} from '@jest/globals';

import { TurnoController } from '../src/controllers/turnoController.js';
import { Turno } from '../src/models/Turno.js';
import { Profesional } from '../src/models/Profesional.js';

// ============================================================
// TURNOFLEX - TEST HTTP DE LLAMADOS MÉDICOS
// ============================================================

// Identificadores ficticios.
const turnoId = '507f1f77bcf86cd799439011';
const profesionalId = '507f1f77bcf86cd799439012';

// ============================================================
// 1. FECHA ACTUAL DE BUENOS AIRES
// ============================================================

function fechaHoy() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const obtener = tipo =>
    partes.find(p => p.type === tipo)?.value || '';

  return (
    obtener('year') + '-' +
    obtener('month') + '-' +
    obtener('day')
  );
}

// ============================================================
// 2. APLICACIÓN EXPRESS EXCLUSIVA PARA PRUEBAS
// ============================================================

// No utilizamos app.js.
// No iniciamos el servidor real de TurnoFlex.

const app = express();

app.use(express.json());

// ============================================================
// 3. SIMULAR UNA SESIÓN DE USUARIO
// ============================================================

app.use((req, res, next) => {
  req.session = {
    usuario: {
      rol: req.get('x-test-rol') || 'profesional',
      email: 'medica@turnoflex.test'
    }
  };

  next();
});

// ============================================================
// 4. RUTA DE LLAMADO MÉDICO
// ============================================================

app.post(
  '/medico/turnos/:id/llamar',
  TurnoController.llamarPaciente
);

// ============================================================
// 5. VARIABLES UTILIZADAS POR LAS PRUEBAS
// ============================================================

let turno;
let socketFalso;
let emitirSala;
let buscarTurno;

// ============================================================
// 6. PREPARAR DATOS ANTES DE CADA PRUEBA
// ============================================================

beforeEach(() => {

  // ----------------------------------------------------------
  // PROFESIONAL FICTICIO
  // ----------------------------------------------------------

  jest.spyOn(Profesional, 'findOne').mockResolvedValue({
    _id: profesionalId,
    nombre: 'Dra. Sofía Benítez',
    email: 'medica@turnoflex.test',
    sede: 'Sede Central - Consultorio 6',
    activo: true
  });

  // ----------------------------------------------------------
  // TURNO FICTICIO
  // ----------------------------------------------------------

  
  // Preparo un paciente que ya confirmó su llegada.
  // Así puedo comprobar que el médico lo llame correctamente.
  turno = {
    _id: turnoId,
    profesional_id: profesionalId,

    cliente_id: {
      nombre: 'Lucas Giménez'
    },

    fecha: fechaHoy(),
    hora: '15:00',
    estado: 'reservado',

    presentadoEn: new Date()
  };

  // ----------------------------------------------------------
  // SIMULAR LA CONSULTA MONGODB
  // ----------------------------------------------------------

  buscarTurno = jest.spyOn(Turno, 'findOne');

  buscarTurno.mockImplementation(() => ({
    populate: jest.fn().mockResolvedValue(turno)
  }));

  // ----------------------------------------------------------
  // SIMULAR LA PERSISTENCIA DEL LLAMADO
  // ----------------------------------------------------------

  // IMPORTANTE:
  // Aquí solamente preparamos el mock.
  // NO verificamos todavía que updateOne haya sido llamado.

  jest.spyOn(Turno, 'updateOne').mockResolvedValue({
    acknowledged: true,
    matchedCount: 1,
    modifiedCount: 1
  });

  // ----------------------------------------------------------
  // SIMULAR LA SALA PRIVADA DE SOCKET.IO
  // ----------------------------------------------------------

  emitirSala = jest.fn();

  socketFalso = {
    to: jest.fn().mockReturnValue({
      emit: emitirSala
    })
  };

  app.set('socketio', socketFalso);

});

// ============================================================
// 7. RESTABLECER LOS MOCKS
// ============================================================

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================
// 8. PRUEBAS AUTOMATIZADAS
// ============================================================

describe('TurnoFlex - Llamado de pacientes', () => {

  // ----------------------------------------------------------
  // TEST 1: LLAMAR CORRECTAMENTE A UN PACIENTE
  // ----------------------------------------------------------

  test('El médico puede llamar a su paciente', async () => {

    // Ejecutar el llamado mediante HTTP.
    const respuesta = await request(app)
      .post(`/medico/turnos/${turnoId}/llamar`)
      .set('Accept', 'application/json')
      .expect(200);

    // Verificar la respuesta del controlador.
    expect(respuesta.body.ok).toBe(true);

    // --------------------------------------------------------
    // VERIFICAR QUE EL LLAMADO SE GUARDE
    // --------------------------------------------------------

    // Esta comprobación debe estar DESPUÉS
    // de ejecutar la solicitud HTTP.

    expect(Turno.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: turnoId,
        profesional_id: profesionalId
      }),
      {
        $set: {
          ultimoLlamadoSalaEn: expect.any(Date)
        }
      }
    );

    // --------------------------------------------------------
    // VERIFICAR LA SALA PRIVADA DE SOCKET.IO
    // --------------------------------------------------------

    expect(socketFalso.to).toHaveBeenCalledWith(
      'sala-espera'
    );

    // --------------------------------------------------------
    // VERIFICAR LOS DATOS DEL LLAMADO
    // --------------------------------------------------------

    expect(emitirSala).toHaveBeenCalledWith(
      'llamado_paciente',
      expect.objectContaining({
        turnoId,
        paciente: 'Lucas Giménez',
        profesional: 'Dra. Sofía Benítez',
        consultorio: 'Consultorio 6'
      })
    );

    // --------------------------------------------------------
    // LLAMAR NO SIGNIFICA MARCAR COMO ATENDIDO
    // --------------------------------------------------------

    expect(turno.estado).toBe('reservado');

  });

  // ----------------------------------------------------------
  // TEST 2: BLOQUEAR LLAMADOS DE PACIENTES
  // ----------------------------------------------------------

  test('Un paciente no puede realizar llamados', async () => {

    await request(app)
      .post(`/medico/turnos/${turnoId}/llamar`)
      .set('x-test-rol', 'cliente')
      .set('Accept', 'application/json')
      .expect(403);

    // No debe emitir ningún llamado.
    expect(emitirSala).not.toHaveBeenCalled();

    // No debe registrar un llamado en MongoDB.
    expect(Turno.updateOne).not.toHaveBeenCalled();

  });

  // ----------------------------------------------------------
  // TEST 3: IMPEDIR LLAMADOS DE OTRO PROFESIONAL
  // ----------------------------------------------------------

  test('No puede llamar un turno de otro profesional', async () => {

    // Simular que el turno no pertenece al profesional.
    buscarTurno.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(null)
    }));

    await request(app)
      .post(`/medico/turnos/${turnoId}/llamar`)
      .set('Accept', 'application/json')
      .expect(404);

    // Verificar que se buscó el turno del médico actual.
    expect(buscarTurno).toHaveBeenCalledWith({
      _id: turnoId,
      profesional_id: profesionalId
    });

    expect(emitirSala).not.toHaveBeenCalled();

    expect(Turno.updateOne).not.toHaveBeenCalled();

  });

  // ----------------------------------------------------------
  // TEST 4: IMPEDIR LLAMADOS DE TURNOS CANCELADOS
  // ----------------------------------------------------------

  test('No puede llamar un turno cancelado', async () => {

    turno.estado = 'cancelado';

    await request(app)
      .post(`/medico/turnos/${turnoId}/llamar`)
      .set('Accept', 'application/json')
      .expect(409);

    expect(emitirSala).not.toHaveBeenCalled();

    expect(Turno.updateOne).not.toHaveBeenCalled();

  });

  // ----------------------------------------------------------
  // TEST 5: IMPEDIR LLAMADOS DE OTROS DÍAS
  // ----------------------------------------------------------

  test('No puede llamar turnos de otro día', async () => {

    turno.fecha = '2000-01-01';

    await request(app)
      .post(`/medico/turnos/${turnoId}/llamar`)
      .set('Accept', 'application/json')
      .expect(409);

    expect(emitirSala).not.toHaveBeenCalled();

    expect(Turno.updateOne).not.toHaveBeenCalled();

  });

  // ----------------------------------------------------------
  // TEST 6: RECHAZAR IDENTIFICADORES INVÁLIDOS
  // ----------------------------------------------------------

  test('Debe rechazar identificadores inválidos', async () => {

    await request(app)
      .post('/medico/turnos/identificador-invalido/llamar')
      .set('Accept', 'application/json')
      .expect(400);

    expect(emitirSala).not.toHaveBeenCalled();

    expect(Turno.updateOne).not.toHaveBeenCalled();

  });

});
