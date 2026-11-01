
import 'dotenv/config';
import mongoose from 'mongoose';
import readline from 'node:readline/promises';
import { stdin as entrada, stdout as salida } from 'node:process';

import { Usuario } from '../src/models/Usuario.js';
import { Profesional } from '../src/models/Profesional.js';
import { Turno } from '../src/models/Turno.js';

const pregunta = readline.createInterface({
  input: entrada,
  output: salida
});

const id = valor => String(valor?._id ?? valor ?? '');

const PACIENTE_PRUEBA = '6adec16324e1a2870974cae2';

try {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('No ejecutar en producción.');
  }

  if (!process.env.MONGO_URI) {
    throw new Error('Falta MONGO_URI en el archivo .env.');
  }

  if (!Usuario.schema.path('profesional_id')) {
    throw new Error(
      'El modelo Usuario no contiene profesional_id.'
    );
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 8000
  });

  console.log('\nBASE:', mongoose.connection.name);
  console.log('Herramienta para datos ficticios de prueba.\n');

  const email = (
    await pregunta.question(
      'Correo con el que inicia sesión el médico: '
    )
  ).trim().toLowerCase();

  const usuario = await Usuario.findOne({ email })
    .select('_id nombre email rol profesional_id')
    .lean();

  const profesional = await Profesional.findOne({ email })
    .select('_id nombre email matricula especialidad')
    .lean();

  if (!usuario || usuario.rol !== 'profesional') {
    throw new Error(
      'No se encontró una cuenta con rol profesional.'
    );
  }

  if (!profesional) {
    throw new Error(
      'No existe una ficha profesional con ese correo.'
    );
  }

  console.log('\n=== CUENTA DE USUARIO ===');
  console.log('Nombre:', usuario.nombre);
  console.log('ID:', id(usuario));
  console.log('Correo:', usuario.email);
  console.log('Rol:', usuario.rol);

  console.log('\n=== FICHA PROFESIONAL CANDIDATA ===');
  console.log('Nombre:', profesional.nombre);
  console.log('ID:', id(profesional));
  console.log('Matrícula:', profesional.matricula);
  console.log('Especialidad:', profesional.especialidad);

  const turnos = await Turno.countDocuments({
    cliente_id: PACIENTE_PRUEBA,
    profesional_id: profesional._id,
    estado: { $nin: ['cancelado', 'ausente'] }
  });

  console.log('\n=== COMPROBACIÓN DE TURNOS ===');
  console.log(
    'Turnos del médico con el paciente del error:',
    turnos
  );

  if (turnos === 0) {
    console.log(
      'ATENCIÓN: sin un turno asignado, la historia seguirá protegida.'
    );
  }

  const vinculoActual = id(usuario.profesional_id);

  if (vinculoActual) {
    if (vinculoActual === id(profesional)) {
      console.log(
        '\n✅ La cuenta YA está vinculada correctamente.'
      );
      console.log(
        'No se modificó nada. Si persiste el 403, revisaremos el turno.'
      );
    } else {
      console.log(
        '\n⚠️ La cuenta está vinculada con otro profesional:',
        vinculoActual
      );
      console.log('No se modificó nada.');
    }
  } else {
    const otraCuenta = await Usuario.findOne({
      _id: { $ne: usuario._id },
      profesional_id: profesional._id
    }).select('_id').lean();

    if (otraCuenta) {
      throw new Error(
        'La ficha profesional ya pertenece a otra cuenta.'
      );
    }

    console.log(
      '\n⚠️ Esta cuenta NO tiene profesional_id.'
    );

    console.log(
      'Verificá personalmente que ambos IDs y la matrícula corresponden al mismo médico ficticio.'
    );

    const confirmacion = (
      await pregunta.question(
        '\nSi verificaste esa identidad, escribí VINCULAR: '
      )
    ).trim();

    if (confirmacion !== 'VINCULAR') {
      console.log(
        '\nOperación cancelada. No se modificó nada.'
      );
    } else {
      const resultado = await Usuario.updateOne(
        {
          _id: usuario._id,
          rol: 'profesional',
          $or: [
            { profesional_id: { $exists: false } },
            { profesional_id: null }
          ]
        },
        {
          $set: {
            profesional_id: profesional._id
          }
        }
      );

      if (resultado.modifiedCount !== 1) {
        throw new Error(
          'No se pudo guardar el vínculo. Revisá la cuenta.'
        );
      }

      console.log('\n✅ VÍNCULO GUARDADO.');
      console.log(
        'Cerrá sesión y volvé a ingresar como médico.'
      );
    }
  }
} catch (error) {
  console.error('\nERROR:', error.message);
} finally {
  pregunta.close();
  await mongoose.disconnect();
}
