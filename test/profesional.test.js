import { describe, test, expect } from '@jest/globals';
import { Profesional } from '../src/models/Profesional.js';

// Creamos profesionales ficticios para las pruebas.
// No se guarda nada en MongoDB.

function crearProfesional(datos = {}) {
  return new Profesional({
    nombre: 'Profesional de Prueba',
    dni: '12345678',
    genero: 'Otro',
    email: 'prueba@turnoflex.test',
    telefono: '1122334455',
    matricula: 'MAT-TEST-001',
    especialidad: 'Clínica Médica',
    subespecialidad: 'General',
    horaInicio: '08:00',
    horaFin: '16:00',
    ...datos
  });
}

describe('TurnoFlex - Gestión de profesionales', () => {

  test('Los días deben comenzar sin seleccionar', () => {
    const profesional = crearProfesional();

    expect(profesional.diasAtencion).toEqual([]);
    expect(profesional.diasSobreturnos).toEqual([]);
    expect(profesional.diasTelemedicina).toEqual([]);
  });

  test('Los sobreturnos deben estar desactivados por defecto', () => {
    const profesional = crearProfesional();

    expect(profesional.permiteSobreturnos).toBe(false);
  });

  test('La telemedicina debe estar desactivada por defecto', () => {
    const profesional = crearProfesional();

    expect(profesional.ofreceTelemedicina).toBe(false);
  });

  test('Debe aceptar los días y horarios configurados', () => {
    const profesional = crearProfesional({
      diasAtencion: ['Lunes', 'Miércoles'],
      horaInicio: '09:00',
      horaFin: '17:00',
      permiteSobreturnos: true,
      diasSobreturnos: ['Miércoles']
    });

    expect(profesional.diasAtencion).toEqual([
      'Lunes',
      'Miércoles'
    ]);

    expect(profesional.horaInicio).toBe('09:00');
    expect(profesional.horaFin).toBe('17:00');
    expect(profesional.permiteSobreturnos).toBe(true);
    expect(profesional.diasSobreturnos).toEqual(['Miércoles']);

    expect(profesional.validateSync()).toBeUndefined();
  });

  test('Debe rechazar un profesional sin nombre', () => {
    const profesional = crearProfesional({
      nombre: ''
    });

    const error = profesional.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.nombre).toBeDefined();
  });

});