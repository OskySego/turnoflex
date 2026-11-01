// ============================================================
// TURNOFLEX - SERVICE WORKER
// Versión corregida para evitar conflictos de sesión
// ============================================================

const CACHE_NAME = 'turnoflex-cache-v2';


// ============================================================
// INSTALACIÓN
// ============================================================

self.addEventListener('install', (event) => {

  console.log('TurnoFlex: instalando Service Worker actualizado');

  // Activa la versión nueva sin esperar al cierre del navegador.
  event.waitUntil(
    self.skipWaiting()
  );

});


// ============================================================
// ACTIVACIÓN
// ============================================================

self.addEventListener('activate', (event) => {

  console.log('TurnoFlex: activando Service Worker actualizado');

  event.waitUntil(

    (async () => {

      const nombresCaches = await caches.keys();

      // Eliminar cachés anteriores que pueden contener
      // páginas de login o paneles de otros usuarios.
      await Promise.all(

        nombresCaches
          .filter(nombre => nombre.startsWith('turnoflex-cache'))
          .map(nombre => caches.delete(nombre))

      );

      // Tomar el control de las pestañas abiertas.
      await self.clients.claim();

      console.log('TurnoFlex: caché anterior eliminada');

    })()

  );

});


// ============================================================
// PETICIONES
// ============================================================

// IMPORTANTE:
//
// Por seguridad, este Service Worker ya NO intercepta
// las peticiones del sistema.
//
// El login, las sesiones, los paneles, los turnos,
// los pacientes y los pagos siempre consultarán
// al servidor.
//
// Esto evita servir información desactualizada
// o páginas correspondientes a otra sesión.
//
// La funcionalidad sin conexión queda temporalmente
// deshabilitada hasta implementar un caché seguro.