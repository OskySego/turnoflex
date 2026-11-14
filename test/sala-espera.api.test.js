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

import { Turno } from '../src/models/Turno.js';
import TurnoController from '../src/controllers/turnoController.js';

const app = express();

app.get(
  '/api/sala-espera/activos',
  TurnoController.getTurnosSalaEspera
);

const turnoFicticio = {
  _id: '507f1f77bcf86cd799439011',
  hora: '15:00',
  estado: 'reservado',
  cliente_id: {
    nombre: 'Paciente Confidencial',
    dni: '30000000',
    email: 'paciente@turnoflex.test'
  },
  profesional_id: {
    nombre: 'Profesional Confidencial',
    email: 'profesional@turnoflex.test'
  }
};

let consultaSimulada;
let buscarTurnos;

function fechaBuenosAires() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const valor = tipo =>
    partes.find(p => p.type === tipo)?.value || '';

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

beforeEach(() => {
  consultaSimulada = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([turnoFicticio])
  };

  buscarTurnos = jest
    .spyOn(Turno, 'find')
    .mockReturnValue(consultaSimulada);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TurnoFlex - Seguridad API Sala de Espera', () => {

  test('No debe revelar datos personales del paciente', async () => {
    const respuesta = await request(app)
      .get('/api/sala-espera/activos')
      .expect(200);

    expect(respuesta.body).toEqual([
      {
        _id: turnoFicticio._id,
        hora: '15:00',
        estado: 'reservado'
      }
    ]);

    const contenido = JSON.stringify(respuesta.body);

    expect(contenido).not.toContain(
      'Paciente Confidencial'
    );

    expect(contenido).not.toContain(
      'Profesional Confidencial'
    );

    expect(contenido).not.toContain(
      '30000000'
    );

    expect(contenido).not.toContain(
      '@turnoflex.test'
    );

    expect(consultaSimulada.select)
      .toHaveBeenCalledWith('_id hora estado');
  });

  test('Debe consultar la fecha actual de Buenos Aires', async () => {
    await request(app)
      .get('/api/sala-espera/activos')
      .expect(200);

    expect(buscarTurnos).toHaveBeenCalledWith({
      fecha: fechaBuenosAires(),
      estado: {
        $in: ['reservado', 'En Espera']
      }
    });
  });

  test('No debe exponer detalles internos ante un error', async () => {
    consultaSimulada.lean.mockRejectedValueOnce(
      new Error('Error interno de conexión')
    );

    const respuesta = await request(app)
      .get('/api/sala-espera/activos')
      .expect(500);

    expect(respuesta.body).toEqual({
      error: 'Error al obtener datos de la sala de espera.'
    });
  });

});