/**
 * Test de compilación estática de vistas Pug (Módulo Clínico).
 * Compila las plantillas para detectar errores de sintaxis sin levantar servidor ni BD.
 */

import pug from 'pug';
import path from 'node:path';

// Setup de rutas base del workspace
const raiz = process.cwd();
const vistas = [
  'historia', 'evolucion-nueva', 'rectificacion-nueva',
  'estudio-nuevo', 'estudio-cargado'
];
let errores = 0;

// Iteramos cada vista del módulo clínico para validar su sintaxis Pug
for (const vista of vistas) {
  const archivo = path.join(raiz, 'src', 'views', 'clinica', vista + '.pug');
  try {
    pug.compileFile(archivo, { cache: false, basedir: path.join(raiz, 'src', 'views') });
    console.log('✅ Vista Pug válida:', vista);
  } catch (e) {
    errores++;
    console.error('❌ Vista Pug:', vista, e.message);
  }
}

// Salida de estado según el resultado de compilación
if (errores) {
  process.exitCode = 1;
} else {
  console.log('✅ Se compilaron las cinco vistas. Esto NO prueba la renderización con MongoDB.');
}