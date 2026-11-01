/* TurnoFlex · UNICO JavaScript compartido · 2026
 * Tema, menues, acceso, registro, navegacion, toasts y PWA.
 * No reemplaza controladores ni las peticiones de negocio de cada pantalla.
 */
(() => {
  'use strict';
  if (window.TurnoFlexUI) return;
  const KEY = 'turnoflex-theme';
  const root = document.documentElement;
  const valid = value => value === 'dark' || value === 'light';
  const readTheme = () => {
    try {
      const saved = localStorage.getItem(KEY);
      if (valid(saved)) return saved;
    } catch (_) { /* storage privado */ }
    return 'dark'; // El mismo aspecto inicial que Bienvenida Premium.
  };
  let theme = readTheme();
  function updateButtons() {
    const dark = theme === 'dark';
    document.querySelectorAll('[data-theme-switch], #tfThemeToggle').forEach(button => {
      button.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
      button.setAttribute('title', dark ? 'Activar modo claro' : 'Activar modo oscuro');
      button.setAttribute('aria-pressed', String(!dark));
      button.querySelectorAll('[data-theme-icon], #tfThemeIcon').forEach(icon => {
        icon.textContent = dark ? '☀' : '☾';
      });
      const bootstrapIcon = button.querySelector('.bi');
      if (bootstrapIcon) bootstrapIcon.className = dark ? 'bi bi-sun' : 'bi bi-moon-stars';
    });
  }
  function setTheme(next, save = true) {
    if (!valid(next)) return;
    theme = next;
    root.setAttribute('data-bs-theme', theme);
    root.setAttribute('data-tf-theme', theme);
    root.style.colorScheme = theme;
    if (save) try { localStorage.setItem(KEY, theme); } catch (_) { /* almacenamiento opcional */ }
    if (document.readyState !== 'loading') updateButtons();
  }
  setTheme(theme, false); // Antes del primer render; sin flash de tema equivocado.
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-theme-switch], #tfThemeToggle');
    if (!button || button.disabled) return;
    event.preventDefault();
    setTheme(theme === 'dark' ? 'light' : 'dark');
  });
  document.addEventListener('DOMContentLoaded', updateButtons, {once:true});
  window.addEventListener('storage', event => {
    if (event.key === KEY && valid(event.newValue)) setTheme(event.newValue, false);
  });
  window.TurnoFlexUI = {setTheme, getTheme: () => theme};
})();

// Funciones de Bienvenida y Login; no vuelven a controlar el tema.
document.addEventListener('DOMContentLoaded', () => {
  const menuButton = document.querySelector('[data-menu-toggle]');
  const menu = document.getElementById('tfp-menu');
  const setMenu = open => {
    if (!menuButton || !menu) return;
    menu.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menuButton.innerHTML = open ? '<i class="bi bi-x-lg" aria-hidden="true"></i>' : '<i class="bi bi-list" aria-hidden="true"></i>';
  };
  if (menu && menuButton) {
    menuButton.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });
  }
  document.querySelectorAll('[data-password-toggle]').forEach(button => {
    const field = document.getElementById(button.getAttribute('aria-controls'));
    if (!field) return;
    button.addEventListener('click', () => {
      const visible = field.type === 'text';
      field.type = visible ? 'password' : 'text';
      button.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
      button.setAttribute('aria-pressed', String(!visible));
      button.innerHTML = visible ? '<i class="bi bi-eye" aria-hidden="true"></i>' : '<i class="bi bi-eye-slash" aria-hidden="true"></i>';
    });
  });
  const loginForm = document.getElementById('tfp-login-form');
  if (loginForm) loginForm.addEventListener('submit', () => {
    if (!loginForm.checkValidity()) return;
    const submit = loginForm.querySelector('button[type="submit"]');
    if (!submit || submit.disabled) return;
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    const text = submit.querySelector('span');
    if (text) text.textContent = 'Ingresando…';
  });
  document.querySelectorAll('[data-current-year]').forEach(span => {
    span.textContent = String(new Date().getFullYear());
  });
});

