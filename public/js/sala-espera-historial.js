(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {

    // Capturo los elementos del DOM donde voy a inyectar el historial y los contadores
    const lista = document.getElementById(
      'listaUltimosLlamados'
    );

    const contador = document.getElementById(
      'contadorUltimosLlamados'
    );

    if (!lista || !contador) return;

    let revision = 0;

    // Función auxiliar para mostrar alertas o avisos vacíos en la lista
    function mostrarMensaje(texto) {
      lista.replaceChildren();

      const elemento = document.createElement('li');
      elemento.className = 'text-light opacity-75';
      elemento.textContent = texto;

      lista.appendChild(elemento);
    }

    // Dibujo el historial de llamados directamente en la pantalla de la clínica
    function mostrarHistorial(llamados) {
      lista.replaceChildren();

      contador.textContent =
        `${llamados.length} de 5`;

      if (!llamados.length) {
        mostrarMensaje(
          'Todavía no se realizaron llamados hoy.'
        );
        return;
      }

      llamados.forEach(llamado => {

        const fila = document.createElement('li');
        fila.className =
          'sala-item-fila d-flex justify-content-between gap-3 flex-wrap';

        const informacion = document.createElement('div');

        const nombre = document.createElement('strong');
        nombre.className = 'text-white d-block';
        nombre.textContent =
          String(llamado.paciente || 'Paciente');

        const consultorio = document.createElement('small');
        consultorio.className =
          'text-light opacity-75 d-block';

        consultorio.textContent =
          String(llamado.consultorio || 'Consultorio no asignado');

        informacion.append(nombre, consultorio);

        const detalles = document.createElement('div');
        detalles.className = 'text-end';

        const hora = document.createElement('span');
        hora.className = 'text-info fw-bold d-block';
        hora.textContent =
          String(llamado.hora || '--:--') + ' hs';

        const estado = document.createElement('small');
        estado.className = 'text-light opacity-75';
        estado.textContent =
          llamado.estado === 'Atendido'
            ? 'Atendido'
            : 'Llamado';

        detalles.append(hora, estado);
        fila.append(informacion, detalles);

        lista.appendChild(fila);
      });
    }

    // Petición AJAX (Fetch) para traer los últimos llamados desde el backend sin recargar la página
    async function cargarUltimosLlamados() {
      const actual = ++revision;

      try {
        const respuesta = await fetch(
          '/api/sala-espera/ultimos-llamados',
          {
            headers: {
              Accept: 'application/json'
            },
            credentials: 'same-origin',
            cache: 'no-store'
          }
        );

        if (!respuesta.ok) {
          throw new Error(
            'Error HTTP ' + respuesta.status
          );
        }

        const datos = await respuesta.json();

        if (actual !== revision) return;

        if (!Array.isArray(datos.ultimosLlamados)) {
          throw new Error(
            'Formato de historial inválido.'
          );
        }

        mostrarHistorial(
          datos.ultimosLlamados.slice(0, 5)
        );

      } catch (error) {

        if (actual !== revision) return;

        console.error(
          'Error al actualizar historial:',
          error
        );

        mostrarMensaje(
          'No se pudo actualizar el historial de llamados.'
        );
      }
    }

    // Carga inicial al abrir la pantalla.
    cargarUltimosLlamados();

    // Actualización periódica por seguridad cada 10 segundos.
    setInterval(cargarUltimosLlamados, 10000);

    // Conexión con Socket.IO para escuchar eventos en tiempo real. 
    // Cada vez que el médico llama a un paciente, refresco la lista instantáneamente.
    if (typeof io === 'function') {
      const socketHistorial = io();

      socketHistorial.on(
        'connect',
        cargarUltimosLlamados
      );

      socketHistorial.on(
        'llamado_paciente',
        cargarUltimosLlamados
      );

      socketHistorial.on(
        'actualizacion_agenda',
        cargarUltimosLlamados
      );
    }
  });
})();