const fs = require('node:fs');
const path = require('node:path');
const pug = require('pug');

const raiz = process.cwd();
const agenda = path.join(raiz, 'src/views/profesional-agenda.pug');
const sala = path.join(raiz, 'src/views/sala-espera.pug');
const originales = new Map();
const fecha = new Date().toISOString().replace(/[:.]/g, '-');

function modificar(archivo, funcion) {
  const anterior = fs.readFileSync(archivo, 'utf8');
  originales.set(archivo, anterior);
  fs.writeFileSync(archivo + '.backup-' + fecha, anterior);
  fs.writeFileSync(archivo, funcion(anterior));
}

try {
  // ==========================================
  // 1. AGENDA DEL MEDICO
  // ==========================================
  modificar(agenda, (codigo) => {

    if (!codigo.includes('form.medico-llamar')) {

      const buscar =
        "                if estado === 'reservado'\n" +
        "                  form.medico-atendido";

      if (!codigo.includes(buscar)) {
        throw new Error('No se encontro el bloque de la agenda.');
      }

      codigo = codigo.replace(buscar, `
                //- BOTON PARA LLAMAR PACIENTE
                if turno.fecha === hoy && ['reservado', 'En Espera'].includes(estado)
                  form.medico-llamar(method='POST' action=('/medico/turnos/' + turno._id + '/llamar'))
                    if typeof csrfToken !== 'undefined' && csrfToken
                      input(type='hidden' name='_csrf' value=csrfToken)
                    button.md-btn.md-btn-yes(type='submit') 📢 Llamar paciente
                if estado === 'reservado'
                  form.medico-atendido`);
    }

    if (!codigo.includes(
      "document.querySelectorAll('.medico-llamar')"
    )) {

      const buscar =
        "      document.querySelectorAll('.medico-atendido').forEach(function(form) {";

      if (!codigo.includes(buscar)) {
        throw new Error('No se encontro el script de la agenda.');
      }

      codigo = codigo.replace(buscar, `
      document.querySelectorAll('.medico-llamar').forEach(function(form) {
        form.addEventListener('submit', async function(e) {
          e.preventDefault();

          var boton = form.querySelector('button');
          if (boton.disabled) return;

          boton.disabled = true;
          boton.textContent = 'Enviando llamado...';

          try {
            var respuesta = await fetch(form.action, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { Accept: 'application/json' },
              body: new URLSearchParams(new FormData(form))
            });

            var datos = await respuesta.json();

            if (!respuesta.ok || !datos.ok) {
              throw new Error(datos.error || 'No se pudo llamar');
            }

            boton.textContent = '✓ Llamado enviado';

          } catch (error) {
            alert(error.message);

          } finally {
            setTimeout(function() {
              boton.disabled = false;
              boton.textContent = '📢 Llamar paciente';
            }, 2500);
          }
        });
      });
` + buscar);
    }

    return codigo;
  });

  // ==========================================
  // 2. PANTALLA SALA DE ESPERA
  // ==========================================
  modificar(sala, (codigo) => {

    if (codigo.includes(
      "socket.on('llamado_paciente'"
    )) {
      return codigo;
    }

    const inicio = codigo.indexOf(
      '        async function cargarSala() {'
    );

    const fin = codigo.indexOf(
      '        actualizarReloj();',
      inicio
    );

    if (inicio === -1 || fin === -1) {
      throw new Error('No se encontro el script de sala de espera.');
    }

    codigo = codigo.slice(0, inicio) + `
        async function cargarSala() {
          try {
            var respuesta = await fetch(
              '/api/sala-espera/activos',
              { headers: { Accept: 'application/json' } }
            );

            if (!respuesta.ok) return;

            var turnos = await respuesta.json();

            if (!Array.isArray(turnos)) return;

            var lista = document.getElementById('listaEspera');
            var contador = document.getElementById('contadorEspera');

            var esperando = turnos.filter(function(t) {
              return ['reservado', 'en espera'].includes(
                String(t.estado || '').toLowerCase().trim()
              );
            });

            lista.replaceChildren();

            esperando.forEach(function(t) {
              var fila = document.createElement('div');
              fila.className = 'sala-item-fila py-2';

              fila.textContent =
                String(t.hora || '--:--') +
                ' hs — Turno #' +
                String(t._id || '').slice(-6).toUpperCase();

              lista.appendChild(fila);
            });

            if (!esperando.length) {
              lista.textContent = 'No hay pacientes en espera.';
            }

            contador.textContent =
              esperando.length + ' en fila';

          } catch (error) {
            console.error('Sala de espera:', error);
          }
        }

        function mostrarLlamado(datos) {
          var codigo = String(datos.codigo || '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 8);

          if (!codigo) return;

          document.getElementById('pacienteActual').textContent =
            'Turno #' + codigo;

          document.getElementById('profesionalActual').textContent =
            'Por favor, acérquese a su consultorio';
        }

` + codigo.slice(fin);

    const buscar =
      "          socket.on('actualizacion_agenda', function(data) {\n" +
      "            cargarSala();\n" +
      "          });";

    if (!codigo.includes(buscar)) {
      throw new Error('No se encontro el receptor Socket.IO.');
    }

    return codigo.replace(buscar, `
          socket.on('actualizacion_agenda', cargarSala);
          socket.on('llamado_paciente', mostrarLlamado);`);
  });

  // ==========================================
  // 3. VERIFICAR SINTAXIS
  // ==========================================
  for (const archivo of originales.keys()) {
    pug.compileFile(archivo, { cache: false });

    console.log(
      '✅ Pug correcto:',
      path.basename(archivo)
    );
  }

  console.log('✅ Vistas actualizadas correctamente.');
  console.log('✅ Copias de seguridad creadas.');

} catch (error) {

  for (const [archivo, contenido] of originales) {
    fs.writeFileSync(archivo, contenido);
  }

  console.error(
    '❌ No se aplicaron los cambios:',
    error.message
  );

  process.exitCode = 1;
}