// Funciones originales del Registro (validacion del navegador y visibilidad de claves).
document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    const form = document.getElementById('tfr-form');
    if (!form) return;

    const password = document.getElementById('password');
    const confirmacion = document.getElementById('tfr-confirmar');
    const textoFuerza = document.getElementById('tfr-strength-text');
    const barraFuerza = document.querySelector('.tfr-strength');
    const avisoCoincidencia = document.getElementById('tfr-match-message');

    function actualizarFuerza() {
      if (!password || !barraFuerza) return;
      const valor = password.value;
      let nivel = 0;
      if (valor.length > 0) {
        const grupos = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter(r => r.test(valor)).length;
        nivel = valor.length < 8 ? 1 : (valor.length >= 12 && grupos >= 3 ? 3 : grupos >= 2 ? 2 : 1);
      }
      barraFuerza.dataset.level = String(nivel);
      barraFuerza.setAttribute('aria-valuenow', String(nivel));
      if (textoFuerza) textoFuerza.textContent = ['', 'Mejorable', 'Adecuada', 'Más robusta'][nivel] || 'Seguridad de contraseña';
      if (!valor && textoFuerza) textoFuerza.textContent = 'Seguridad de contraseña';
    }

    function validarCoincidencia() {
      if (!password || !confirmacion) return;
      const tieneContenido = confirmacion.value.length > 0;
      const coincide = password.value === confirmacion.value;
      confirmacion.setCustomValidity(tieneContenido && !coincide ? 'Las contraseñas no coinciden.' : '');
      if (avisoCoincidencia) {
        avisoCoincidencia.classList.toggle('is-error', tieneContenido && !coincide);
        avisoCoincidencia.classList.toggle('is-ok', tieneContenido && coincide);
        avisoCoincidencia.textContent = !tieneContenido ? '' : (coincide ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden.');
      }
    }

    password?.addEventListener('input', () => {
      actualizarFuerza();
      validarCoincidencia();
    });
    confirmacion?.addEventListener('input', validarCoincidencia);

    document.querySelectorAll('[data-register-toggle]').forEach(button => {
      const field = document.getElementById(button.getAttribute('aria-controls'));
      if (!field) return;
      button.addEventListener('click', () => {
        const visible = field.type === 'text';
        field.type = visible ? 'password' : 'text';
        button.setAttribute('aria-pressed', String(!visible));
        button.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
        button.innerHTML = visible
          ? '<i class="bi bi-eye" aria-hidden="true"></i>'
          : '<i class="bi bi-eye-slash" aria-hidden="true"></i>';
      });
    });

    form.addEventListener('submit', event => {
      validarCoincidencia();
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
        return;
      }
      const enviar = form.querySelector('button[type="submit"]');
      if (!enviar || enviar.disabled) return;
      enviar.disabled = true;
      enviar.setAttribute('aria-busy', 'true');
      const texto = enviar.querySelector('span');
      if (texto) texto.textContent = 'Creando tu cuenta…';
    });
    actualizarFuerza();
});

// Logica compartida del layout original: avatar y menu activo.
document.addEventListener(
  'DOMContentLoaded',
  function () {

    const avatar =
      document.getElementById(
        'tfUserAvatar'
      );


    // ====================================================
    // INICIALES DEL USUARIO
    // ====================================================

    if (avatar) {

      const elementoNombre =
        document.querySelector(
          '.tf-user-name'
        );


      const nombre =
        elementoNombre
          ? elementoNombre.textContent.trim()
          : 'Usuario';


      const partes =
        nombre
          .split(' ')
          .filter(
            function (parte) {
              return parte;
            }
          );


      let iniciales =
        'U';


      if (partes.length > 0) {

        iniciales =
          partes
            .slice(0, 2)
            .map(
              function (parte) {

                return parte
                  .charAt(0)
                  .toUpperCase();

              }
            )
            .join('');

      }


      avatar.textContent =
        iniciales;

    }




    // ====================================================
    // MENÚ ACTIVO SEGÚN URL
    // ====================================================

    const path =
      window.location.pathname;


    const enlaces =
      document.querySelectorAll(
        '.tf-nav-link'
      );


    enlaces.forEach(
      function (enlace) {

        const rutaExacta =
          enlace.getAttribute(
            'data-nav-path'
          );


        const prefijo =
          enlace.getAttribute(
            'data-nav-prefix'
          );


        let activo =
          false;


        if (rutaExacta) {

          activo =
            path === rutaExacta;

        }


        if (
          !activo &&
          prefijo
        ) {

          activo =
            path === prefijo ||
            path.startsWith(
              prefijo + '/'
            );

        }


        if (activo) {

          enlace.classList.add(
            'active'
          );

        }

      }
    );


    // ====================================================
    // PRIORIZAR RUTA EXACTA
    // Evita que /turnos también marque /turnos/nuevo.
    // ====================================================

    const activos =
      Array.from(
        document.querySelectorAll(
          '.tf-nav-link.active'
        )
      );


    if (activos.length > 1) {

      const exacto =
        activos.find(
          function (enlace) {

            return (
              enlace.getAttribute(
                'data-nav-path'
              ) === path
            );

          }
        );


      if (exacto) {

        activos.forEach(
          function (enlace) {

            if (
              enlace !== exacto
            ) {

              enlace.classList.remove(
                'active'
              );

            }

          }
        );

      }

    }

  }
);


