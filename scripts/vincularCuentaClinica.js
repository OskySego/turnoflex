import 'dotenv/config';
import mongoose from 'mongoose';
import { Usuario } from '../src/models/Usuario.js';
import { Cliente } from '../src/models/Cliente.js';
import { Profesional } from '../src/models/Profesional.js';

// Uso: node scripts/vincularCuentaClinica.js paciente USUARIO_ID PACIENTE_ID [--aplicar]
//      node scripts/vincularCuentaClinica.js medico USUARIO_ID PROFESIONAL_ID [--aplicar]
// Por defecto sólo muestra la validación; --aplicar guarda en BD de desarrollo.
const [tipo, usuarioId, fichaId, ...opciones] = process.argv.slice(2);
const valido = v => mongoose.isValidObjectId(v) && /^[0-9a-f]{24}$/i.test(String(v));
const aplicar = opciones.includes('--aplicar');
const uri = process.env.TF_CLINICA_MONGODB_URI;
if (!['paciente', 'medico'].includes(tipo) || !valido(usuarioId) || !valido(fichaId) ||
    opciones.some(x => x !== '--aplicar') || !uri) {
  console.error('Uso: TF_CLINICA_MONGODB_URI=<URI> node scripts/vincularCuentaClinica.js paciente|medico USUARIO_ID FICHA_ID [--aplicar]');
  console.error('La variable TF_CLINICA_MONGODB_URI debe apuntar exclusivamente a la base FICTICIA de desarrollo.');
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const usuario = await Usuario.findById(usuarioId).select('_id nombre email rol cliente_id profesional_id').lean();
    const esPaciente = tipo === 'paciente';
    const Modelo = esPaciente ? Cliente : Profesional;
    const esperado = esPaciente ? 'cliente' : 'profesional';
    const campo = esPaciente ? 'cliente_id' : 'profesional_id';
    const ficha = await Modelo.findById(fichaId).select('_id nombre email dni').lean();
    if (!usuario || !ficha) throw new Error('Cuenta o ficha inexistente; no se modificó nada.');
    if (usuario.rol !== esperado) throw new Error('Rol no coincide: no se modificó nada.');
    if (usuario[campo] && String(usuario[campo]) !== fichaId) {
      throw new Error('La cuenta ya está enlazada a otra ficha: no se modificó nada.');
    }
    const otro = await Usuario.exists({ _id: { $ne: usuarioId }, [campo]: ficha._id });
    if (otro) throw new Error('Otra cuenta ya está enlazada a esta ficha: no se modificó nada.');
    console.log('Cuenta:', usuario.nombre, usuario.email, '| rol:', usuario.rol, '| ID:', usuario._id);
    console.log('Ficha:', ficha.nombre, '| ID:', ficha._id, '| DNI:', ficha.dni || '(sin DNI)');
    console.log('Corroborá presencialmente que la cuenta y la ficha corresponden a la misma persona.');
    if (!aplicar) {
      console.log('SIMULACIÓN: no se guardó ningún cambio. Repetí con --aplicar solamente después de verificar.');
    } else {
      const actualizado = await Usuario.updateOne(
        { _id: usuarioId, rol: esperado, $or: [{ [campo]: null }, { [campo]: ficha._id }] },
        { $set: { [campo]: ficha._id } }
      );
      if (!actualizado.matchedCount) throw new Error('Cuenta cambió durante la operación; sin vinculación.');
      console.log('Vínculo de desarrollo guardado.');
    }
  } catch (error) {
    console.error('No se pudo vincular:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
