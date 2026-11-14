
import path from 'node:path';
import vm from 'node:vm';
import pug from 'pug';

import {
  describe,
  test,
  expect,
  jest
} from '@jest/globals';

// ============================================================
// TURNOFLEX - TEST DE SALA DE ESPERA
// ============================================================

const archivo = path.resolve(
  process.cwd(),
  'src/views/sala-espera.pug'
);

// ============================================================
// 1. RENDERIZAR LA VISTA REAL DE TURNOFLEX
// ============================================================

function obtenerVista() {
  return pug.renderFile(archivo);
}

// ============================================================
// 2. EXTRAER EL JAVASCRIPT DE LA VISTA
// ============================================================

function obtenerScript(html) {
  const scripts = [
    ...html.matchAll(
      /<script\b[^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  const encontrado = scripts.find(
    coincidencia =>
      coincidencia[1].includes('DOMContentLoaded')
  );

  if (!encontrado) {
    throw new Error(
      'No se encontró el script de sala de espera.'
    );
  }

  return encontrado[1];
}

// ============================================================
// 3. SIMULAR ELEMENTOS HTML
// ============================================================

function crearElemento(texto = '') {
  return {
    textContent: texto,
    className: '',
    offsetWidth: 100,

    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },

    replaceChildren: jest.fn(),
    appendChild: jest.fn()
  };
}

// ============================================================
// 4. CREAR ENTORNO FICTICIO DEL NAVEGADOR
// ============================================================

function crearEntorno() {
  const html = obtenerVista();
  const codigo = obtenerScript(html);

  const elementos = {
    salaClock: crearElemento('--:--'),

    salaDate: crearElemento(
      'Cargando fecha...'
    ),

    pacienteActual: crearElemento(
      'Aguardando próximo llamado...'
    ),

    profesionalActual: crearElemento(
      'Los pacientes serán convocados.'
    ),

    estadoLlamado: crearElemento(
      'Aguardando llamado'
    ),

    listaEspera: crearElemento(),

    contadorEspera: crearElemento(
      '0 en fila'
    )
  };

  const eventos = {};

  let iniciarPagina;

  // ==========================================================
  // SOCKET.IO FICTICIO
  // ==========================================================

  const socket = {
    on(nombre, funcion) {
      eventos[nombre] = funcion;
    }
  };

  // ==========================================================
  // DOCUMENTO HTML FICTICIO
  // ==========================================================

  const documento = {
    getElementById(id) {
      return elementos[id] || null;
    },

    createElement() {
      return crearElemento();
    },

    addEventListener(nombre, funcion) {
      if (nombre === 'DOMContentLoaded') {
        iniciarPagina = funcion;
      }
    }
  };

  // ==========================================================
  // SIMULACIÓN DE LAS DOS APIS DE SALA DE ESPERA
  // ==========================================================

  const consultarTurnos = jest.fn(async (url) => ({
    ok: true,

    json: async () => {

      // Recuperación del último llamado.
      if (
        url === '/api/sala-espera/ultimo-llamado'
      ) {
        return {
          llamado: null
        };
      }

      // Lista de turnos reservados.
      return [
        {
          _id: '507f1f77bcf86cd799439011',
          estado: 'reservado',
          hora: '15:00'
        }
      ];
    }
  }));

  // ==========================================================
  // EJECUTAR EL JAVASCRIPT DE LA VISTA
  // ==========================================================

  vm.runInNewContext(codigo, {
    document: documento,

    fetch: consultarTurnos,

    io: () => socket,

    setInterval: jest.fn(),

    Date,
    Intl,
    console
  });

  if (
    typeof iniciarPagina !== 'function'
  ) {
    throw new Error(
      'No se inicializó DOMContentLoaded.'
    );
  }

  // Inicializar la página antes de verificar resultados.
  iniciarPagina();

  return {
    html,
    elementos,
    eventos,
    consultarTurnos
  };
}

// ============================================================
// 5. ESPERAR OPERACIONES ASÍNCRONAS
// ============================================================

async function terminarPendientes() {
  await new Promise(
    resolve => setImmediate(resolve)
  );
}

// ============================================================
// 6. PRUEBAS AUTOMATIZADAS
// ============================================================

describe('TurnoFlex - Sala de espera', () => {

  // ----------------------------------------------------------
  // TEST 1: TÍTULO DE LA PANTALLA
  // ----------------------------------------------------------

  test('La vista debe mostrar el título correcto', () => {

    const html = obtenerVista();

    expect(html).toContain(
      'Llamado a consultorio'
    );

    expect(html).not.toContain(
      'Paciente en Box / Consultorio'
    );

  });

  // ----------------------------------------------------------
  // TEST 2: RELOJ Y FECHA
  // ----------------------------------------------------------

  test('Debe inicializar fecha y hora de Buenos Aires', () => {

    const { elementos } = crearEntorno();

    expect(
      elementos.salaClock.textContent
    ).toMatch(/\d{2}:\d{2}/);

    expect(
      elementos.salaDate.textContent
    ).not.toBe('Cargando fecha...');

  });

  // ----------------------------------------------------------
  // TEST 3: UN TURNO RESERVADO NO ES UN LLAMADO
  // ----------------------------------------------------------

  test('Un turno reservado no debe aparecer como llamado', async () => {

    const { elementos } = crearEntorno();

    await terminarPendientes();

    expect(
      elementos.pacienteActual.textContent
    ).toBe('Aguardando próximo llamado...');

    expect(
      elementos.estadoLlamado.textContent
    ).toBe('Aguardando llamado');

    expect(
      elementos.listaEspera.appendChild
    ).toHaveBeenCalled();

  });

  // ----------------------------------------------------------
  // TEST 4: RECEPCIÓN DE LLAMADOS POR SOCKET.IO
  // ----------------------------------------------------------

  test('Debe mostrar paciente y consultorio al recibir el evento', () => {

    const {
      elementos,
      eventos
    } = crearEntorno();

    expect(
      typeof eventos.llamado_paciente
    ).toBe('function');

    // Simular un llamado del médico.
    eventos.llamado_paciente({
      turnoId: '507f1f77bcf86cd799439011',
      paciente: 'Lucas Giménez',
      profesional: 'Dra. Sofía Benítez',
      consultorio: 'Sede Central - Consultorio 6'
    });

    // Verificar nombre del paciente.
    expect(
      elementos.pacienteActual.textContent
    ).toBe('Lucas Giménez');

    // Mostrar solamente el consultorio.
    expect(
      elementos.profesionalActual.textContent
    ).toContain('Consultorio 6');

    // Mostrar el nombre del profesional.
    expect(
      elementos.profesionalActual.textContent
    ).toContain('Dra. Sofía Benítez');

    // No mostrar el nombre de la sede.
    expect(
      elementos.profesionalActual.textContent
    ).not.toContain('Sede Central');

    // Verificar el estado visual.
    expect(
      elementos.estadoLlamado.textContent
    ).toContain('Llamando ahora');

  });

  // ----------------------------------------------------------
  // TEST 5: RECUPERACIÓN DESPUÉS DE RECONEXIÓN
  // ----------------------------------------------------------

  test('Al reconectar debe consultar nuevamente los turnos', () => {

    const {
      eventos,
      consultarTurnos
    } = crearEntorno();

    // Verificar que el evento de conexión existe.
    expect(
      typeof eventos.connect
    ).toBe('function');

    // Contar las consultas de una ruta específica.
    const consultasA = ruta =>
      consultarTurnos.mock.calls.filter(
        ([url]) => url === ruta
      );

    // Al abrir la pantalla se consultan ambas APIs.
    expect(
      consultasA('/api/sala-espera/activos')
    ).toHaveLength(1);

    expect(
      consultasA('/api/sala-espera/ultimo-llamado')
    ).toHaveLength(1);

    // Simular desconexión y reconexión de Socket.IO.
    eventos.connect();

    // Verificar que volvió a consultar los turnos.
    expect(
      consultasA('/api/sala-espera/activos')
    ).toHaveLength(2);

    // Verificar recuperación del último llamado.
    expect(
      consultasA('/api/sala-espera/ultimo-llamado')
    ).toHaveLength(2);

  });

});
