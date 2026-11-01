import pug from 'pug';
import path from 'node:path';

// Compila Pug sin ejecutarlo ni conectarse a MongoDB.
// Requiere src/views/layout.pug y sus partials DEL PROYECTO ORIGINAL.
const raiz = process.cwd();
const vistas = [
  'historia', 'evolucion-nueva', 'rectificacion-nueva',
  'estudio-nuevo', 'estudio-cargado'
];
let errores = 0;
for (const vista of vistas) {
  const archivo = path.join(raiz, 'src', 'views', 'clinica', vista + '.pug');
  try {
    pug.compileFile(archivo, { cache: false, basedir: path.join(raiz,'src','views') });
    console.log('✅ Vista Pug válida:', vista);
  } catch (e) {
    errores++;
    console.error('❌ Vista Pug:', vista, e.message);
  }
}
if (errores) process.exitCode = 1;
else console.log('✅ Se compilaron las cinco vistas. Esto NO prueba la renderización con MongoDB.');
