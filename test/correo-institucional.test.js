import {
  describe,
  test,
  expect,
  jest
} from '@jest/globals';

import {
  generarCorreoInstitucional,
  generarCorreoInstitucionalDisponible,
  normalizarCorreoParticular
} from '../src/utils/correoInstitucional.js';

describe('TurnoFlex - Correo institucional', () => {

  test('Genera un correo sin tildes ni títulos', () => {
    expect(
      generarCorreoInstitucional(
        'Dra. Sofía Benítez',
        'clinica.com.ar'
      )
    ).toBe('sofia.benitez@clinica.com.ar');
  });

  test('Admite nombres y apellidos compuestos', () => {
    expect(
      generarCorreoInstitucional(
        'Dr. Juan Carlos de la Cruz',
        'clinica.com.ar'
      )
    ).toBe('juan.cruz@clinica.com.ar');
  });

  test('Normaliza el correo particular', () => {
    expect(
      normalizarCorreoParticular(
        ' SOFIA@GMAIL.COM '
      )
    ).toBe('sofia@gmail.com');
  });

  test('Evita el primer correo duplicado', async () => {
    const existeCorreo = jest.fn(
      async correo =>
        correo === 'sofia.benitez@clinica.com.ar'
    );

    const resultado =
      await generarCorreoInstitucionalDisponible({
        nombreCompleto: 'Dra. Sofía Benítez',
        dominio: 'clinica.com.ar',
        existeCorreo
      });

    expect(resultado).toBe(
      'sofia.benitez.2@clinica.com.ar'
    );

    expect(existeCorreo).toHaveBeenCalledTimes(2);
  });

  test('Evita varios correos duplicados', async () => {
    const ocupados = new Set([
      'sofia.benitez@clinica.com.ar',
      'sofia.benitez.2@clinica.com.ar'
    ]);

    const resultado =
      await generarCorreoInstitucionalDisponible({
        nombreCompleto: 'Sofía Benítez',
        dominio: 'clinica.com.ar',
        existeCorreo: async correo =>
          ocupados.has(correo)
      });

    expect(resultado).toBe(
      'sofia.benitez.3@clinica.com.ar'
    );
  });

  test('Rechaza dominios inválidos', () => {
    expect(() =>
      generarCorreoInstitucional(
        'Sofía Benítez',
        'https://clinica.com.ar'
      )
    ).toThrow('dominio institucional válido');
  });

  test('Rechaza un nombre sin apellido', () => {
    expect(() =>
      generarCorreoInstitucional(
        'Sofía',
        'clinica.com.ar'
      )
    ).toThrow('nombre y apellido');
  });

  test('Exige comprobar si el correo existe', async () => {
    await expect(
      generarCorreoInstitucionalDisponible({
        nombreCompleto: 'Sofía Benítez',
        dominio: 'clinica.com.ar'
      })
    ).rejects.toThrow(
      'Falta la función'
    );
  });

});