// Mensajes y PWA del layout original, sin cambios de funciones.
document.addEventListener(
  'DOMContentLoaded',
  function () {

    const contenedor =
      document.getElementById(
        'tfToastStack'
      );


    if (!contenedor) {
      return;
    }


    // ====================================================
    // CONFIGURACIÓN
    // ====================================================

    const configuracion = {

      success: {
        icono: '✓',
        titulo: 'Operación realizada'
      },

      error: {
        icono: '!',
        titulo: 'Ocurrió un problema'
      },

      warning: {
        icono: '!',
        titulo: 'Atención'
      },

      info: {
        icono: 'i',
        titulo: 'TurnoFlex'
      }

    };


    // ====================================================
    // CREAR TOAST
    // ====================================================

    function mostrarToast(
      mensaje,
      tipo,
      titulo
    ) {

      if (!mensaje) {
        return;
      }


      const tipoSeguro =
        configuracion[tipo]
          ? tipo
          : 'info';


      const datos =
        configuracion[
          tipoSeguro
        ];


      const toast =
        document.createElement(
          'div'
        );


      toast.className =
        'tf-toast tf-toast-' +
        tipoSeguro;


      // ==================================================
      // ICONO
      // ==================================================

      const icono =
        document.createElement(
          'div'
        );


      icono.className =
        'tf-toast-icon';


      icono.textContent =
        datos.icono;


      // ==================================================
      // CONTENIDO
      // ==================================================

      const contenido =
        document.createElement(
          'div'
        );


      contenido.className =
        'tf-toast-content';


      const tituloElemento =
        document.createElement(
          'span'
        );


      tituloElemento.className =
        'tf-toast-title';


      tituloElemento.textContent =
        titulo ||
        datos.titulo;


      const mensajeElemento =
        document.createElement(
          'p'
        );


      mensajeElemento.className =
        'tf-toast-message';


      mensajeElemento.textContent =
        mensaje;


      contenido.appendChild(
        tituloElemento
      );


      contenido.appendChild(
        mensajeElemento
      );


      // ==================================================
      // CERRAR
      // ==================================================

      const cerrar =
        document.createElement(
          'button'
        );


      cerrar.type =
        'button';


      cerrar.className =
        'tf-toast-close';


      cerrar.setAttribute(
        'aria-label',
        'Cerrar notificación'
      );


      cerrar.textContent =
        '×';


      function eliminarToast() {

        if (
          toast.classList.contains(
            'tf-toast-exit'
          )
        ) {

          return;

        }


        toast.classList.add(
          'tf-toast-exit'
        );


        window.setTimeout(
          function () {

            toast.remove();

          },
          260
        );

      }


      cerrar.addEventListener(
        'click',
        eliminarToast
      );


      toast.appendChild(
        icono
      );


      toast.appendChild(
        contenido
      );


      toast.appendChild(
        cerrar
      );


      contenedor.appendChild(
        toast
      );


      window.setTimeout(
        eliminarToast,
        5000
      );

    }


    // ====================================================
    // FUNCIÓN GLOBAL
    // Puede utilizarse desde cualquier vista:
    //
    // TurnoFlexToast(
    //   'Mensaje',
    //   'success'
    // );
    // ====================================================

    window.TurnoFlexToast =
      function (
        mensaje,
        tipo,
        titulo
      ) {

        mostrarToast(
          mensaje,
          tipo || 'info',
          titulo
        );

      };


    // ====================================================
    // LEER MENSAJES DE LA URL
    //
    // ?exito=
    // ?error=
    // ?aviso=
    // ?info=
    // ====================================================

    const parametros =
      new URLSearchParams(
        window.location.search
      );


    const mensajes = [

      {
        parametro: 'exito',
        tipo: 'success'
      },

      {
        parametro: 'error',
        tipo: 'error'
      },

      {
        parametro: 'aviso',
        tipo: 'warning'
      },

      {
        parametro: 'info',
        tipo: 'info'
      }

    ];


    let hayMensaje =
      false;


    mensajes.forEach(
      function (item) {

        const mensaje =
          parametros.get(
            item.parametro
          );


        if (mensaje) {

          hayMensaje =
            true;


          mostrarToast(
            mensaje,
            item.tipo
          );


          parametros.delete(
            item.parametro
          );

        }

      }
    );


    // ====================================================
    // EVITAR DUPLICAR ALERTAS ANTIGUAS
    // ====================================================

    if (hayMensaje) {

      const alertasViejas =
        document.querySelectorAll(
          '.profile-success, .agenda-success, .alert-success'
        );


      alertasViejas.forEach(
        function (alerta) {

          alerta.style.display =
            'none';

        }
      );

    }


    // ====================================================
    // LIMPIAR LA URL
    //
    // Después de mostrar el toast eliminamos ?exito=
    // para que no vuelva a aparecer al refrescar.
    // ====================================================

    if (hayMensaje) {

      const nuevaBusqueda =
        parametros.toString();


      const nuevaUrl =
        window.location.pathname +
        (
          nuevaBusqueda
            ? '?' + nuevaBusqueda
            : ''
        ) +
        window.location.hash;


      window.history.replaceState(
        {},
        document.title,
        nuevaUrl
      );

    }

  }
);

// ========================================================
// SERVICE WORKER / PWA
// ========================================================

if (
  'serviceWorker' in navigator
) {

  window.addEventListener(
    'load',
    function () {

      navigator.serviceWorker
        .register(
          '/sw.js'
        )
        .then(
          function () {

            console.log(
              '✅ TurnoFlex PWA activa'
            );

          }
        )
        .catch(
          function (error) {

            console.warn(
              'PWA no disponible:',
              error
            );

          }
        );

    }
  );

}
