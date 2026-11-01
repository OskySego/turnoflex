import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const raiz = process.cwd();
const errores = [];
const avisos = [];
const informar = (etiqueta, ok) => console.log(`${ok ? '✅' : '❌'} ${etiqueta}`);
const requerido = archivo => {
  if (!fs.existsSync(path.join(raiz, archivo))) errores.push(`No se encontró: ${archivo}`);
};

const version = Number(process.versions.node.split('.')[0]);
if (version < 20) avisos.push(`Se recomienda Node.js 20 o superior (detectado ${process.version}).`);
const pkg = JSON.parse(fs.readFileSync(path.join(raiz,'package.json'),'utf8'));
if (pkg.type !== 'module') errores.push('package.json debe declarar "type": "module".');
for (const modulo of ['express','mongoose','multer','pug','express-session','dotenv']) {
  if (!pkg.dependencies?.[modulo]) errores.push(`Falta ${modulo} en package.json.`);
  try { require.resolve(modulo); } catch { errores.push(`Falta instalar ${modulo}; ejecutá npm install en tu proyecto.`); }
}
if (!/^mongodb(\+srv)?:\/\//i.test(String(process.env.MONGO_URI || ''))) {
  errores.push('Falta MONGO_URI o su formato no comienza con mongodb:// o mongodb+srv://.');
}
const secreto = String(process.env.SESSION_SECRET || '');
if (secreto.trim().length < 32) avisos.push('SESSION_SECRET ausente o menor de 32 caracteres. Configurá un secreto fuerte en .env.');
if (process.env.NODE_ENV === 'production') avisos.push('El módulo clínico está deshabilitado en producción (respuesta 503): es un prototipo.');
const privado = path.resolve(raiz, process.env.TF_CLINICA_PRIVATE_DIR || 'storage_privado/clinica');
const publico = path.resolve(raiz, 'public');
if (privado === publico || privado.startsWith(publico + path.sep)) errores.push('TF_CLINICA_PRIVATE_DIR está dentro de public/.');
for (const archivo of [
  'src/models/Usuario.js',
  'src/views/clinica/historia.pug',
  'src/views/clinica/evolucion-nueva.pug',
  'src/views/clinica/estudio-nuevo.pug',
  'src/views/layout.pug'
]) requerido(archivo);
console.log('TurnoFlex — comprobación local (sin conectarse a la base ni revelar credenciales)');
informar('Node.js y dependencias', !errores.some(e=>/Falta instalar|dependencies|package.json/.test(e)));
informar('Configuración MongoDB presente', /^mongodb(\+srv)?:\/\//i.test(String(process.env.MONGO_URI || '')));
informar('Almacenamiento privado', !(privado === publico || privado.startsWith(publico + path.sep)));
for (const aviso of avisos) console.warn('⚠️', aviso);
for (const error of errores) console.error('❌', error);
if (errores.length) {
  console.error(`Revisión incompleta: ${errores.length} punto(s) a corregir.`);
  process.exitCode = 1;
} else {
  console.log('✅ Verificación estructural completa. Todavía faltan las pruebas reales de rutas y permisos.');
}
